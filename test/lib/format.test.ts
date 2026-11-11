/**
 * Tests for the shared display formatters (lib/format.ts).
 *
 * Every expectation is a literal string, worked out from the legacy code
 * paths the new functions replace (Intl en-US rounding is half away from
 * zero; Number.prototype.toFixed rounds the exact binary value). The last
 * block compares the new functions to the legacy ones over the same inputs.
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
import {
  formatCurrency as utilsFormatCurrency,
  formatPercent as utilsFormatPercent,
  formatYearsAndMonths as utilsFormatYearsAndMonths,
} from '@/lib/utils';
import {
  formatCurrency as coreFormatCurrency,
  formatPercent as coreFormatPercent,
} from '@/lib/calculations/core';
import { formatPercent as percentInputFormatPercent } from '@/components/ui/inputs/PercentInput';
import {
  formatMonths as dashboardFormatMonths,
  formatMultiple as dashboardFormatMultiple,
} from '@/components/dashboard/derive';

const MINUS = '\u2212';

// The leverage results' own formatters, frozen here as they were when slice
// c7 deleted app/tools/leverage-comparison/components/format.ts, so the
// parity block below keeps comparing against them.

/** $950, $12.3k, $633k, $1.20M, $12.4M */
function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/** +$54.8k, or the U+2212 minus for a negative; $0 when it rounds to zero. */
function formatSignedCompactCurrency(value: number): string {
  if (Math.abs(value) < 0.5) return '$0';
  return value > 0 ? `+${formatCompactCurrency(value)}` : formatCompactCurrency(value);
}

/** 0.434 -> "43%"; 0.0795 with 2 digits -> "7.95%" */
function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** 0.095 -> "+9.5%", the U+2212 minus for a negative; rounds to zero -> "0.0%" */
function formatSignedPct(fraction: number, digits = 1): string {
  const rounded = Number((fraction * 100).toFixed(digits));
  const text = `${Math.abs(rounded).toFixed(digits)}%`;
  if (rounded === 0) return text;
  return rounded > 0 ? `+${text}` : `${MINUS}${text}`;
}

/** 2 -> "2x", 1.5 -> "1.5x" */
function formatLeverage(ratio: number): string {
  return `${Number(ratio.toFixed(2))}x`;
}

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
    // Fixed digits, no grouping (leverage formatPct, PercentInput formatPercent)
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
    [2, '2x'],
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

describe('parity with the legacy formatters (delete each case when its legacy formatter is deleted)', () => {
  const MONEY = [0, 0.4, 0.5, -0.5, 1, 950, 999.6, 1234, 1234.5, -1234.4, 12_345, 99_960, 578_000, -59_300, 1_200_000, 12_400_000, 1e9, NaN];
  const FRACTIONS = [0, 0.0004, -0.0004, 0.003, -0.003, 0.07, 0.075, 0.0795, 0.095, -0.1, 0.12345, 0.125, 0.434, 1, 12.345];
  const RATIOS = [1, 1.5, 2, 2.25, 2.256, 2.999, 3];

  it('lib/utils and lib/calculations/core formatCurrency equal formatCurrency(n)', () => {
    for (const n of MONEY) {
      expect(formatCurrency(n)).toBe(utilsFormatCurrency(n));
      expect(formatCurrency(n)).toBe(coreFormatCurrency(n));
    }
  });

  it('lib/utils and lib/calculations/core formatPercent equal formatPercent(f)', () => {
    for (const f of [...FRACTIONS, NaN]) {
      expect(formatPercent(f)).toBe(utilsFormatPercent(f));
      expect(formatPercent(f)).toBe(coreFormatPercent(f));
    }
  });

  it('leverage formatCompactCurrency equals formatCurrency(n, { compact: true })', () => {
    for (const n of [...MONEY, -0.3]) {
      expect(formatCurrency(n, { compact: true })).toBe(formatCompactCurrency(n));
    }
  });

  it('leverage formatSignedCompactCurrency equals formatCurrency(n, { compact: true, signed: true })', () => {
    for (const n of [...MONEY, -0.4, -54_800]) {
      expect(formatCurrency(n, { compact: true, signed: true })).toBe(formatSignedCompactCurrency(n));
    }
  });

  // formatPct and PercentInput formatPercent print "-0.0%" for small negatives;
  // the new function prints that as "0.0%". Every other output is identical.
  const unsignedZero = (legacy: string) => (/^-0(\.0+)?%$/.test(legacy) ? legacy.slice(1) : legacy);

  it('leverage formatPct equals formatPercent(f, { digits }), negative zero aside', () => {
    for (const f of FRACTIONS) {
      for (const digits of [0, 1, 2]) {
        expect(formatPercent(f, { digits })).toBe(unsignedZero(formatPct(f, digits)));
      }
      expect(formatPercent(f, { digits: 0 })).toBe(unsignedZero(formatPct(f)));
    }
    expect(formatPct(-0.0004, 1)).toBe('-0.0%');
  });

  it('leverage formatSignedPct equals formatPercent(f, { digits, signed: true })', () => {
    for (const f of FRACTIONS) {
      for (const digits of [0, 1, 2]) {
        expect(formatPercent(f, { digits, signed: true })).toBe(formatSignedPct(f, digits));
      }
      expect(formatPercent(f, { digits: 1, signed: true })).toBe(formatSignedPct(f));
    }
  });

  it('PercentInput formatPercent equals formatPercent(f, { digits }), negative zero aside', () => {
    for (const f of FRACTIONS) {
      expect(formatPercent(f, { digits: 1 })).toBe(unsignedZero(percentInputFormatPercent(f)));
      expect(formatPercent(f, { digits: 2 })).toBe(unsignedZero(percentInputFormatPercent(f, 2)));
    }
  });

  it('leverage formatLeverage equals formatMultiple(r)', () => {
    for (const r of RATIOS) {
      expect(formatMultiple(r)).toBe(formatLeverage(r));
    }
  });

  it('dashboard formatMultiple equals formatMultiple(v, { digits: 1, trimZeros: false })', () => {
    for (const v of [...RATIOS, 1.96, NaN, Infinity]) {
      expect(formatMultiple(v, { digits: 1, trimZeros: false })).toBe(dashboardFormatMultiple(v));
    }
  });

  it('dashboard formatMonths equals formatMonths', () => {
    for (const v of [0, 0.96, 1, 2.04, 2.5, 3.25, 12]) {
      expect(formatMonths(v)).toBe(dashboardFormatMonths(v));
    }
  });

  it('lib/utils formatYearsAndMonths equals formatYearsAndMonths', () => {
    for (const v of [-2, 0, 0.03, 0.25, 1 / 12, 0.99, 1, 1 + 1 / 12, 2, 2.5, 30.7]) {
      expect(formatYearsAndMonths(v)).toBe(utilsFormatYearsAndMonths(v));
    }
  });
});
