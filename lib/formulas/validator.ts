/**
 * Formula Validation Utilities
 * Comprehensive validation system for formula accuracy and consistency
 */

import { FormulaRegistryEntry, ValidationResult, ExampleData } from './types';
import { formulaRegistry } from './registry';

export class FormulaValidator {
  /**
   * Validate a single formula entry
   */
  static async validateFormula(
    formula: FormulaRegistryEntry,
    actualFunction?: (...args: unknown[]) => unknown
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const startTime = performance.now();

    try {
      // 1. Validate formula metadata structure
      this.validateMetadata(formula, errors);

      // 2. Validate LaTeX syntax
      this.validateLatex(formula.latex, errors);

      // 3. Validate example data
      this.validateExample(formula.example, errors);

      // 4. If function is provided, validate execution
      if (actualFunction) {
        await this.validateFunctionExecution(formula, actualFunction, errors);
      }

      // 5. Check for common issues
      this.checkCommonIssues(formula, warnings);

      const endTime = performance.now();
      const success = errors.length === 0;

      return {
        success,
        errors,
        warnings,
        performance: {
          executionTime: endTime - startTime,
          memoryUsage: this.estimateMemoryUsage(formula)
        }
      };
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        errors,
        warnings,
        performance: {
          executionTime: performance.now() - startTime,
          memoryUsage: 0
        }
      };
    }
  }

  /**
   * Validate all registered formulas
   */
  static async validateAllRegisteredFormulas(): Promise<{
    results: Map<string, ValidationResult>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
    };
  }> {
    const formulas = formulaRegistry.getAllFormulas();
    const results = new Map<string, ValidationResult>();
    let passed = 0;
    let failed = 0;
    let totalWarnings = 0;

    for (const formula of formulas) {
      const result = await this.validateFormula(formula);
      results.set(formula.id, result);

      if (result.success) {
        passed++;
        formulaRegistry.markValidated(formula.id, true);
      } else {
        failed++;
        formulaRegistry.markValidated(formula.id, false);
      }

      totalWarnings += result.warnings.length;
    }

    return {
      results,
      summary: {
        total: formulas.length,
        passed,
        failed,
        warnings: totalWarnings
      }
    };
  }

  /**
   * Validate formula metadata structure
   * @private
   */
  private static validateMetadata(formula: FormulaRegistryEntry, errors: string[]): void {
    // Required fields
    const requiredFields = [
      'name', 'category', 'latex', 'variables', 
      'description', 'purpose', 'example', 'sources'
    ];

    requiredFields.forEach(field => {
      if (!formula[field as keyof FormulaRegistryEntry]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Category validation
    const validCategories = ['core', 'intermediate', 'advanced', 'assumptions'];
    if (!validCategories.includes(formula.category)) {
      errors.push(`Invalid category: ${formula.category}`);
    }

    // Variables validation
    if (formula.variables && typeof formula.variables === 'object') {
      Object.entries(formula.variables).forEach(([key, variable]) => {
        if (!variable.symbol || !variable.description) {
          errors.push(`Invalid variable definition for ${key}`);
        }
      });
    }

    // Sources validation
    if (formula.sources && Array.isArray(formula.sources) && formula.sources.length === 0) {
      errors.push('At least one source is required');
    }
  }

  /**
   * Validate LaTeX syntax
   * @private
   */
  private static validateLatex(latex: string, errors: string[]): void {
    if (!latex || latex.trim().length === 0) {
      errors.push('LaTeX formula is empty');
      return;
    }

    // Check for balanced braces
    const openBraces = (latex.match(/\{/g) || []).length;
    const closeBraces = (latex.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced braces in LaTeX formula');
    }

    // Check for balanced parentheses
    const openParens = (latex.match(/\(/g) || []).length;
    const closeParens = (latex.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in LaTeX formula');
    }

    // Check for common LaTeX commands
    const commonCommands = ['\\times', '\\div', '\\frac', '\\sqrt', '\\sum', '\\prod'];
    const hasValidCommands = commonCommands.some(cmd => latex.includes(cmd)) || 
                            /[+\-*/^=<>]/.test(latex);
    
    if (!hasValidCommands) {
      errors.push('LaTeX formula appears to lack mathematical operators');
    }
  }

  /**
   * Validate example data
   * @private
   */
  private static validateExample(example: ExampleData, errors: string[]): void {
    if (!example) {
      errors.push('Missing example data');
      return;
    }

    if (!example.inputs || typeof example.inputs !== 'object') {
      errors.push('Example inputs must be an object');
    }

    if (example.output === undefined || example.output === null) {
      errors.push('Example output is required');
    }

    if (!example.explanation || example.explanation.trim().length === 0) {
      errors.push('Example explanation is required');
    }

    // Validate input types
    if (example.inputs) {
      Object.entries(example.inputs).forEach(([key, value]) => {
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
          errors.push(`Invalid input value for ${key}: must be a finite number`);
        }
      });
    }

    // Validate output type
    if (typeof example.output === 'number') {
      if (isNaN(example.output) || !isFinite(example.output)) {
        errors.push('Example output must be a finite number');
      }
    }
  }

  /**
   * Validate function execution with example
   * @private
   */
  private static async validateFunctionExecution(
    formula: FormulaRegistryEntry,
    fn: (...args: unknown[]) => unknown,
    errors: string[]
  ): Promise<void> {
    try {
      const example = formula.example;
      const inputs = Object.values(example.inputs);
      
      const result = fn(...inputs);
      const expectedOutput = example.output;
      
      // Validate that result is a number
      if (typeof result !== 'number') {
        errors.push(`Function returned ${typeof result}, expected number`);
        return;
      }
      
      // Allow for floating point precision errors
      const tolerance = Math.abs(expectedOutput * 0.001); // 0.1% tolerance
      const difference = Math.abs(result - expectedOutput);
      
      if (difference > tolerance) {
        errors.push(
          `Function output (${result}) does not match expected output (${expectedOutput}). ` +
          `Difference: ${difference}, Tolerance: ${tolerance}`
        );
      }
    } catch (error) {
      errors.push(`Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for common issues and best practices
   * @private
   */
  private static checkCommonIssues(formula: FormulaRegistryEntry, warnings: string[]): void {
    // Check description length
    if (formula.description.length < 20) {
      warnings.push('Description is quite short, consider adding more detail');
    }

    // Check for outdated sources
    if (formula.lastUpdated) {
      const lastUpdate = new Date(formula.lastUpdated);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      if (lastUpdate < oneYearAgo) {
        warnings.push('Formula has not been updated in over a year');
      }
    }

    // Check for missing assumptions
    if (!formula.assumptions || formula.assumptions.length === 0) {
      warnings.push('No assumptions documented - consider adding key assumptions');
    }

    // Check for missing limitations
    if (!formula.limitations || formula.limitations.length === 0) {
      warnings.push('No limitations documented - consider adding known limitations');
    }

    // Check variable count
    const variableCount = Object.keys(formula.variables || {}).length;
    if (variableCount > 10) {
      warnings.push('Formula has many variables - consider breaking into smaller formulas');
    }
  }

  /**
   * Estimate memory usage for a formula
   * @private
   */
  private static estimateMemoryUsage(formula: FormulaRegistryEntry): number {
    // Rough estimate based on string lengths and object size
    const jsonSize = JSON.stringify(formula).length;
    return jsonSize * 2; // Rough multiplier for object overhead
  }

  /**
   * Generate validation report
   */
  static generateValidationReport(
    results: Map<string, ValidationResult>
  ): {
    summary: string;
    details: Array<{
      formulaId: string;
      status: 'PASS' | 'FAIL';
      errors: string[];
      warnings: string[];
      performance: { executionTime: number; memoryUsage: number };
    }>;
  } {
    const details = Array.from(results.entries()).map(([formulaId, result]) => ({
      formulaId,
      status: result.success ? 'PASS' as const : 'FAIL' as const,
      errors: result.errors,
      warnings: result.warnings,
      performance: result.performance!
    }));

    const passed = details.filter(d => d.status === 'PASS').length;
    const failed = details.filter(d => d.status === 'FAIL').length;
    const totalWarnings = details.reduce((sum, d) => sum + d.warnings.length, 0);

    const summary = `
Formula Validation Report
========================
Total Formulas: ${details.length}
Passed: ${passed}
Failed: ${failed}
Warnings: ${totalWarnings}
Pass Rate: ${(passed / details.length * 100).toFixed(1)}%
    `.trim();

    return { summary, details };
  }
}