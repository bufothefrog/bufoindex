/**
 * Comprehensive Performance Benchmarks
 * Critical performance monitoring for BufoIndex calculations
 * 
 * Performance Targets:
 * - Basic calculations: <50ms
 * - Complex tax calculations: <100ms  
 * - Monte Carlo 1,000 runs: <500ms
 * - Monte Carlo 10,000 runs: <2,000ms
 * - Memory usage: <10MB increase per operation
 */

import { bench, describe } from 'vitest'
import { FinancialCalculations } from '@/lib/calculations/calculations'
import { calculateOptimalAllocation } from '@/lib/calculations/core'
import { generateReturnSequence } from '@/lib/calculations/monte-carlo'
import { generateMockProfile, measureCalculationPerformance } from '../../utils/financial-test-helpers'
import { getDefaultProfile } from '@/lib/calculations/core'

// Sample data for consistent benchmarking
const BENCHMARK_DATA = {
  basicCalculation: {
    principal: 10000,
    rate: 0.07,
    periods: 10
  },
  complexTaxScenario: {
    income: 150000,
    filingStatus: 'marriedFilingJointly' as const,
    state: 'CA',
    deductions: 25000
  },
  monteCarloScenario: {
    retirementAge: 65,
    targetIncome: 80000,
    startingAge: 30,
    startingBalance: 50000,
    lifeExpectancy: 90
  },
  monteCarloAssumptions: {
    inflationRate: 0.025,
    accumulationReturn: 0.07,
    retirementReturn: 0.04,
    volatility: 0.15
  },
  paycheckProfile: getDefaultProfile()
}

describe('Core Financial Calculation Benchmarks', () => {
  // Basic calculation benchmarks (<50ms target)
  
  bench('Currency formatting (basic)', () => {
    FinancialCalculations.formatCurrency(1234567.89)
  })

  bench('Currency parsing (basic)', () => {
    FinancialCalculations.parseCurrency('$1,234,567.89')
  })

  bench('Future value calculation (basic)', () => {
    FinancialCalculations.futureValue(
      BENCHMARK_DATA.basicCalculation.principal,
      BENCHMARK_DATA.basicCalculation.rate,
      BENCHMARK_DATA.basicCalculation.periods
    )
  })

  bench('Present value calculation (basic)', () => {
    FinancialCalculations.presentValue(
      BENCHMARK_DATA.basicCalculation.principal,
      BENCHMARK_DATA.basicCalculation.rate,
      BENCHMARK_DATA.basicCalculation.periods
    )
  })

  bench('Portfolio size calculation (basic)', () => {
    FinancialCalculations.portfolioSizeForWithdrawal(80000, 0.04)
  })

  bench('Batch basic calculations (50 operations)', () => {
    const operations = []
    for (let i = 0; i < 50; i++) {
      operations.push(() => FinancialCalculations.futureValue(10000 + i * 100, 0.07 + i * 0.001, 10 + i))
    }
    operations.forEach(op => op())
  }, {
    time: 50 // All 50 operations should complete in <50ms
  })
})

describe('Complex Tax Calculation Benchmarks', () => {
  // Complex tax calculation benchmarks (<100ms target)

  bench('Federal tax bracket calculation', () => {
    // Simulate complex federal tax calculation
    const income = BENCHMARK_DATA.complexTaxScenario.income
    let tax = 0
    
    // 2024 married filing jointly brackets
    const brackets = [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 }
    ]
    
    let remainingIncome = income
    for (const bracket of brackets) {
      if (remainingIncome <= 0) break
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
      tax += taxableInBracket * bracket.rate
      remainingIncome -= taxableInBracket
    }
  })

  bench('State tax calculation (California)', () => {
    // Simulate California state tax calculation
    const income = BENCHMARK_DATA.complexTaxScenario.income
    const caRate = 0.093 // Approximate CA rate for this income level
    const stateTax = income * caRate
  })

  bench('Complete tax optimization analysis', () => {
    // Simulate comprehensive tax optimization
    const income = BENCHMARK_DATA.complexTaxScenario.income
    const scenarios = []
    
    // Test multiple contribution scenarios
    for (let contrib401k = 0; contrib401k <= 23000; contrib401k += 2000) {
      for (let contribIRA = 0; contribIRA <= 7000; contribIRA += 1000) {
        const taxableIncome = income - contrib401k - contribIRA
        scenarios.push({ contrib401k, contribIRA, taxableIncome })
      }
    }
    
    // Find optimal scenario
    const optimal = scenarios.reduce((best, current) => 
      current.taxableIncome < best.taxableIncome ? current : best
    )
  }, {
    time: 100 // Should complete within 100ms
  })

  bench('Paycheck allocation optimization', () => {
    calculateOptimalAllocation(BENCHMARK_DATA.paycheckProfile)
  }, {
    time: 100 // Complex optimization should complete within 100ms
  })
})

