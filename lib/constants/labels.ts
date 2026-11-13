/**
 * One label table per answer vocabulary, so every select, choice group,
 * summary and result line spells a value the same way. Pay frequency lives
 * in ./frequency.ts next to its multipliers.
 *
 * Where older copies disagreed, the wording on the calculator page wins.
 */

import { formatMultiple } from '@/lib/format';
import { LEVERAGE_RATIO_OPTIONS } from './leverage';
import type { AccountType } from '@/lib/calculations/portfolioRebalancing';
import type {
  BonusFrequency,
  ContributionType,
  FilingStatus,
  HsaCoverage,
  OptimizationGoal,
  RiskTolerance,
  TargetMixPreset,
} from '@/lib/profile/types';

/** One entry of a select or choice group. */
export interface LabelOption<V extends string | number> {
  value: V;
  label: string;
  /** Optional one-line explanation shown under the label. */
  description?: string;
}

function optionsFrom<V extends string>(
  order: readonly V[],
  labels: Readonly<Record<V, string>>,
): readonly LabelOption<V>[] {
  return order.map((value) => ({ value, label: labels[value] }));
}

// ---------------------------------------------------------------------------
// Filing status
// ---------------------------------------------------------------------------

export interface FilingStatusMeta {
  /** Select-option and heading text. */
  label: string;
  /** In-sentence text, e.g. "30, TX, married filing jointly". */
  phrase: string;
}

export const FILING_STATUS_META: Readonly<Record<FilingStatus, FilingStatusMeta>> = {
  single: { label: 'Single', phrase: 'single' },
  marriedJoint: { label: 'Married Filing Jointly', phrase: 'married filing jointly' },
  marriedSeparate: { label: 'Married Filing Separately', phrase: 'married filing separately' },
  headOfHousehold: { label: 'Head of Household', phrase: 'head of household' },
};

export const FILING_STATUS_OPTIONS: readonly LabelOption<FilingStatus>[] = (
  ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold'] as const
).map((value) => ({ value, label: FILING_STATUS_META[value].label }));

// ---------------------------------------------------------------------------
// Bonus frequency
// ---------------------------------------------------------------------------

export const BONUS_FREQUENCY_LABELS: Readonly<Record<BonusFrequency, string>> = {
  quarterly: 'Quarterly',
  annual: 'Annual',
  irregular: 'Irregular',
};

export const BONUS_FREQUENCY_OPTIONS = optionsFrom<BonusFrequency>(
  ['quarterly', 'annual', 'irregular'],
  BONUS_FREQUENCY_LABELS,
);

// ---------------------------------------------------------------------------
// Account type (portfolio rebalancer)
// ---------------------------------------------------------------------------

/** Title case; lower-case it for in-sentence use ("in your tax-deferred account"). */
export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  taxable: 'Taxable',
  'tax-deferred': 'Tax-Deferred',
  'tax-free': 'Tax-Free',
};

export const ACCOUNT_TYPE_OPTIONS = optionsFrom<AccountType>(
  ['taxable', 'tax-deferred', 'tax-free'],
  ACCOUNT_TYPE_LABELS,
);

// ---------------------------------------------------------------------------
// Target mix
// ---------------------------------------------------------------------------

export const TARGET_MIX_LABELS: Readonly<Record<TargetMixPreset, string>> = {
  '100-0': '100% stocks',
  '80-20': '80% stocks, 20% bonds',
  '60-40': '60% stocks, 40% bonds',
  custom: 'Custom',
};

export const TARGET_MIX_OPTIONS: readonly LabelOption<TargetMixPreset>[] = [
  { value: '100-0', label: TARGET_MIX_LABELS['100-0'] },
  { value: '80-20', label: TARGET_MIX_LABELS['80-20'] },
  { value: '60-40', label: TARGET_MIX_LABELS['60-40'] },
  { value: 'custom', label: TARGET_MIX_LABELS.custom, description: 'Set a target for each asset class.' },
];

// ---------------------------------------------------------------------------
// Paycheck allocator assumptions
// ---------------------------------------------------------------------------

export const RISK_TOLERANCE_LABELS: Readonly<Record<RiskTolerance, string>> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  optimizer: 'Optimizer',
};

/** The option text adds the ordering each setting applies. */
export const RISK_TOLERANCE_OPTIONS: readonly LabelOption<RiskTolerance>[] = [
  { value: 'conservative', label: `${RISK_TOLERANCE_LABELS.conservative} (traditional ordering)` },
  { value: 'moderate', label: `${RISK_TOLERANCE_LABELS.moderate} (balanced ordering)` },
  { value: 'optimizer', label: `${RISK_TOLERANCE_LABELS.optimizer} (highest after-tax return first)` },
];

export const OPTIMIZATION_GOAL_LABELS: Readonly<Record<OptimizationGoal, string>> = {
  balanced: 'Balanced',
  tax_minimization: 'Tax Minimization',
  wealth_maximization: 'Wealth Maximization',
};

export const OPTIMIZATION_GOAL_OPTIONS = optionsFrom<OptimizationGoal>(
  ['balanced', 'tax_minimization', 'wealth_maximization'],
  OPTIMIZATION_GOAL_LABELS,
);

// ---------------------------------------------------------------------------
// HSA coverage and 401(k) contribution type
// ---------------------------------------------------------------------------

export const HSA_COVERAGE_LABELS: Readonly<Record<HsaCoverage, string>> = {
  individual: 'Individual',
  family: 'Family',
};

/**
 * Plain labels: the annual limit is stated once, as the help line of the
 * monthly HSA contribution (lib/calculators/paycheck/fields.ts).
 */
export const HSA_COVERAGE_OPTIONS = optionsFrom<HsaCoverage>(['individual', 'family'], HSA_COVERAGE_LABELS);

export const CONTRIBUTION_TYPE_LABELS: Readonly<Record<ContributionType, string>> = {
  traditional: 'Traditional (Pre-tax)',
  roth: 'Roth (After-tax)',
  split: 'Split (Both Traditional & Roth)',
};

export const CONTRIBUTION_TYPE_OPTIONS = optionsFrom<ContributionType>(
  ['traditional', 'roth', 'split'],
  CONTRIBUTION_TYPE_LABELS,
);

// ---------------------------------------------------------------------------
// Leverage ratio
// ---------------------------------------------------------------------------

/** Labels for the ratios offered in the calculator (LEVERAGE_RATIO_OPTIONS). */
export const LEVERAGE_RATIO_LABELS: Readonly<Record<number, string>> = {
  1: '1x (index exposure, leveraged-fund fees)',
  2: '2x (SSO-like daily-reset fund)',
  3: '3x (UPRO-like daily-reset fund)',
};

/** Label for any ratio; one without its own label reads "2.5x daily-reset fund". */
export function leverageRatioLabel(ratio: number): string {
  return LEVERAGE_RATIO_LABELS[ratio] ?? `${formatMultiple(ratio)} daily-reset fund`;
}

/**
 * Options for the offered ratios, plus `current` in sorted position when it
 * is not one of them (a profile can hold any ratio within the bounds).
 */
export function leverageRatioOptions(current?: number): readonly LabelOption<number>[] {
  const ratios: number[] = [...LEVERAGE_RATIO_OPTIONS];
  if (current !== undefined && !ratios.includes(current)) {
    ratios.push(current);
    ratios.sort((a, b) => a - b);
  }
  return ratios.map((value) => ({ value, label: leverageRatioLabel(value) }));
}
