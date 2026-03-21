/**
 * Formula Validation Tests
 * Comprehensive testing of formula metadata validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormulaValidator } from '@/lib/formulas/validator';
import { FormulaRegistryEntry, FormulaCategory } from '@/lib/formulas/types';
import { createFormulaRegistry } from '@/lib/formulas/registry';

// Mock formula for testing
const createMockFormula = (overrides: Partial<FormulaRegistryEntry> = {}): FormulaRegistryEntry => ({
  id: 'test-formula',
  functionName: 'testFunction',
  filePath: '/test/path',
  validated: false,
  name: 'Test Formula',
  category: 'core' as FormulaCategory,
  latex: 'F = ma',
  variables: {
    F: { symbol: 'F', description: 'Force', unit: 'N' },
    m: { symbol: 'm', description: 'Mass', unit: 'kg' },
    a: { symbol: 'a', description: 'Acceleration', unit: 'm/s²' }
  },
  description: 'Newton\'s second law of motion',
  purpose: 'Calculate force from mass and acceleration',
  example: {
    inputs: { F: 0, m: 10, a: 9.8 },
    output: 98,
    explanation: 'A 10kg mass experiences 98N force with 9.8 m/s² acceleration'
  },
  sources: ['Physics textbook'],
  assumptions: ['No friction'],
  limitations: ['Classical mechanics only'],
  lastUpdated: new Date().toISOString(),
  ...overrides
});

describe('FormulaValidator', () => {
  describe('validateFormula', () => {
    it('should validate a correct formula', async () => {
      const formula = createMockFormula();
      const result = await FormulaValidator.validateFormula(formula);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.performance).toBeDefined();
      expect(result.performance!.executionTime).toBeGreaterThan(0);
    });

    it('should fail validation for missing required fields', async () => {
      const formula = createMockFormula({
        name: '', // Missing name
        description: '', // Missing description
        latex: '' // Missing LaTeX
      });

      const result = await FormulaValidator.validateFormula(formula);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
      expect(result.errors).toContain('Missing required field: description');
      expect(result.errors).toContain('LaTeX formula is empty');
    });

    it('should validate LaTeX syntax', async () => {
      const formula = createMockFormula({
        latex: 'F = ma \\frac{1}{2}' // Unbalanced braces
      });

      const result = await FormulaValidator.validateFormula(formula);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Unbalanced braces'))).toBe(true);
    });

    it('should validate example data', async () => {
      const formula = createMockFormula({
        example: {
          inputs: { F: NaN, m: 10, a: 9.8 },
          output: 98,
          explanation: 'Test explanation'
        }
      });

      const result = await FormulaValidator.validateFormula(formula);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid input value for F'))).toBe(true);
    });

    it('should validate with actual function execution', async () => {
      const formula = createMockFormula();
      const testFunction = ((m: number, a: number) => m * a) as (...args: unknown[]) => unknown;

      const result = await FormulaValidator.validateFormula(formula, testFunction);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect function execution mismatch', async () => {
      const formula = createMockFormula({
        example: {
          inputs: { m: 10, a: 9.8 },
          output: 98,
          explanation: 'Should match'
        }
      });
      const wrongFunction = () => 50; // Returns wrong value

      const result = await FormulaValidator.validateFormula(formula, wrongFunction);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('does not match expected output'))).toBe(true);
    });

    it('should generate warnings for potential issues', async () => {
      const formula = createMockFormula({
        description: 'Short', // Too short
        assumptions: [], // No assumptions
        limitations: [], // No limitations
        lastUpdated: new Date('2020-01-01').toISOString() // Old update
      });

      const result = await FormulaValidator.validateFormula(formula);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Description is quite short'))).toBe(true);
      expect(result.warnings.some(w => w.includes('No assumptions documented'))).toBe(true);
    });
  });

  describe('validateAllRegisteredFormulas', () => {
    it('should validate multiple formulas', async () => {
      const registry = createFormulaRegistry();
      
      // Register some test formulas
      registry.registerFormula('test-1', 'testFunc1', createMockFormula({ id: 'test-1' }));
      registry.registerFormula('test-2', 'testFunc2', createMockFormula({ 
        id: 'test-2',
        name: 'Test Formula 2'
      }));

      const result = await FormulaValidator.validateAllRegisteredFormulas();

      expect(result.summary.total).toBe(2);
      expect(result.summary.passed).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(result.results.has('test-1')).toBe(true);
      expect(result.results.has('test-2')).toBe(true);
    });

    it('should handle mixed validation results', async () => {
      const registry = createFormulaRegistry();
      
      // Register valid formula
      registry.registerFormula('valid', 'validFunc', createMockFormula({ id: 'valid' }));
      
      // Register invalid formula
      registry.registerFormula('invalid', 'invalidFunc', createMockFormula({ 
        id: 'invalid',
        name: '', // Invalid
        latex: '' // Invalid
      }));

      const result = await FormulaValidator.validateAllRegisteredFormulas();

      expect(result.summary.total).toBe(2);
      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(1);
      
      const validResult = result.results.get('valid');
      const invalidResult = result.results.get('invalid');
      
      expect(validResult?.success).toBe(true);
      expect(invalidResult?.success).toBe(false);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate comprehensive report', () => {
      const results = new Map([
        ['formula-1', {
          success: true,
          errors: [],
          warnings: ['Minor warning'],
          performance: { executionTime: 5, memoryUsage: 100 }
        }],
        ['formula-2', {
          success: false,
          errors: ['Critical error'],
          warnings: [],
          performance: { executionTime: 10, memoryUsage: 200 }
        }]
      ]);

      const report = FormulaValidator.generateValidationReport(results);

      expect(report.summary).toContain('Total Formulas: 2');
      expect(report.summary).toContain('Passed: 1');
      expect(report.summary).toContain('Failed: 1');
      expect(report.summary).toContain('Pass Rate: 50.0%');
      
      expect(report.details).toHaveLength(2);
      expect(report.details[0].status).toBe('PASS');
      expect(report.details[1].status).toBe('FAIL');
    });
  });

  describe('LaTeX validation', () => {
    it('should accept valid LaTeX formulas', async () => {
      const validLatexFormulas = [
        'F = ma',
        'E = mc^2',
        'FV = PV \\times (1 + r)^t',
        '\\frac{a}{b} = c',
        'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        '\\sum_{i=1}^{n} x_i'
      ];

      for (const latex of validLatexFormulas) {
        const formula = createMockFormula({ latex });
        const result = await FormulaValidator.validateFormula(formula);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid LaTeX formulas', async () => {
      const invalidLatexFormulas = [
        '', // Empty
        '\\frac{a}{b', // Unbalanced braces
        'F = ma \\times (1 + r', // Unbalanced parentheses
        '\\invalid{command}', // Unknown command (would be caught by KaTeX)
      ];

      for (const latex of invalidLatexFormulas) {
        const formula = createMockFormula({ latex });
        const result = await FormulaValidator.validateFormula(formula);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Variable validation', () => {
    it('should validate variable definitions', async () => {
      const formula = createMockFormula({
        variables: {
          x: { symbol: 'x', description: 'Valid variable', unit: 'units' },
          y: { symbol: '', description: '', unit: '' } // Invalid
        }
      });

      const result = await FormulaValidator.validateFormula(formula);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid variable definition for y'))).toBe(true);
    });

    it('should handle complex variable structures', async () => {
      const formula = createMockFormula({
        variables: {
          'complex_var': { 
            symbol: 'X_{complex}', 
            description: 'Complex variable with subscript',
            unit: 'kg⋅m/s²',
            constraints: 'Must be positive'
          }
        }
      });

      const result = await FormulaValidator.validateFormula(formula);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance validation', () => {
    it('should measure validation performance', async () => {
      const formula = createMockFormula();
      const result = await FormulaValidator.validateFormula(formula);

      expect(result.performance).toBeDefined();
      expect(result.performance!.executionTime).toBeGreaterThan(0);
      expect(result.performance!.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle performance degradation gracefully', async () => {
      const largeFormula = createMockFormula({
        description: 'x'.repeat(10000), // Large description
        variables: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `var${i}`,
            { symbol: `x_${i}`, description: `Variable ${i}`, unit: 'unit' }
          ])
        )
      });

      const result = await FormulaValidator.validateFormula(largeFormula);

      expect(result.performance).toBeDefined();
      expect(result.performance!.memoryUsage).toBeGreaterThan(0);
    });
  });
});