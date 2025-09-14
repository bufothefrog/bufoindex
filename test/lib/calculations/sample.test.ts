import { describe, it, expect, beforeEach } from 'vitest'

// Sample calculation function for testing framework validation
function calculateCompoundInterest(
  principal: number,
  rate: number,
  time: number,
  compoundFreq: number = 1
): number {
  return principal * Math.pow(1 + rate / compoundFreq, compoundFreq * time)
}

describe('Sample Calculation Tests', () => {
  describe('calculateCompoundInterest', () => {
    it('should calculate basic compound interest correctly', () => {
      // Test case from architecture review: $10,000 at 7% for 10 years = $19,671.51
      const result = calculateCompoundInterest(10000, 0.07, 10)
      expect(result).toBeCloseTo(19671.51, 2)
    })

    it('should handle edge cases', () => {
      // Zero principal
      expect(calculateCompoundInterest(0, 0.07, 10)).toBe(0)
      
      // Zero rate
      expect(calculateCompoundInterest(10000, 0, 10)).toBe(10000)
      
      // Zero time
      expect(calculateCompoundInterest(10000, 0.07, 0)).toBe(10000)
    })

    it('should meet performance requirements', () => {
      const { duration } = measurePerformance('compound-interest', () => {
        return calculateCompoundInterest(100000, 0.07, 30)
      })
      
      // Should complete in less than 10ms (well under target of 50ms for basic calculations)
      expect(duration).toBeLessThan(10)
    })
  })
})

// Export for use in other tests
export { calculateCompoundInterest }