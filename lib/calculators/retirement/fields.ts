/**
 * Field specs only the retirement calculator asks (docs/rebuild-plan.md
 * section 2.14): the retirement target, Social Security and healthcare, and
 * the model assumptions. The facts other forms also ask come from
 * lib/fields/shared.ts. Pure.
 *
 * Bounds follow plan section 2.3: life expectancy 50-110 and at least the
 * retirement age, Social Security from 62 to 70, and the assumption bounds
 * of the calculator's sliders.
 */

import {
  calculateEffectiveTaxRate,
  calculateTDFAllocation,
  calculateTDFReturnForAge,
  calculateTDFVolatilityForAge,
} from '@/lib/calculations/retirement';
import { CONTRIBUTION_TIMING_LABELS } from '@/lib/constants/labels';
import { RetirementConstants } from '@/lib/constants/retirement';
import { formatCurrency, formatPercent } from '@/lib/format';
import { AGE, FILING_STATUS, RETIREMENT_AGE } from '@/lib/fields/shared';
import { isFiniteNumber } from '@/lib/fields/runtime';
import type { CrossFieldRule, FieldOption, FieldSpec, Get, Write } from '@/lib/fields/types';
import type { FilingStatus } from '@/lib/profile/types';
import { retirementFilingStatus } from './bindings';
import { SOCIAL_SECURITY_AGE_PATH, claimingAgeLabel } from './claiming';
import { SOCIAL_SECURITY_BENEFIT_PATH, estimatedSocialSecurityBenefit } from './socialSecurity';

const RISK_PROFILE_PATH = 'assumptions.retirement.riskProfile';

const num = (get: Get, path: string): number => get(path) as number;

const isCustomProfile = (get: Get): boolean => get(RISK_PROFILE_PATH) === 'custom';

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

export const TARGET_RETIREMENT_INCOME: FieldSpec = {
  path: 'spending.targetRetirementIncome',
  kind: 'money',
  label: 'Target annual income in retirement',
  help: (get) => {
    const years = num(get, RETIREMENT_AGE.path) - num(get, AGE.path);
    const inflation = num(get, 'assumptions.retirement.inflationRate');
    const future = num(get, 'spending.targetRetirementIncome') * Math.pow(1 + inflation, years);
    return `That's ${formatCurrency(Math.round(future))} in future dollars`;
  },
  min: 0,
  tier: 'details',
  summary: (value) => `${formatCurrency(value as number)}/yr target`,
};

export const LIFE_EXPECTANCY: FieldSpec = {
  path: 'person.lifeExpectancy',
  kind: 'number',
  label: 'Life expectancy',
  hint: 'ssa.gov has a life expectancy calculator by birth date and sex.',
  min: 50,
  max: RetirementConstants.MAX_LIFE_EXPECTANCY,
  step: 1,
  unit: { suffix: ' years' },
  tier: 'details',
  summary: (value) => `plan to age ${value as number}`,
};

/** The projection runs to the life expectancy, so it cannot end before retirement. */
export const LIFE_EXPECTANCY_AFTER_RETIREMENT: CrossFieldRule = {
  lower: RETIREMENT_AGE.path,
  upper: LIFE_EXPECTANCY.path,
  strict: false,
  checkOn: LIFE_EXPECTANCY.path,
  message: 'Life expectancy needs to be at least your retirement age.',
};

// ---------------------------------------------------------------------------
// Contribution timing (calculator-only, on the Monthly investing card)
// ---------------------------------------------------------------------------

/** A finite number of 0 or more, else 0. */
const nonNegative = (value: unknown): number => (isFiniteNumber(value) ? Math.max(0, value) : 0);

/** Auto monthly investing: timing applies only then (a Custom figure is all monthly). */
const isAutoInvesting = (get: Get): boolean => !isFiniteNumber(get('investing.monthlyContribution'));

/**
 * One timing choice for a part of Auto monthly investing: 'Monthly', or
 * 'Once a year, at the start: $X' with X = 12 x the part's monthly amount.
 * Shown while Auto is on and the part is in use (yearStartInvesting in
 * lib/profile/accounts.ts reads the leaf).
 */
function timingField(path: string, label: string, amountPath: string, inUse: (get: Get) => boolean): FieldSpec {
  return {
    path,
    kind: 'choice',
    label,
    options: (get) => [
      { value: 'monthly', label: CONTRIBUTION_TIMING_LABELS.monthly },
      {
        value: 'yearStart',
        label: `${CONTRIBUTION_TIMING_LABELS.yearStart}: ${formatCurrency(12 * nonNegative(get(amountPath)))}`,
      },
    ],
    tier: 'details',
    visibleWhen: (get) => isAutoInvesting(get) && inUse(get),
    summary: (value) => (value === 'yearStart' ? `${label} once a year, at the start` : null),
  };
}

