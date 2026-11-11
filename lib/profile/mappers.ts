/**
 * Pure mappers from the shared FinancialProfile to each calculator's input
 * model. No React, DOM, or storage access: every function here is a plain
 * transform. Until each calculator moves to its schema bindings
 * (lib/calculators/<id>/bindings.ts), these feed the URL-hash links in
 * lib/profile/links.ts and the dashboard. For a v1-shaped profile (every
 * v2-only field at its default) the output equals the v1 mappers' output.
 */

import { getDefaultProfile, updateLegacyIncomeFields } from '@/lib/calculations/core';
import {
  annualizeIncome,
  type IncomePeriod,
  type RetirementInputs,
} from '@/lib/calculations/retirement';
import type { ClassTarget, RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import { FREQUENCY_MULTIPLIERS } from '@/lib/constants/frequency';
import { LEVERAGE_INPUT_BOUNDS } from '@/lib/constants/leverage';
import type { PaycheckProfile } from '@/lib/types';
import { classTargetsForMix, PROFILE_FIELDS } from './defaults';
import { newCashDeposit } from './migrate';
import type { FilingStatus, FinancialProfile, PayFrequency } from './types';

/**
 * Paychecks per year, derived from the paychecks-per-month multipliers in
 * lib/constants/frequency.ts so both calculators annualize the same way
 * (weekly 52, bi-weekly 26, semi-monthly 24, monthly 12).
 */
export const PAYCHECKS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: Math.round(FREQUENCY_MULTIPLIERS.weekly * 12),
  'bi-weekly': Math.round(FREQUENCY_MULTIPLIERS['bi-weekly'] * 12),
  'semi-monthly': Math.round(FREQUENCY_MULTIPLIERS['semi-monthly'] * 12),
  monthly: Math.round(FREQUENCY_MULTIPLIERS.monthly * 12),
};

/**
 * The retirement calculator's income-period vocabulary has no weekly entry,
 * so weekly pay is annualized and entered as a yearly amount.
 */
const RETIREMENT_INCOME_PERIOD: Record<PayFrequency, IncomePeriod | null> = {
  weekly: null,
  'bi-weekly': 'biweekly',
  'semi-monthly': 'semimonthly',
  monthly: 'monthly',
};

/** Annual gross income implied by the per-paycheck gross and frequency. */
export function annualGrossIncome(profile: FinancialProfile): number {
  return profile.income.grossPerPaycheck * PAYCHECKS_PER_YEAR[profile.income.frequency];
}

/** Monthly gross income (gross per paycheck x paychecks per month). */
export function monthlyGrossIncome(profile: FinancialProfile): number {
  return profile.income.grossPerPaycheck * FREQUENCY_MULTIPLIERS[profile.income.frequency];
}

/** Monthly take-home pay (net per paycheck x paychecks per month). */
export function monthlyNetIncome(profile: FinancialProfile): number {
  return profile.income.netPerPaycheck * FREQUENCY_MULTIPLIERS[profile.income.frequency];
}

/** Filing statuses the retirement engine models directly. */
export type RetirementFilingStatus = RetirementInputs['filingStatus'];

/**
 * Retirement models single and married-filing-jointly brackets only (O10):
 * married-filing-jointly maps to itself; single, head of household and
 * married filing separately all use the single brackets.
 */
export function retirementFilingStatus(status: FilingStatus): RetirementFilingStatus {
  return status === 'marriedJoint' ? 'marriedJoint' : 'single';
}

/** True when retirement substitutes the single brackets for the user's status. */
export function isRetirementFilingStatusApproximated(status: FilingStatus): boolean {
  return status === 'marriedSeparate' || status === 'headOfHousehold';
}

/**
 * Profile -> retirement calculator inputs. Income is entered per paycheck
 * (O11); weekly pay is annualized and passed as a yearly amount because the
 * engine's income periods have no weekly entry.
 */
