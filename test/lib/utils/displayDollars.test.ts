/**
 * Tests for the display-layer dollar conversion helpers.
 *
 * These helpers move amounts between nominal (future) dollars and today's
 * purchasing power for display only — fixtures are hand-computed so a formula
 * regression cannot hide behind a re-derived expectation.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOLLAR_DISPLAY_MODE,
  DISPLAY_INFLATION_ASSUMPTION,
  displayDollars,
  displayRealDollars,
  toNominalDollars,
  toTodaysDollars,
} from '@/lib/utils/displayDollars';

describe('toTodaysDollars', () => {
  it('deflates $10,000 ten years out at 3% to $7,440.94', () => {
    expect(toTodaysDollars(10000, 0.03, 10)).toBeCloseTo(7440.94, 2);
  });

  it('deflates $1,000 one year out at 10% to $909.09', () => {
    expect(toTodaysDollars(1000, 0.1, 1)).toBeCloseTo(909.09, 2);
  });

  it('deflates $50,000 twenty years out at 2.5% to $30,513.55', () => {
    expect(toTodaysDollars(50000, 0.025, 20)).toBeCloseTo(30513.55, 2);
  });

  it('returns the amount unchanged at 0% inflation', () => {
    expect(toTodaysDollars(12345.67, 0, 25)).toBe(12345.67);
  });

  it('passes through when yearsFromNow is 0', () => {
    expect(toTodaysDollars(10000, 0.03, 0)).toBe(10000);
  });

  it('passes through when yearsFromNow is negative', () => {
    expect(toTodaysDollars(10000, 0.03, -5)).toBe(10000);
  });

  it('returns 0 for a zero amount', () => {
    expect(toTodaysDollars(0, 0.03, 10)).toBe(0);
  });
});

describe('toNominalDollars', () => {
  it('inflates $10,000 ten years out at 3% to $13,439.16', () => {
    expect(toNominalDollars(10000, 0.03, 10)).toBeCloseTo(13439.16, 2);
  });

  it('inflates $1,000 one year out at 10% to $1,100.00', () => {
    expect(toNominalDollars(1000, 0.1, 1)).toBeCloseTo(1100, 2);
  });

  it('round-trips with toTodaysDollars over a 35-year horizon', () => {
    const nominal = toNominalDollars(4000, 0.03, 35);
    expect(toTodaysDollars(nominal, 0.03, 35)).toBeCloseTo(4000, 6);
  });

  it('returns the amount unchanged at 0% inflation', () => {
    expect(toNominalDollars(12345.67, 0, 25)).toBe(12345.67);
  });

  it('passes through when yearsFromNow is 0 or negative', () => {
    expect(toNominalDollars(10000, 0.03, 0)).toBe(10000);
    expect(toNominalDollars(10000, 0.03, -5)).toBe(10000);
  });

  it('returns 0 for a zero amount', () => {
    expect(toNominalDollars(0, 0.03, 10)).toBe(0);
  });
});

describe('displayDollars', () => {
  it("deflates in 'today' mode", () => {
    expect(displayDollars(10000, 'today', 0.03, 10)).toBeCloseTo(7440.94, 2);
  });

  it("passes through unchanged in 'nominal' mode", () => {
    expect(displayDollars(10000, 'nominal', 0.03, 10)).toBe(10000);
  });

  it("passes through in 'today' mode when yearsFromNow <= 0", () => {
    expect(displayDollars(10000, 'today', 0.03, 0)).toBe(10000);
    expect(displayDollars(10000, 'today', 0.03, -1)).toBe(10000);
  });
});

describe('displayRealDollars', () => {
  it("passes an already-real amount through unchanged in 'today' mode", () => {
    expect(displayRealDollars(4000, 'today', 0.03, 35)).toBe(4000);
  });

  it("inflates to the year it occurs in 'nominal' mode", () => {
    // $4,000/month of today's purchasing power, 35 years out at 3%.
    expect(displayRealDollars(4000, 'nominal', 0.03, 35)).toBeCloseTo(
      4000 * Math.pow(1.03, 35),
      2
    );
  });

  it("passes through in 'nominal' mode when yearsFromNow <= 0", () => {
    expect(displayRealDollars(4000, 'nominal', 0.03, 0)).toBe(4000);
    expect(displayRealDollars(4000, 'nominal', 0.03, -1)).toBe(4000);
  });

  it('is the inverse of displayDollars across the two modes', () => {
    // A real amount inflated for future-dollar display, then deflated as a
    // nominal amount, lands back on the original figure.
    const shown = displayRealDollars(4000, 'nominal', 0.03, 35);
    expect(displayDollars(shown, 'today', 0.03, 35)).toBeCloseTo(4000, 6);
  });
});

describe('display constants', () => {
  it("defaults to today's dollars", () => {
    expect(DEFAULT_DOLLAR_DISPLAY_MODE).toBe('today');
  });

  it('assumes 3% inflation for calculators without an inflation input', () => {
    expect(DISPLAY_INFLATION_ASSUMPTION).toBe(0.03);
  });
});
