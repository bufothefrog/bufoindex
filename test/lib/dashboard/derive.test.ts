/**
 * The dashboard's pure derivations: the cash buffer under each strategy
 * preset, the automation checklist rows and the retirement summary with its
 * "save more" lever. Every expected figure is worked out by hand from the
 * profile below (or, for the seeded Monte Carlo figures, pinned once from the
 * engine and compared with a tolerance, since Node 22 and 24 can differ in
 * the last digit of a double).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ASSUMED_PORTFOLIO_RETURN,
  buildChecklistRows,
  sortAllocations,
  strategyDescription,
  summarizeCashBuffer,
  summarizeRetirement,
} from '@/lib/dashboard/derive';
import { currentPlanScenario } from '@/lib/calculators/retirement/headline';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { formatCurrency } from '@/lib/format';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import type { AllocationItem } from '@/lib/types';
import { toTodaysDollars } from '@/lib/utils/displayDollars';

type Overrides = {
  [K in keyof FinancialProfile]?: FinancialProfile[K] extends unknown[] ? FinancialProfile[K] : Partial<FinancialProfile[K]>;
};

/** The default profile with some sections partly replaced. */
function profileWith(overrides: Overrides = {}): FinancialProfile {
  const base = getDefaultFinancialProfile();
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = (base as unknown as Record<string, unknown>)[key];
    merged[key] = Array.isArray(value) || typeof value !== 'object' || value === null ? value : { ...(current as object), ...value };
  }
  return merged as unknown as FinancialProfile;
}

function allocation(id: string, account: string, amount: number, priority: number): AllocationItem {
  return {
    id,
    account,
    amount,
    percentage: 0,
    priority,
    reasoning: `${account} reasoning`,
    taxImpact: 0,
    category: 'investment',
    implementation: `Set up ${account}`,
  };
}

describe('ASSUMED_PORTFOLIO_RETURN', () => {
  it('is the paycheck allocator\'s 7% (O16), the one cash-drag return the dashboard uses', () => {
    expect(ASSUMED_PORTFOLIO_RETURN).toBe(0.07);
  });
});

describe('strategyDescription', () => {
  it('describes each preset with its cash months, and the leverage ratio for the cash-flow investor', () => {
    expect(strategyDescription('standard', 2)).toBe(
      '3 months of necessary expenses in cash and unleveraged index funds for every contribution.'
    );
    expect(strategyDescription('cashflow-investor', 2)).toBe(
      '1 month of necessary expenses in cash, with steady income as the backstop, and a 2x daily-reset fund compared for taxable contributions.'
    );
    expect(strategyDescription('cashflow-investor', 1.5)).toContain('a 1.5x daily-reset fund');
  });
});

