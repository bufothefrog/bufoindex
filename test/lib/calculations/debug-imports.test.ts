/**
 * Debug import test to understand module structure
 */

import { describe, it, expect } from 'vitest'

describe('Debug imports', () => {
  it('should debug calculations module', async () => {
    const calculationsModule = await import('@/lib/calculations/calculations')
    expect(Object.keys(calculationsModule)).toContain('default')
    expect(calculationsModule.default).toBeDefined()
    
    // Test if default is the FinancialCalculations class
    if (calculationsModule.default) {
      expect(typeof calculationsModule.default.formatCurrency).toBe('function')
    }
  })

  it('should debug monte-carlo module', async () => {
    const monteCarloModule = await import('@/lib/calculations/monte-carlo')
    console.log('Monte Carlo module keys:', Object.keys(monteCarloModule))
    console.log('Default export:', monteCarloModule.default)
    console.log('Named exports:', Object.keys(monteCarloModule).filter(k => k !== 'default'))
  })

  it('should debug financial-modeling module', async () => {
    const modelingModule = await import('@/lib/calculations/financial-modeling')
    console.log('Modeling module keys:', Object.keys(modelingModule))
    console.log('Default export:', modelingModule.default)
    console.log('Named exports:', Object.keys(modelingModule).filter(k => k !== 'default'))
  })
})