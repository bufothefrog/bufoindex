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
  /** Intake option text, e.g. "Every two weeks". */
  intakeOption: string;
  /** In-sentence cadence of the intake's core summary, e.g. "$4,000 every 2 weeks". */
  cadence: string;
  /** Paychecks per month (FREQUENCY_MULTIPLIERS). */
  perMonth: number;
  /** Paychecks per year: 52, 26, 24 or 12. */
  perYear: number;
}

function meta(
  frequency: PayFrequency,
  wording: Omit<PayFrequencyMeta, 'perMonth' | 'perYear'>
): PayFrequencyMeta {
  const perMonth = FREQUENCY_MULTIPLIERS[frequency];
  return { ...wording, perMonth, perYear: Math.round(perMonth * 12) };
}

/**
 * label, option and phrase are the paycheck allocator's wording; intakeOption
 * and cadence are the intake's.
 */
export const PAY_FREQUENCY_META: Readonly<Record<PayFrequency, PayFrequencyMeta>> = {
  weekly: meta('weekly', {
    label: 'Weekly',
    option: 'Weekly',
    phrase: 'weekly',
    intakeOption: 'Every week',
    cadence: 'every week',
  }),
  'bi-weekly': meta('bi-weekly', {
    label: 'Bi-Weekly',
    option: 'Bi-Weekly',
    phrase: 'bi-weekly',
    intakeOption: 'Every two weeks',
    cadence: 'every 2 weeks',
  }),
  'semi-monthly': meta('semi-monthly', {
    label: 'Semi-Monthly',
    option: 'Semi-Monthly (2x/month)',
    phrase: 'semi-monthly',
    intakeOption: 'Twice a month',
    cadence: 'twice a month',
  }),
  monthly: meta('monthly', {
    label: 'Monthly',
    option: 'Monthly',
    phrase: 'monthly',
    intakeOption: 'Once a month',
    cadence: 'once a month',
  }),
};

export const PAY_FREQUENCY_OPTIONS: readonly LabelOption<PayFrequency>[] = (
  ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'] as const
).map((value) => ({ value, label: PAY_FREQUENCY_META[value].option }));
