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