export function toRetirementInputs(profile: FinancialProfile): RetirementInputs {
  const { person, income, spending, investing, retirementIncome } = profile;
  const assumptions = profile.assumptions.retirement;
  const period = RETIREMENT_INCOME_PERIOD[income.frequency];
  const incomePeriod: IncomePeriod = period ?? 'yearly';
  const incomeAmount = period ? income.grossPerPaycheck : annualGrossIncome(profile);

  return {
    startingAge: person.age,
    retirementAge: person.retirementAge,
    lifeExpectancy: person.lifeExpectancy,
    targetIncome: spending.targetRetirementIncome,
    startingBalance: investing.investedBalance,
    currentIncome: annualizeIncome(incomeAmount, incomePeriod),
    incomeAmount,
    incomePeriod,
    monthlySavings: investing.monthlyContribution,
    necessaryMonthlyExpenses: spending.necessaryMonthly,
    accumulationReturn: assumptions.accumulationReturn,
    retirementReturn: assumptions.retirementReturn,
    inflationRate: assumptions.inflationRate,
    socialSecurityAge: retirementIncome.socialSecurityAge,
    socialSecurityBenefit: retirementIncome.socialSecurityBenefit,
    healthcareCostMultiplier: assumptions.healthcareCostMultiplier,
    volatility: assumptions.volatility,
    filingStatus: retirementFilingStatus(person.filingStatus),
    state: person.state,
    riskProfile: assumptions.riskProfile,
    effectiveTaxRate: assumptions.effectiveTaxRate,
    estimatedAnnualHealthcareCost: retirementIncome.annualHealthcareCost,
  };
}

/**
 * The 401(k) election split by contribution type (rebuild plan 2.5):
 * traditional puts the whole total in traditional, roth in Roth, and split
 * puts min(rothContributionPercent, total) in Roth and the rest in
 * traditional.
 */
export function split401kContribution(workplace: FinancialProfile['workplace']): {
  total: number;
  traditional: number;
  roth: number;
} {
  const total = workplace.contributionPercent;
  switch (workplace.contributionType) {
    case 'roth':
      return { total, traditional: 0, roth: total };
    case 'split': {
      const roth = Math.min(Math.max(workplace.rothContributionPercent, 0), total);
      return { total, traditional: total - roth, roth };
    }
    default:
      return { total, traditional: total, roth: 0 };
  }
}

/**
 * Profile -> paycheck allocator profile. Starts from the allocator's own
 * defaults (getDefaultProfile) for the engine-only inputs (federal bracket,
 * withholding, YTD amounts, other benefits, isPeakEarnings) and overrides
 * everything the profile holds.
 */
export function toPaycheckProfile(profile: FinancialProfile): PaycheckProfile {
  const base = getDefaultProfile();
  const { person, income, spending, cash, workplace, hsa, ira, investing } = profile;
  const assumptions = profile.assumptions.paycheck;
  const contribution = split401kContribution(workplace);

  return {
    ...base,
    income: updateLegacyIncomeFields({
      ...base.income,
      grossPaycheck: income.grossPerPaycheck,
      netPaycheck: income.netPerPaycheck,
      frequency: income.frequency,
      regularBonus: income.hasBonus,
      bonusAmount: income.bonusAmount,
      bonusFrequency: income.bonusFrequency,
    }),
    taxes: {
      ...base.taxes,
      state: person.state,
      filingStatus: person.filingStatus,
    },
    benefits: {
      ...base.benefits,
      employer401k: {
        ...base.benefits.employer401k,
        available: workplace.has401k,
        matchPercent: workplace.matchPercent,
        matchLimit: workplace.matchLimit,
        contributionType: workplace.contributionType,
        currentContribution: contribution.total,
        traditionalContribution: contribution.traditional,
        rothContribution: contribution.roth,
        afterTaxAvailable: workplace.afterTaxAvailable,
      },
      hsa: {
        ...base.benefits.hsa,
        eligible: hsa.eligible,
        coverageType: hsa.coverage,
        currentContribution: hsa.monthlyContribution,
        employerContribution: hsa.employerAnnualContribution,
        investmentStrategy: hsa.investing,
      },
      ira: {
        hasIRA: ira.traditional || ira.roth,
        accountTypes: { traditional: ira.traditional, roth: ira.roth },
        currentContributions: { traditional: ira.traditionalMonthly, roth: ira.rothMonthly },
        currentBalances: { traditional: ira.traditionalBalance, roth: ira.rothBalance },
      },
    },
    debts: profile.debts.map((debt) => ({ ...debt })),
    preferences: {
      ...base.preferences,
      age: person.age,
      necessaryExpenses: spending.necessaryMonthly,
      funMoney: {
        min: spending.funMoneyMin,
        max: spending.funMoneyMax,
        current: (spending.funMoneyMin + spending.funMoneyMax) / 2,
      },
      emergencyFundMonths: cash.targetMonths,
      currentEmergencyFund: cash.emergencyFundBalance,
      emergencyFundAPY: cash.emergencyFundApy,
      hasTaxableAccount: investing.taxableMonthlyContribution > 0,
      taxableAccountContribution: investing.taxableMonthlyContribution,
      riskTolerance: assumptions.riskTolerance,
      optimizationGoal: assumptions.optimizationGoal,
      expectedRetirementBracket: assumptions.expectedRetirementBracket,
    },
    // Deterministic (base stamps Date.now()); the codec does not carry it.
    lastUpdated: profile.updatedAt,
    source: 'imported',
  };
}

