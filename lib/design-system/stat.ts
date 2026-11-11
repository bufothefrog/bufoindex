/**
 * A headline figure as data. Each calculator's headline(results, inputs)
 * returns these, and both its results header and its dashboard card render
 * them through StatGrid, so a figure is labelled and formatted once.
 */

import { formatValue, type FormatKind } from '@/lib/format';
import type { Tone } from './tone';

export interface StatSpec {
  /** Stable key, unique within one headline. */
  id: string;
  label: string;
  /** null when the figure does not apply or cannot be computed. */
  value: number | null;
  format: FormatKind;
  tone?: Tone;
  /** One short line under the figure, e.g. "Today's dollars". */
  hint?: string;
  /** A short pill beside the label, e.g. "Active". */
  badge?: string;
}

/** Shown in place of a figure that is null or not finite. */
export const MISSING_VALUE = '\u2014';

/** Formats a stat value, or returns MISSING_VALUE when there is none to show. */
export function formatStatValue(value: number | null, format: FormatKind): string {
  return value === null || !Number.isFinite(value) ? MISSING_VALUE : formatValue(value, format);
}
