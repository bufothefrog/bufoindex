/**
 * One label table per input vocabulary. Wizard screens, calculator fields,
 * results and the dashboard read their option text from here, so a value is
 * spelled the same way everywhere ("Cash-flow investor" exists once).
 *
 * Each vocabulary exports its values (in display order), a value type, a
 * META record (label plus any per-value extras) and an OPTIONS list in the
 * { value, label, description? } shape every choice renderer takes. Pay
 * frequency lives in lib/constants/frequency.ts with its multipliers.
 *
 * Copy is descriptive, never prescriptive: descriptions say what a choice
 * does, not which one to pick.
 */

import { CONTRIBUTION_LIMITS_2026 } from './irs-2026';
import { LEVERAGE_RATIO_OPTIONS } from './leverage';
import { formatCurrency, formatMultiple } from '@/lib/format';

export interface ChoiceOption<V extends string | number = string> {
  value: V;
  label: string;
  /** Optional one-line explanation shown under the label. */
  description?: string;
}

export interface LabelMeta {
  label: string;
  description?: string;
}

function toOptions<V extends string>(
  values: readonly V[],
  meta: Record<V, LabelMeta>
): ReadonlyArray<ChoiceOption<V>> {
  return values.map((value) => {
    const { label, description } = meta[value];
    return description === undefined ? { value, label } : { value, label, description };
  });
}

/* ------------------------------------------------------------------ */
/* Filing status                                                      */
/* ------------------------------------------------------------------ */

export const FILING_STATUSES = ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold'] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

export interface FilingStatusMeta extends LabelMeta {
  /** Mid-sentence phrase: "30, TX, married filing jointly". */
  phrase: string;
}

export const FILING_STATUS_META: Record<FilingStatus, FilingStatusMeta> = {
  single: { label: 'Single', phrase: 'single' },
  marriedJoint: { label: 'Married filing jointly', phrase: 'married filing jointly' },
  marriedSeparate: { label: 'Married filing separately', phrase: 'married filing separately' },
  headOfHousehold: { label: 'Head of household', phrase: 'head of household' },
};

export const FILING_STATUS_OPTIONS = toOptions(FILING_STATUSES, FILING_STATUS_META);

/* ------------------------------------------------------------------ */
/* Bonus frequency                                                    */
/* ------------------------------------------------------------------ */

export const BONUS_FREQUENCIES = ['quarterly', 'annual', 'irregular'] as const;
export type BonusFrequency = (typeof BONUS_FREQUENCIES)[number];

export const BONUS_FREQUENCY_META: Record<BonusFrequency, LabelMeta> = {
  quarterly: { label: 'Quarterly' },
  annual: { label: 'Annual' },
  irregular: { label: 'Irregular', description: 'Averaged as one bonus a year.' },
};

export const BONUS_FREQUENCY_OPTIONS = toOptions(BONUS_FREQUENCIES, BONUS_FREQUENCY_META);

/* ------------------------------------------------------------------ */
/* Account type (portfolio rebalancer)                                */
/* ------------------------------------------------------------------ */

export const ACCOUNT_TYPES = ['taxable', 'tax-deferred', 'tax-free'] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_META: Record<AccountTypeValue, LabelMeta> = {
  taxable: { label: 'Taxable', description: 'Brokerage account.' },
  'tax-deferred': { label: 'Tax-Deferred', description: 'Traditional 401(k) or IRA.' },
  'tax-free': { label: 'Tax-Free', description: 'Roth 401(k), Roth IRA or HSA.' },
};

export const ACCOUNT_TYPE_OPTIONS = toOptions(ACCOUNT_TYPES, ACCOUNT_TYPE_META);

/* ------------------------------------------------------------------ */
/* Strategy preset                                                    */
/* ------------------------------------------------------------------ */

export const STRATEGY_PRESETS = ['standard', 'cashflow-investor'] as const;
export type StrategyPresetValue = (typeof STRATEGY_PRESETS)[number];

export const STRATEGY_PRESET_META: Record<StrategyPresetValue, LabelMeta> = {
  standard: {
    label: 'Standard',
    description: 'About 3 months of must-pay costs in cash, then unleveraged index funds.',
  },
  'cashflow-investor': {
    label: 'Cash-flow investor',
    description:
      'About 1 month in cash backed by a plan, automated contributions, and a leverage comparison for long horizons.',
  },
};

export const STRATEGY_PRESET_OPTIONS = toOptions(STRATEGY_PRESETS, STRATEGY_PRESET_META);

/* ------------------------------------------------------------------ */
/* Target stock/bond mix                                              */
/* ------------------------------------------------------------------ */

export const TARGET_MIXES = ['100-0', '80-20', '60-40'] as const;
export type TargetMix = (typeof TARGET_MIXES)[number];

