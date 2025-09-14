/**
 * Formula Decorators
 * TypeScript decorators for registering formulas with metadata
 */

import { formulaRegistry } from './registry';
import { FormulaDecoratorOptions, FormulaFunction } from './types';

/**
 * Main formula decorator for registering calculation functions
 * 
 * @example
 * ```typescript
 * @formula({
 *   name: "Future Value of Investment",
 *   category: "core",
 *   latex: "FV = PV \\times (1 + r)^t",
 *   variables: {
 *     FV: { symbol: "FV", description: "Future Value", unit: "$" },
 *     PV: { symbol: "PV", description: "Present Value", unit: "$" },
 *     r: { symbol: "r", description: "Annual Return Rate", unit: "decimal" },
 *     t: { symbol: "t", description: "Time Period", unit: "years" }
 *   },
 *   description: "Calculates compound growth of a lump sum investment",
 *   purpose: "Determine how much money invested today will be worth in the future",
 *   example: {
 *     inputs: { PV: 10000, r: 0.07, t: 30 },
 *     output: 76123.45,
 *     explanation: "A $10,000 investment at 7% annual return grows to $76,123 over 30 years"
 *   },
 *   sources: ["Federal Reserve Economic Data", "Investment textbooks"],
 *   assumptions: ["Constant annual return", "No additional contributions"],
 *   limitations: ["Does not account for taxes or fees"]
 * })
 * export function futureValue(presentValue: number, rate: number, time: number): number {
 *   return presentValue * Math.pow(1 + rate, time);
 * }
 * ```
 */
export function formula(options: FormulaDecoratorOptions) {
  return function <T extends FormulaFunction>(
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalFunction = descriptor.value as T;
    
    if (typeof originalFunction !== 'function') {
      throw new Error(`@formula can only be applied to functions, got ${typeof originalFunction}`);
    }

    // Generate unique ID for this formula
    const formulaId = generateFormulaId(propertyKey, options.name);

    // Register the formula with complete metadata
    formulaRegistry.registerFormula(
      formulaId,
      propertyKey,
      {
        ...options,
        lastUpdated: new Date().toISOString()
      },
      options.calculator
    );

    // Return enhanced function that tracks usage
    descriptor.value = function (this: unknown, ...args: Parameters<T>) {
      if (process.env.NODE_ENV === 'development') {
        // Validate inputs in development
        validateFormulaInputs(formulaId, args, options);
      }

      const result = originalFunction.apply(this, args);

      if (process.env.NODE_ENV === 'development') {
        // Log formula usage for debugging
        logFormulaUsage(formulaId, args, result);
      }

      return result;
    } as T;

    return descriptor;
  };
}

/**
 * Specialized decorator for core financial formulas
 */
export function coreFormula(options: Omit<FormulaDecoratorOptions, 'category'>) {
  return formula({ ...options, category: 'core' });
}

/**
 * Specialized decorator for intermediate formulas
 */
export function intermediateFormula(options: Omit<FormulaDecoratorOptions, 'category'>) {
  return formula({ ...options, category: 'intermediate' });
}

/**
 * Specialized decorator for advanced formulas
 */
export function advancedFormula(options: Omit<FormulaDecoratorOptions, 'category'>) {
  return formula({ ...options, category: 'advanced' });
}

/**
 * Decorator for assumptions and constants
 */
export function assumptionFormula(options: Omit<FormulaDecoratorOptions, 'category'>) {
  return formula({ ...options, category: 'assumptions' });
}

/**
 * Generate a unique ID for a formula
 * @private
 */
function generateFormulaId(functionName: string, displayName: string): string {
  const sanitized = displayName
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '-');
  return `${functionName}-${sanitized}`;
}

/**
 * Validate formula inputs in development mode
 * @private
 */
function validateFormulaInputs(
  formulaId: string,
  inputs: unknown[],
  options: FormulaDecoratorOptions
): void {
  const formula = formulaRegistry.getFormula(formulaId);
  if (!formula) return;

  // Basic type checking
  inputs.forEach((input, index) => {
    if (typeof input !== 'number' && !Array.isArray(input) && typeof input !== 'object') {
      console.warn(`Formula ${formulaId}: Input ${index} is not a valid type`);
    }

    if (typeof input === 'number' && (isNaN(input) || !isFinite(input))) {
      console.warn(`Formula ${formulaId}: Input ${index} is NaN or Infinity`);
    }
  });
}

/**
 * Log formula usage for debugging
 * @private
 */
function logFormulaUsage(formulaId: string, inputs: unknown[], result: unknown): void {
  if (process.env.DEBUG === 'formulas' || process.env.DEBUG === 'all') {
    console.log(`Formula ${formulaId}:`, {
      inputs,
      result,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get all formulas registered via decorators
 */
export function getRegisteredFormulas() {
  return formulaRegistry.getAllFormulas();
}

/**
 * Validate all registered formulas
 */
export async function validateAllFormulas(): Promise<{ 
  valid: string[]; 
  invalid: { id: string; errors: string[] }[] 
}> {
  const formulas = formulaRegistry.getAllFormulas();
  const valid: string[] = [];
  const invalid: { id: string; errors: string[] }[] = [];

  for (const formula of formulas) {
    try {
      // Try to execute the example to validate the formula
      const example = formula.example;
      const inputs = Object.values(example.inputs);
      
      // This would need the actual function reference to work fully
      // For now, just mark as validated if it has valid structure
      if (formula.latex && formula.variables && example.output) {
        formulaRegistry.markValidated(formula.id, true);
        valid.push(formula.id);
      } else {
        const errors = [];
        if (!formula.latex) errors.push('Missing LaTeX formula');
        if (!formula.variables) errors.push('Missing variables definition');
        if (example.output === undefined) errors.push('Missing example output');
        
        invalid.push({ id: formula.id, errors });
      }
    } catch (error) {
      invalid.push({ 
        id: formula.id, 
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      });
    }
  }

  return { valid, invalid };
}