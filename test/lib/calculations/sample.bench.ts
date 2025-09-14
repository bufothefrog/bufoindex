import { bench, describe } from 'vitest'
import { calculateCompoundInterest } from './sample.test'

// Performance benchmarks for calculation functions
describe('Calculation Performance Benchmarks', () => {
  bench('Basic compound interest calculation', () => {
    calculateCompoundInterest(10000, 0.07, 10)
  })

  bench('Complex compound interest with monthly compounding', () => {
    calculateCompoundInterest(10000, 0.07, 10, 12)
  })

  bench('Large principal calculation', () => {
    calculateCompoundInterest(1000000, 0.07, 30, 12)
  })

  // Monte Carlo simulation benchmark (placeholder for actual implementation)
  bench('Monte Carlo simulation (1000 iterations)', () => {
    // Simulate 1000 Monte Carlo runs
    let sum = 0
    for (let i = 0; i < 1000; i++) {
      const result = calculateCompoundInterest(10000, 0.07 + (Math.random() * 0.06 - 0.03), 10)
      sum += result
    }
    // Don't return value for benchmark functions
  }, {
    // Target: Monte Carlo 1000 runs < 500ms
    time: 500
  })
})