/**
 * Formula Registry Implementation
 * Central registry for all calculation formulas with metadata
 */

import {
  FormulaRegistry,
  FormulaRegistryEntry,
  RegisteredFormula
} from './types';

class FormulaRegistryImpl implements FormulaRegistry {
  public formulas = new Map<string, FormulaRegistryEntry>();
  public byCalculator: Record<string, string[]> = {};

  /**
   * Register a formula with its metadata
   */
  registerFormula(
    id: string,
    functionName: string,
    metadata: RegisteredFormula['metadata'],
    calculator?: string
  ): void {
    const entry: FormulaRegistryEntry = {
      id,
      functionName,
      filePath: this.getCallerFilePath(),
      validated: false,
      lastUpdated: '2026-08-12',
      ...metadata
    };

    this.formulas.set(id, entry);

    // Update calculator index
    if (calculator) {
      if (!this.byCalculator[calculator]) {
        this.byCalculator[calculator] = [];
      }
      if (!this.byCalculator[calculator].includes(id)) {
        this.byCalculator[calculator].push(id);
      }
    }
  }

  /**
   * Get all formulas for a calculator
   */
  getFormulasByCalculator(calculator: string): FormulaRegistryEntry[] {
    const formulaIds = this.byCalculator[calculator] || [];
    return formulaIds
      .map(id => this.formulas.get(id))
      .filter((formula): formula is FormulaRegistryEntry => formula !== undefined);
  }

  /**
   * Get caller file path for registration tracking
   * @private
   */
  private getCallerFilePath(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const stackLines = stack.split('\n');
    // Find the line that's not from this file or the decorators file
    for (let i = 2; i < stackLines.length; i++) {
      const line = stackLines[i];
      if (!line.includes('registry.ts') && !line.includes('decorators.ts')) {
        const match = line.match(/\((.*?):\d+:\d+\)/);
        return match ? match[1] : 'unknown';
      }
    }
    return 'unknown';
  }
}

// Global registry instance
export const formulaRegistry = new FormulaRegistryImpl();