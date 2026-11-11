import '@testing-library/jest-dom'
// Registers the toBeCloseToCurrency matcher (and its type augmentation) for
// every test file, so suites no longer need a side-effect import.
import './utils/financial-test-helpers'

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : () => {},
  warn: console.warn,
  error: console.error,
}

// jsdom has no ResizeObserver; Radix primitives and Recharts'
// ResponsiveContainer construct one on mount. A file that needs to drive
// resize callbacks can still replace it with vi.stubGlobal.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
