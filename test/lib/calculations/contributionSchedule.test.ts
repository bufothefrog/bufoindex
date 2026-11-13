/**
 * The contribution schedule helpers (lib/calculations/contributionSchedule.ts):
 * the monthly-rate convention, the split of a total into monthly and yearly
 * parts, and the future value of the two streams. Expected numbers are
 * hand-computed in the comments (contract examples E1 to E5).
 */

import { describe, expect, it } from 'vitest';
import {
  growOneYear,
  monthlyRateOf,
  scheduleFactor,
  scheduleFutureValue,
  splitSchedule,
  yearStartDeposit,
  yearStartShareOf,
} from '@/lib/calculations/contributionSchedule';

const i10 = 0.007974140428903764; // 1.1^(1/12) - 1
const i8 = 0.00643403011000343; // 1.08^(1/12) - 1

describe('monthlyRateOf', () => {
  it('is (1 + r)^(1/12) - 1, so twelve months compound to exactly 1 + r', () => {
    expect(monthlyRateOf(0.08)).toBe(0.00643403011000343);
    expect(monthlyRateOf(0.1)).toBeCloseTo(i10, 15);
    expect(Math.pow(1 + monthlyRateOf(0.08), 12)).toBeCloseTo(1.08, 12);
    expect(monthlyRateOf(0)).toBe(0);
  });
});

describe('splitSchedule (E5)', () => {
  it('splits a total into its monthly rest and the yearly dollars', () => {
    expect(splitSchedule(2165, 7500)).toEqual({ monthly: 1540, yearStart: 7500 });
    expect(splitSchedule(3195, 7500)).toEqual({ monthly: 2570, yearStart: 7500 });
  });

  it('passes the total through untouched with no yearly part', () => {
    expect(splitSchedule(1540, 0).monthly).toBe(1540);
    expect(splitSchedule(1540, 0)).toEqual({ monthly: 1540, yearStart: 0 });
    expect(splitSchedule(0, 0)).toEqual({ monthly: 0, yearStart: 0 });
  });

  it('reads NaN, undefined and a negative yearly amount as 0', () => {
    expect(splitSchedule(1540, NaN)).toEqual({ monthly: 1540, yearStart: 0 });
    expect(splitSchedule(1540, undefined)).toEqual({ monthly: 1540, yearStart: 0 });
    expect(splitSchedule(100, -5)).toEqual({ monthly: 100, yearStart: 0 });
  });

  it('keeps a negative total untouched (nothing can be yearly)', () => {
    expect(splitSchedule(-1, 1200)).toEqual({ monthly: -1, yearStart: 0 });
  });

  it('caps the yearly part at 12 x the total', () => {
    expect(splitSchedule(100, 5000)).toEqual({ monthly: 0, yearStart: 1200 });
  });

  it('gives exactly 0 monthly for an all-yearly rounded total', () => {
    // 12 x 333.33 = 3,999.96, the cap; 333.33 - 3,999.96 / 12 is a floating residue, read as 0.
    const s = splitSchedule(333.33, 4000);
    expect(s.monthly).toBe(0);
    expect(s.yearStart).toBeCloseTo(3999.96, 9);
  });
});

describe('yearStartShareOf', () => {
  it('is the yearly dollars over the yearly total, clamped to 0..1', () => {
    // 7,500 / (12 x 3,195 = 38,340) = 0.195618...
    expect(yearStartShareOf(3195, 7500)).toBeCloseTo(0.19562, 5);
    expect(yearStartShareOf(0, 1200)).toBe(0);
    expect(yearStartShareOf(100, NaN)).toBe(0);
    expect(yearStartShareOf(100, undefined)).toBe(0);
    expect(yearStartShareOf(100, 5000)).toBe(1);
    expect(yearStartShareOf(100, -5)).toBe(0);
  });
});