describe('summarizeCashBuffer', () => {
  it('measures the default profile against its 3-month target: a $4,000 shortfall', () => {
    // $5,000 on hand, $3,000 a month of necessary expenses, 3 target months, 4% APY.
    const cash = summarizeCashBuffer(profileWith());
    expect(cash.balance).toBe(5000);
    expect(cash.necessaryMonthly).toBe(3000);
    expect(cash.monthsOnHand).toBeCloseTo(5 / 3, 12);
    expect(cash.presets).toEqual([
      { preset: 'cashflow-investor', months: 1, target: 3000 },
      { preset: 'standard', months: 3, target: 9000 },
    ]);
    expect(cash.activePreset).toBe('cashflow-investor');
    expect(cash.activeMonths).toBe(3);
    expect(cash.activeTarget).toBe(9000);
    expect(cash.usesCustomTarget).toBe(false);
    expect(cash.excess).toBe(0);
    expect(cash.shortfall).toBe(4000);
    expect(cash.costSpread).toBeCloseTo(0.03, 12);
    expect(cash.annualCostOfExcess).toBe(0);
  });

  it('prices cash above the target at the assumed return minus the APY', () => {
    // $30,000 against 3 x $4,200 = $12,600: $17,400 above; (7% - 4%) x 17,400 = $522
    // (before O16 the dashboard assumed 8%: $696).
    const cash = summarizeCashBuffer(
      profileWith({
        spending: { necessaryMonthly: 4200 },
        cash: { emergencyFundBalance: 30000, emergencyFundApy: 0.04, targetMonths: 3 },
        strategy: { preset: 'standard' },
      })
    );
    expect(cash.monthsOnHand).toBeCloseTo(30000 / 4200, 12);
    expect(cash.activeTarget).toBe(12600);
    expect(cash.excess).toBe(17400);
    expect(cash.shortfall).toBe(0);
    expect(cash.costSpread).toBeCloseTo(0.03, 12);
    expect(cash.annualCostOfExcess).toBeCloseTo(522, 6);
    expect(cash.annualCostOfExcess).toBeCloseTo(17400 * (ASSUMED_PORTFOLIO_RETURN - 0.04), 6);
  });

  it('floors the spread at zero when the APY beats the assumed return', () => {
    const cash = summarizeCashBuffer(
      profileWith({ cash: { emergencyFundBalance: 20000, emergencyFundApy: 0.075, targetMonths: 1 } })
    );
    expect(cash.excess).toBe(17000);
    expect(cash.costSpread).toBe(0);
    expect(cash.annualCostOfExcess).toBe(0);
  });

  it('has no months on hand without necessary expenses, and clamps negatives to zero', () => {
    const cash = summarizeCashBuffer(
      profileWith({ spending: { necessaryMonthly: -10 }, cash: { emergencyFundBalance: -50, targetMonths: -2 } })
    );
    expect(cash.necessaryMonthly).toBe(0);
    expect(cash.balance).toBe(0);
    expect(cash.monthsOnHand).toBeNull();
    expect(cash.activeMonths).toBe(0);
    expect(cash.activeTarget).toBe(0);
    expect(cash.presets.map((p) => p.target)).toEqual([0, 0]);
    expect(cash.excess).toBe(0);
    expect(cash.shortfall).toBe(0);
  });

  it('uses a custom target only when the visitor entered months that differ from the preset', () => {
    const entered = (targetMonths: number, preset: FinancialProfile['strategy']['preset']) =>
      summarizeCashBuffer({
        ...profileWith({ cash: { targetMonths }, strategy: { preset } }),
        provided: ['cash.targetMonths'],
      }).usesCustomTarget;
    expect(entered(2, 'cashflow-investor')).toBe(true);
    expect(entered(1, 'cashflow-investor')).toBe(false);
    expect(entered(3, 'standard')).toBe(false);
    // Not entered: a target that differs from the preset still follows it.
    expect(summarizeCashBuffer(profileWith({ cash: { targetMonths: 2 } })).usesCustomTarget).toBe(false);
  });
});

