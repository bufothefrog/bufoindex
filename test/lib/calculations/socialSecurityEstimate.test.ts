/**
 * The Social Security estimate (lib/calculations/socialSecurityEstimate.ts),
 * against hand-computed values with the 2026 figures: bend points 1,286 and
 * 7,749 a month, contribution and benefit base 184,500 a year.
 */

import { describe, expect, it } from 'vitest';
import {
  averageIndexedMonthlyEarnings,
  estimateSocialSecurityBenefit,
  primaryInsuranceAmount,
} from '@/lib/calculations/socialSecurityEstimate';

describe('estimateSocialSecurityBenefit', () => {
  it('below the first bend point: 90% only', () => {
    // 12,000 / 12 = 1,000 AIME; 0.9 x 1,000 = 900 a month; x 12 = 10,800.
    expect(averageIndexedMonthlyEarnings(12000)).toBeCloseTo(1000, 9);
    expect(primaryInsuranceAmount(1000)).toBeCloseTo(900, 9);
    expect(estimateSocialSecurityBenefit(12000)).toBeCloseTo(10800, 6);
  });

  it('between the bend points: 90% then 32%', () => {
    // 60,000 / 12 = 5,000 AIME.
    // 0.9 x 1,286 = 1,157.40; 0.32 x (5,000 - 1,286) = 0.32 x 3,714 = 1,188.48.
    // 1,157.40 + 1,188.48 = 2,345.88 a month; x 12 = 28,150.56.
    expect(primaryInsuranceAmount(5000)).toBeCloseTo(2345.88, 6);
    expect(estimateSocialSecurityBenefit(60000)).toBeCloseTo(28150.56, 6);
  });

  it('above the second bend point: 90%, 32% and 15%', () => {
    // 120,000 / 12 = 10,000 AIME.
    // 1,157.40 + 0.32 x (7,749 - 1,286) = 0.32 x 6,463 = 2,068.16
    // + 0.15 x (10,000 - 7,749) = 0.15 x 2,251 = 337.65.
    // 1,157.40 + 2,068.16 + 337.65 = 3,563.21 a month; x 12 = 42,758.52.
    expect(primaryInsuranceAmount(10000)).toBeCloseTo(3563.21, 6);
    expect(estimateSocialSecurityBenefit(120000)).toBeCloseTo(42758.52, 6);
  });

  it('the default profile pay (4,000 every two weeks = 104,000 a year)', () => {
    // 104,000 / 12 = 8,666.67 AIME.
    // 1,157.40 + 2,068.16 + 0.15 x (8,666.67 - 7,749) = 0.15 x 917.67 = 137.65.
    // 3,363.21 a month; x 12 = 40,358.52.
    expect(estimateSocialSecurityBenefit(104000)).toBeCloseTo(40358.52, 6);
  });

  it('above the contribution and benefit base: pay counts only up to 184,500', () => {
    // 184,500 / 12 = 15,375 AIME.
    // 1,157.40 + 2,068.16 + 0.15 x (15,375 - 7,749) = 0.15 x 7,626 = 1,143.90.
    // 4,369.46 a month; x 12 = 52,433.52, for the base and for any pay above it.
    expect(averageIndexedMonthlyEarnings(250000)).toBeCloseTo(15375, 9);
    expect(estimateSocialSecurityBenefit(184500)).toBeCloseTo(52433.52, 6);
    expect(estimateSocialSecurityBenefit(250000)).toBeCloseTo(52433.52, 6);
    expect(estimateSocialSecurityBenefit(1000000)).toBeCloseTo(52433.52, 6);
  });

  it('no pay, negative pay and a non-number estimate 0', () => {
    expect(estimateSocialSecurityBenefit(0)).toBe(0);
    expect(estimateSocialSecurityBenefit(-5000)).toBe(0);
    expect(estimateSocialSecurityBenefit(Number.NaN)).toBe(0);
    expect(estimateSocialSecurityBenefit(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('caps an infinite pay figure at the base like any pay above it', () => {
    expect(estimateSocialSecurityBenefit(Number.POSITIVE_INFINITY)).toBeCloseTo(52433.52, 6);
  });
});