export const IRA_TRADITIONAL_TIMING: FieldSpec = timingField(
  'ira.traditionalTiming',
  'Traditional IRA',
  'ira.traditionalMonthly',
  (get) => get('ira.traditional') === true && nonNegative(get('ira.traditionalMonthly')) > 0
);

export const IRA_ROTH_TIMING: FieldSpec = timingField(
  'ira.rothTiming',
  'Roth IRA',
  'ira.rothMonthly',
  (get) => get('ira.roth') === true && nonNegative(get('ira.rothMonthly')) > 0
);

export const TAXABLE_TIMING: FieldSpec = timingField(
  'investing.taxableTiming',
  'Taxable investing',
  'investing.taxableMonthlyContribution',
  (get) => nonNegative(get('investing.taxableMonthlyContribution')) > 0
);

// ---------------------------------------------------------------------------
// Social Security and healthcare
// ---------------------------------------------------------------------------

/**
 * The benefit at full retirement age. Auto (null, the default) is an estimate
 * from pay (./socialSecurity.ts), which is also where an override starts; the
 * Auto label and the summary say "estimate", so it never reads as the
 * visitor's own number.
 */
export const SOCIAL_SECURITY_BENEFIT: FieldSpec = {
  path: SOCIAL_SECURITY_BENEFIT_PATH,
  kind: 'money',
  label: 'Social Security benefit',
  hint: 'A yearly amount; ssa.gov/myaccount shows your estimate.',
  min: 0,
  nullable: { autoLabel: 'Estimate from your pay', overrideDefault: estimatedSocialSecurityBenefit },
  tier: 'details',
  summary: (value, get) =>
    value === null
      ? `Social Security estimate ${formatCurrency(estimatedSocialSecurityBenefit(get))}/yr`
      : `Social Security ${formatCurrency(value as number)}/yr`,
};

/** Renderer id of the claiming-age control (components/calculators/renderers/retirement.tsx). */
export const CLAIMING_AGE_RENDERER = 'socialSecurityClaiming';

/**
 * The claiming age, a calculator-only control: three choices (62, 67, 70)
 * next to a table of the yearly benefit at each (./claiming.ts). The stored
 * age may be any whole age in the bounds; the control shows the nearest
 * choice.
 */
export const SOCIAL_SECURITY_AGE: FieldSpec = {
  path: SOCIAL_SECURITY_AGE_PATH,
  kind: 'custom',
  renderer: CLAIMING_AGE_RENDERER,
  label: 'Social Security claiming age',
  min: RetirementConstants.SS_MIN_AGE,
  max: RetirementConstants.SS_MAX_AGE,
  tier: 'details',
  summary: (value) => `claim at ${claimingAgeLabel(value)}`,
};

export const ANNUAL_HEALTHCARE_COST: FieldSpec = {
  path: 'retirementIncome.annualHealthcareCost',
  kind: 'money',
  label: 'Annual healthcare cost',
  help: 'Premiums plus out-of-pocket costs for a year.',
  placeholder: '7,500',
  min: 0,
  // null runs the model's own base cost, which is also where an override starts.
  nullable: { autoLabel: 'Typical cost the model uses', overrideDefault: RetirementConstants.HEALTHCARE_BASE_COST },
  tier: 'details',
  summary: (value) => (value === null ? 'typical healthcare cost' : `${formatCurrency(value as number)}/yr healthcare`),
};

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

/** What the target-date glide path uses at `age`, as the risk-profile choice shows it. */
export interface TdfProfile {
  /** Stock share of the allocation at `age`. */
  stocks: number;
  accumulationReturn: number;
  /** The glide-path return about 30 years ahead, a retirement-phase figure. */
  retirementReturn: number;
  volatility: number;
}

export function tdfProfileFor(age: number): TdfProfile {
  return {
    stocks: calculateTDFAllocation(age).stocks,
    accumulationReturn: calculateTDFReturnForAge(age),
    retirementReturn: calculateTDFReturnForAge(Math.min(100, age + 30)),
    volatility: calculateTDFVolatilityForAge(age),
  };
}

const ACCUMULATION_RETURN_PATH = 'assumptions.retirement.accumulationReturn';
const RETIREMENT_RETURN_PATH = 'assumptions.retirement.retirementReturn';
const VOLATILITY_PATH = 'assumptions.retirement.volatility';

const wholePercent = (fraction: number) => formatPercent(fraction, { digits: 0 });

