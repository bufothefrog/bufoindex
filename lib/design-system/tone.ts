/**
 * The one tone scale for results, alerts and tiles.
 *
 * Results, alerts, tiles, progress bars and list cards take a `tone` from
 * this scale; the older alert and card variants are gone. BaseCard's
 * `color`, ResultCard's `status` and OptionCard's `tone` keep their own
 * small vocabularies for card borders, titles and option surfaces.
 *
 * Every class below is a semantic token (or the sage brand scale with its
 * dark-mode pair), so each map works in light and dark mode. The strings are
 * written out in full so Tailwind's source scan picks them up.
 */

export type Tone = 'neutral' | 'positive' | 'caution' | 'negative' | 'info' | 'brand';

/** Every tone, in display order (for the /demo gallery and table-driven tests). */
export const TONES: readonly Tone[] = ['neutral', 'positive', 'caution', 'negative', 'info', 'brand'];

/** Text color for a figure, a title or an icon. */
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  neutral: 'text-foreground',
  positive: 'text-success',
  caution: 'text-warning',
  negative: 'text-destructive',
  info: 'text-info',
  brand: 'text-sage-700 dark:text-sage-300',
};

/** Border color for a tinted surface (pair it with TONE_SURFACE). */
export const TONE_BORDER: Readonly<Record<Tone, string>> = {
  neutral: 'border-border',
  positive: 'border-success/30',
  caution: 'border-warning/30',
  negative: 'border-destructive/30',
  info: 'border-info/30',
  brand: 'border-sage-400 dark:border-sage-500',
};

/** Background tint for a tile, an alert or a selected option. */
export const TONE_SURFACE: Readonly<Record<Tone, string>> = {
  neutral: 'bg-muted/40',
  positive: 'bg-success/10',
  caution: 'bg-warning/10',
  negative: 'bg-destructive/10',
  info: 'bg-info/10',
  brand: 'bg-sage-50 dark:bg-sage-800/50',
};

/** Solid fill for a bar or a marker (ProgressBar). */
export const TONE_FILL: Readonly<Record<Tone, string>> = {
  neutral: 'bg-muted-foreground',
  positive: 'bg-success',
  caution: 'bg-warning',
  negative: 'bg-destructive',
  info: 'bg-info',
  brand: 'bg-sage-500 dark:bg-sage-400',
};
