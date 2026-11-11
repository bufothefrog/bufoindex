/**
 * Financial Test Helpers
 *
 * Registers the `toBeCloseToCurrency` matcher. test/setup.ts imports this
 * file, so every suite has the matcher without importing it; the explicit
 * side-effect imports some suites still carry are harmless.
 *
 * IRS values belong in tests via `@/lib/constants/irs-2026` directly.
 */

import { expect } from 'vitest'

/**
 * Custom matchers for financial calculations
 */
export interface FinancialMatchers<R = unknown> {
  toBeCloseToCurrency: (expected: number, precision?: number) => R
}

declare module 'vitest' {
  // Vitest's own Assertion interface defaults its type parameter to `any`;
  // the augmentation must match that shape for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends FinancialMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends FinancialMatchers {}
}

/**
 * Currency comparison with proper precision: passes when the absolute
 * difference is below 10^-precision (default 2, i.e. within a cent).
 */
expect.extend({
  toBeCloseToCurrency(received: number, expected: number, precision: number = 2) {
    const difference = Math.abs(received - expected)
    const threshold = Math.pow(10, -precision)

    return {
      pass: difference < threshold,
      message: () =>
        `Expected ${received.toFixed(precision)} to be close to ${expected.toFixed(precision)} (within ${threshold})`
    }
  },
})
