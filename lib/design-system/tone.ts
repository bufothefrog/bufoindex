/**
 * The one tone scale for results, alerts and tiles.
 *
 * It replaces seven older vocabularies that named the same few colors
 * differently: StatusAlert (info / warning / danger / success), BreakdownRow
 * (default / success / warning / danger / info), ExpandableListCard's
 * CardVariant (default / success / warning / danger, which also clashed with
 * the CardVariant in lib/design-system/types.ts), BaseCard's ComponentColor
 * and ResultCard's status (sage / success / warning / error / info),
 * SummaryCard's change direction (up / down / neutral), OptionCard's tone
 * (default / emphasis / selected) and the dashboard StatTile's `emphasis` flag.
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

/** Every name the older vocabularies used for a tone. */
export type LegacyTone =
  | 'default'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'error'
  | 'info'
  | 'sage'
  | 'emphasis'
  | 'selected'
  | 'up'
  | 'down';

const LEGACY_TONES: Readonly<Record<LegacyTone, Tone>> = {
  default: 'neutral',
  neutral: 'neutral',
  success: 'positive',
  warning: 'caution',
  danger: 'negative',
  error: 'negative',
  info: 'info',
  sage: 'brand',
  emphasis: 'brand',
  selected: 'brand',
  up: 'positive',
  down: 'negative',
};

/**
 * Maps a name from one of the older vocabularies onto the tone scale, so a
 * component can keep accepting its old `variant` while rendering by tone.
 */
export function toneFromLegacy(legacy: LegacyTone): Tone {
  return LEGACY_TONES[legacy];
}
