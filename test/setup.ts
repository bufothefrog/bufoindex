import '@testing-library/jest-dom'
import { expect } from 'vitest'

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : () => {},
  warn: console.warn,
  error: console.error,
}

/**
 * Custom matchers for financial calculations
 */
export interface FinancialMatchers<R = unknown> {
  toBeCloseToCurrency: (expected: number, precision?: number) => R
}

declare module 'vitest' {
  // Vitest's own Assertion interface defaults its type parameter to `any`;
  // the augmentation must match that shape for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type -- the merged interface must repeat Vitest's `any` default and adds members only through FinancialMatchers
  interface Assertion<T = any> extends FinancialMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the augmentation adds its members only through FinancialMatchers
  interface AsymmetricMatchersContaining extends FinancialMatchers {}
}

/**
 * Currency comparison with proper precision
 */
expect.extend({
  toBeCloseToCurrency(received: number, expected: number, precision: number = 2) {
    const difference = Math.abs(received - expected)
    const threshold = Math.pow(10, -precision)

    return {
      pass: difference < threshold,
      message: () =>
        `Expected ${received.toFixed(precision)} to be close to ${expected.toFixed(precision)} (within ${threshold})`,
    }
  },
})

// jsdom has no ResizeObserver; chart and layout components construct one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub
}

// Node 25 and later define their own global localStorage and sessionStorage
// (Web Storage is on by default; localStorage is undefined and warns unless
// --localstorage-file is given). Vitest's jsdom environment does not
// overwrite a global the runtime already has, so those Node objects would
// hide jsdom's. Point both names at the jsdom window's storage, as on
// Node 22 and 24. Vitest exposes that window as the global `jsdom`.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window
if (jsdomWindow) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: jsdomWindow[key],
      configurable: true,
      writable: true,
    })
  }
}
