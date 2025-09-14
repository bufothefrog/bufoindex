/* eslint-disable @next/next/no-assign-module-variable */
/**
 * Simple import test to verify module structure
 */

import { describe, it, expect } from 'vitest'

// Test basic imports
describe('Import verification', () => {
  it('should import from calculations.ts correctly', async () => {
    const module = await import('@/lib/calculations/calculations')
    const FinancialCalculations = module.default || module.FinancialCalculations
    expect(FinancialCalculations).toBeDefined()
    expect(typeof FinancialCalculations.formatCurrency).toBe('function')
  })

  it('should import from core.ts correctly', async () => {
    const coreModule = await import('@/lib/calculations/core')
    expect(coreModule.calculateOptimalAllocation).toBeDefined()
    expect(typeof coreModule.calculateOptimalAllocation).toBe('function')
  })

  it('should import from monte-carlo.ts correctly', async () => {
    const module = await import('@/lib/calculations/monte-carlo')
    const MonteCarloEngine = module.default || module.MonteCarloEngine
    expect(MonteCarloEngine).toBeDefined()
    expect(typeof MonteCarloEngine.runSimulation).toBe('function')
  })

  it('should import from financial-modeling.ts correctly', async () => {
    const module = await import('@/lib/calculations/financial-modeling')
    const FinancialModeling = module.default || module.FinancialModeling
    expect(FinancialModeling).toBeDefined()
    expect(typeof FinancialModeling.calculateFederalTax).toBe('function')
  })
})