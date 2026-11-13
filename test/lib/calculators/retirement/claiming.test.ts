/**
 * The claiming-age control's pure helpers (lib/calculators/retirement/claiming.ts):
 * the three choices, the nearest choice for a stored age, and the yearly
 * benefit at each choice from the engine's claiming-age adjustment.
 */

import { describe, expect, it } from 'vitest';
import {
  CLAIMING_AGE_CHOICES,
  claimingAgeBenefits,
  claimingAgeLabel,
  nearestClaimingAge,
} from '@/lib/calculators/retirement/claiming';

describe('CLAIMING_AGE_CHOICES', () => {
  it('offers 62 (early), 67 (full) and 70 (late)', () => {
    expect(CLAIMING_AGE_CHOICES).toEqual([
      { age: 62, label: '62 (early)' },
      { age: 67, label: '67 (full)' },
      { age: 70, label: '70 (late)' },
    ]);
  });
});

describe('nearestClaimingAge', () => {
  it('keeps each offered age', () => {
    expect([62, 67, 70].map(nearestClaimingAge)).toEqual([62, 67, 70]);
  });

  it('shows a stored age between the choices as the nearest one', () => {
    // 63 and 64 are nearer 62 (1 and 2 years) than 67 (4 and 3); 65 and 66 nearer 67; 68 nearer 67; 69 nearer 70.
    expect([63, 64, 65, 66, 68, 69].map(nearestClaimingAge)).toEqual([62, 62, 67, 67, 67, 70]);
  });

  it('breaks a tie toward the earlier age', () => {
    // 64.5 is 2.5 years from 62 and from 67; 68.5 is 1.5 years from 67 and from 70.
    expect(nearestClaimingAge(64.5)).toBe(62);
    expect(nearestClaimingAge(68.5)).toBe(67);
  });

  it('reads anything that is not a number as the full retirement age', () => {
    expect(nearestClaimingAge(undefined)).toBe(67);
    expect(nearestClaimingAge('65')).toBe(67);
    expect(nearestClaimingAge(Number.NaN)).toBe(67);
  });

  it('labels the nearest choice', () => {
    expect(claimingAgeLabel(65)).toBe('67 (full)');
    expect(claimingAgeLabel(62)).toBe('62 (early)');
    expect(claimingAgeLabel(70)).toBe('70 (late)');
  });
});

describe('claimingAgeBenefits', () => {
  it('adjusts the entered benefit for each age the way the engine does', () => {
    // $30,000 at 67. At 62, 60 months early: 36 months at 5/9% (20%) plus 24 months at 5/12% (10%),
    // a 30% reduction: $21,000. At 70, 3 years of 8% credits: +24%, $37,200.
    const rows = claimingAgeBenefits(30000);
    expect(rows.map((row) => [row.age, row.label])).toEqual([
      [62, '62 (early)'],
      [67, '67 (full)'],
      [70, '70 (late)'],
    ]);
    expect(rows[0].yearlyBenefit).toBeCloseTo(21000, 6);
    expect(rows[1].yearlyBenefit).toBeCloseTo(30000, 6);
    expect(rows[2].yearlyBenefit).toBeCloseTo(37200, 6);
  });

  it('counts a benefit that is not a number as 0', () => {
    expect(claimingAgeBenefits(undefined).map((row) => row.yearlyBenefit)).toEqual([0, 0, 0]);
  });
});
