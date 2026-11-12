/**
 * The visitor's own position on the Savings Rate Impact chart: their current
 * savings rate (a horizontal reference line), the point on the curve at their
 * planned retirement age, and one sentence that says both in words for people
 * who cannot read the chart.
 *
 * Display only: it reads the curve from lib/calculations/savingsRate and the
 * inputs the engine already has, and feeds nothing back into a calculation.
 * Kept free of Recharts so the results section can build the caption without
 * loading the chart.
 */

import type { RetirementInputs } from '@/lib/calculations/retirement';
import {
  requiredSavingsCurve,
  type SavingsRateInputs,
  type SavingsRatePoint,
} from '@/lib/calculations/savingsRate';
import { formatPercent } from '@/lib/format';

/** The inputs the markers read: the curve's own plus savings and retirement age. */
export type SavingsRateMarkerInputs = SavingsRateInputs &
  Pick<RetirementInputs, 'monthlySavings' | 'retirementAge'>;

export interface SavingsRateMarkers {
  /** The required-savings curve, one point per retirement age. */
  curve: SavingsRatePoint[];
  /**
   * monthlySavings * 12 / currentIncome in percent (the engine's formula), or
   * null when there is no positive income to divide by.
   */
  currentSavingsRate: number | null;
  /** The curve's point at the planned retirement age, or null when it is not plotted. */
  plannedPoint: SavingsRatePoint | null;
  /** The plotted age range, or null when the curve is empty. */
  ageRange: { from: number; to: number } | null;
  /** The text alternative; empty when there is nothing to say. */
  sentence: string;
}

/** A percent (0 to 100 and beyond) as whole percent text, "12%". */
const wholePercent = (percent: number) => formatPercent(percent / 100, { digits: 0 });

function plannedAgeSentence(
  age: number,
  point: SavingsRatePoint | null,
  range: { from: number; to: number } | null,
): string {
  if (!range) return '';
  if (!point) {
    return `Retiring at ${age} is outside the plotted ages (${range.from} to ${range.to}).`;
  }
  if (point.requiredSavingsRate <= 0) {
    return `Retiring at ${age} needs no further savings: the starting balance alone reaches the target.`;
  }
  if (point.requiredSavingsRate >= 100) {
    return `Retiring at ${age} needs 100% of current income or more.`;
  }
  return `Retiring at ${age} needs about ${wholePercent(point.requiredSavingsRate)}.`;
}

/**
 * The markers and the sentence for one set of inputs. With no positive
 * income every rate on the curve is undefined, so there is no marker and no
 * sentence at all.
 */
export function savingsRateMarkers(inputs: SavingsRateMarkerInputs): SavingsRateMarkers {
  const { startingAge, targetIncome, startingBalance, accumulationReturn, currentIncome } = inputs;
  const curve = requiredSavingsCurve({
    startingAge,
    targetIncome,
    startingBalance,
    accumulationReturn,
    currentIncome,
  });

  const hasIncome = Number.isFinite(currentIncome) && currentIncome > 0;
  if (!hasIncome) {
    return { curve, currentSavingsRate: null, plannedPoint: null, ageRange: null, sentence: '' };
  }

  const currentSavingsRate = ((inputs.monthlySavings * 12) / currentIncome) * 100;
  const ageRange =
    curve.length > 0
      ? { from: curve[0].retirementAge, to: curve[curve.length - 1].retirementAge }
      : null;
  const plannedPoint = curve.find(p => p.retirementAge === inputs.retirementAge) ?? null;

  const sentence = [
    `Your current savings rate is ${wholePercent(currentSavingsRate)}.`,
    plannedAgeSentence(inputs.retirementAge, plannedPoint, ageRange),
  ]
    .filter(Boolean)
    .join(' ');

  return { curve, currentSavingsRate, plannedPoint, ageRange, sentence };
}
