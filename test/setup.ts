import '@testing-library/jest-dom'

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : () => {},
  warn: console.warn,
  error: console.error,
}