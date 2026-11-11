/**
 * The one tone scale for results, alerts, rows and progress bars.
 *
 * It replaces the per-component vocabularies ('success' | 'warning' |
 * 'danger', 'error', 'up' | 'down', the sage brand color, ...) and avoids
 * the CardVariant name clash in lib/design-system/types.ts. Every class here
 * is a semantic token, so light and dark mode come from app/globals.css.
 *
 * Tone describes how a figure reads against the user's own inputs (a
 * shortfall, a surplus); it never asserts that one choice is right.
 */

export const TONES = ['neutral', 'positive', 'caution', 'negative', 'info', 'brand'] as const;

export type Tone = (typeof TONES)[number];

/** Text color for a value, title or icon in this tone. */
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  neutral: 'text-foreground',
  positive: 'text-success',
  caution: 'text-warning',
  negative: 'text-destructive',
  info: 'text-info',
  brand: 'text-primary',
};

/** Border color for a tinted container in this tone. */
export const TONE_BORDER: Readonly<Record<Tone, string>> = {
  neutral: 'border-border',
  positive: 'border-success/40',
  caution: 'border-warning/50',
  negative: 'border-destructive/50',
  info: 'border-info/40',
  brand: 'border-sage-400 dark:border-sage-500',
};

/** Background for a tinted container in this tone. */
export const TONE_SURFACE: Readonly<Record<Tone, string>> = {
  neutral: 'bg-muted/40',
  positive: 'bg-success/10',
  caution: 'bg-warning/10',
  negative: 'bg-destructive/10',
  info: 'bg-info/10',
  brand: 'bg-sage-50 dark:bg-sage-800/50',
};

/** Solid fill (progress bars, markers) in this tone. */
export const TONE_FILL: Readonly<Record<Tone, string>> = {
  neutral: 'bg-muted-foreground',
  positive: 'bg-success',
  caution: 'bg-warning',
  negative: 'bg-destructive',
  info: 'bg-info',
  brand: 'bg-sage-500 dark:bg-sage-400',
};

/** Every legacy tone spelling still passed by callers (variant, status, color, direction). */
export type LegacyTone =
  | Tone
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'error'
  | 'destructive'
  | 'sage'
  | 'primary'
  | 'up'
  | 'down'
  | 'good'
  | 'bad';

const LEGACY_TONE: Readonly<Record<LegacyTone, Tone>> = {
  neutral: 'neutral',
  positive: 'positive',
  caution: 'caution',
  negative: 'negative',
  info: 'info',
  brand: 'brand',
  default: 'neutral',
  success: 'positive',
  warning: 'caution',
  danger: 'negative',
  error: 'negative',
  destructive: 'negative',
  sage: 'brand',
  primary: 'brand',
  up: 'positive',
  down: 'negative',
  good: 'positive',
  bad: 'negative',
};

export function isTone(value: unknown): value is Tone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value);
}

/** Maps a legacy variant / status / color / direction name onto the Tone scale. */
export function toneFromLegacy(value: LegacyTone | null | undefined, fallback: Tone = 'neutral'): Tone {
  if (value === null || value === undefined) return fallback;
  return Object.prototype.hasOwnProperty.call(LEGACY_TONE, value) ? LEGACY_TONE[value] : fallback;
}
