/**
 * Required savings rate by retirement age: for each age from the later of
 * (starting age + 10) and 45 up to 70, the level monthly contribution that
 * grows, together with the starting balance, to the balance the 4% guideline
 * implies for the target income, and that contribution as a share of the
 * current income.
 *
 * The retirement calculator's SavingsRateChart plots this series.
 * The target income and the required contribution are in today's dollars:
 * the target is not inflated to the retirement year.
 *
 * Contributions compound at the effective monthly rate (1 + r)^(1/12) - 1, the
 * rate that grows the starting balance, and a share of each year's total may
 * land at the start of the year (lib/calculations/contributionSchedule.ts).
 */

import { scheduleFactor } from './contributionSchedule';
import { calculateRequiredBalance, futureValue, type RetirementInputs } from './retirement';

/** The inputs the curve reads. */
export type SavingsRateInputs = Pick<
  RetirementInputs,
  'startingAge' | 'targetIncome' | 'startingBalance' | 'accumulationReturn' | 'currentIncome'
> & {
  /** 0..1, default 0: share of the yearly total landing at the start of the year. */
  yearStartShare?: number;
};

export interface SavingsRatePoint {
  retirementAge: number;
  /** Required annual contribution over current income, in percent, capped at 100. */
  requiredSavingsRate: number;
  /** Level monthly contribution from today until this retirement age. */
  requiredMonthlySavings: number;
}

/** The curve starts no sooner than this many years from the starting age... */
const MIN_YEARS_TO_RETIREMENT = 10;
/** ...and no earlier than this age. */
const EARLIEST_RETIREMENT_AGE = 45;
/** The last retirement age on the curve. */
const LATEST_RETIREMENT_AGE = 70;

/**
 * One point per whole retirement age. Empty when the starting age leaves no
 * age up to 70 that is at least ten years out.
 */
export function requiredSavingsCurve(inputs: SavingsRateInputs): SavingsRatePoint[] {
  const data: SavingsRatePoint[] = [];
  const requiredBalance = calculateRequiredBalance(inputs.targetIncome);

  const minAge = Math.max(inputs.startingAge + MIN_YEARS_TO_RETIREMENT, EARLIEST_RETIREMENT_AGE);
  const yearStartShare = inputs.yearStartShare ?? 0;

  for (let retirementAge = minAge; retirementAge <= LATEST_RETIREMENT_AGE; retirementAge++) {
    const yearsToRetirement = retirementAge - inputs.startingAge;
    const monthsToRetirement = yearsToRetirement * 12;

    // What the starting balance grows to, and what contributions must add.
    const growthOfStartingBalance = futureValue(
      inputs.startingBalance,
      inputs.accumulationReturn,
      yearsToRetirement
    );
    const additionalNeeded = requiredBalance - growthOfStartingBalance;

    if (additionalNeeded <= 0) {
      // The starting balance alone gets there.
      data.push({ retirementAge, requiredSavingsRate: 0, requiredMonthlySavings: 0 });
      continue;
    }

    // The monthly-equivalent contribution whose schedule grows to the
    // amount needed: PMT = FV / (future value per monthly-equivalent dollar).
    // All monthly at i = (1 + r)^(1/12) - 1 that factor is ((1 + i)^n - 1) / i,
    // and n at a zero return.
    const requiredMonthlySavings =
      additionalNeeded / scheduleFactor(inputs.accumulationReturn, monthsToRetirement, yearStartShare);

    const requiredSavingsRate = Math.min(1, (requiredMonthlySavings * 12) / inputs.currentIncome);

    data.push({
      retirementAge,
      requiredSavingsRate: requiredSavingsRate * 100,
      requiredMonthlySavings,
    });
  }

  return data;
}
