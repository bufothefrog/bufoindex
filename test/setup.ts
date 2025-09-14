import '@testing-library/jest-dom'

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : () => {},
  warn: console.warn,
  error: console.error,
}

// Performance measurement helper for calculation benchmarks
global.measurePerformance = function<T>(name: string, fn: () => T): { result: T; duration: number } {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  return { result, duration }
}

// Extend global types
declare global {
  function measurePerformance<T>(name: string, fn: () => T): { result: T; duration: number }
}