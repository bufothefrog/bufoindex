/**
 * Display formatting for every calculator, the dashboard and the wizard.
 *
 * Pure and dependency-free (no React, no clsx), so the retirement worker can
 * import it without pulling UI helpers into its bundle. Intl.NumberFormat
 * instances are cached per option set: constructing one per call cost about
 * 74 ms on the overview's first render (docs/production-audit.md).
 *
 * Default outputs are byte-identical to the formatters they replace:
 * - formatCurrency / formatPercent: lib/utils formatCurrency / formatPercent
 * - formatCurrency compact (+ signed), formatPercent with digits (+ signed),
 *   formatMultiple: app/tools/leverage-comparison/components/format.ts
 * - formatMonths: components/dashboard/derive.ts
 * - formatYearsAndMonths: lib/utils formatYearsAndMonths
 * - formatShares: the rebalancer's results table
 * test/lib/format.test.ts holds the parity tables.
 */

/** U+2212, used by the signed and compact formats (matches the leverage results). */
export const MINUS_SIGN = '−';

/** Shown in place of a missing value. */
export const EMPTY_VALUE = '—';

const formatterCache = new Map<string, Intl.NumberFormat>();

/** A cached en-US Intl.NumberFormat for `options`. */
export function getNumberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

const CURRENCY_WHOLE: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

const CURRENCY_CENTS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const PERCENT_DEFAULT: Intl.NumberFormatOptions = {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
};

/* ------------------------------------------------------------------ */
/* Currency                                                           */
/* ------------------------------------------------------------------ */

export interface CurrencyFormatOptions {
  /** $950, $12.3k, $633k, $1.20M, $12.4M (negative values use U+2212). */
  compact?: boolean;
  /** Prefix '+' for positive values and U+2212 for negative; zero has no sign. */
  signed?: boolean;
  /** Two decimal places (ignored when compact). */
  cents?: boolean;
}

function compactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS_SIGN : '';
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

/**
 * US dollars. With no options: whole dollars via Intl ("$1,235", "-$50"),
 * identical to the lib/utils formatter it replaces.
 */
export function formatCurrency(amount: number, options: CurrencyFormatOptions = {}): string {
  const { compact = false, signed = false, cents = false } = options;

  if (compact) {
    if (!signed) return compactCurrency(amount);
    if (Math.abs(amount) < 0.5) return '$0';
    return amount > 0 ? `+${compactCurrency(amount)}` : compactCurrency(amount);
  }

  const formatter = getNumberFormat(cents ? CURRENCY_CENTS : CURRENCY_WHOLE);
  if (!signed) return formatter.format(amount);

  const text = formatter.format(Math.abs(amount));
  // Anything that rounds to zero is shown without a sign.
  if (!/[1-9]/.test(text)) return text;
  return amount > 0 ? `+${text}` : `${MINUS_SIGN}${text}`;
}

/* ------------------------------------------------------------------ */
/* Percent                                                            */
/* ------------------------------------------------------------------ */

export interface PercentFormatOptions {
  /**
   * Fixed decimal places ("43%", "7.95%"), no thousands separator. Omitted:
   * Intl percent with 0 to 1 decimals ("8%", "7.5%"), unless `signed`, which
   * defaults to 1 digit.
   */
  digits?: number;
  /** "+9.5%" / "−10.0%"; a value that rounds to zero has no sign ("0.0%"). */
  signed?: boolean;
}

/** A decimal fraction as a percentage: 0.075 -> "7.5%". */
export function formatPercent(fraction: number, options: PercentFormatOptions = {}): string {
  if (options.signed) {
    const digits = options.digits ?? 1;
    const rounded = Number((fraction * 100).toFixed(digits));
    const text = `${Math.abs(rounded).toFixed(digits)}%`;
    if (rounded === 0) return text;
    return rounded > 0 ? `+${text}` : `${MINUS_SIGN}${text}`;
  }

  if (options.digits === undefined) return getNumberFormat(PERCENT_DEFAULT).format(fraction);
  return `${(fraction * 100).toFixed(options.digits)}%`;
}

/* ------------------------------------------------------------------ */
/* Other kinds                                                        */
/* ------------------------------------------------------------------ */

export interface MultipleFormatOptions {
  /** Maximum decimal places; trailing zeros are dropped. Default 2. */
  digits?: number;
}

/** 2 -> "2x", 1.5 -> "1.5x", 2.25 -> "2.25x"; non-finite -> "-". */
export function formatMultiple(value: number, options: MultipleFormatOptions = {}): string {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value.toFixed(options.digits ?? 2))}x`;
}

/** 1 -> "1 month", 2.5 -> "2.5 months" (one decimal at most). */
export function formatMonths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'month' : 'months'}`;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** 2.5 -> "2 years 6 months", 0.25 -> "3 months", 0 or less -> "0 years". */
export function formatYearsAndMonths(decimalYears: number): string {
  if (decimalYears <= 0) return '0 years';

  const years = Math.floor(decimalYears);
  const months = Math.round((decimalYears - years) * 12);
  // Rounding can land on 12 months; carry it into the years.
  const adjustedYears = months === 12 ? years + 1 : years;
  const adjustedMonths = months === 12 ? 0 : months;

  if (adjustedYears === 0) return plural(adjustedMonths, 'month');
  if (adjustedMonths === 0) return plural(adjustedYears, 'year');
  return `${plural(adjustedYears, 'year')} ${plural(adjustedMonths, 'month')}`;
}

export interface SharesFormatOptions {
  /** Round to whole shares. Default false (up to 4 decimals). */
  whole?: boolean;
}

/** 12.5 -> "12.5", 1234.56789 -> "1,234.5679"; whole: 12.5 -> "13". */
export function formatShares(shares: number, options: SharesFormatOptions = {}): string {
  if (options.whole) return getNumberFormat({ maximumFractionDigits: 0 }).format(Math.round(shares));
  return getNumberFormat({ minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(shares);
}

/** A whole count with thousands separators: 1234.4 -> "1,234". */
export function formatCount(value: number): string {
  return getNumberFormat({ maximumFractionDigits: 0 }).format(value);
}

/* ------------------------------------------------------------------ */
/* By kind                                                            */
/* ------------------------------------------------------------------ */

export const FORMAT_KINDS = [
  'currency',
  'currencyCents',
  'currencyCompact',
  'currencySigned',
  'currencyCompactSigned',
  'percent',
  'percentSigned',
  'multiple',
  'months',
  'yearsAndMonths',
  'shares',
  'count',
] as const;

/** How a StatSpec (lib/design-system/stat.ts) or a table cell formats its number. */
export type FormatKind = (typeof FORMAT_KINDS)[number];

/** Formats `value` as `kind`; null, undefined and NaN render as EMPTY_VALUE. */
export function formatValue(value: number | null | undefined, kind: FormatKind): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE;
  switch (kind) {
    case 'currency':
      return formatCurrency(value);
    case 'currencyCents':
      return formatCurrency(value, { cents: true });
    case 'currencyCompact':
      return formatCurrency(value, { compact: true });
    case 'currencySigned':
      return formatCurrency(value, { signed: true });
    case 'currencyCompactSigned':
      return formatCurrency(value, { compact: true, signed: true });
    case 'percent':
      return formatPercent(value);
    case 'percentSigned':
      return formatPercent(value, { signed: true });
    case 'multiple':
      return formatMultiple(value);
    case 'months':
      return formatMonths(value);
    case 'yearsAndMonths':
      return formatYearsAndMonths(value);
    case 'shares':
      return formatShares(value);
    case 'count':
      return formatCount(value);
  }
}
