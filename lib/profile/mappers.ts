/**
 * Pure mappers from the shared FinancialProfile to each calculator's input
 * model. No React, DOM, or storage access: every function here is a plain
 * transform so the calculators can be seeded through their existing URL-hash
 * codecs (see lib/profile/links.ts) without touching their stores. The
 * calculator bindings (lib/calculators/<id>/bindings.ts) replace these from
 * the calculator slices on; slice x1 deletes them.
 */

import { getDefaultProfile, updateLegacyIncomeFields } from '@/lib/calculations/core';
import {
  annualizeIncome,
  type IncomePeriod,
  type RetirementInputs,
} from '@/lib/calculations/retirement';
import type { RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import { FREQUENCY_MULTIPLIERS } from '@/lib/constants/frequency';
import type { PaycheckProfile } from '@/lib/types';
import { presetClassTargets, PROFILE_FIELDS } from './defaults';
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

/**
 * The retirement model knows single and joint filing only; the other two
 * statuses run as single (owner decision O10).
 */
function retirementFilingStatus(status: FilingStatus): RetirementInputs['filingStatus'] {
  return status === 'marriedJoint' ? 'marriedJoint' : 'single';
}

/** Profile -> retirement calculator inputs. */
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
 * The 401(k) election split by contribution type: the whole contribution is
 * traditional or Roth, or for 'split' the Roth part (capped at the total)
 * and the rest traditional.
 */
function split401k(workplace: FinancialProfile['workplace']): { traditional: number; roth: number } {
  const total = workplace.contributionPercent;
  if (workplace.contributionType === 'roth') return { traditional: 0, roth: total };
  if (workplace.contributionType === 'split') {
    const roth = Math.min(workplace.rothContributionPercent, total);
    return { traditional: total - roth, roth };
  }
  return { traditional: total, roth: 0 };
}

/**
 * Profile -> paycheck allocator profile. Starts from the allocator's own
 * defaults (getDefaultProfile) for the engine-only fields (federal bracket,
 * withholding, year-to-date amounts, other benefits, isPeakEarnings) and
 * takes everything else from the profile.
 */
export function toPaycheckProfile(profile: FinancialProfile): PaycheckProfile {
  const base = getDefaultProfile();
  const { person, income, spending, cash, workplace, hsa, ira, investing } = profile;
  const assumptions = profile.assumptions.paycheck;
  const election = split401k(workplace);

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
        currentContribution: workplace.contributionPercent,
        traditionalContribution: election.traditional,
        rothContribution: election.roth,
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
 * Profile -> rebalancer inputs. Accounts (with their deposits), securities
 * and holdings come from the portfolio lists. A preset target mix sets the
 * portfolio-wide TARGET_MIX_WEIGHTS; 'custom' uses portfolio.classTargets.
 */
export function toRebalanceInputs(profile: FinancialProfile): RebalanceInputsV2 {
  const { portfolio, investing } = profile;
  const settings = profile.assumptions.portfolio;
  const classTargets =
    investing.targetMix === 'custom'
      ? portfolio.classTargets.map((target) => ({ ...target }))
      : presetClassTargets(investing.targetMix);

  return {
    setupMode: 'multi-shared',
    securities: portfolio.securities.map((security) => ({ ...security })),
    accounts: portfolio.accounts.map((account) => ({ ...account })),
    holdings: portfolio.holdings.map((holding) => ({ ...holding })),
    classTargets,
    customAssetClasses: portfolio.customAssetClasses.map((custom) => ({ ...custom })),
    allowTaxableSelling: settings.allowTaxableSelling,
    showPlacementAdvice: settings.showPlacementAdvice,
    mode: settings.mode,
  };
}

/**
 * How many of the 25 v1 fields the user actually answered, and which ones
 * are still placeholders. Paths in `provided` that are not v1 fields are
 * ignored.
 *
 * @deprecated Slice w1 counts completeness by topic screen
 * (lib/calculators/forms.ts). Kept for its current callers until slice x1.
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
