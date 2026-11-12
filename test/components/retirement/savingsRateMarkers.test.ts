import { describe, expect, it } from 'vitest';
import {
  savingsRateMarkers,
  type SavingsRateMarkerInputs,
} from '@/app/tools/retirement-calculator/components/savingsRateMarkers';

// Zero return keeps the curve hand-computable: the required balance is
// target / 4% = $1,000,000, and with no starting balance the level monthly
// contribution is $1,000,000 / months.
const ZERO_RETURN: SavingsRateMarkerInputs = {
  startingAge: 30,
  targetIncome: 40000,
  startingBalance: 0,
  accumulationReturn: 0,
  currentIncome: 50000,
  monthlySavings: 500,
  retirementAge: 65,
};

describe('savingsRateMarkers', () => {
  it('derives the current rate with the engine formula and reads the planned age off the curve', () => {
    const m = savingsRateMarkers(ZERO_RETURN);
    // $500 x 12 / $50,000 = 12%.
    expect(m.currentSavingsRate).toBeCloseTo(12, 10);
    // 35 years = 420 months: $1,000,000 / 420 = $2,380.95 a month,
    // x 12 / $50,000 = 57.142857%.
    expect(m.plannedPoint?.retirementAge).toBe(65);
    expect(m.plannedPoint?.requiredSavingsRate).toBeCloseTo(57.142857, 5);
    expect(m.plannedPoint?.requiredMonthlySavings).toBeCloseTo(2380.952381, 5);
    expect(m.ageRange).toEqual({ from: 45, to: 70 });
    expect(m.curve).toHaveLength(26);
    expect(m.sentence).toBe('Your current savings rate is 12%. Retiring at 65 needs about 57%.');
  });

  it('rounds to whole percent with a growing balance', () => {
    const m = savingsRateMarkers({
      startingAge: 25,
      targetIncome: 80000,
      startingBalance: 10000,
      accumulationReturn: 0.08,
      currentIncome: 100000,
      monthlySavings: 2000,
      retirementAge: 60,
    });
    expect(m.currentSavingsRate).toBeCloseTo(24, 10);
    // $10,000 grows to $147,853 over 35 years at 8%; the remaining
    // $1,852,147 needs $807.43 a month at 8%/12 over 420 months, 9.689%.
    expect(m.plannedPoint?.requiredSavingsRate).toBeCloseTo(9.689144, 5);
    expect(m.sentence).toBe('Your current savings rate is 24%. Retiring at 60 needs about 10%.');
  });

  it('says when a retirement age lies outside the plotted range, and plots no dot', () => {
    const early = savingsRateMarkers({ ...ZERO_RETURN, retirementAge: 40 });
    expect(early.plannedPoint).toBeNull();
    expect(early.currentSavingsRate).toBeCloseTo(12, 10);
    expect(early.sentence).toBe(
      'Your current savings rate is 12%. Retiring at 40 is outside the plotted ages (45 to 70).'
    );

    const late = savingsRateMarkers({ ...ZERO_RETURN, retirementAge: 72 });
    expect(late.plannedPoint).toBeNull();
    expect(late.sentence).toBe(
      'Your current savings rate is 12%. Retiring at 72 is outside the plotted ages (45 to 70).'
    );
  });

  it('has no marker and no sentence when income is zero', () => {
    const m = savingsRateMarkers({ ...ZERO_RETURN, currentIncome: 0 });
    expect(m.currentSavingsRate).toBeNull();
    expect(m.plannedPoint).toBeNull();
    expect(m.ageRange).toBeNull();
    expect(m.sentence).toBe('');
  });

  it('speaks only of the current rate when the curve is empty', () => {
    // Starting at 65, no age up to 70 is ten years out.
    const m = savingsRateMarkers({ ...ZERO_RETURN, startingAge: 65, retirementAge: 67 });
    expect(m.curve).toEqual([]);
    expect(m.plannedPoint).toBeNull();
    expect(m.ageRange).toBeNull();
    expect(m.sentence).toBe('Your current savings rate is 12%.');
  });

  it('words the ends of the curve: no further savings, and the 100% cap', () => {
    const funded = savingsRateMarkers({
      ...ZERO_RETURN,
      startingBalance: 2000000,
      retirementAge: 55,
    });
    expect(funded.plannedPoint?.requiredSavingsRate).toBe(0);
    expect(funded.sentence).toBe(
      'Your current savings rate is 12%. Retiring at 55 needs no further savings: the starting balance alone reaches the target.'
    );

    // 15 years = 180 months: $5,555.56 a month is $66,667 a year, over the
    // $50,000 income, so the curve caps at 100%.
    const capped = savingsRateMarkers({ ...ZERO_RETURN, retirementAge: 45 });
    expect(capped.plannedPoint?.requiredSavingsRate).toBe(100);
    expect(capped.sentence).toBe(
      'Your current savings rate is 12%. Retiring at 45 needs 100% of current income or more.'
    );
  });
});
