/**
 * Display formatters shared by every calculator, the dashboard and the
 * methodology pages (display only; nothing here feeds back into a model).
 *
 * Each Intl.NumberFormat is built once at module scope: constructing one costs
 * about 30 microseconds against under 1 for a cached instance
 * (docs/production-audit.md, H7).
 *
 * Default outputs were checked to be byte-identical to the legacy formatters
 * these replaced (the formatCurrency / formatPercent copies in lib/utils and
 * lib/calculations/core, and the leverage comparison's components/format.ts)
 * when those were deleted; the literal tables in test/lib/format.test.ts now
 * pin the outputs. Signed and compact output uses the U+2212 minus sign, as
 * the leverage results always have.
 *
 * Intentional deviations from legacy output (no option reproduces them):
 * - A percent that rounds to zero never prints a minus: leverage
 *   formatPct(-0.0049, 0) gave "-0%" and PercentInput gave "-0.0%".
 * - Signed NaN prints "NaN%" (leverage formatSignedPct gave a minus first).
 * - formatMultiple prints "-" for NaN and the infinities (formatLeverage
 *   gave "NaNx", "Infinityx", "-Infinityx").
 * - Negative axis ticks print like "-$5k" with a U+2212 minus; the
 *   retirement MonteCarloChart formatAxisCurrency gave "$-5000". Non-finite
 *   compact values are not guarded (-Infinity prints with an "M" suffix);
 *   callers pass finite numbers.
 * - percent-signed without digits follows formatPercent (0 to 1 decimals,
 *   grouped); the leverage formatSignedPct always had one decimal, so its
 *   callers pass { digits: 1, signed: true }.
 */

/** A value kind a results tile or table cell can be formatted as. */
export type FormatKind =
  | 'currency'
  | 'currency-cents'
  | 'currency-compact'
  | 'currency-signed'
  | 'currency-compact-signed'
  | 'percent'
  /** Exactly one decimal place: 0.03 -> "3.0%". */
  | 'percent-1'
  | 'percent-signed'
  | 'multiple'
  | 'months'
  | 'years-months'
  | 'count'
  | 'shares';

export interface CurrencyFormatOptions {
  /**
   * true: $950, $12.3k, $633k, $1.20M, $12.4M (three significant figures).
   * 'axis': one figure less, for chart ticks: $950, $12k, $633k, $1.2M.
   * Compact output ignores `cents`.
   */
  compact?: boolean | 'axis';
  /** +$54.8k / -$59.3k with a U+2212 minus; anything that rounds to zero prints unsigned. */
  signed?: boolean;
  /** Two decimal places ($1,234.50) instead of whole dollars. */
  cents?: boolean;
}

export interface PercentFormatOptions {
  /**
   * Exactly this many decimal places, without digit grouping (0.0795 with 2
   * -> "7.95%"). Omitted: 0 to 1 decimals with grouping (0.075 -> "7.5%",
   * 0.07 -> "7%"). A value that rounds to zero never prints a minus sign.
   */
  digits?: number;
  /**
   * +9.5% / -10% with a U+2212 minus (-10.0% with digits: 1); anything that
   * rounds to zero prints unsigned.
   */
  signed?: boolean;
}

export interface MultipleFormatOptions {
  /** Decimal places to round to (default 2: 2.25 -> "2.25x"). */
  digits?: number;
  /**
   * true (default): drop trailing zeros after rounding (2 -> "2x", 1.5 ->
   * "1.5x"). false: whole inputs print no decimals and every other input
   * prints exactly `digits` of them (1.96 with 1 digit -> "2.0x").
   */
  trimZeros?: boolean;
}

export interface CountFormatOptions {
  /**
   * At most this many decimal places, trailing zeros dropped, with grouping
   * (1234.5 with 2 -> "1,234.5"). Omitted: toLocaleString('en-US'), which
   * keeps up to 3.
   */
  maxDigits?: number;
}

export interface SharesFormatOptions {
  /** Round to whole shares (1,234). Default: up to 4 decimals (12.3457). */
  whole?: boolean;
}

const MINUS = '\u2212';

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Same output as Number.prototype.toLocaleString('en-US'). */
const DECIMAL = new Intl.NumberFormat('en-US');

/** Grouped decimals with at most N places, built once per N on first use. */
const DECIMAL_MAX_DIGITS = new Map<number, Intl.NumberFormat>();

function decimalWithMaxDigits(maxDigits: number): Intl.NumberFormat {
  let format = DECIMAL_MAX_DIGITS.get(maxDigits);
  if (!format) {
    format = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDigits });
    DECIMAL_MAX_DIGITS.set(maxDigits, format);
  }
  return format;
}

