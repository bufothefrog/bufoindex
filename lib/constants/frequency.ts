import type { LabelOption } from './labels';

/**
 * Paycheck frequency conversion multipliers (paychecks per month).
 *
 * Lives in constants (rather than lib/calculations/core) so that modules on
 * both sides of the utils <-> calculations boundary can share it without an
 * import cycle; lib/calculations/core re-exports it for its callers.
 */
export const FREQUENCY_MULTIPLIERS = {
  'weekly': 52 / 12,      // 4.33 - weeks per month
  'bi-weekly': 26 / 12,   // 2.17 - bi-weekly pays per month
  'semi-monthly': 2,      // 2.00 - semi-monthly pays per month
  'monthly': 1            // 1.00 - monthly pays per month
} as const;

export type PayFrequency = keyof typeof FREQUENCY_MULTIPLIERS;

export interface PayFrequencyMeta {
  /** Title text, e.g. "Your Bi-Weekly Paycheck Allocation". */
  label: string;
  /** Select-option text. */
  option: string;
  /** In-sentence adjective, e.g. "per bi-weekly paycheck". */
  phrase: string;
  /** Paychecks per month (FREQUENCY_MULTIPLIERS). */
  perMonth: number;
  /** Paychecks per year: 52, 26, 24 or 12. */
  perYear: number;
}

function meta(frequency: PayFrequency, label: string, option: string, phrase: string): PayFrequencyMeta {
  const perMonth = FREQUENCY_MULTIPLIERS[frequency];
  return { label, option, phrase, perMonth, perYear: Math.round(perMonth * 12) };
}

/** Wording from the paycheck allocator, the one calculator that asks for it. */
export const PAY_FREQUENCY_META: Readonly<Record<PayFrequency, PayFrequencyMeta>> = {
  weekly: meta('weekly', 'Weekly', 'Weekly', 'weekly'),
  'bi-weekly': meta('bi-weekly', 'Bi-Weekly', 'Bi-Weekly', 'bi-weekly'),
  'semi-monthly': meta('semi-monthly', 'Semi-Monthly', 'Semi-Monthly (2x/month)', 'semi-monthly'),
  monthly: meta('monthly', 'Monthly', 'Monthly', 'monthly'),
};

export const PAY_FREQUENCY_OPTIONS: readonly LabelOption<PayFrequency>[] = (
  ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'] as const
).map((value) => ({ value, label: PAY_FREQUENCY_META[value].option }));