export const TARGET_MIX_META: Record<TargetMix, LabelMeta> = {
  '100-0': { label: '100% stocks', description: 'The highest expected growth and the deepest drawdowns.' },
  '80-20': { label: '80% stocks, 20% bonds', description: 'Mostly stocks, with a bond cushion.' },
  '60-40': { label: '60% stocks, 40% bonds', description: 'Smaller swings and lower expected growth.' },
};

export const TARGET_MIX_OPTIONS = toOptions(TARGET_MIXES, TARGET_MIX_META);

/* ------------------------------------------------------------------ */
/* Risk tolerance (paycheck allocation ordering)                      */
/* ------------------------------------------------------------------ */

export const RISK_TOLERANCES = ['conservative', 'moderate', 'optimizer'] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

export const RISK_TOLERANCE_META: Record<RiskTolerance, LabelMeta> = {
  conservative: { label: 'Conservative', description: 'Traditional ordering.' },
  moderate: { label: 'Moderate', description: 'Balanced ordering.' },
  optimizer: { label: 'Optimizer', description: 'Highest after-tax return first.' },
};

export const RISK_TOLERANCE_OPTIONS = toOptions(RISK_TOLERANCES, RISK_TOLERANCE_META);

/* ------------------------------------------------------------------ */
/* Optimization goal (paycheck)                                       */
/* ------------------------------------------------------------------ */

export const OPTIMIZATION_GOALS = ['balanced', 'tax_minimization', 'wealth_maximization'] as const;
export type OptimizationGoal = (typeof OPTIMIZATION_GOALS)[number];

export const OPTIMIZATION_GOAL_META: Record<OptimizationGoal, LabelMeta> = {
  balanced: { label: 'Balanced' },
  tax_minimization: { label: 'Tax minimization' },
  wealth_maximization: { label: 'Wealth maximization' },
};

export const OPTIMIZATION_GOAL_OPTIONS = toOptions(OPTIMIZATION_GOALS, OPTIMIZATION_GOAL_META);

/* ------------------------------------------------------------------ */
/* HSA coverage                                                       */
/* ------------------------------------------------------------------ */

export const HSA_COVERAGES = ['individual', 'family'] as const;
export type HsaCoverage = (typeof HSA_COVERAGES)[number];

export interface HsaCoverageMeta extends LabelMeta {
  /** 2026 annual contribution limit (lib/constants/irs-2026.ts). */
  limit: number;
}

export const HSA_COVERAGE_META: Record<HsaCoverage, HsaCoverageMeta> = {
  individual: {
    label: 'Individual',
    limit: CONTRIBUTION_LIMITS_2026.hsa.individual,
    description: `${formatCurrency(CONTRIBUTION_LIMITS_2026.hsa.individual)} annual limit.`,
  },
  family: {
    label: 'Family',
    limit: CONTRIBUTION_LIMITS_2026.hsa.family,
    description: `${formatCurrency(CONTRIBUTION_LIMITS_2026.hsa.family)} annual limit.`,
  },
};

export const HSA_COVERAGE_OPTIONS = toOptions(HSA_COVERAGES, HSA_COVERAGE_META);

/* ------------------------------------------------------------------ */
/* 401(k) contribution type                                           */
/* ------------------------------------------------------------------ */

export const CONTRIBUTION_TYPES = ['traditional', 'roth', 'split'] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_TYPE_META: Record<ContributionType, LabelMeta> = {
  traditional: { label: 'Traditional (pre-tax)' },
  roth: { label: 'Roth (after-tax)' },
  split: { label: 'Split (traditional and Roth)' },
};

export const CONTRIBUTION_TYPE_OPTIONS = toOptions(CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_META);

/* ------------------------------------------------------------------ */
/* Leverage ratio                                                     */
/* ------------------------------------------------------------------ */

/** "1x", "2x", "1.5x": the one spelling of a leverage ratio. */
export function leverageRatioLabel(ratio: number): string {
  return formatMultiple(ratio);
}

/**
 * Choice options for the leverage ratio. Named CHOICES because
 * lib/constants/leverage.ts already exports LEVERAGE_RATIO_OPTIONS (the bare
 * ratios these are built from).
 */
export const LEVERAGE_RATIO_CHOICES: ReadonlyArray<ChoiceOption<number>> = LEVERAGE_RATIO_OPTIONS.map((ratio) =>
  ratio === 1
    ? { value: ratio, label: leverageRatioLabel(ratio), description: 'No leverage: the plain index fund.' }
    : { value: ratio, label: leverageRatioLabel(ratio), description: `A daily-reset fund at ${leverageRatioLabel(ratio)} the index.` }
);
