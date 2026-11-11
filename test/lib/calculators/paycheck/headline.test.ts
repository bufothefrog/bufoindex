/**
 * paycheckHeadline: where one take-home paycheck goes, labelled and
 * formatted the way the payroll guide's paycheck flow printed it before the
 * rebuild. Necessary expenses and the allocated fun money are monthly and are
 * converted to the pay frequency; the priority share is the rest.
 */

import { describe, expect, it } from 'vitest';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import { paycheckFlow, paycheckHeadline } from '@/lib/calculators/paycheck/headline';
import { formatStatValue } from '@/lib/design-system/stat';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import {
  createIncomeData,
  createPaycheckProfile,
  createUserPreferences,
} from '@/test/factories/test-data-factory';

/** Only funMoneyAllocated is read from the result. */
function resultWithFunMoney(funMoneyAllocated: number): AllocationResult {
  return { ...calculateOptimalAllocation(createPaycheckProfile()), funMoneyAllocated };
}

function profile(frequency: PaycheckProfile['income']['frequency'], netPaycheck: number, necessaryExpenses: number) {
  return createPaycheckProfile({
    income: createIncomeData({ frequency, netPaycheck }),
    preferences: createUserPreferences({ necessaryExpenses }),
  });
}

const shown = (result: AllocationResult, inputs: PaycheckProfile) =>
  paycheckHeadline(result, inputs).map(({ id, label, value, format, tone }) => ({
    id,
    label,
    value: formatStatValue(value, format),
    tone,
  }));

describe('paycheckFlow', () => {
  it('converts the monthly spending to the pay frequency', () => {
    // Monthly: (3,000 + 200) per paycheck.
    expect(paycheckFlow(resultWithFunMoney(200), profile('monthly', 5000, 3000))).toEqual({
      takeHome: 5000,
      spending: 3200,
      priority: 1800,
    });
    // Semi-monthly: 3,200 / 2.
    expect(paycheckFlow(resultWithFunMoney(200), profile('semi-monthly', 2250, 3000))).toEqual({
      takeHome: 2250,
      spending: 1600,
      priority: 650,
    });
    // Weekly: 3,250 / (52 / 12) = 750.
    const weekly = paycheckFlow(resultWithFunMoney(250), profile('weekly', 1200, 3000));
    expect(weekly.spending).toBeCloseTo(750, 10);
    expect(weekly.priority).toBeCloseTo(450, 10);
  });

  it('lets the priority share go negative when spending exceeds take-home pay', () => {
    expect(paycheckFlow(resultWithFunMoney(200), profile('monthly', 2250, 3000)).priority).toBe(-950);
  });
});

describe('paycheckHeadline', () => {
  it('labels and formats the three figures as the paycheck flow did', () => {
    // Bi-weekly: 3,200 / (26 / 12) = 1,476.92 per paycheck; 2,250 - 1,476.92 = 773.08.
    expect(shown(resultWithFunMoney(200), profile('bi-weekly', 2250, 3000))).toEqual([
      { id: 'take-home', label: 'Take-Home Pay', value: '$2,250', tone: undefined },
      { id: 'spending', label: 'Expenses + Fun Money', value: '$1,477', tone: 'positive' },
      { id: 'priority', label: 'Priority Investments', value: '$773', tone: 'info' },
    ]);
  });

  it('reads the fun money the engine allocated', () => {
    const inputs = createPaycheckProfile();
    const result = calculateOptimalAllocation(inputs);
    // The factory's fun-money minimum is $200 a month.
    expect(result.funMoneyAllocated).toBe(200);
    expect(shown(result, inputs).map((stat) => stat.value)).toEqual(['$2,250', '$1,477', '$773']);
  });

  it('prints a negative priority share with a leading minus', () => {
    const [, , priority] = shown(resultWithFunMoney(200), profile('monthly', 2250, 3000));
    expect(priority.value).toBe('-$950');
  });
});
