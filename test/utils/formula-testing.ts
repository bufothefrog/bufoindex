/**
 * Formula Testing Utilities
 * Helper functions and utilities for testing formulas
 */

import { FormulaRegistryEntry, FormulaCategory, ExampleData, FormulaVariable } from '@/lib/formulas/types';
import { CalculatorEngine } from '@/lib/methodology/calculator-engine';

/**
 * Create a mock formula for testing
 */
export function createMockFormula(overrides: Partial<FormulaRegistryEntry> = {}): FormulaRegistryEntry {
  return {
    id: 'test-formula',
    functionName: 'testFunction',
    filePath: '/test/path',
    validated: false,
    name: 'Test Formula',
    category: 'core',
    latex: 'y = mx + b',
    variables: {
      y: { symbol: 'y', description: 'Output', unit: '' },
      m: { symbol: 'm', description: 'Slope', unit: '' },
      x: { symbol: 'x', description: 'Input', unit: '' },
      b: { symbol: 'b', description: 'Intercept', unit: '' }
    },
    description: 'Linear equation for testing',
    purpose: 'Test mathematical relationships',
    example: {
      inputs: { m: 2, x: 5, b: 3 },
      output: 13,
      explanation: 'When m=2, x=5, b=3, result is 2*5+3=13'
    },
    sources: ['Mathematics textbook'],
    assumptions: ['Linear relationship'],
    limitations: ['Only works for linear functions'],
    lastUpdated: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a financial formula for testing
 */
export function createFinancialFormula(
  formulaType: 'future_value' | 'present_value' | 'annuity' | 'compound_interest'
): FormulaRegistryEntry {
  const formulas = {
    future_value: {
      name: 'Future Value',
      latex: 'FV = PV \\times (1 + r)^t',
      variables: {
        FV: { symbol: 'FV', description: 'Future Value', unit: '$' },
        PV: { symbol: 'PV', description: 'Present Value', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Time Period', unit: 'years' }
      },
      example: {
        inputs: { PV: 10000, r: 0.07, t: 30 },
        output: 76122.55,
        explanation: '$10,000 invested at 7% for 30 years grows to $76,122.55'
      }
    },
    present_value: {
      name: 'Present Value',
      latex: 'PV = \\frac{FV}{(1 + r)^t}',
      variables: {
        PV: { symbol: 'PV', description: 'Present Value', unit: '$' },
        FV: { symbol: 'FV', description: 'Future Value', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Time Period', unit: 'years' }
      },
      example: {
        inputs: { FV: 76122.55, r: 0.07, t: 30 },
        output: 10000,
        explanation: '$76,122.55 discounted at 7% for 30 years equals $10,000 today'
      }
    },
    annuity: {
      name: 'Future Value of Annuity',
      latex: 'FVA = PMT \\times \\frac{(1 + r)^t - 1}{r}',
      variables: {
        FVA: { symbol: 'FVA', description: 'Future Value of Annuity', unit: '$' },
        PMT: { symbol: 'PMT', description: 'Payment', unit: '$' },
        r: { symbol: 'r', description: 'Interest Rate', unit: 'decimal' },
        t: { symbol: 't', description: 'Number of Payments', unit: 'periods' }
      },
      example: {
        inputs: { PMT: 1000, r: 0.06, t: 20 },
        output: 36785.59,
        explanation: '$1,000 annual payments at 6% for 20 years accumulate to $36,785.59'
      }
    },
    compound_interest: {
      name: 'Compound Interest',
      latex: 'A = P(1 + \\frac{r}{n})^{nt}',
      variables: {
        A: { symbol: 'A', description: 'Amount', unit: '$' },
        P: { symbol: 'P', description: 'Principal', unit: '$' },
        r: { symbol: 'r', description: 'Annual Interest Rate', unit: 'decimal' },
        n: { symbol: 'n', description: 'Compounding Frequency', unit: 'times per year' },
        t: { symbol: 't', description: 'Time', unit: 'years' }
      },
      example: {
        inputs: { P: 10000, r: 0.05, n: 12, t: 10 },
        output: 16470.09,
        explanation: '$10,000 compounded monthly at 5% for 10 years grows to $16,470.09'
      }
    }
  };

  const template = formulas[formulaType];
  
  return createMockFormula({
    id: `${formulaType}-formula`,
    functionName: `${formulaType}Function`,
    name: template.name,
    latex: template.latex,
    variables: template.variables,
    example: template.example,
    description: `Financial calculation: ${template.name}`,
    purpose: `Calculate ${template.name.toLowerCase()}`,
    sources: ['Financial mathematics textbook', 'IRS Publication 590'],
    assumptions: ['Constant interest rate', 'Regular compounding'],
    limitations: ['Does not account for taxes or fees']
  });
}

/**
 * Test accuracy of a formula against known values
 */
export interface AccuracyTestCase {
  inputs: Record<string, number>;
  expectedOutput: number;
  tolerance?: number;
  description?: string;
}

export function testFormulaAccuracy(
  formula: FormulaRegistryEntry,
  testCases: AccuracyTestCase[]
): {
  passed: number;
  failed: number;
  results: Array<{
    case: AccuracyTestCase;
    result: number;
    passed: boolean;
    error?: string;
  }>;
} {
  let passed = 0;
  let failed = 0;
  const results: Array<{
    case: AccuracyTestCase;
    result: number;
    passed: boolean;
    error?: string;
  }> = [];

  testCases.forEach(testCase => {
    try {
      const calculation = CalculatorEngine.calculate(formula, testCase.inputs);
      
      if (calculation.error) {
        results.push({
          case: testCase,
          result: 0,
          passed: false,
          error: calculation.error
        });
        failed++;
        return;
      }

      const tolerance = testCase.tolerance || 0.01;
      const difference = Math.abs(calculation.value - testCase.expectedOutput);
      const isPassed = difference <= tolerance;

      results.push({
        case: testCase,
        result: calculation.value,
        passed: isPassed,
        error: isPassed ? undefined : `Expected ${testCase.expectedOutput}, got ${calculation.value}, difference ${difference}`
      });

      if (isPassed) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      results.push({
        case: testCase,
        result: 0,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      failed++;
    }
  });

  return { passed, failed, results };
}

/**
 * Validate formula structure and completeness
 */
export function validateFormulaStructure(formula: FormulaRegistryEntry): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!formula.id) errors.push('Missing formula ID');
  if (!formula.name) errors.push('Missing formula name');
  if (!formula.latex) errors.push('Missing LaTeX formula');
  if (!formula.description) errors.push('Missing description');
  if (!formula.example) errors.push('Missing example');

  // Variables validation
  if (!formula.variables || Object.keys(formula.variables).length === 0) {
    errors.push('No variables defined');
  } else {
    Object.entries(formula.variables).forEach(([key, variable]) => {
      if (!variable.symbol) errors.push(`Variable ${key} missing symbol`);
      if (!variable.description) errors.push(`Variable ${key} missing description`);
    });
  }

  // Example validation
  if (formula.example) {
    if (!formula.example.inputs) errors.push('Example missing inputs');
    if (formula.example.output === undefined) errors.push('Example missing output');
    if (!formula.example.explanation) errors.push('Example missing explanation');
    
    if (formula.example.inputs && formula.variables) {
      const exampleKeys = Object.keys(formula.example.inputs);
      const variableKeys = Object.keys(formula.variables);
      
      // Check if all example inputs have corresponding variables
      exampleKeys.forEach(key => {
        if (!variableKeys.includes(key)) {
          warnings.push(`Example input '${key}' has no corresponding variable definition`);
        }
      });
    }
  }

  // Sources validation
  if (!formula.sources || formula.sources.length === 0) {
    warnings.push('No sources provided');
  }

  // Category validation
  const validCategories: FormulaCategory[] = ['core', 'intermediate', 'advanced', 'assumptions'];
  if (!validCategories.includes(formula.category)) {
    errors.push(`Invalid category: ${formula.category}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate test cases for boundary conditions
 */
export function generateBoundaryTestCases(formula: FormulaRegistryEntry): AccuracyTestCase[] {
  const testCases: AccuracyTestCase[] = [];
  const variables = Object.keys(formula.variables);

  if (variables.length === 0) return testCases;

  // Zero values test
  const zeroInputs = variables.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  testCases.push({
    inputs: zeroInputs,
    expectedOutput: 0,
    description: 'All zero inputs',
    tolerance: 0.001
  });

  // Negative values test (where applicable)
  const negativeInputs = variables.reduce((acc, key) => ({ ...acc, [key]: -1 }), {});
  testCases.push({
    inputs: negativeInputs,
    expectedOutput: -1, // This will need to be adjusted based on formula
    description: 'Negative inputs',
    tolerance: 0.001
  });

  // Large values test
  const largeInputs = variables.reduce((acc, key) => ({ ...acc, [key]: 1000000 }), {});
  testCases.push({
    inputs: largeInputs,
    expectedOutput: 1000000, // This will need to be adjusted based on formula
    description: 'Large inputs',
    tolerance: 1000
  });

  // Small values test
  const smallInputs = variables.reduce((acc, key) => ({ ...acc, [key]: 0.0001 }), {});
  testCases.push({
    inputs: smallInputs,
    expectedOutput: 0.0001, // This will need to be adjusted based on formula
    description: 'Small inputs',
    tolerance: 0.00001
  });

  return testCases;
}

/**
 * Performance testing utility
 */
export function testFormulaPerformance(
  formula: FormulaRegistryEntry,
  iterations: number = 1000
): {
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successfulRuns: number;
  errors: string[];
} {
  const times: number[] = [];
  const errors: string[] = [];
  let successfulRuns = 0;

  const inputs = formula.example.inputs;

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    
    try {
      const result = CalculatorEngine.calculate(formula, inputs);
      if (!result.error) {
        successfulRuns++;
      } else {
        errors.push(result.error);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    const endTime = performance.now();
    times.push(endTime - startTime);
  }

  return {
    totalTime: times.reduce((sum, time) => sum + time, 0),
    averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    successfulRuns,
    errors: [...new Set(errors)] // Unique errors only
  };
}

/**
 * Create test suite for a formula
 */
export function createFormulaTestSuite(
  formula: FormulaRegistryEntry,
  additionalTestCases: AccuracyTestCase[] = []
) {
  return {
    formula,
    structureValidation: validateFormulaStructure(formula),
    accuracyTests: testFormulaAccuracy(formula, [
      // Include the formula's own example
      {
        inputs: formula.example.inputs,
        expectedOutput: formula.example.output,
        description: 'Formula example case'
      },
      ...additionalTestCases,
      ...generateBoundaryTestCases(formula)
    ]),
    performanceTest: testFormulaPerformance(formula)
  };
}

/**
 * Compare two formulas for consistency
 */
export function compareFormulas(
  formula1: FormulaRegistryEntry,
  formula2: FormulaRegistryEntry,
  testInputs: Record<string, number>
): {
  formula1Result: number;
  formula2Result: number;
  difference: number;
  percentDifference: number;
  isConsistent: boolean;
  tolerance: number;
} {
  const result1 = CalculatorEngine.calculate(formula1, testInputs);
  const result2 = CalculatorEngine.calculate(formula2, testInputs);

  const difference = Math.abs(result1.value - result2.value);
  const percentDifference = result1.value !== 0 
    ? (difference / Math.abs(result1.value)) * 100 
    : 0;

  const tolerance = 0.01; // 1% tolerance
  const isConsistent = percentDifference <= tolerance;

  return {
    formula1Result: result1.value,
    formula2Result: result2.value,
    difference,
    percentDifference,
    isConsistent,
    tolerance
  };
}

/**
 * Mock KaTeX for testing environments
 */
export function mockKaTeX() {
  return {
    render: (latex: string, element: HTMLElement) => {
      element.innerHTML = `[LATEX: ${latex}]`;
    },
    renderToString: (latex: string) => `[LATEX: ${latex}]`
  };
}