/**
 * Pay frequency: conversion multipliers and the one label table.
 *
 * Lives in constants (rather than lib/calculations/core) so that modules on
 * both sides of the utils <-> calculations boundary can share it without an
 * import cycle; lib/calculations/core re-exports FREQUENCY_MULTIPLIERS for
 * its callers.
 */

/** Paychecks per month. */
export const FREQUENCY_MULTIPLIERS = {
  'weekly': 52 / 12,      // 4.33 - weeks per month
  'bi-weekly': 26 / 12,   // 2.17 - bi-weekly pays per month
  'semi-monthly': 2,      // 2.00 - semi-monthly pays per month
  'monthly': 1            // 1.00 - monthly pays per month
} as const;

export type PayFrequency = keyof typeof FREQUENCY_MULTIPLIERS;

/** Every pay frequency, shortest interval first. */
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'];

export interface PayFrequencyMeta {
  /** Title case for selects and table headers: "Bi-weekly". */
  label: string;
  /** Plain-language choice text: "Every two weeks". */
  option: string;
  /** Mid-sentence phrase: "$3,500 every 2 weeks". */
  phrase: string;
  /** Lowercase adjective: "a bi-weekly paycheck". */
  adjective: string;
  /** Paychecks per month (FREQUENCY_MULTIPLIERS). */
  perMonth: number;
  /** Paychecks per year. */
  perYear: number;
}

export const PAY_FREQUENCY_META: Record<PayFrequency, PayFrequencyMeta> = {
  weekly: {
    label: 'Weekly',
    option: 'Every week',
    phrase: 'every week',
    adjective: 'weekly',
    perMonth: FREQUENCY_MULTIPLIERS.weekly,
    perYear: 52,
  },
  'bi-weekly': {
    label: 'Bi-weekly',
    option: 'Every two weeks',
    phrase: 'every 2 weeks',
    adjective: 'bi-weekly',
    perMonth: FREQUENCY_MULTIPLIERS['bi-weekly'],
    perYear: 26,
  },
  'semi-monthly': {
    label: 'Semi-monthly',
    option: 'Twice a month',
    phrase: 'twice a month',
    adjective: 'semi-monthly',
    perMonth: FREQUENCY_MULTIPLIERS['semi-monthly'],
    perYear: 24,
  },
  monthly: {
    label: 'Monthly',
    option: 'Once a month',
    phrase: 'once a month',
    adjective: 'monthly',
    perMonth: FREQUENCY_MULTIPLIERS.monthly,
    perYear: 12,
  },
};

/** Choice options for a pay-frequency field (plain-language text). */
export const PAY_FREQUENCY_OPTIONS: ReadonlyArray<{ value: PayFrequency; label: string }> = PAY_FREQUENCIES.map(
  (value) => ({ value, label: PAY_FREQUENCY_META[value].option })
);