function riskProfileOptions(get: Get): readonly FieldOption[] {
  const tdf = tdfProfileFor(num(get, AGE.path));
  return [
    {
      value: 'tdf',
      label: 'Target Date Fund',
      description: `Age-based: ${wholePercent(tdf.stocks)} stocks, ${wholePercent(tdf.accumulationReturn)} / ${wholePercent(tdf.retirementReturn)} returns`,
    },
    { value: 'custom', label: 'Custom' },
  ];
}

export const RISK_PROFILE: FieldSpec = {
  path: RISK_PROFILE_PATH,
  kind: 'choice',
  label: 'Risk profile',
  options: riskProfileOptions,
  tier: 'assumption',
  // Choosing the glide path fills the custom inputs with its figures for the
  // current age, so switching back to Custom starts from them.
  onChange: (value, get): Write[] => {
    if (value !== 'tdf') return [];
    const tdf = tdfProfileFor(num(get, AGE.path));
    return [
      { path: ACCUMULATION_RETURN_PATH, value: tdf.accumulationReturn },
      { path: RETIREMENT_RETURN_PATH, value: tdf.retirementReturn },
      { path: VOLATILITY_PATH, value: tdf.volatility },
    ];
  },
  summary: (value, get) =>
    value === 'tdf'
      ? 'Target-date glide path'
      : `${formatPercent(num(get, ACCUMULATION_RETURN_PATH))} / ${formatPercent(num(get, RETIREMENT_RETURN_PATH))} returns, ${formatPercent(num(get, VOLATILITY_PATH))} volatility`,
};

export const ACCUMULATION_RETURN: FieldSpec = {
  path: ACCUMULATION_RETURN_PATH,
  kind: 'percent',
  label: 'Accumulation return',
  help: 'Nominal (before inflation) annual return while saving',
  min: 0,
  max: 0.25,
  step: 0.001,
  precision: 2,
  slider: true,
  tier: 'assumption',
  visibleWhen: isCustomProfile,
};

export const RETIREMENT_RETURN: FieldSpec = {
  path: RETIREMENT_RETURN_PATH,
  kind: 'percent',
  label: 'Retirement return',
  help: 'Nominal (before inflation) annual return after retiring',
  min: 0,
  max: 0.25,
  step: 0.001,
  precision: 2,
  slider: true,
  tier: 'assumption',
  visibleWhen: isCustomProfile,
};

export const VOLATILITY: FieldSpec = {
  path: VOLATILITY_PATH,
  kind: 'percent',
  label: 'Portfolio volatility',
  help: 'Annual standard deviation of returns',
  min: 0.05,
  max: 0.25,
  step: 0.005,
  precision: 2,
  slider: true,
  tier: 'assumption',
  visibleWhen: isCustomProfile,
};

export const INFLATION_RATE: FieldSpec = {
  path: 'assumptions.retirement.inflationRate',
  kind: 'percent',
  label: 'Inflation rate',
  min: 0.01,
  max: 0.05,
  step: 0.001,
  precision: 2,
  slider: true,
  tier: 'assumption',
  summary: (value) => `${formatPercent(value as number)} inflation`,
};

/**
 * The rate the model estimates when the tax rate is left on auto: the
 * effective federal rate on the target income for the filing status the
 * model runs (the base plan's withdrawal; other scenarios estimate their own).
 */
function estimatedEffectiveTaxRate(get: Get): number {
  return calculateEffectiveTaxRate(
    num(get, TARGET_RETIREMENT_INCOME.path),
    retirementFilingStatus(get(FILING_STATUS.path) as FilingStatus)
  );
}

export const EFFECTIVE_TAX_RATE: FieldSpec = {
  path: 'assumptions.retirement.effectiveTaxRate',
  kind: 'percent',
  label: 'Effective tax rate',
  min: 0,
  max: 0.4,
  step: 0.01,
  precision: 2,
  slider: true,
  nullable: {
    autoLabel: 'Estimated from your target income and filing status',
    overrideDefault: estimatedEffectiveTaxRate,
  },
  tier: 'assumption',
  summary: (value) => (value === null ? 'tax rate estimated from income' : `${formatPercent(value as number)} tax rate`),
};

export const HEALTHCARE_COST_MULTIPLIER: FieldSpec = {
  path: 'assumptions.retirement.healthcareCostMultiplier',
  kind: 'slider',
  label: 'Healthcare cost multiplier',
  // The old calculator's readout under the slider, word for word.
  help: (get) => `${num(get, 'assumptions.retirement.healthcareCostMultiplier')}x average cost`,
  min: 0.5,
  max: 3,
  step: 0.1,
  unit: { suffix: 'x' },
  tier: 'assumption',
  summary: (value) => `${value as number}x healthcare`,
};
