/**
 * The retirement headline: the plan figures from the "Your Current Plan"
 * scenario (found by id), converted for the dollar-display mode, the implied
 * withdrawal rate and the scenario count, with the tones the results page
 * used to spell as card variants and alert colors.
 */

import { describe, expect, it } from 'vitest';
import type { RetirementInputs, RetirementResults, RetirementScenario } from '@/lib/calculations/retirement';
import {
  currentPlanScenario,
  retirementHeadline,
  scenarioCountStat,
  successTone,
  withdrawalRateStat,
  withdrawalRateTone,
} from '@/lib/calculators/retirement/headline';
import { formatStatValue, type StatSpec } from '@/lib/design-system/stat';

const INPUTS = {
  startingAge: 25,
  retirementAge: 60,
  inflationRate: 0.03,
} as RetirementInputs;

const scenario = (overrides: Partial<RetirementScenario>): RetirementScenario => ({
  id: 'current-plan-baseline',
  name: 'Your Current Plan',
  retirementAge: 60,
  requiredBalance: 2_000_000,
  projectedBalance: 2_500_000,
  monthlyWithdrawal: 5000,
  successProbability: 0.856,
  yearsOfIncome: 25,
  ...overrides,
});

const results = (scenarios: RetirementScenario[], initialWithdrawalRate = 0.032): RetirementResults => ({
  scenarios,
  netWorthByAge: {},
  withdrawalsByAge: {},
  insights: [],
  initialWithdrawalRate,
});

const OTHER = scenario({
  id: 'small-improvement',
  name: 'Save extra $500/month',
  retirementAge: 58,
  requiredBalance: 1_000_000,
  projectedBalance: 1_100_000,
  successProbability: 0.45,
});

const shown = (stats: StatSpec[]) =>
  stats.map(({ id, label, value, format, tone, hint }) => ({ id, label, value: formatStatValue(value, format), tone, hint }));

describe('retirementHeadline', () => {
  it("shows the current plan's success, balances in today's dollars and the withdrawal rate", () => {
    // 35 years at 3%: 1.03^35 = 2.813862. $2,500,000 / 2.813862 = $888,458;
    // $2,000,000 / 2.813862 = $710,767.
    expect(shown(retirementHeadline(results([scenario({}), OTHER]), INPUTS))).toEqual([
      { id: 'success', label: 'Success Probability', value: '85.6%', tone: 'positive', hint: undefined },
      { id: 'projected', label: 'Projected Balance', value: '$888,458', tone: undefined, hint: "Today's dollars" },
      { id: 'required', label: 'Required Balance', value: '$710,767', tone: undefined, hint: "Today's dollars" },
      {
        id: 'withdrawal-rate',
        label: 'Implied Withdrawal Rate',
        value: '3.2%',
        tone: 'positive',
        hint: 'at or below the 4% guideline',
      },
    ]);
  });

  it('passes the nominal balances through in future dollars', () => {
    const [, projected, required] = shown(retirementHeadline(results([scenario({})]), INPUTS, 'nominal'));
    expect(projected).toMatchObject({ value: '$2,500,000', hint: 'Future dollars' });
    expect(required).toMatchObject({ value: '$2,000,000', hint: 'Future dollars' });
  });

  it('finds the current plan by id wherever it sits, whatever its name', () => {
    const plan = scenario({ id: 'current-plan-falling-short', name: 'Renamed', successProbability: 0.6 });
    const [success] = retirementHeadline(results([OTHER, plan]), INPUTS);
    expect(success).toMatchObject({ value: 0.6, tone: 'caution' });
  });

  it("converts over the plan scenario's own horizon", () => {
    // Retiring at 35, ten years out: $1,343,916.38 / 1.03^10 (1.343916) = $1,000,000.
    const plan = scenario({ retirementAge: 35, projectedBalance: 1_343_916.38 });
    const [, projected] = shown(retirementHeadline(results([plan]), INPUTS));
    expect(projected.value).toBe('$1,000,000');
  });

  it('falls back to the first scenario, and to dashes when there is none', () => {
    expect(currentPlanScenario(results([OTHER]))).toBe(OTHER);
    expect(currentPlanScenario(results([]))).toBeUndefined();

    const stats = shown(retirementHeadline(results([]), INPUTS));
    expect(stats.map((s) => s.value)).toEqual(['\u2014', '\u2014', '\u2014', '3.2%']);
    expect(stats[0].tone).toBe('neutral');
  });
});

describe('withdrawalRateStat', () => {
  it('grades the rate against the 4% guideline', () => {
    expect(withdrawalRateStat(results([], 0.04))).toMatchObject({
      tone: 'positive',
      hint: 'at or below the 4% guideline',
    });
    expect(withdrawalRateStat(results([], 0.045))).toMatchObject({ tone: 'caution', hint: 'above the 4% guideline' });
    expect(withdrawalRateStat(results([], 0.062))).toMatchObject({ tone: 'negative', hint: 'above the 4% guideline' });
  });

  it('formats the rate as a percent with up to one decimal', () => {
    const stat = withdrawalRateStat(results([], 0.04567));
    expect(formatStatValue(stat.value, stat.format)).toBe('4.6%');
  });
});

describe('withdrawalRateTone', () => {
  it('is positive to 4%, caution to 5% and negative beyond', () => {
    expect(withdrawalRateTone(0.03)).toBe('positive');
    expect(withdrawalRateTone(0.04)).toBe('positive');
    expect(withdrawalRateTone(0.0401)).toBe('caution');
    expect(withdrawalRateTone(0.05)).toBe('caution');
    expect(withdrawalRateTone(0.0501)).toBe('negative');
  });
});

describe('successTone', () => {
  it('is positive from 70%, caution from 50% and negative below', () => {
    expect(successTone(0.95)).toBe('positive');
    expect(successTone(0.7)).toBe('positive');
    expect(successTone(0.6999)).toBe('caution');
    expect(successTone(0.5)).toBe('caution');
    expect(successTone(0.4999)).toBe('negative');
  });
});

describe('scenarioCountStat', () => {
  it('counts the scenarios', () => {
    expect(scenarioCountStat(results([scenario({}), OTHER]))).toEqual({
      id: 'scenarios',
      label: 'Scenarios Analyzed',
      value: 2,
      format: 'count',
      tone: 'info',
      hint: 'retirement options',
    });
  });
});
