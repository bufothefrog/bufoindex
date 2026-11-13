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
  scenarioTitle,
  successTone,
  withdrawalRateStat,
  withdrawalRateTone,
} from '@/lib/calculators/retirement/headline';
import { formatStatValue, type StatSpec } from '@/lib/design-system/stat';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { ownerRaw, ownerYearStartRaw } from '@/test/factories/accountsFixtures';

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

describe('scenarioTitle: scenario titles follow the dollar mode (PR 5)', () => {
  const conservativeOf = (profile: ReturnType<typeof getDefaultFinancialProfile>) => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profile);
    const results = RETIREMENT_CALCULATOR.calculate(inputs);
    const found = results.scenarios.find((each) => each.id === 'conservative-wealth-building');
    if (!found) throw new Error('no conservative scenario');
    return { scenario: found, inflationRate: inputs.inflationRate };
  };

  it('E14, the default profile: the name keeps the computed figures; the title converts them', () => {
    // Legacy 7,248,462.75 nominal at 65 years: / 1.03^65 (6.829983) = 1,061,271.02 -> $1,061,000.
    // Income 2,733.33 of today's dollars at 40 years: x 1.03^40 (3.262038) = 8,916.24 -> $8,900.
    const { scenario, inflationRate } = conservativeOf(getDefaultFinancialProfile());
    expect(scenario.name).toBe('Conservative: $2,700/month, leave $7,248,000 legacy');
    expect(scenarioTitle(scenario, 'today', inflationRate)).toBe('Conservative: $2,700/month, leave $1,061,000 legacy');
    expect(scenarioTitle(scenario, 'nominal', inflationRate)).toBe('Conservative: $8,900/month, leave $7,248,000 legacy');
  });

  it('the owner with the Roth IRA once a year', () => {
    const { scenario, inflationRate } = conservativeOf(normalizeProfile(ownerYearStartRaw()));
    expect(scenarioTitle(scenario, 'today', inflationRate)).toBe('Conservative: $2,700/month, leave $3,679,000 legacy');
    expect(scenarioTitle(scenario, 'nominal', inflationRate)).toBe('Conservative: $8,900/month, leave $25,126,000 legacy');
  });

  it('the owner with timing untouched', () => {
    const { scenario, inflationRate } = conservativeOf(normalizeProfile(ownerRaw()));
    expect(scenario.name).toBe('Conservative: $2,700/month, leave $24,893,000 legacy');
    expect(scenarioTitle(scenario, 'today', inflationRate)).toBe('Conservative: $2,700/month, leave $3,645,000 legacy');
    expect(scenarioTitle(scenario, 'nominal', inflationRate)).toBe('Conservative: $8,900/month, leave $24,893,000 legacy');
  });

  it('a scenario with no title returns its name, in both modes', () => {
    const plain = scenario({ name: 'Retire 5 years early at 60' });
    expect(scenarioTitle(plain, 'today', 0.03)).toBe('Retire 5 years early at 60');
    expect(scenarioTitle(plain, 'nominal', 0.03)).toBe('Retire 5 years early at 60');
  });

  it('an unrounded part prints whole dollars, converted over its own horizon', () => {
    // 8,000 of today's dollars 10 years out at 2%: x 1.218994 = 9,751.96 -> $9,752.
    const buffer = scenario({
      name: 'Conservative: $6,000/month with $8,000 annual buffer',
      title: [
        'Conservative: ',
        { amount: 6000, basis: 'today', yearsFromNow: 10, roundTo: 100 },
        '/month with ',
        { amount: 8000, basis: 'today', yearsFromNow: 10 },
        ' annual buffer',
      ],
    });
    expect(scenarioTitle(buffer, 'today', 0.02)).toBe('Conservative: $6,000/month with $8,000 annual buffer');
    // 6,000 x 1.218994 = 7,313.96 -> $7,300.
    expect(scenarioTitle(buffer, 'nominal', 0.02)).toBe('Conservative: $7,300/month with $9,752 annual buffer');
  });
});
