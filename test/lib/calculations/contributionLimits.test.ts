/**
 * The shared contribution limits: hand-computed 2026 values at every age
 * boundary, and parity with the allocator (lib/calculations/optimization.ts),
 * which keeps its own copies. Each parity case asks the engine for the whole
 * remaining room (no contributions yet, a monthly paycheck, unlimited money)
 * and reads the limit back off its recommendation.
 */

import { describe, expect, it } from 'vitest';
import {
  HIGH_INTEREST_THRESHOLD,
  limit401k,
  limit415c,
  limitHsa,
  limitIra,
} from '@/lib/calculations/contributionLimits';
import {
  calculateAdditional401k,
  calculateHighInterestDebt,
  calculateHSAOptimal,
  calculateMegaBackdoorRoth,
  calculateRothIRA,
} from '@/lib/calculations/optimization';
import type { PaycheckProfile } from '@/lib/types';
import {
  createBenefitsData,
  createDebtData,
  createEmployerBenefits,
  createHSABenefits,
  createIRAData,
  createIncomeData,
  createPaycheckProfile,
  createTaxData,
  createUserPreferences,
} from '@/test/factories/test-data-factory';

const AGES = [25, 49, 50, 54, 55, 59, 60, 61, 63, 64, 70];
const UNLIMITED = 1e9;

/** A monthly-pay profile with no contributions, so the engine offers the whole limit. */
function roomProfile(age: number, overrides: Partial<PaycheckProfile> = {}): PaycheckProfile {
  return createPaycheckProfile({
    income: createIncomeData({ frequency: 'monthly', gross: 5000, monthlyGross: 5000, netPaycheck: 4000 }),
    taxes: createTaxData({ federalBracket: 0.12, filingStatus: 'single' }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({
        available: true,
        currentContribution: 0,
        traditionalContribution: 0,
        rothContribution: 0,
        matchPercent: 0,
        matchLimit: 0,
        afterTaxAvailable: true,
      }),
      hsa: createHSABenefits({ eligible: true, currentContribution: 0, employerContribution: 0 }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age, isPeakEarnings: false, expectedRetirementBracket: 0.12 }),
    debts: [],
    ...overrides,
  });
}

describe('limit401k', () => {
  it('adds the regular catch-up at 50 and the super catch-up only from 60 to 63', () => {
    expect(limit401k(49)).toBe(24500);
    expect(limit401k(50)).toBe(32500); // 24,500 + 8,000
    expect(limit401k(59)).toBe(32500);
    expect(limit401k(60)).toBe(35750); // 24,500 + 11,250
    expect(limit401k(63)).toBe(35750);
    expect(limit401k(64)).toBe(32500);
  });

  it('equals the room the allocator offers at every age', () => {
    for (const age of AGES) {
      const item = calculateAdditional401k(roomProfile(age), UNLIMITED);
      expect(item?.amount, `age ${age}`).toBe(limit401k(age) / 12);
    }
  });
});

describe('limitIra', () => {
  it('adds the catch-up from 50', () => {
    expect(limitIra(49)).toBe(7500);
    expect(limitIra(50)).toBe(8600); // 7,500 + 1,100
    expect(limitIra(70)).toBe(8600);
  });

  it('equals the room the allocator offers below the phase-out at every age', () => {
    for (const age of AGES) {
      const item = calculateRothIRA(roomProfile(age), UNLIMITED);
      expect(item?.amount, `age ${age}`).toBeCloseTo(limitIra(age) / 12, 10);
    }
  });
});

describe('limitHsa', () => {
  it('takes the coverage tier and adds the catch-up from 55', () => {
    expect(limitHsa('individual', 54)).toBe(4400);
    expect(limitHsa('individual', 55)).toBe(5400);
    expect(limitHsa('family', 54)).toBe(8750);
    expect(limitHsa('family', 55)).toBe(9750);
  });

  it('equals the room the allocator offers for both tiers at every age', () => {
    for (const coverageType of ['individual', 'family'] as const) {
      for (const age of AGES) {
        const profile = roomProfile(age);
        profile.benefits.hsa.coverageType = coverageType;
        const item = calculateHSAOptimal(profile, UNLIMITED);
        expect(item?.amount, `${coverageType} at ${age}`).toBeCloseTo(limitHsa(coverageType, age) / 12, 10);
      }
    }
  });
});

describe('limit415c', () => {
  it('follows the same age bands as the 401(k) catch-ups', () => {
    expect(limit415c(49)).toBe(72000);
    expect(limit415c(50)).toBe(80000);
    expect(limit415c(60)).toBe(83250);
    expect(limit415c(63)).toBe(83250);
    expect(limit415c(64)).toBe(80000);
  });

  it('equals the after-tax room the allocator offers to a high earner at every age', () => {
    for (const age of AGES) {
      // Above the single Roth IRA phase-out (168,000 a year), so the
      // mega backdoor step applies.
      const profile = roomProfile(age, {
        income: createIncomeData({ frequency: 'monthly', gross: 20000, monthlyGross: 20000, netPaycheck: 12000 }),
      });
      const item = calculateMegaBackdoorRoth(profile, UNLIMITED);
      expect(item?.amount, `age ${age}`).toBeCloseTo(limit415c(age) / 12, 10);
    }
  });
});

describe('HIGH_INTEREST_THRESHOLD', () => {
  it('is 7%, and the allocator counts only rates above it', () => {
    expect(HIGH_INTEREST_THRESHOLD).toBe(0.07);
    const at = roomProfile(30, { debts: [createDebtData({ interestRate: HIGH_INTEREST_THRESHOLD })] });
    const above = roomProfile(30, { debts: [createDebtData({ interestRate: HIGH_INTEREST_THRESHOLD + 0.0001 })] });
    expect(calculateHighInterestDebt(at, 100_000)).toBeNull();
    expect(calculateHighInterestDebt(above, 100_000)).not.toBeNull();
  });
});
