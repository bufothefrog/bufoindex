import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  FORMAT_KINDS,
  MINUS_SIGN,
  formatCount,
  formatCurrency,
  formatMonths,
  formatMultiple,
  formatPercent,
  formatShares,
  formatValue,
  formatYearsAndMonths,
  getNumberFormat,
} from '@/lib/format';
// Reference implementations: core.ts still builds a fresh Intl formatter per
// call with the exact options lib/utils used before it delegated here.
import { formatCurrency as legacyCurrency, formatPercent as legacyPercent } from '@/lib/calculations/core';
import { formatCurrency as utilsCurrency, formatPercent as utilsPercent, formatYearsAndMonths as legacyYearsAndMonths } from '@/lib/utils';
import {
  formatCompactCurrency,
  formatLeverage,
  formatPct,
  formatSignedCompactCurrency,
  formatSignedPct,
} from '@/app/tools/leverage-comparison/components/format';
import { formatMonths as dashboardMonths } from '@/components/dashboard/derive';

/** The rebalancer's results-table formatter, copied verbatim as a reference. */
function rebalancerShares(n: number, mode: 'whole' | 'fractional'): string {
  if (mode === 'whole') return Math.round(n).toLocaleString('en-US');
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

const CURRENCY_VALUES = [0, 1, 0.4, 0.5, 1.5, 2.5, -0.4, -50, 999.5, 1234.56, 12_345.5, 578_000, 1_234_567.89, -98_765.4, 1e9];
const PERCENT_VALUES = [0, 0.001, 0.0005, 0.07, 0.075, 0.0795, 0.12345, 0.5, 1, 1.234, -0.05, -0.123, 12.5];
const COMPACT_VALUES = [0, 0.4, 0.6, 950, 999.4, 12_345, 99_949, 99_950, 578_000, 633_400, 999_999, 1_200_000, 9_994_000, 12_400_000, -950, -12_345, -1_200_000];
const SIGNED_PCT_VALUES = [0, 0.0004, -0.0004, 0.095, -0.1, 0.4339, -0.4339, 1.5, -0.00049];

describe('formatCurrency parity', () => {
  it.each(CURRENCY_VALUES)('default output matches the old lib/utils formatter for %s', (value) => {
    expect(formatCurrency(value)).toBe(legacyCurrency(value));
    expect(utilsCurrency(value)).toBe(legacyCurrency(value));
  });

  it.each(COMPACT_VALUES)('compact output matches leverage formatCompactCurrency for %s', (value) => {
    expect(formatCurrency(value, { compact: true })).toBe(formatCompactCurrency(value));
    expect(formatCurrency(value, { compact: true, signed: true })).toBe(formatSignedCompactCurrency(value));
  });

  it('pins the documented compact outputs', () => {
    expect(formatCurrency(578_000, { compact: true })).toBe('$578k');
    expect(formatCurrency(12_345, { compact: true })).toBe('$12.3k');
    expect(formatCurrency(1_200_000, { compact: true })).toBe('$1.20M');
    expect(formatCurrency(12_400_000, { compact: true })).toBe('$12.4M');
    expect(formatCurrency(-59_300, { compact: true, signed: true })).toBe(`${MINUS_SIGN}$59.3k`);
    expect(formatCurrency(54_800, { compact: true, signed: true })).toBe('+$54.8k');
    expect(formatCurrency(0.2, { compact: true, signed: true })).toBe('$0');
  });

  it('formats cents and signed whole dollars', () => {
    expect(formatCurrency(1234.5, { cents: true })).toBe('$1,234.50');
    expect(formatCurrency(-3, { cents: true })).toBe('-$3.00');
    expect(formatCurrency(1234.4, { signed: true })).toBe('+$1,234');
    expect(formatCurrency(-1234.4, { signed: true })).toBe(`${MINUS_SIGN}$1,234`);
    expect(formatCurrency(0.4, { signed: true })).toBe('$0');
    expect(formatCurrency(-0.4, { signed: true })).toBe('$0');
    expect(formatCurrency(-0.004, { signed: true, cents: true })).toBe('$0.00');
    expect(formatCurrency(0.01, { signed: true, cents: true })).toBe('+$0.01');
  });
});

describe('formatPercent parity', () => {
  it.each(PERCENT_VALUES)('default output matches the old lib/utils formatter for %s', (value) => {
    expect(formatPercent(value)).toBe(legacyPercent(value));
    expect(utilsPercent(value)).toBe(legacyPercent(value));
  });

  it.each(PERCENT_VALUES)('fixed digits match leverage formatPct for %s', (value) => {
    expect(formatPercent(value, { digits: 0 })).toBe(formatPct(value));
    expect(formatPercent(value, { digits: 2 })).toBe(formatPct(value, 2));
  });

  it.each(SIGNED_PCT_VALUES)('signed output matches leverage formatSignedPct for %s', (value) => {
    expect(formatPercent(value, { signed: true })).toBe(formatSignedPct(value));
    expect(formatPercent(value, { signed: true, digits: 0 })).toBe(formatSignedPct(value, 0));
  });

  it('pins the documented percent outputs', () => {
    expect(formatPercent(0.075)).toBe('7.5%');
    expect(formatPercent(0.434, { digits: 0 })).toBe('43%');
    expect(formatPercent(0.0795, { digits: 2 })).toBe('7.95%');
    expect(formatPercent(0.095, { signed: true })).toBe('+9.5%');
    expect(formatPercent(-0.1, { signed: true })).toBe(`${MINUS_SIGN}10.0%`);
    expect(formatPercent(0.0001, { signed: true })).toBe('0.0%');
  });
});

describe('formatMultiple', () => {
  it.each([1, 1.5, 2, 2.25, 3, 1.333333, 0.5])('matches leverage formatLeverage for %s', (value) => {
    expect(formatMultiple(value)).toBe(formatLeverage(value));
  });

  it('pins outputs, digits and the non-finite fallback', () => {
    expect(formatMultiple(2.25)).toBe('2.25x');
    expect(formatMultiple(2)).toBe('2x');
    expect(formatMultiple(1.5, { digits: 1 })).toBe('1.5x');
    expect(formatMultiple(Infinity)).toBe('-');
    expect(formatMultiple(Number.NaN)).toBe('-');
  });
});

describe('formatMonths', () => {
  it.each([0, 1, 1.04, 2.5, 2.56, 0.96, 12])('matches the dashboard formatter for %s', (value) => {
    expect(formatMonths(value)).toBe(dashboardMonths(value));
  });

  it('pins singular and plural', () => {
    expect(formatMonths(1)).toBe('1 month');
    expect(formatMonths(2.5)).toBe('2.5 months');
  });
});

describe('formatYearsAndMonths', () => {
  it.each([-1, 0, 0.05, 0.25, 1 / 12, 1, 1.5, 2, 2.99, 2.96, 10.0833])('matches lib/utils for %s', (value) => {
    expect(formatYearsAndMonths(value)).toBe(legacyYearsAndMonths(value));
  });

  it('pins the documented outputs', () => {
    expect(formatYearsAndMonths(0)).toBe('0 years');
    expect(formatYearsAndMonths(0.25)).toBe('3 months');
    expect(formatYearsAndMonths(1 / 12)).toBe('1 month');
    expect(formatYearsAndMonths(1)).toBe('1 year');
    expect(formatYearsAndMonths(2.5)).toBe('2 years 6 months');
    expect(formatYearsAndMonths(1 + 1 / 12)).toBe('1 year 1 month');
    expect(formatYearsAndMonths(2.99)).toBe('3 years');
  });
});

describe('formatShares and formatCount', () => {
  it.each([0, 1, 12.5, 1234.56789, 0.00004, 1_000_000.12345, -3.25])('matches the rebalancer formatter for %s', (value) => {
    expect(formatShares(value)).toBe(rebalancerShares(value, 'fractional'));
    expect(formatShares(value, { whole: true })).toBe(rebalancerShares(value, 'whole'));
  });

  it('formats counts with separators and no decimals', () => {
    expect(formatCount(1234.4)).toBe('1,234');
    expect(formatCount(500)).toBe('500');
  });
});

describe('formatValue', () => {
  it('dispatches every kind to its formatter', () => {
    const expected: Record<(typeof FORMAT_KINDS)[number], string> = {
      currency: '$1,235',
      currencyCents: '$1,234.56',
      currencyCompact: '$1.2k',
      currencySigned: '+$1,235',
      currencyCompactSigned: '+$1.2k',
      percent: '123,456%',
      percentSigned: '+123456.0%',
      multiple: '1234.56x',
      months: '1234.6 months',
      yearsAndMonths: '1234 years 7 months',
      shares: '1,234.56',
      count: '1,235',
    };
    for (const kind of FORMAT_KINDS) {
      expect(formatValue(1234.56, kind)).toBe(expected[kind]);
    }
  });

  it('renders missing values as the empty marker', () => {
    expect(formatValue(null, 'currency')).toBe(EMPTY_VALUE);
    expect(formatValue(undefined, 'percent')).toBe(EMPTY_VALUE);
    expect(formatValue(Number.NaN, 'count')).toBe(EMPTY_VALUE);
  });
});

describe('getNumberFormat cache', () => {
  it('returns the same Intl instance for equal options', () => {
    const a = getNumberFormat({ style: 'percent' });
    const b = getNumberFormat({ style: 'percent' });
    expect(a).toBe(b);
    expect(getNumberFormat()).toBe(getNumberFormat({}));
    expect(getNumberFormat({ maximumFractionDigits: 2 })).not.toBe(a);
  });
});