describe('sortAllocations', () => {
  it('orders by priority without changing the input', () => {
    const input = [allocation('c', 'C', 1, 3), allocation('a', 'A', 1, 1), allocation('b', 'B', 1, 2)];
    expect(sortAllocations(input).map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(input.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('buildChecklistRows', () => {
  const allocations = [
    allocation('taxable', 'Taxable Investment', 288, 4),
    allocation('k401', '401k (Roth + Traditional)', 279, 2),
    allocation('roth-ira', 'Roth IRA', 144, 1),
    allocation('match', 'Employer 401(k) Match', 100, 0),
  ];

  it('leads with the current 401(k) election, then the allocations in plan order', () => {
    // $3,500 gross per paycheck at 6%: $210.
    const rows = buildChecklistRows(profileWith(), allocations);
    expect(rows.map((row) => row.id)).toEqual(['current-401k-deferral', 'match', 'roth-ira', 'k401', 'taxable']);
    expect(rows[0]).toEqual({
      id: 'current-401k-deferral',
      account: '401(k) payroll deferral',
      perPaycheck: 210,
      percentOfGross: 0.06,
      implementation:
        'Payroll election at 6% of gross pay, set once in the benefits portal; it comes out before take-home pay.',
    });
  });

  it('shows a 401(k) allocation as an increase in its share of gross pay', () => {
    const rows = buildChecklistRows(profileWith(), allocations);
    const k401 = rows.find((row) => row.id === 'k401');
    expect(k401?.percentOfGross).toBeCloseTo(279 / 3500, 12);
    expect(k401?.percentIsIncrease).toBe(true);
    const match = rows.find((row) => row.id === 'match');
    expect(match?.percentOfGross).toBeCloseTo(100 / 3500, 12);
    const roth = rows.find((row) => row.id === 'roth-ira');
    expect(roth).toEqual({
      id: 'roth-ira',
      account: 'Roth IRA',
      perPaycheck: 144,
      percentOfGross: undefined,
      percentIsIncrease: false,
      implementation: 'Set up Roth IRA',
    });
  });

  it('has no election row without a plan or a contribution, and no share without gross pay', () => {
    expect(buildChecklistRows(profileWith({ workplace: { has401k: false } }), [])).toEqual([]);
    expect(buildChecklistRows(profileWith({ workplace: { contributionPercent: 0 } }), [])).toEqual([]);
    const rows = buildChecklistRows(profileWith({ income: { grossPerPaycheck: 0 } }), [allocations[1]]);
    expect(rows.map((row) => [row.id, row.perPaycheck, row.percentOfGross])).toEqual([
      ['current-401k-deferral', 0, 0.06],
      ['k401', 279, undefined],
    ]);
  });
});

describe('summarizeRetirement', () => {
  it('runs the calculator on the default profile and the same markets with $500 more a month', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profileWith());
    const outcome = summarizeRetirement(inputs);
    if (outcome.status !== 'ok') throw new Error('expected a result');
    expect(outcome.results).toEqual(RETIREMENT_CALCULATOR.calculate(inputs));
    const plan = currentPlanScenario(outcome.results);
    expect(plan?.successProbability).toBeCloseTo(0.05, 3);
    expect(outcome.lever.extraMonthly).toBe(500);
    expect(outcome.lever.successProbability).toBeCloseTo(0.364, 3);
    // The lever's balance is nominal; the card converts it for display.
    // Pinned from the pre-move dashboard: $1,343,473 in today's dollars (30
    // years at 3% inflation), so the nominal figure is that times 1.03^30.
    expect(inputs.inflationRate).toBe(0.03);
    expect(outcome.lever.yearsToRetirement).toBe(30);
    const today = toTodaysDollars(outcome.lever.projectedBalance, 0.03, 30);
    expect(today).toBeCloseTo(1_343_473, -1);
    expect(formatCurrency(today)).toBe('$1,343,473');
    expect(outcome.lever.projectedBalance).toBeCloseTo(1_343_473 * 1.03 ** 30, -2);
  });

  it('returns the engine messages for inputs it rejects', () => {
    const inputs = { ...engineInputsFor(RETIREMENT_CALCULATOR, profileWith()), lifeExpectancy: 55 };
    const outcome = summarizeRetirement(inputs);
    expect(outcome.status).toBe('invalid');
    if (outcome.status !== 'invalid') return;
    expect(outcome.messages.length).toBeGreaterThan(0);
    expect(outcome.messages.join(' ')).toMatch(/life expectancy/i);
  });

  it('reports an unexpected failure as one message', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profileWith());
    const spy = vi.spyOn(RETIREMENT_CALCULATOR, 'calculate');
    spy.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(summarizeRetirement(inputs)).toEqual({ status: 'invalid', messages: ['boom'] });
    spy.mockImplementationOnce(() => {
      throw 'not an error';
    });
    expect(summarizeRetirement(inputs)).toEqual({
      status: 'invalid',
      messages: ['The retirement analysis could not run.'],
    });
    spy.mockRestore();
  });
});