/**
 * Profile -> rebalancer inputs. Accounts, securities and holdings come from
 * portfolio.* (the worked example until the user edits them). Class targets
 * come from the stock/bond preset, or from portfolio.classTargets when the
 * mix is 'custom'. Negative or non-finite deposits deposit nothing.
 */
export function toRebalanceInputs(profile: FinancialProfile): RebalanceInputsV2 {
  const { portfolio } = profile;
  const settings = profile.assumptions.portfolio;
  const mix = profile.investing.targetMix;
  const classTargets: ClassTarget[] =
    mix === 'custom' ? portfolio.classTargets.map((t) => ({ ...t })) : classTargetsForMix(mix);

  return {
    setupMode: 'multi-shared',
    securities: portfolio.securities.map((s) => ({ ...s })),
    accounts: portfolio.accounts.map((a) => ({ ...a, deposit: newCashDeposit(a.deposit) })),
    holdings: portfolio.holdings.map((h) => ({ ...h })),
    classTargets,
    customAssetClasses: portfolio.customAssetClasses.map((c) => ({ ...c })),
    allowTaxableSelling: settings.allowTaxableSelling,
    showPlacementAdvice: settings.showPlacementAdvice,
    mode: settings.mode,
  };
}

function finiteOr(value: number | null, fallback: number): number {
  return value !== null && Number.isFinite(value) ? value : fallback;
}

/** The four leverage comparison inputs the profile seeds. */
export interface LeverageSeed {
  monthlyContribution: number;
  years: number;
  startingBalance: number;
  leverageRatio: number;
}

/**
 * Profile -> leverage comparison seed (rebuild plan 2.5). Each override in
 * profile.leverage wins when set; otherwise:
 *   monthly contribution = the taxable contribution, or the total monthly
 *     contribution when no taxable contribution is set
 *   years = years to retirement, rounded and clamped to
 *     LEVERAGE_INPUT_BOUNDS (1..60)
 *   starting balance = the invested balance
 * Non-finite values fall back to 0 (money), 1 (years) and 2 (ratio).
 */
export function leverageSeed(profile: FinancialProfile): LeverageSeed {
  const { person, investing, strategy, leverage } = profile;
  const taxable = finiteOr(investing.taxableMonthlyContribution, 0);
  const derivedContribution = taxable > 0 ? taxable : finiteOr(investing.monthlyContribution, 0);
  const rawYears = Math.round(finiteOr(person.retirementAge - person.age, LEVERAGE_INPUT_BOUNDS.minYears));
  const derivedYears = Math.min(LEVERAGE_INPUT_BOUNDS.maxYears, Math.max(LEVERAGE_INPUT_BOUNDS.minYears, rawYears));

  return {
    monthlyContribution: finiteOr(leverage.monthlyContribution, derivedContribution),
    years: finiteOr(leverage.years, derivedYears),
    startingBalance: finiteOr(leverage.startingBalance, finiteOr(investing.investedBalance, 0)),
    leverageRatio: finiteOr(strategy.leverageRatio, 2),
  };
}

/**
 * How many of the 25 v1 fields the user actually answered, and which ones
 * are still placeholders. Paths in `provided` that are not v1 fields are
 * ignored.
 *
 * @deprecated Replaced by profileCompleteness in lib/calculators/forms.ts
 * (counted by topic screen, O14). Removed in x1.
 */
export function profileCompleteness(profile: FinancialProfile): {
  provided: number;
  total: number;
  missing: { path: string; label: string }[];
} {
  const answered = new Set(profile.provided);
  const missing = PROFILE_FIELDS.filter((f) => !answered.has(f.path)).map(({ path, label }) => ({
    path,
    label,
  }));
  return {
    provided: PROFILE_FIELDS.length - missing.length,
    total: PROFILE_FIELDS.length,
    missing,
  };
}
