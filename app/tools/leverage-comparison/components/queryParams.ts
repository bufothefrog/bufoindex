/**
 * Query-string state for the leverage comparison calculator.
 *
 * Contract (shared with lib/profile/links.ts): c = monthly contribution,
 * y = years, b = starting balance, l = leverage ratio. The assumption
 * overrides r (index return), v (volatility), f (financing rate) and
 * e (leveraged expense ratio) are optional and only written when they differ
 * from the defaults, so profile links stay short.
 */

import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  type DcaComparisonInputs,
} from '@/lib/calculations/leverageComparison';
import { LEVERAGE_INPUT_BOUNDS } from '@/lib/constants/leverage';

export const LEVERAGE_COMPARISON_PATH = '/tools/leverage-comparison';

/** Anything with URLSearchParams' get(), including Next's ReadonlyURLSearchParams. */
export interface QueryReader {
  get(name: string): string | null;
}

function readNumber(
  params: QueryReader | null,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = params?.get(key);
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function inputsFromQuery(params: QueryReader | null): DcaComparisonInputs {
  const d = DEFAULT_DCA_COMPARISON_INPUTS;
  const b = LEVERAGE_INPUT_BOUNDS;
  return {
    ...d,
    monthlyContribution: Math.round(
      readNumber(params, 'c', d.monthlyContribution, 0, b.maxMonthlyContribution),
    ),
    years: Math.round(readNumber(params, 'y', d.years, b.minYears, b.maxYears)),
    startingBalance: Math.round(readNumber(params, 'b', d.startingBalance, 0, b.maxStartingBalance)),
    leverageRatio: readNumber(params, 'l', d.leverageRatio, 1, 3),
    indexMeanReturn: readNumber(params, 'r', d.indexMeanReturn, b.minReturn, b.maxReturn),
    indexVolatility: readNumber(params, 'v', d.indexVolatility, b.minVolatility, b.maxVolatility),
    financingRate: readNumber(params, 'f', d.financingRate, 0, b.maxFinancingRate),
    expenseRatio: readNumber(params, 'e', d.expenseRatio, 0, b.maxExpenseRatio),
  };
}

export function toQueryString(inputs: DcaComparisonInputs): string {
  const d = DEFAULT_DCA_COMPARISON_INPUTS;
  const params = new URLSearchParams({
    c: String(Math.round(inputs.monthlyContribution)),
    y: String(inputs.years),
    b: String(Math.round(inputs.startingBalance)),
    l: String(inputs.leverageRatio),
  });
  const optional: Array<[string, number, number]> = [
    ['r', inputs.indexMeanReturn, d.indexMeanReturn],
    ['v', inputs.indexVolatility, d.indexVolatility],
    ['f', inputs.financingRate, d.financingRate],
    ['e', inputs.expenseRatio, d.expenseRatio],
  ];
  for (const [key, value, fallback] of optional) {
    if (Math.abs(value - fallback) > 1e-9) params.set(key, String(Number(value.toFixed(6))));
  }
  return params.toString();
}

export function comparisonHref(inputs: DcaComparisonInputs): string {
  return `${LEVERAGE_COMPARISON_PATH}?${toQueryString(inputs)}`;
}
