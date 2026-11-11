/**
 * StatSpec: one headline figure, as data.
 *
 * Each calculator's pure `headline(results, inputs)` returns StatSpec[]; the
 * results header and the dashboard card both render the same specs through
 * StatGrid, so a figure is formatted one way everywhere.
 */

import { formatValue, type FormatKind } from '@/lib/format';
import type { Tone } from './tone';

export interface StatSpec {
  /** Stable key (also the React key and a test hook). */
  id: string;
  label: string;
  /** Raw number; null renders as the empty value. */
  value: number | null;
  format: FormatKind;
  tone?: Tone;
  /** One short line under the value (units, basis, assumption). */
  hint?: string;
  /** Small pill next to the label, e.g. 'Active'. */
  badge?: string;
}

/** The display string for a spec's value. */
export function formatStat(spec: Pick<StatSpec, 'value' | 'format'>): string {
  return formatValue(spec.value, spec.format);
}

/** Finds a spec by id (headline consumers pick single figures this way). */
export function findStat(specs: readonly StatSpec[], id: string): StatSpec | undefined {
  return specs.find((spec) => spec.id === id);
}
