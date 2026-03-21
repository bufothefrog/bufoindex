/**
 * Formula Registry Types
 * Core interfaces for the calculator methodology system
 */

export type FormulaCategory = 'core' | 'intermediate' | 'advanced' | 'assumptions';

export interface ExampleData {
  inputs: Record<string, number>;
  output: number;
  explanation: string;
  stepByStep?: string[];
}

export interface FormulaVariable {
  symbol: string;
  description: string;
  unit?: string;
  constraints?: string;
}

export interface FormulaMetadata {
  name: string;
  category: FormulaCategory;
  latex: string;
  variables: Record<string, FormulaVariable>;
  description: string;
  purpose: string;
  example: ExampleData;
  sources: string[];
  assumptions: string[];
  limitations: string[];
  relatedFormulas?: string[];
  lastUpdated?: string;
}

export interface FormulaRegistryEntry extends FormulaMetadata {
  id: string;
  functionName: string;
  filePath: string;
  validated: boolean;
}

export interface FormulaRegistry {
  formulas: Map<string, FormulaRegistryEntry>;
  categories: Record<FormulaCategory, string[]>;
  byCalculator: Record<string, string[]>;
}

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  performance?: {
    executionTime: number;
    memoryUsage: number;
  };
}

export interface FormulaDecoratorOptions extends Omit<FormulaMetadata, 'lastUpdated'> {
  calculator?: string;
  skipValidation?: boolean;
}

// Utility types for formula functions
export type FormulaFunction = (...args: unknown[]) => number | number[] | object;

export interface RegisteredFormula {
  metadata: FormulaMetadata;
  function: FormulaFunction;
  calculator?: string;
}