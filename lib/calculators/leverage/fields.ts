/**
 * Field specs only the leverage comparison asks: the three nullable
 * overrides and the leverage ratio (the comparison screen), and the five
 * market assumptions. Facts other forms also ask come from
 * lib/fields/shared.ts. Wording and bounds are the calculator's, from
 * before the rebuild.
 */

import { LEVERAGE_INPUT_BOUNDS, LEVERAGE_RATIO_OPTIONS } from '@/lib/constants/leverage';
import { leverageRatioOptions } from '@/lib/constants/labels';
import type { FieldSpec, Get } from '@/lib/fields/types';
import { formatCurrency, formatMultiple, formatPercent } from '@/lib/format';
import {
  LEVERAGE_RATIO_PATH,
  MONTHLY_CONTRIBUTION_PATH,
  STARTING_BALANCE_PATH,
  YEARS_PATH,
  derivedMonthlyContribution,
  derivedStartingBalance,
  derivedYears,
  usesTaxableContribution,
} from './bindings';

const BOUNDS = LEVERAGE_INPUT_BOUNDS;

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The leverage ratio the profile holds, for labels that name the fund ("2x"). */
function ratioLabel(get: Get): string {
  const ratio = get(LEVERAGE_RATIO_PATH);
  return formatMultiple(isNumber(ratio) ? ratio : 0);
}

/** A nullable field's summary: its override, or the value it derives. */
function overrideSummary(derive: (get: Get) => number, format: (value: number) => string) {
  return (value: unknown, get: Get): string => format(isNumber(value) ? value : derive(get));
}

// ---------------------------------------------------------------------------
// Comparison (calculator surface)
// ---------------------------------------------------------------------------

export const MONTHLY_CONTRIBUTION: FieldSpec = {
  path: MONTHLY_CONTRIBUTION_PATH,
  kind: 'money',
  label: 'Monthly contribution',
  help: 'Invested at the start of every month, in both funds.',
  min: 0,
  max: BOUNDS.maxMonthlyContribution,
  nullable: {
    autoLabel: (get) =>
      usesTaxableContribution(get) ? 'Your monthly taxable contribution' : 'Your monthly investing contribution',
    overrideDefault: derivedMonthlyContribution,
  },
  tier: 'details',
  summary: overrideSummary(derivedMonthlyContribution, (value) => `${formatCurrency(value)}/mo`),
};

export const YEARS: FieldSpec = {
  path: YEARS_PATH,
  kind: 'number',
  label: 'Years',
  help: `${BOUNDS.minYears} to ${BOUNDS.maxYears} years of monthly contributions.`,
  unit: { suffix: ' yrs' },
  min: BOUNDS.minYears,
  max: BOUNDS.maxYears,
  step: 1,
  nullable: {
    autoLabel: 'From your age to the age you plan to stop contributing',
    overrideDefault: derivedYears,
  },
  tier: 'details',
  summary: overrideSummary(derivedYears, (value) => `${value} ${value === 1 ? 'year' : 'years'}`),
};

export const STARTING_BALANCE: FieldSpec = {
  path: STARTING_BALANCE_PATH,
  kind: 'money',
  label: 'Starting balance',
  help: 'Already invested at month 0. Use 0 to compare contributions only.',
  min: 0,
  max: BOUNDS.maxStartingBalance,
  nullable: {
    autoLabel: 'What you already have invested',
    overrideDefault: derivedStartingBalance,
  },
  tier: 'details',
  summary: overrideSummary(derivedStartingBalance, (value) => `${formatCurrency(value)} start`),
};

/** Asked on the comparison and on the intake's facts screen. */
export const LEVERAGE_RATIO: FieldSpec = {
  path: LEVERAGE_RATIO_PATH,
  kind: 'select',
  label: 'Leverage ratio',
  // The offered ratios, plus the saved one when it is not among them.
  options: (get) => {
    const ratio = get(LEVERAGE_RATIO_PATH);
    return leverageRatioOptions(isNumber(ratio) ? ratio : undefined);
  },
  help: (get) =>
    get(LEVERAGE_RATIO_PATH) === 1
      ? 'At 1x the only difference from the index fund is the expense ratio in Assumptions.'
      : 'Compared against a plain index fund receiving the same dollars on the same dates.',
  min: Math.min(...LEVERAGE_RATIO_OPTIONS),
  max: Math.max(...LEVERAGE_RATIO_OPTIONS),
  tier: 'details',
  summary: (value) => (isNumber(value) ? `${formatMultiple(value)} fund` : null),
};

// ---------------------------------------------------------------------------
// Market assumptions
// ---------------------------------------------------------------------------

export const INDEX_MEAN_RETURN: FieldSpec = {
  path: 'assumptions.leverage.indexMeanReturn',
  kind: 'percent',
  label: 'Index expected annual return',
  help: 'Expected simple return of the underlying index, before fund costs.',
  min: BOUNDS.minReturn,
  max: BOUNDS.maxReturn,
  precision: 1,
  tier: 'assumption',
  summary: (value) => (isNumber(value) ? `${formatPercent(value, { digits: 1 })} return` : null),
};

export const INDEX_VOLATILITY: FieldSpec = {
  path: 'assumptions.leverage.indexVolatility',
  kind: 'percent',
  label: 'Index annual volatility',
  help: (get) => {
    const L = ratioLabel(get);
    return `The ${L} fund's volatility is about ${L} this figure.`;
  },
  min: BOUNDS.minVolatility,
  max: BOUNDS.maxVolatility,
  precision: 1,
  tier: 'assumption',
  summary: (value) => (isNumber(value) ? `${formatPercent(value, { digits: 1 })} volatility` : null),
};

export const FINANCING_RATE: FieldSpec = {
  path: 'assumptions.leverage.financingRate',
  kind: 'percent',
  label: 'Financing rate on borrowed exposure',
  help: 'Short-term rate plus a swap spread, charged on the extra (L - 1) exposure.',
  min: 0,
  max: BOUNDS.maxFinancingRate,
  precision: 2,
  tier: 'assumption',
  summary: (value) => (isNumber(value) ? `${formatPercent(value, { digits: 2 })} financing` : null),
};

export const EXPENSE_RATIO: FieldSpec = {
  path: 'assumptions.leverage.expenseRatio',
  kind: 'percent',
  label: 'Leveraged fund expense ratio',
  min: 0,
  max: BOUNDS.maxExpenseRatio,
  precision: 2,
  tier: 'assumption',
};

export const INDEX_EXPENSE_RATIO: FieldSpec = {
  path: 'assumptions.leverage.indexExpenseRatio',
  kind: 'percent',
  label: 'Index fund expense ratio',
  min: 0,
  max: BOUNDS.maxExpenseRatio,
  precision: 2,
  tier: 'assumption',
};

export const MARKET_FIELDS: readonly FieldSpec[] = [
  INDEX_MEAN_RETURN,
  INDEX_VOLATILITY,
  FINANCING_RATE,
  EXPENSE_RATIO,
  INDEX_EXPENSE_RATIO,
];
