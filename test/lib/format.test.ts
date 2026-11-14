/**
 * Tests for the shared display formatters (lib/format.ts).
 *
 * Every expectation is a literal string (Intl en-US rounding is half away
 * from zero; Number.prototype.toFixed rounds the exact binary value).
 */

import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatCurrency,
  formatMonths,
  formatMultiple,
  formatPercent,
  formatShares,
  formatValue,
  formatYearsAndMonths,
  type CurrencyFormatOptions,
  type FormatKind,
  type PercentFormatOptions,
} from '@/lib/format';

const MINUS = '\u2212';

describe('formatCurrency', () => {
  const cases: Array<[number, CurrencyFormatOptions | undefined, string]> = [
    // Default: whole dollars, grouped, hyphen-minus (lib/utils formatCurrency)
    [0, undefined, '$0'],
    [1234, undefined, '$1,234'],
    [1234.5, undefined, '$1,235'],
    [0.5, undefined, '$1'],
    [-0.5, undefined, '-$1'],
    [-1234.4, undefined, '-$1,234'],
    [1_000_000_000, undefined, '$1,000,000,000'],
    [-0, undefined, '-$0'],
    [NaN, undefined, '$NaN'],
    // Cents
    [1234.5, { cents: true }, '$1,234.50'],
    [0, { cents: true }, '$0.00'],
    [-12.345, { cents: true }, '-$12.35'],
    // Compact (leverage formatCompactCurrency)
    [0, { compact: true }, '$0'],
    [950, { compact: true }, '$950'],
    [999.6, { compact: true }, '$1000'],
    [12_345, { compact: true }, '$12.3k'],
    [99_960, { compact: true }, '$100.0k'],
    [578_000, { compact: true }, '$578k'],
    [633_400, { compact: true }, '$633k'],
    [1_200_000, { compact: true }, '$1.20M'],
    [12_400_000, { compact: true }, '$12.4M'],
    // Exactly at each compact edge: the larger unit or the shorter form wins.
    [1_000, { compact: true }, '$1.0k'],
    [100_000, { compact: true }, '$100k'],
    [1_000_000, { compact: true }, '$1.00M'],
    [10_000_000, { compact: true }, '$10.0M'],
    [-59_300, { compact: true }, `${MINUS}$59.3k`],
    [-0.3, { compact: true }, `${MINUS}$0`],
    [1234.5, { compact: true, cents: true }, '$1.2k'],
    // Compact and signed (leverage formatSignedCompactCurrency)
    [54_800, { compact: true, signed: true }, '+$54.8k'],
    [-59_300, { compact: true, signed: true }, `${MINUS}$59.3k`],
    [1_500_000, { compact: true, signed: true }, '+$1.50M'],
    [0.4, { compact: true, signed: true }, '$0'],
    [-0.4, { compact: true, signed: true }, '$0'],
    [0, { compact: true, signed: true }, '$0'],
    [NaN, { compact: true, signed: true }, '$NaN'],
    // Axis (retirement MonteCarloChart formatAxisCurrency)
    [0, { compact: 'axis' }, '$0'],
    [950, { compact: 'axis' }, '$950'],
    [12_345, { compact: 'axis' }, '$12k'],
    [500_000, { compact: 'axis' }, '$500k'],
    [1_250_000, { compact: 'axis' }, '$1.3M'],
    [12_400_000, { compact: 'axis' }, '$12.4M'],
    // New behaviour, an intentional deviation: MonteCarloChart printed '$-5000'.
    [-5000, { compact: 'axis' }, `${MINUS}$5k`],
    // Signed, not compact
    [1234, { signed: true }, '+$1,234'],
    [-1234, { signed: true }, `${MINUS}$1,234`],
    [0.4, { signed: true }, '$0'],
    [-0.4, { signed: true }, '$0'],
    [NaN, { signed: true }, '$NaN'],
    [0.004, { signed: true, cents: true }, '$0.00'],
    [-5.5, { signed: true, cents: true }, `${MINUS}$5.50`],
  ];

  it.each(cases)('formatCurrency(%s, %o) -> %s', (value, options, expected) => {
    expect(formatCurrency(value, options)).toBe(expected);
  });
});

describe('formatPercent', () => {
  const cases: Array<[number, PercentFormatOptions | undefined, string]> = [
    // Default: 0 to 1 decimals, grouped (lib/utils formatPercent)
    [0, undefined, '0%'],
    [1, undefined, '100%'],
    [0.07, undefined, '7%'],
    [0.075, undefined, '7.5%'],
    [0.0795, undefined, '8%'],
    [0.12345, undefined, '12.3%'],
    [-0.25, undefined, '-25%'],
    [12.345, undefined, '1,234.5%'],
    [NaN, undefined, 'NaN%'],
    // Signed, default digits
    [0.095, { signed: true }, '+9.5%'],
    [-0.1, { signed: true }, `${MINUS}10%`],
    [0.0004, { signed: true }, '0%'],
    [-0.0004, { signed: true }, '0%'],
    // Fixed digits, no grouping (leverage formatPct, the PercentInput slider labels)
    [0.434, { digits: 0 }, '43%'],
    [0.125, { digits: 0 }, '13%'],
    [0.0795, { digits: 2 }, '7.95%'],
    [0.5, { digits: 1 }, '50.0%'],
    [12.345, { digits: 1 }, '1234.5%'],
    [-0.003, { digits: 1 }, '-0.3%'],
    [-0.0001, { digits: 1 }, '0.0%'],
    [0.0004, { digits: 1 }, '0.0%'],
    [NaN, { digits: 1 }, 'NaN%'],
    // Fixed digits and signed (leverage formatSignedPct)
    [0.095, { digits: 1, signed: true }, '+9.5%'],
    [-0.1, { digits: 1, signed: true }, `${MINUS}10.0%`],
    [0.0004, { digits: 1, signed: true }, '0.0%'],
    [-0.0004, { digits: 1, signed: true }, '0.0%'],
    [0.0795, { digits: 2, signed: true }, '+7.95%'],
  ];

  it.each(cases)('formatPercent(%s, %o) -> %s', (value, options, expected) => {
    expect(formatPercent(value, options)).toBe(expected);
  });

  it('reproduces the rebalancer drift column with signed only for positive values', () => {
    // RebalanceResults formatPercentPoints(d, true): "+" for gains, hyphen-minus for losses.
    const drift = (d: number) => formatPercent(d, { digits: 1, signed: d > 0 });
    expect(drift(0.0123)).toBe('+1.2%');
    expect(drift(-0.0123)).toBe('-1.2%');
    expect(drift(0.0004)).toBe('0.0%');
    expect(drift(-0.0004)).toBe('0.0%');
  });
});

