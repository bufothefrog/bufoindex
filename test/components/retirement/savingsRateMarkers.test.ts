import { describe, expect, it } from 'vitest';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { ownerYearStartRaw } from '@/test/factories/accountsFixtures';
import {
  savingsRateLabelPositions,
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
    // $1,852,147 needs $864.45 a month at i = 1.08^(1/12) - 1 over 420
    // months, 10.373%. (Before PR 5, at 8%/12: $807.43, 9.689%.)
    expect(m.plannedPoint?.requiredSavingsRate).toBeCloseTo(10.373422, 5);
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

describe('savingsRateMarkers: contribution timing (PR 5)', () => {
  it('keeps the default sentence', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile());
    const m = savingsRateMarkers(inputs);
    // 65: 149.60 a month, 1.726% (138.04, 1.593% before PR 5).
    expect(m.plannedPoint?.requiredSavingsRate).toBeCloseTo(1.726, 3);
    expect(m.sentence).toBe('Your current savings rate is 18%. Retiring at 65 needs about 2%.');
  });

  it('reads the start-of-year share from monthlySavings and yearStartSavings', () => {
    const inputs = { ...engineInputsFor(RETIREMENT_CALCULATOR, normalizeProfile(ownerYearStartRaw())), retirementAge: 45 };
    expect(inputs.yearStartSavings).toBe(7500);
    // Share 7,500 / (12 x 3,195) = 0.19562: 927.07 a month, 7.13%.
    expect(savingsRateMarkers(inputs).plannedPoint?.requiredSavingsRate).toBeCloseTo(7.13, 2);
    // The same inputs all monthly: 934.75 a month, 7.19%.
    expect(savingsRateMarkers({ ...inputs, yearStartSavings: 0 }).plannedPoint?.requiredSavingsRate).toBeCloseTo(7.19, 2);
  });
});

describe('savingsRateLabelPositions', () => {
  // A 326 px chart with the labeled margins and a 60 px y axis: the plot runs
  // from x 80 to 296 and from y 20 down to the x-axis line at 324.
  const GEOMETRY = {
    svgWidth: 326,
    plot: { x: 80, y: 20, width: 216, height: 304 },
    dotText: 'Retire at 60',
    rateText: 'Your savings rate: 24%',
  };
  const AXIS_Y = 324;
  const place = (dot: { x: number; y: number } | null, lineY: number | null) =>
    savingsRateLabelPositions({ ...GEOMETRY, dot, lineY });
  const below = (box: { top: number }, y: number) => box.top >= y;
  const above = (box: { bottom: number }, y: number) => box.bottom <= y;

  it('puts the labels on opposite sides of the line, the dot label away from it', () => {
    // A dot under the line: its label below it, the rate label above the line.
    const under = place({ x: 200, y: 200 }, 150);
    expect(under.dotLabel?.textAnchor).toBe('middle');
    expect(below(under.dotLabel!.box, 200)).toBe(true);
    expect(above(under.rateLabel!.box, 150)).toBe(true);

    // A dot over the line: its label above it, the rate label below the line.
    const over = place({ x: 200, y: 100 }, 150);
    expect(above(over.dotLabel!.box, 100)).toBe(true);
    expect(below(over.rateLabel!.box, 150)).toBe(true);

    // A dot a few pixels under the line: the line still separates the labels.
    const near = place({ x: 200, y: 155 }, 150);
    expect(below(near.dotLabel!.box, 150)).toBe(true);
    expect(above(near.rateLabel!.box, 150)).toBe(true);
  });

  it('puts the label above a dot on the x axis at the right edge, anchored inward', () => {
    // Retiring at 70 on a nearly flat late curve: the dot sits on the axis at
    // the plot's right edge, under the line. Below it there is no room.
    const { dotLabel, rateLabel } = place({ x: 296, y: 320 }, 250);
    expect(dotLabel!.box.bottom).toBeLessThanOrEqual(AXIS_Y - 2);
    expect(above(dotLabel!.box, 320)).toBe(true);
    expect(dotLabel!.textAnchor).toBe('end');
    expect(dotLabel!.box.right).toBeLessThanOrEqual(326);
    expect(dotLabel!.box.left).toBeGreaterThanOrEqual(0);
    // The label is under the line, so the rate label goes above it.
    expect(below(dotLabel!.box, 250)).toBe(true);
    expect(above(rateLabel!.box, 250)).toBe(true);
  });

  it('anchors the label inward at the first plotted age near the left edge', () => {
    const { dotLabel } = place({ x: 30, y: 100 }, 250);
    expect(dotLabel!.textAnchor).toBe('start');
    expect(dotLabel!.box.left).toBeGreaterThanOrEqual(0);
  });

  it('puts the label beside a dot near the axis when the line leaves no room above it', () => {
    // A dot 20 px over the axis at mid-plot with the line 12 px over it:
    // below meets the axis and above meets the line, so the label goes to the
    // right of the dot.
    const { dotLabel, rateLabel } = place({ x: 150, y: 304 }, 292);
    expect(dotLabel!.textAnchor).toBe('start');
    expect(dotLabel!.box.left).toBeGreaterThan(150);
    expect(below(dotLabel!.box, 294)).toBe(true);
    expect(dotLabel!.box.bottom).toBeLessThanOrEqual(AXIS_Y - 2);
    expect(above(rateLabel!.box, 292)).toBe(true);
  });

  it('lifts the label over the line when a dot on the axis has the line just over it', () => {
    // At the right edge, with the line 10 px over a dot on the axis, no spot
    // next to the dot fits: the label goes above the line, and the rate label,
    // with no room below the line, above that.
    const { dotLabel, rateLabel } = place({ x: 296, y: AXIS_Y }, 314);
    expect(dotLabel!.textAnchor).toBe('end');
    expect(dotLabel!.box.right).toBeLessThanOrEqual(326);
    expect(above(dotLabel!.box, 312)).toBe(true);
    expect(above(rateLabel!.box, dotLabel!.box.top)).toBe(true);
    expect(rateLabel!.box.top).toBeGreaterThanOrEqual(0);
  });

  it('keeps the rate label inside the plot when there is no dot', () => {
    expect(place(null, 150).dotLabel).toBeNull();
    expect(below(place(null, 150).rateLabel!.box, 150)).toBe(true);
    // A line on the axis has no room below it.
    expect(above(place(null, AXIS_Y).rateLabel!.box, AXIS_Y)).toBe(true);
  });

  it('draws no rate label without a line', () => {
    const { rateLabel, dotLabel } = place({ x: 200, y: 200 }, null);
    expect(rateLabel).toBeNull();
    expect(above(dotLabel!.box, 200)).toBe(true);
  });
});
