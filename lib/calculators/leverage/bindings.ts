/**
 * Leverage comparison bindings (docs/rebuild-plan.md section 2.5): how the
 * profile feeds DcaComparisonInputs. Pure.
 *
 * The contribution, the horizon and the starting balance are nullable
 * overrides (profile.leverage); null derives each one from the profile:
 *
 * - monthlyContribution: the taxable monthly contribution, or the total
 *   monthly contribution when no taxable contribution is set.
 * - years: retirement age minus age, rounded, clamped to the bounds.
 * - startingBalance: the invested balance.
 *
 * A derived contribution or balance is clamped to LEVERAGE_INPUT_BOUNDS, as
 * the old query reader did, so a profile value the comparison does not
 * accept never reaches the engine. An override is not clamped: the form
 * checks it against the same bounds and shows the error on the field.
 */

import { LEVERAGE_INPUT_BOUNDS } from '@/lib/constants/leverage';
import type { DcaComparisonInputs } from '@/lib/calculations/leverageComparison';
import type { Binding } from '@/lib/fields/binding';
import { isFiniteNumber } from '@/lib/fields/runtime';
import { AGE, INVESTED_BALANCE, MONTHLY_INVESTING, RETIREMENT_AGE, TAXABLE_MONTHLY } from '@/lib/fields/shared';
import type { Get } from '@/lib/fields/types';
import { clamp } from '@/lib/utils';

export const MONTHLY_CONTRIBUTION_PATH = 'leverage.monthlyContribution';
export const YEARS_PATH = 'leverage.years';
export const STARTING_BALANCE_PATH = 'leverage.startingBalance';
export const LEVERAGE_RATIO_PATH = 'strategy.leverageRatio';

const BOUNDS = LEVERAGE_INPUT_BOUNDS;

function numberAt(get: Get, path: string): number {
  const value = get(path);
  return isFiniteNumber(value) ? value : 0;
}

/** True when the profile has a taxable monthly contribution, which the derived contribution then uses. */
export function usesTaxableContribution(get: Get): boolean {
  return numberAt(get, TAXABLE_MONTHLY.path) > 0;
}

/** The monthly contribution the profile implies (the auto value of leverage.monthlyContribution). */
export function derivedMonthlyContribution(get: Get): number {
  const monthly = usesTaxableContribution(get)
    ? numberAt(get, TAXABLE_MONTHLY.path)
    : numberAt(get, MONTHLY_INVESTING.path);
  return clamp(monthly, 0, BOUNDS.maxMonthlyContribution);
}

/** Whole years from the current age to the retirement age (the auto value of leverage.years). */
export function derivedYears(get: Get): number {
  const span = Math.round(numberAt(get, RETIREMENT_AGE.path) - numberAt(get, AGE.path));
  return clamp(span, BOUNDS.minYears, BOUNDS.maxYears);
}

/** The invested balance (the auto value of leverage.startingBalance). */
export function derivedStartingBalance(get: Get): number {
  return clamp(numberAt(get, INVESTED_BALANCE.path), 0, BOUNDS.maxStartingBalance);
}

/** The override at `path` when it is set, otherwise the derived value. */
function overrideOr(path: string, derive: (get: Get) => number): (get: Get) => number {
  return (get) => {
    const override = get(path);
    return typeof override === 'number' ? override : derive(get);
  };
}

export const LEVERAGE_BINDINGS: readonly Binding<DcaComparisonInputs>[] = [
  { engine: 'monthlyContribution', read: overrideOr(MONTHLY_CONTRIBUTION_PATH, derivedMonthlyContribution) },
  { engine: 'years', read: overrideOr(YEARS_PATH, derivedYears) },
  { engine: 'startingBalance', read: overrideOr(STARTING_BALANCE_PATH, derivedStartingBalance) },
  { profile: LEVERAGE_RATIO_PATH, engine: 'leverageRatio' },
  { profile: 'assumptions.leverage.indexMeanReturn', engine: 'indexMeanReturn' },
  { profile: 'assumptions.leverage.indexVolatility', engine: 'indexVolatility' },
  { profile: 'assumptions.leverage.financingRate', engine: 'financingRate' },
  { profile: 'assumptions.leverage.expenseRatio', engine: 'expenseRatio' },
  { profile: 'assumptions.leverage.indexExpenseRatio', engine: 'indexExpenseRatio' },
];

/** Engine inputs with no profile home, on purpose (plan section 2.3). */
export const LEVERAGE_ENGINE_ONLY: Readonly<Record<string, string>> = {
  paths: 'Fixed at DEFAULT_LEVERAGE_PATHS (500); the results copy and the sampling-error threshold are calibrated to it.',
  seed: 'Fixed at DEFAULT_LEVERAGE_SEED, so the same inputs always give the same results.',
};