describe('scheduleFutureValue', () => {
  it('E1: 1,000 at the start of each year, 10%, 3 years = 3,641', () => {
    // 1000 x 1.1 = 1100; (1100 + 1000) x 1.1 = 2310; (2310 + 1000) x 1.1 = 3641.
    expect(scheduleFutureValue({ monthly: 0, yearStart: 1000 }, 0.1, 36)).toBeCloseTo(3641, 6);
  });

  it('E2: the same 1,200 a year, monthly against at the start of each year', () => {
    // Monthly: 100 x (1.331 - 1) / i10.
    expect(scheduleFutureValue({ monthly: 100, yearStart: 0 }, 0.1, 36)).toBeCloseTo(4150.917618659306, 8);
    // Yearly: 1200 x (1.331 + 1.21 + 1.1) = 4,369.20.
    expect(scheduleFutureValue({ monthly: 0, yearStart: 1200 }, 0.1, 36)).toBeCloseTo(4369.2, 8);
    // One year: 100 x 0.1 / i10 = 1,254.0537 against 1,200 x 1.1 = 1,320.
    expect(scheduleFutureValue({ monthly: 100, yearStart: 0 }, 0.1, 12)).toBeCloseTo(1254.0537, 4);
    expect(scheduleFutureValue({ monthly: 0, yearStart: 1200 }, 0.1, 12)).toBeCloseTo(1320, 8);
  });

  it('E2: the monthly part is the ordinary annuity expression, bit for bit', () => {
    expect(scheduleFutureValue({ monthly: 100, yearStart: 0 }, 0.1, 36)).toBe(
      100 * ((Math.pow(1 + monthlyRateOf(0.1), 36) - 1) / monthlyRateOf(0.1))
    );
  });

  it('E3: mixed 60 a month and 480 a year at 8% over 3 years = 4,104.855904', () => {
    // 60 x (1.259712 - 1) / i8 = 2,421.922144; 480 x (1.259712 + 1.1664 + 1.08) = 1,682.933760.
    expect(60 * ((1.259712 - 1) / i8)).toBeCloseTo(2421.922144, 5);
    expect(scheduleFutureValue({ monthly: 60, yearStart: 480 }, 0.08, 36)).toBeCloseTo(4104.855904, 5);
  });

  it('E3 at a zero rate: 60 x 36 + 480 x 3 = 3,600', () => {
    expect(scheduleFutureValue({ monthly: 60, yearStart: 480 }, 0, 36)).toBe(3600);
  });

  it('E4: a final partial year prorates the last yearly amount', () => {
    // k = 1, q = 6: (1200 x 1.1 + 600) x 1.1^0.5 = 1920 x 1.0488088 = 2,013.712988.
    expect(scheduleFutureValue({ monthly: 0, yearStart: 1200 }, 0.1, 18)).toBeCloseTo(2013.712988, 5);
    // 100 x (1.1^1.5 - 1) / i10 = 1,927.3517.
    expect(scheduleFutureValue({ monthly: 100, yearStart: 0 }, 0.1, 18)).toBeCloseTo(1927.3517, 4);
  });

  it('is 0 for zero, negative or non-finite months, and for a zero schedule', () => {
    expect(scheduleFutureValue({ monthly: 100, yearStart: 1200 }, 0.1, 0)).toBe(0);
    expect(scheduleFutureValue({ monthly: 100, yearStart: 1200 }, 0.1, -12)).toBe(0);
    expect(scheduleFutureValue({ monthly: 100, yearStart: 1200 }, 0.1, NaN)).toBe(0);
    expect(scheduleFutureValue(splitSchedule(0, 0), 0.08, 36)).toBe(0);
  });
});

describe('growOneYear', () => {
  it('adds the yearly amount first, then 12 months of growth and end-of-month deposits', () => {
    // E1 year 1 at 10%, no monthly part: 1000 x 1.1.
    expect(growOneYear(0, 0.1, { monthly: 0, yearStart: 1000 })).toBeCloseTo(1100, 9);
    // 1,200 a year paid monthly: 100 x 0.1 / i10.
    expect(growOneYear(0, 0.1, { monthly: 100, yearStart: 0 })).toBeCloseTo(1254.0537, 4);
    // A starting balance grows a full year: 500 x 1.08.
    expect(growOneYear(500, 0.08, { monthly: 0, yearStart: 0 })).toBeCloseTo(540, 9);
  });

  it('matches scheduleFutureValue over whole years', () => {
    let b = 0;
    const s = { monthly: 60, yearStart: 480 };
    for (let year = 0; year < 3; year++) b = growOneYear(b, 0.08, s);
    expect(b).toBeCloseTo(4104.855904, 5);
  });
});

describe('scheduleFactor', () => {
  it('is the ordinary annuity factor at share 0, in the same operation order', () => {
    const i = monthlyRateOf(0.1);
    expect(scheduleFactor(0.1, 36, 0)).toBe((Math.pow(1 + i, 36) - 1) / i);
    expect(scheduleFactor(0.1, 36, 0)).toBeCloseTo(41.50917618659306, 10);
    expect(scheduleFactor(0, 36, 0)).toBe(36);
    expect(scheduleFactor(0.1, 36, NaN)).toBe(scheduleFactor(0.1, 36, 0));
  });

  it('is the per-dollar value of the split schedule for a share above 0, clamped at 1', () => {
    // Share 1 at 10% over 3 years: 12 x (1.331 + 1.21 + 1.1) = 43.692.
    expect(scheduleFactor(0.1, 36, 1)).toBeCloseTo(43.692, 9);
    expect(scheduleFactor(0.1, 36, 2)).toBeCloseTo(43.692, 9);
    // Share 0.5: half of each.
    expect(scheduleFactor(0.1, 36, 0.5)).toBeCloseTo((41.50917618659306 + 43.692) / 2, 9);
  });
});

describe('yearStartDeposit', () => {
  it('E4: lands at month 0, 12, ... prorating the final partial year', () => {
    expect(yearStartDeposit(1200, 0, 18)).toBe(1200);
    expect(yearStartDeposit(1200, 12, 18)).toBe(600);
    expect(yearStartDeposit(1200, 5, 18)).toBe(0);
    expect(yearStartDeposit(1200, 0, 6)).toBe(600);
    expect(yearStartDeposit(1200, 18, 18)).toBe(0);
  });

  it('is 0 for a yearly amount of 0 or less, or NaN', () => {
    expect(yearStartDeposit(0, 0, 18)).toBe(0);
    expect(yearStartDeposit(-100, 0, 18)).toBe(0);
    expect(yearStartDeposit(NaN, 0, 18)).toBe(0);
  });

  it('sums to the same dollars as the monthly stream', () => {
    let total = 0;
    for (let m = 0; m < 18; m++) total += yearStartDeposit(1200, m, 18);
    expect(total).toBe(1800);
  });
});
