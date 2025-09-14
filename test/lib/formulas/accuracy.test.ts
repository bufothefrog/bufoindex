/**
 * Formula Accuracy Tests
 * Tests for formula calculation accuracy and mathematical correctness
 */

import { describe, it, expect } from 'vitest';
import { CalculatorEngine, CalculationResult } from '@/lib/methodology/calculator-engine';
import { FormulaRegistryEntry, FormulaCategory, FormulaVariable, ExampleData } from '@/lib/formulas/types';

// Helper to create test formula
const createTestFormula = (
  name: string,
  latex: string,
  variables: Record<string, FormulaVariable>,
  example: ExampleData
): FormulaRegistryEntry => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  functionName: name.replace(/\s+/g, ''),
  filePath: '/test',
  validated: false,
  name,
  category: 'core' as FormulaCategory,
  latex,
  variables,
  description: `Test formula: ${name}`,
  purpose: `Calculate ${name}`,
  example,
  sources: ['Test source'],
  assumptions: ['Test assumptions'],
  limitations: ['Test limitations'],
  lastUpdated: new Date().toISOString()
});

describe('Formula Accuracy Tests', () => {
  describe('Future Value Calculations', () => {
    const futureValueFormula = createTestFormula(
      'Future Value of Investment',
      'FV = PV \\times (1 + r)^t',
      {
        PV: { symbol: 'PV', description: 'Present Value', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Time Period', unit: 'years' }
      },
      {
        inputs: { PV: 10000, r: 0.07, t: 30 },
        output: 76122.55,
        explanation: 'Test calculation'
      }
    );

    it('should calculate future value correctly', () => {
      const result = CalculatorEngine.calculate(futureValueFormula, {
        PV: 10000,
        r: 0.07,
        t: 30
      });

      expect(result.error).toBeUndefined();
      expect(result.value).toBeCloseTo(76122.55, 2);
      expect(result.steps.length).toBeGreaterThan(1);
    });

    it('should handle zero interest rate', () => {
      const result = CalculatorEngine.calculate(futureValueFormula, {
        PV: 1000,
        r: 0,
        t: 10
      });

      expect(result.value).toBe(1000); // No growth with 0% interest
    });

    it('should handle fractional time periods', () => {
      const result = CalculatorEngine.calculate(futureValueFormula, {
        PV: 1000,
        r: 0.05,
        t: 2.5
      });

      expect(result.value).toBeCloseTo(1131.41, 2);
    });

    it('should generate detailed calculation steps', () => {
      const result = CalculatorEngine.calculate(futureValueFormula, {
        PV: 1000,
        r: 0.10,
        t: 5
      });

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].description).toContain('Identify given values');
      expect(result.steps[1].description).toContain('compound factor');
      expect(result.steps[2].description).toContain('Multiply by present value');
    });
  });

  describe('Present Value Calculations', () => {
    const presentValueFormula = createTestFormula(
      'Present Value',
      'PV = FV / (1 + r)^t',
      {
        FV: { symbol: 'FV', description: 'Future Value', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Time Period', unit: 'years' }
      },
      {
        inputs: { FV: 76122.55, r: 0.07, t: 30 },
        output: 10000,
        explanation: 'Test calculation'
      }
    );

    it('should calculate present value correctly', () => {
      const result = CalculatorEngine.calculate(presentValueFormula, {
        FV: 76122.55,
        r: 0.07,
        t: 30
      });

      expect(result.value).toBeCloseTo(10000, 2);
    });

    it('should be inverse of future value', () => {
      const fvResult = CalculatorEngine.calculate(
        createTestFormula('FV Test', 'FV = PV(1+r)^t', {}, { inputs: {}, output: 0, explanation: '' }),
        { PV: 5000, r: 0.08, t: 15 }
      );

      const pvResult = CalculatorEngine.calculate(presentValueFormula, {
        FV: fvResult.value,
        r: 0.08,
        t: 15
      });

      expect(pvResult.value).toBeCloseTo(5000, 1);
    });
  });

  describe('Annuity Calculations', () => {
    const futureValueAnnuityFormula = createTestFormula(
      'Future Value of Annuity',
      'FVA = PMT \\times \\frac{(1 + r)^t - 1}{r}',
      {
        PMT: { symbol: 'PMT', description: 'Payment', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Number of Payments', unit: 'periods' }
      },
      {
        inputs: { PMT: 1000, r: 0.06, t: 20 },
        output: 36785.59,
        explanation: 'Test annuity calculation'
      }
    );

    it('should calculate annuity future value correctly', () => {
      const result = CalculatorEngine.calculate(futureValueAnnuityFormula, {
        PMT: 1000,
        r: 0.06,
        t: 20
      });

      expect(result.value).toBeCloseTo(36785.59, 2);
    });

    it('should handle zero interest rate for annuity', () => {
      const result = CalculatorEngine.calculate(futureValueAnnuityFormula, {
        PMT: 1000,
        r: 0,
        t: 10
      });

      expect(result.value).toBe(10000); // Simple sum when r = 0
    });

    it('should calculate monthly annuity correctly', () => {
      const result = CalculatorEngine.calculate(futureValueAnnuityFormula, {
        PMT: 500, // Monthly payment
        r: 0.06 / 12, // Monthly interest rate
        t: 12 * 10 // 10 years of monthly payments
      });

      expect(result.value).toBeCloseTo(81940.57, 2);
    });
  });

  describe('Compound Interest Calculations', () => {
    const compoundInterestFormula = createTestFormula(
      'Compound Interest',
      'A = P(1 + r/n)^{nt}',
      {
        P: { symbol: 'P', description: 'Principal', unit: '$' },
        r: { symbol: 'r', description: 'Annual Rate', unit: 'decimal' },
        n: { symbol: 'n', description: 'Compounding Frequency', unit: 'times per year' },
        t: { symbol: 't', description: 'Time', unit: 'years' }
      },
      {
        inputs: { P: 10000, r: 0.05, n: 12, t: 10 },
        output: 16470.09,
        explanation: 'Monthly compounding'
      }
    );

    it('should calculate compound interest with monthly compounding', () => {
      const result = CalculatorEngine.calculate(compoundInterestFormula, {
        P: 10000,
        r: 0.05,
        n: 12, // Monthly compounding
        t: 10
      });

      expect(result.value).toBeCloseTo(16470.09, 2);
    });

    it('should calculate compound interest with daily compounding', () => {
      const result = CalculatorEngine.calculate(compoundInterestFormula, {
        P: 10000,
        r: 0.05,
        n: 365, // Daily compounding
        t: 10
      });

      expect(result.value).toBeCloseTo(16486.65, 2);
    });

    it('should calculate compound interest with annual compounding', () => {
      const result = CalculatorEngine.calculate(compoundInterestFormula, {
        P: 10000,
        r: 0.05,
        n: 1, // Annual compounding
        t: 10
      });

      expect(result.value).toBeCloseTo(16288.95, 2);
    });
  });

  describe('Withdrawal Rate Calculations', () => {
    const safeWithdrawalRateFormula = createTestFormula(
      'Safe Withdrawal Rate',
      'SWR = \\frac{\\text{Annual Expenses}}{\\text{Portfolio Value}}',
      {
        annualExpenses: { symbol: 'E', description: 'Annual Expenses', unit: '$' },
        portfolioValue: { symbol: 'P', description: 'Portfolio Value', unit: '$' }
      },
      {
        inputs: { annualExpenses: 40000, portfolioValue: 1000000 },
        output: 0.04,
        explanation: '4% withdrawal rate'
      }
    );

    it('should calculate 4% rule correctly', () => {
      const result = CalculatorEngine.calculate(safeWithdrawalRateFormula, {
        annualExpenses: 40000,
        portfolioValue: 1000000
      });

      expect(result.value).toBe(0.04);
    });

    it('should handle different withdrawal rates', () => {
      const result = CalculatorEngine.calculate(safeWithdrawalRateFormula, {
        annualExpenses: 35000,
        portfolioValue: 1000000
      });

      expect(result.value).toBe(0.035); // 3.5% withdrawal rate
    });

    it('should handle zero portfolio value', () => {
      const result = CalculatorEngine.calculate(safeWithdrawalRateFormula, {
        annualExpenses: 40000,
        portfolioValue: 0
      });

      expect(result.value).toBe(0);
    });
  });

  describe('Required Balance Calculations', () => {
    const requiredBalanceFormula = createTestFormula(
      'Required Balance',
      'RB = \\frac{\\text{Annual Income}}{\\text{Withdrawal Rate}}',
      {
        annualIncome: { symbol: 'I', description: 'Annual Income', unit: '$' },
        withdrawalRate: { symbol: 'W', description: 'Withdrawal Rate', unit: 'decimal' }
      },
      {
        inputs: { annualIncome: 50000, withdrawalRate: 0.04 },
        output: 1250000,
        explanation: 'Required balance for $50k annual income at 4% withdrawal'
      }
    );

    it('should calculate required balance correctly', () => {
      const result = CalculatorEngine.calculate(requiredBalanceFormula, {
        annualIncome: 50000,
        withdrawalRate: 0.04
      });

      expect(result.value).toBe(1250000);
    });

    it('should handle different withdrawal rates', () => {
      const result = CalculatorEngine.calculate(requiredBalanceFormula, {
        annualIncome: 60000,
        withdrawalRate: 0.03 // 3% withdrawal rate
      });

      expect(result.value).toBe(2000000);
    });
  });

  describe('Error Handling', () => {
    const testFormula = createTestFormula(
      'Test Formula',
      'y = mx + b',
      {
        m: { symbol: 'm', description: 'Slope', unit: '' },
        x: { symbol: 'x', description: 'Input', unit: '' },
        b: { symbol: 'b', description: 'Intercept', unit: '' }
      },
      {
        inputs: { m: 2, x: 5, b: 3 },
        output: 13,
        explanation: 'Linear equation'
      }
    );

    it('should handle missing inputs', () => {
      const result = CalculatorEngine.calculate(testFormula, {
        m: 2,
        // Missing x and b
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Missing value');
    });

    it('should handle invalid inputs', () => {
      const result = CalculatorEngine.calculate(testFormula, {
        m: NaN,
        x: 5,
        b: 3
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid value');
    });

    it('should handle infinite inputs', () => {
      const result = CalculatorEngine.calculate(testFormula, {
        m: Infinity,
        x: 5,
        b: 3
      });

      expect(result.error).toBeDefined();
      expect(result.error).toContain('must be a finite number');
    });
  });

  describe('Precision and Rounding', () => {
    it('should maintain precision for financial calculations', () => {
      const formula = createTestFormula(
        'Precision Test',
        'Result = a + b',
        {
          a: { symbol: 'a', description: 'First value', unit: '$' },
          b: { symbol: 'b', description: 'Second value', unit: '$' }
        },
        { inputs: { a: 0.1, b: 0.2 }, output: 0.3, explanation: 'Test' }
      );

      // This tests the classic floating point precision issue
      const result = CalculatorEngine.calculate(formula, {
        a: 0.1,
        b: 0.2
      });

      // Should handle floating point precision correctly
      expect(result.value).toBeCloseTo(0.3, 10);
    });

    it('should handle very small numbers', () => {
      const formula = createTestFormula(
        'Small Numbers Test',
        'Result = a * b',
        { a: { symbol: 'a', description: 'A', unit: '' }, b: { symbol: 'b', description: 'B', unit: '' } },
        { inputs: { a: 0.0001, b: 0.0001 }, output: 0.00000001, explanation: 'Test' }
      );

      const result = CalculatorEngine.calculate(formula, {
        a: 0.0001,
        b: 0.0001
      });

      expect(result.value).toBeCloseTo(0.00000001, 15);
    });

    it('should handle very large numbers', () => {
      const formula = createTestFormula(
        'Large Numbers Test',
        'Result = a + b',
        { a: { symbol: 'a', description: 'A', unit: '' }, b: { symbol: 'b', description: 'B', unit: '' } },
        { inputs: { a: 1000000000, b: 1 }, output: 1000000001, explanation: 'Test' }
      );

      const result = CalculatorEngine.calculate(formula, {
        a: 1000000000,
        b: 1
      });

      expect(result.value).toBe(1000000001);
    });
  });

  describe('Performance', () => {
    it('should complete calculations quickly', () => {
      const formula = createTestFormula(
        'Performance Test',
        'FV = PV(1+r)^t',
        {
          PV: { symbol: 'PV', description: 'Present Value', unit: '$' },
          r: { symbol: 'r', description: 'Rate', unit: 'decimal' },
          t: { symbol: 't', description: 'Time', unit: 'years' }
        },
        { inputs: { PV: 10000, r: 0.07, t: 30 }, output: 76122, explanation: 'Test' }
      );

      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        CalculatorEngine.calculate(formula, {
          PV: 10000,
          r: 0.07,
          t: 30
        });
      }

      const endTime = performance.now();
      const timePerCalculation = (endTime - startTime) / 1000;

      // Should complete each calculation in less than 1ms on average
      expect(timePerCalculation).toBeLessThan(1);
    });
  });
});