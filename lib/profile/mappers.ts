/**
 * Pure mappers from the shared FinancialProfile to each calculator's input
 * model. No React, DOM, or storage access: every function here is a plain
 * transform so the calculators can be seeded through their existing URL-hash
 * codecs (see lib/profile/links.ts) without touching their stores.
 */

import { getDefaultProfile, updateLegacyIncomeFields } from '@/lib/calculations/core';
import {
  annualizeIncome,
  type IncomePeriod,
  type RetirementInputs,
} from '@/lib/calculations/retirement';
import type { ClassTarget, RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import { FREQUENCY_MULTIPLIERS } from '@/lib/constants/frequency';
import { RetirementConstants } from '@/lib/constants/retirement';
import type { PaycheckProfile } from '@/lib/types';
import { PROFILE_FIELDS } from './defaults';
import type { FinancialProfile, PayFrequency, TargetMixPreset } from './types';

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
 * Profile -> retirement calculator inputs. Fields the profile does not carry
 * use the retirement store's own defaults (mirrored from getDefaultInputs in
 * lib/store/retirementStore.ts, which is not imported so this stays pure).
 */
export function toRetirementInputs(profile: FinancialProfile): RetirementInputs {
  const { person, income, spending, investing } = profile;
  const period = RETIREMENT_INCOME_PERIOD[income.frequency];
  const incomePeriod: IncomePeriod = period ?? 'yearly';
  const incomeAmount = period ? income.grossPerPaycheck : annualGrossIncome(profile);

  return {
    startingAge: person.age,
    retirementAge: person.retirementAge,
    lifeExpectancy: 85,
    targetIncome: spending.targetRetirementIncome,
    startingBalance: investing.investedBalance,
    currentIncome: annualizeIncome(incomeAmount, incomePeriod),
    incomeAmount,
    incomePeriod,
    monthlySavings: investing.monthlyContribution,
    necessaryMonthlyExpenses: spending.necessaryMonthly,
    accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
    retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
    inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
    socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
    socialSecurityBenefit: 30000,
    healthcareCostMultiplier: 1,
    volatility: RetirementConstants.DEFAULT_VOLATILITY,
    filingStatus: person.filingStatus,
    state: person.state,
    riskProfile: 'tdf',
    effectiveTaxRate: null,
    estimatedAnnualHealthcareCost: null,
  };
}

/**
 * Profile -> paycheck allocator profile. Starts from the allocator's own
 * defaults (getDefaultProfile) and overrides only what the profile knows.
 */
export function toPaycheckProfile(profile: FinancialProfile): PaycheckProfile {
  const base = getDefaultProfile();
  const { person, income, spending, cash, workplace, investing } = profile;

  return {
    ...base,
    income: updateLegacyIncomeFields({
      ...base.income,
      grossPaycheck: income.grossPerPaycheck,
      netPaycheck: income.netPerPaycheck,
      frequency: income.frequency,
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
        currentContribution: workplace.contributionPercent,
        traditionalContribution: workplace.contributionPercent,
      },
    },
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
    },
    // Deterministic (base stamps Date.now()); the codec does not carry it.
    lastUpdated: profile.updatedAt,
    source: 'imported',
  };
}

/** Portfolio-wide class weights for each stock/bond mix preset. */
export const TARGET_MIX_WEIGHTS: Record<
  TargetMixPreset,
  { 'us-stock': number; 'intl-stock': number; bonds: number; cash: number }
> = {
  '100-0': { 'us-stock': 0.75, 'intl-stock': 0.25, bonds: 0, cash: 0 },
  '80-20': { 'us-stock': 0.6, 'intl-stock': 0.2, bonds: 0.2, cash: 0 },
  '60-40': { 'us-stock': 0.45, 'intl-stock': 0.15, bonds: 0.4, cash: 0 },
};

/**
 * Profile -> rebalancer inputs. Reuses the rebalancer's three-fund worked
 * example (mirrored from defaultInputs in lib/store/portfolioRebalancingStore.ts)
 * with the profile's target mix and this month's new cash deposited into the
 * Brokerage account. The holdings stay illustrative until the user edits them
 * in the rebalancer itself.
 */
export function toRebalanceInputs(profile: FinancialProfile): RebalanceInputsV2 {
  const weights = TARGET_MIX_WEIGHTS[profile.investing.targetMix];
  const newCash = profile.investing.newCashThisMonth;
  const deposit = Number.isFinite(newCash) && newCash > 0 ? newCash : 0;
  const classTargets: ClassTarget[] = [
    { accountId: null, assetClass: 'us-stock', target: weights['us-stock'] },
    { accountId: null, assetClass: 'intl-stock', target: weights['intl-stock'] },
    { accountId: null, assetClass: 'bonds', target: weights.bonds },
    { accountId: null, assetClass: 'cash', target: weights.cash },
  ];

  return {
    setupMode: 'multi-shared',
    securities: [
      { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
      { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 60, assetClass: 'intl-stock' },
      { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 75, assetClass: 'bonds' },
    ],
    accounts: [
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit },
    ],
    holdings: [
      { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
      { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
      { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
      { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
    ],
    classTargets,
    customAssetClasses: [],
    allowTaxableSelling: false,
    showPlacementAdvice: true,
    mode: 'whole',
  };
}

/**
 * How many of the user-editable fields the user actually answered, and which
 * ones are still placeholders. Paths in `provided` that are not known fields
 * are ignored.
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
