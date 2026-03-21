/**
 * Formula Registry Implementation
 * Central registry for all calculation formulas with metadata
 */

import { 
  FormulaRegistry, 
  FormulaRegistryEntry, 
  FormulaCategory, 
  RegisteredFormula,
  FormulaFunction
} from './types';

class FormulaRegistryImpl implements FormulaRegistry {
  public formulas = new Map<string, FormulaRegistryEntry>();
  public categories: Record<FormulaCategory, string[]> = {
    core: [],
    intermediate: [],
    advanced: [],
    assumptions: []
  };
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
      lastUpdated: new Date().toISOString(),
      ...metadata
    };

    this.formulas.set(id, entry);

    // Update category index
    if (!this.categories[metadata.category].includes(id)) {
      this.categories[metadata.category].push(id);
    }

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
   * Get formula by ID
   */
  getFormula(id: string): FormulaRegistryEntry | undefined {
    return this.formulas.get(id);
  }

  /**
   * Get all formulas in a category
   */
  getFormulasByCategory(category: FormulaCategory): FormulaRegistryEntry[] {
    return this.categories[category]
      .map(id => this.formulas.get(id))
      .filter((formula): formula is FormulaRegistryEntry => formula !== undefined);
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
   * Get all registered formulas
   */
  getAllFormulas(): FormulaRegistryEntry[] {
    return Array.from(this.formulas.values());
  }

  /**
   * Search formulas by name or description
   */
  searchFormulas(query: string): FormulaRegistryEntry[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllFormulas().filter(formula =>
      formula.name.toLowerCase().includes(lowercaseQuery) ||
      formula.description.toLowerCase().includes(lowercaseQuery) ||
      formula.purpose.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Mark a formula as validated
   */
  markValidated(id: string, isValid: boolean): void {
    const formula = this.formulas.get(id);
    if (formula) {
      formula.validated = isValid;
    }
  }

  /**
   * Get validation status summary
   */
  getValidationSummary(): {
    total: number;
    validated: number;
    pending: number;
    byCategory: Record<FormulaCategory, { total: number; validated: number }>;
  } {
    const all = this.getAllFormulas();
    const validated = all.filter(f => f.validated);

    const byCategory: Record<FormulaCategory, { total: number; validated: number }> = {
      core: { total: 0, validated: 0 },
      intermediate: { total: 0, validated: 0 },
      advanced: { total: 0, validated: 0 },
      assumptions: { total: 0, validated: 0 }
    };

    all.forEach(formula => {
      byCategory[formula.category].total++;
      if (formula.validated) {
        byCategory[formula.category].validated++;
      }
    });

    return {
      total: all.length,
      validated: validated.length,
      pending: all.length - validated.length,
      byCategory
    };
  }

  /**
   * Clear all registered formulas (for testing)
   */
  clear(): void {
    this.formulas.clear();
    this.categories = {
      core: [],
      intermediate: [],
      advanced: [],
      assumptions: []
    };
    this.byCalculator = {};
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

// Export for testing
export const createFormulaRegistry = () => new FormulaRegistryImpl();