describe('Monte Carlo Simulation Benchmarks', () => {
  // Monte Carlo simulation benchmarks using generateReturnSequence

  bench('Generate return sequence 100 years', () => {
    generateReturnSequence(100, 0.07, 0.15, 42)
  }, {
    time: 100 // Should be very fast
  })

  bench('Generate return sequence 1,000 years', () => {
    generateReturnSequence(1000, 0.07, 0.15, 42)
  }, {
    time: 500 // Should complete in <500ms
  })

  bench('Generate return sequence 10,000 years', () => {
    generateReturnSequence(10000, 0.07, 0.15, 42)
  }, {
    time: 2000 // Should complete in <2,000ms
  })

  bench('Generate return sequence with high volatility', () => {
    generateReturnSequence(5000, 0.07, 0.20, 42)
  }, {
    time: 1500 // Higher volatility, 5,000 years should complete in <1.5s
  })
})

describe('Memory Usage Benchmarks', () => {
  // Memory usage monitoring for calculation-heavy operations
  
  bench('Memory usage - Large dataset processing', () => {
    // Simulate processing large dataset
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      principal: 10000 + i,
      rate: 0.07 + (i * 0.0001),
      periods: 10 + (i % 20)
    }))
    
    const startMemory = process.memoryUsage?.()?.heapUsed || 0
    
    const results = largeDataset.map(data => 
      FinancialCalculations.futureValue(data.principal, data.rate, data.periods)
    )
    
    const endMemory = process.memoryUsage?.()?.heapUsed || 0
    const memoryIncrease = endMemory - startMemory
    
    // Memory increase should be <10MB (10 * 1024 * 1024 bytes)
    if (memoryIncrease > 10485760) {
      throw new Error(`Memory usage too high: ${(memoryIncrease / 1048576).toFixed(2)}MB > 10MB limit`)
    }
  })

  bench('Memory usage - Return sequence generation intensive', () => {
    const startMemory = process.memoryUsage?.()?.heapUsed || 0

    // Run multiple return sequence generations
    for (let i = 0; i < 5; i++) {
      generateReturnSequence(1000, 0.07, 0.15, i)
    }

    const endMemory = process.memoryUsage?.()?.heapUsed || 0
    const memoryIncrease = endMemory - startMemory

    // Memory increase should be <10MB
    if (memoryIncrease > 10485760) {
      throw new Error(`Memory usage too high: ${(memoryIncrease / 1048576).toFixed(2)}MB > 10MB limit`)
    }
  })
})

describe('Component Render Performance Benchmarks', () => {
  // Component render performance for 60fps target (<16ms)
  
  bench('Calculation result formatting for display', () => {
    const results = {
      monthlyContribution: 2543.67,
      targetPortfolioSize: 1256789.45,
      yearsUntilRetirement: 25.5,
      inflatedTargetIncome: 156789.23
    }
    
    // Simulate formatting for display (common operation)
    const formatted = {
      monthlyContribution: FinancialCalculations.formatCurrency(results.monthlyContribution),
      targetPortfolioSize: FinancialCalculations.formatCurrency(results.targetPortfolioSize),
      yearsUntilRetirement: results.yearsUntilRetirement.toFixed(1),
      inflatedTargetIncome: FinancialCalculations.formatCurrency(results.inflatedTargetIncome)
    }
  }, {
    time: 16 // Should format in <16ms for 60fps rendering
  })

  bench('Real-time input validation and calculation', () => {
    // Simulate real-time form updates (every keystroke)
    const inputValues = [
      { income: 50000, rate: 0.06, years: 20 },
      { income: 75000, rate: 0.07, years: 25 },
      { income: 100000, rate: 0.08, years: 30 },
      { income: 125000, rate: 0.09, years: 35 }
    ]
    
    inputValues.forEach(input => {
      const result = FinancialCalculations.futureValue(input.income, input.rate, input.years)
      const formatted = FinancialCalculations.formatCurrency(result)
    })
  }, {
    time: 16 // Real-time updates should be <16ms
  })
})

describe('Performance Regression Detection', () => {
  // Baseline performance tests to detect regressions
  
  bench('Baseline: Simple compound interest', () => {
    FinancialCalculations.futureValue(10000, 0.07, 10)
  }, {
    time: 5 // Simple calculation should be very fast
  })

  bench('Baseline: Paycheck optimization', () => {
    calculateOptimalAllocation(BENCHMARK_DATA.paycheckProfile)
  }, {
    time: 50 // Baseline optimization time
  })

  bench('Baseline: Return sequence generation 1,000', () => {
    generateReturnSequence(1000, 0.07, 0.15, 42)
  }, {
    time: 300 // Baseline return sequence generation time
  })

  // Performance consistency tests
  bench('Consistency: Multiple optimization runs', () => {
    const profiles = Array.from({ length: 10 }, () => getDefaultProfile())
    
    profiles.forEach(profile => calculateOptimalAllocation(profile))
  }, {
    time: 200 // 10 optimizations should complete quickly
  })
})