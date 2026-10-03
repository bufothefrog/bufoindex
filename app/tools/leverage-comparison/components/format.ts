/**
 * Display formatters for the leverage comparison results (display only).
 */

const MINUS = '−';

/** $950, $12.3k, $633k, $1.20M, $12.4M */
export function formatCompactCurrency(value: number): string {
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

/** +$54.8k / −$59.3k / $0 */
export function formatSignedCompactCurrency(value: number): string {
  if (Math.abs(value) < 0.5) return '$0';
  return value > 0 ? `+${formatCompactCurrency(value)}` : formatCompactCurrency(value);
}

/** 0.434 -> "43%"; 0.0795 with 2 digits -> "7.95%" */
export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** 0.095 -> "+9.5%"; -0.1 -> "−10.0%"; rounds to zero -> "0.0%" */
export function formatSignedPct(fraction: number, digits = 1): string {
  const rounded = Number((fraction * 100).toFixed(digits));
  const text = `${Math.abs(rounded).toFixed(digits)}%`;
  if (rounded === 0) return text;
  return rounded > 0 ? `+${text}` : `${MINUS}${text}`;
}

/** 2 -> "2x", 1.5 -> "1.5x" */
export function formatLeverage(ratio: number): string {
  return `${Number(ratio.toFixed(2))}x`;
}
