import { describe, it, expect } from 'vitest'
import FinancialCalculations from '@/lib/calculations/calculations'

describe('Debug alias imports', () => {
  it('should import calculations module directly via alias', () => {
    expect(FinancialCalculations).toBeDefined()
    expect(typeof FinancialCalculations.formatCurrency).toBe('function')
  })
  
  it('should debug calculations module via dynamic alias import', async () => {
    const mod = await import('@/lib/calculations/calculations')
    console.log('calculations.ts via @/ keys:', Object.keys(mod))
    console.log('Default export:', typeof mod.default)
    console.log('FinancialCalculations:', typeof mod.FinancialCalculations)
    
    // Try both default and named exports
    const Calculator = mod.default || mod.FinancialCalculations
    expect(Calculator).toBeDefined()
  })
  
  it('should debug with dynamic relative path import', async () => {
    const mod = await import('../../../lib/calculations/calculations')
    console.log('calculations.ts via relative keys:', Object.keys(mod))
    console.log('Default export:', typeof mod.default)  
    console.log('FinancialCalculations:', typeof mod.FinancialCalculations)
    
    const Calculator = mod.default || mod.FinancialCalculations
    expect(Calculator).toBeDefined()
  })
})