const FRACTIONAL_SHARES = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/** $950, $12.3k, $633k, $1.20M, $12.4M */
function compactCurrency(value: number): string {
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

/** $950, $12k, $1.2M */
function axisCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * Prefixes "+" or the U+2212 minus to an unsigned rendering of |value|.
 * Text that equals the rendering of zero, and NaN, print without a sign.
 */
function withSign(value: number, render: (abs: number) => string): string {
  const text = render(Math.abs(value));
  if (text === render(0)) return text;
  if (value > 0) return `+${text}`;
  if (value < 0) return `${MINUS}${text}`;
  return text;
}

/** $1,234 by default; see CurrencyFormatOptions for the variants. */
export function formatCurrency(amount: number, options: CurrencyFormatOptions = {}): string {
  const { compact = false, signed = false, cents = false } = options;
  const render =
    compact === 'axis'
      ? axisCurrency
      : compact
        ? compactCurrency
        : (n: number) => (cents ? USD_CENTS : USD).format(n);
  return signed ? withSign(amount, render) : render(amount);
}

/** 0.075 -> "7.5%" by default; see PercentFormatOptions for the variants. */
export function formatPercent(fraction: number, options: PercentFormatOptions = {}): string {
  const { digits, signed = false } = options;
  const render =
    digits === undefined
      ? (f: number) => PERCENT.format(f)
      : (f: number) => {
          const text = (f * 100).toFixed(digits);
          return `${Number(text) === 0 ? text.replace('-', '') : text}%`;
        };
  return signed ? withSign(fraction, render) : render(fraction);
}

/** 2.25 -> "2.25x", 2 -> "2x"; non-finite -> "-". */
export function formatMultiple(value: number, options: MultipleFormatOptions = {}): string {
  const { digits = 2, trimZeros = true } = options;
  if (!Number.isFinite(value)) return '-';
  if (trimZeros) return `${Number(value.toFixed(digits))}x`;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(digits)}x`;
}

/** 1 -> "1 month", 2.5 -> "2.5 months" (rounded to one decimal). */
export function formatMonths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'month' : 'months'}`;
}

/** 2.5 -> "2 years 6 months", 0.25 -> "3 months", anything <= 0 -> "0 years". */
export function formatYearsAndMonths(decimalYears: number): string {
  if (decimalYears <= 0) return '0 years';

  const years = Math.floor(decimalYears);
  const months = Math.round((decimalYears - years) * 12);

  // Rounding can produce 12 months; carry it into the years.
  const adjustedYears = months === 12 ? years + 1 : years;
  const adjustedMonths = months === 12 ? 0 : months;

  const yearText = `${adjustedYears} year${adjustedYears === 1 ? '' : 's'}`;
  const monthText = `${adjustedMonths} month${adjustedMonths === 1 ? '' : 's'}`;
  if (adjustedYears === 0) return monthText;
  if (adjustedMonths === 0) return yearText;
  return `${yearText} ${monthText}`;
}

/** 12.34567 -> "12.3457"; with { whole: true }, 1234.5 -> "1,235". */
export function formatShares(shares: number, options: SharesFormatOptions = {}): string {
  if (options.whole) return DECIMAL.format(Math.round(shares));
  return FRACTIONAL_SHARES.format(shares);
}

/**
 * 1000 -> "1,000" (same as toLocaleString('en-US')); with { maxDigits: 2 },
 * 0.125 -> "0.13".
 */
export function formatCount(value: number, options: CountFormatOptions = {}): string {
  const { maxDigits } = options;
  return (maxDigits === undefined ? DECIMAL : decimalWithMaxDigits(maxDigits)).format(value);
}

/** Formats a number as the given kind, for data-driven tiles and tables. */
export function formatValue(value: number, kind: FormatKind): string {
  switch (kind) {
    case 'currency':
      return formatCurrency(value);
    case 'currency-cents':
      return formatCurrency(value, { cents: true });
    case 'currency-compact':
      return formatCurrency(value, { compact: true });
    case 'currency-signed':
      return formatCurrency(value, { signed: true });
    case 'currency-compact-signed':
      return formatCurrency(value, { compact: true, signed: true });
    case 'percent':
      return formatPercent(value);
    case 'percent-1':
      return formatPercent(value, { digits: 1 });
    case 'percent-signed':
      return formatPercent(value, { signed: true });
    case 'multiple':
      return formatMultiple(value);
    case 'months':
      return formatMonths(value);
    case 'years-months':
      return formatYearsAndMonths(value);
    case 'count':
      return formatCount(value);
    case 'shares':
      return formatShares(value);
  }
}