describe('formatMultiple', () => {
  it.each([
    [1, '1x'],
    [2, '2x'],
    [3, '3x'],
    [1.5, '1.5x'],
    [2.25, '2.25x'],
    [2.256, '2.26x'],
    [2.999, '3x'],
    [-1.5, '-1.5x'],
    [NaN, '-'],
    [Infinity, '-'],
  ])('formatMultiple(%s) -> %s', (value, expected) => {
    expect(formatMultiple(value)).toBe(expected);
  });

  it.each([
    [2, '2x'],
    [1.5, '1.5x'],
    [1.96, '2.0x'],
    [2.25, '2.3x'],
  ])('formatMultiple(%s, { digits: 1, trimZeros: false }) -> %s', (value, expected) => {
    expect(formatMultiple(value, { digits: 1, trimZeros: false })).toBe(expected);
  });

  it('trims zeros left by rounding unless asked not to', () => {
    expect(formatMultiple(1.96, { digits: 1 })).toBe('2x');
  });
});

describe('formatMonths', () => {
  it.each([
    [1, '1 month'],
    [2.5, '2.5 months'],
    [0, '0 months'],
    [0.96, '1 month'],
    [2.04, '2 months'],
    [3.25, '3.3 months'],
    [12, '12 months'],
    [-1, '-1 months'],
  ])('formatMonths(%s) -> %s', (value, expected) => {
    expect(formatMonths(value)).toBe(expected);
  });
});

describe('formatYearsAndMonths', () => {
  it.each([
    [0, '0 years'],
    [-2, '0 years'],
    [1, '1 year'],
    [2, '2 years'],
    [0.25, '3 months'],
    [1 / 12, '1 month'],
    [2.5, '2 years 6 months'],
    [1 + 1 / 12, '1 year 1 month'],
    [0.99, '1 year'],
    [0.03, '0 months'],
  ])('formatYearsAndMonths(%s) -> %s', (value, expected) => {
    expect(formatYearsAndMonths(value)).toBe(expected);
  });
});

describe('formatShares', () => {
  it.each([
    [12.34567, '12.3457'],
    [1234.5, '1,234.5'],
    [0, '0'],
    [10, '10'],
  ])('formatShares(%s) -> %s', (value, expected) => {
    expect(formatShares(value)).toBe(expected);
  });

  it.each([
    [1234.5, '1,235'],
    [2.4, '2'],
    [-2.5, '-2'],
  ])('formatShares(%s, { whole: true }) -> %s', (value, expected) => {
    expect(formatShares(value, { whole: true })).toBe(expected);
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [500, '500'],
    [1000, '1,000'],
    [1_234_567, '1,234,567'],
  ])('formatCount(%s) -> %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });

  it('keeps up to 3 decimals by default, like toLocaleString', () => {
    expect(formatCount(1234.5678)).toBe('1,234.568');
    expect(formatCount(1234.5678)).toBe((1234.5678).toLocaleString('en-US'));
  });

  it.each([
    [1234.5, 2, '1,234.5'],
    [0.125, 2, '0.13'],
    [12.3456, 2, '12.35'],
    [7.000000000000001, 2, '7'],
    [-0.5, 2, '-0.5'],
    [2.6, 0, '3'],
    [1.23456, 4, '1.2346'],
  ])('formatCount(%s, { maxDigits: %s }) -> %s', (value, maxDigits, expected) => {
    expect(formatCount(value, { maxDigits })).toBe(expected);
  });
});

describe('formatValue', () => {
  const cases: Array<[number, FormatKind, string]> = [
    [1234.5, 'currency', '$1,235'],
    [1234.5, 'currency-cents', '$1,234.50'],
    [578_000, 'currency-compact', '$578k'],
    [-1234, 'currency-signed', `${MINUS}$1,234`],
    [54_800, 'currency-compact-signed', '+$54.8k'],
    [0.075, 'percent', '7.5%'],
    [0.03, 'percent-1', '3.0%'],
    [-0.1, 'percent-signed', `${MINUS}10%`],
    [2.25, 'multiple', '2.25x'],
    [2.5, 'months', '2.5 months'],
    [2.5, 'years-months', '2 years 6 months'],
    [1000, 'count', '1,000'],
    [12.34567, 'shares', '12.3457'],
  ];

  it.each(cases)('formatValue(%s, %s) -> %s', (value, kind, expected) => {
    expect(formatValue(value, kind)).toBe(expected);
  });
});
