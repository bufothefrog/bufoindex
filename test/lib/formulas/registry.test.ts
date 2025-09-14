/**
 * Formula Registry Tests
 * Tests for the formula registration and retrieval system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createFormulaRegistry } from '@/lib/formulas/registry';
import { FormulaRegistryEntry, FormulaCategory } from '@/lib/formulas/types';

describe('FormulaRegistry', () => {
  let registry: ReturnType<typeof createFormulaRegistry>;

  beforeEach(() => {
    registry = createFormulaRegistry();
  });

  const mockFormula = {
    name: 'Test Formula',
    category: 'core' as FormulaCategory,
    latex: 'F = ma',
    variables: {
      F: { symbol: 'F', description: 'Force', unit: 'N' },
      m: { symbol: 'm', description: 'Mass', unit: 'kg' },
      a: { symbol: 'a', description: 'Acceleration', unit: 'm/s²' }
    },
    description: 'Newton\'s second law',
    purpose: 'Calculate force',
    example: {
      inputs: { m: 10, a: 9.8 },
      output: 98,
      explanation: 'Test calculation'
    },
    sources: ['Physics textbook'],
    assumptions: ['No friction'],
    limitations: ['Classical mechanics only']
  };

  describe('registerFormula', () => {
    it('should register a formula successfully', () => {
      registry.registerFormula('test-id', 'testFunction', mockFormula);

      const retrieved = registry.getFormula('test-id');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Formula');
      expect(retrieved?.id).toBe('test-id');
      expect(retrieved?.functionName).toBe('testFunction');
      expect(retrieved?.validated).toBe(false);
    });

    it('should update category index when registering', () => {
      registry.registerFormula('core-1', 'func1', mockFormula);
      registry.registerFormula('core-2', 'func2', { ...mockFormula, name: 'Another Formula' });

      const coreFormulas = registry.getFormulasByCategory('core');
      expect(coreFormulas).toHaveLength(2);
      expect(coreFormulas.map(f => f.name)).toContain('Test Formula');
      expect(coreFormulas.map(f => f.name)).toContain('Another Formula');
    });

    it('should update calculator index when provided', () => {
      registry.registerFormula('calc-1', 'func1', mockFormula, 'retirement');
      registry.registerFormula('calc-2', 'func2', mockFormula, 'retirement');

      const retirementFormulas = registry.getFormulasByCalculator('retirement');
      expect(retirementFormulas).toHaveLength(2);
    });

    it('should set lastUpdated timestamp', () => {
      const beforeTime = new Date();
      registry.registerFormula('time-test', 'timeFunc', mockFormula);
      const afterTime = new Date();

      const formula = registry.getFormula('time-test');
      expect(formula?.lastUpdated).toBeDefined();
      
      const updatedTime = new Date(formula!.lastUpdated!);
      expect(updatedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(updatedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('getFormula', () => {
    beforeEach(() => {
      registry.registerFormula('existing', 'existingFunc', mockFormula);
    });

    it('should retrieve existing formula', () => {
      const formula = registry.getFormula('existing');
      expect(formula).toBeDefined();
      expect(formula?.id).toBe('existing');
    });

    it('should return undefined for non-existent formula', () => {
      const formula = registry.getFormula('non-existent');
      expect(formula).toBeUndefined();
    });
  });

  describe('getFormulasByCategory', () => {
    beforeEach(() => {
      registry.registerFormula('core-1', 'coreFunc1', { ...mockFormula, category: 'core' });
      registry.registerFormula('core-2', 'coreFunc2', { ...mockFormula, category: 'core', name: 'Core Formula 2' });
      registry.registerFormula('adv-1', 'advFunc1', { ...mockFormula, category: 'advanced', name: 'Advanced Formula' });
    });

    it('should return formulas for specific category', () => {
      const coreFormulas = registry.getFormulasByCategory('core');
      expect(coreFormulas).toHaveLength(2);
      expect(coreFormulas.every(f => f.category === 'core')).toBe(true);
    });

    it('should return empty array for category with no formulas', () => {
      const intermediateFormulas = registry.getFormulasByCategory('intermediate');
      expect(intermediateFormulas).toHaveLength(0);
    });

    it('should return sorted results', () => {
      const coreFormulas = registry.getFormulasByCategory('core');
      const names = coreFormulas.map(f => f.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('getFormulasByCalculator', () => {
    beforeEach(() => {
      registry.registerFormula('ret-1', 'retFunc1', mockFormula, 'retirement');
      registry.registerFormula('ret-2', 'retFunc2', { ...mockFormula, name: 'Retirement Formula 2' }, 'retirement');
      registry.registerFormula('pay-1', 'payFunc1', mockFormula, 'paycheck');
    });

    it('should return formulas for specific calculator', () => {
      const retirementFormulas = registry.getFormulasByCalculator('retirement');
      expect(retirementFormulas).toHaveLength(2);
    });

    it('should return empty array for non-existent calculator', () => {
      const nonExistentFormulas = registry.getFormulasByCalculator('non-existent');
      expect(nonExistentFormulas).toHaveLength(0);
    });
  });

  describe('getAllFormulas', () => {
    it('should return empty array when no formulas registered', () => {
      const allFormulas = registry.getAllFormulas();
      expect(allFormulas).toHaveLength(0);
    });

    it('should return all registered formulas', () => {
      registry.registerFormula('f1', 'func1', mockFormula);
      registry.registerFormula('f2', 'func2', { ...mockFormula, name: 'Formula 2' });
      registry.registerFormula('f3', 'func3', { ...mockFormula, name: 'Formula 3' });

      const allFormulas = registry.getAllFormulas();
      expect(allFormulas).toHaveLength(3);
    });
  });

  describe('searchFormulas', () => {
    beforeEach(() => {
      registry.registerFormula('newton', 'newtonFunc', {
        ...mockFormula,
        name: 'Newton\'s Second Law',
        description: 'Relates force, mass, and acceleration',
        purpose: 'Calculate force from mass and acceleration'
      });
      
      registry.registerFormula('einstein', 'einsteinFunc', {
        ...mockFormula,
        name: 'Mass-Energy Equivalence',
        description: 'Einstein\'s famous equation',
        purpose: 'Convert between mass and energy'
      });
    });

    it('should search by formula name', () => {
      const results = registry.searchFormulas('newton');
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('Newton');
    });

    it('should search by description', () => {
      const results = registry.searchFormulas('einstein');
      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('Einstein');
    });

    it('should search by purpose', () => {
      const results = registry.searchFormulas('mass');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const results = registry.searchFormulas('NEWTON');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = registry.searchFormulas('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('markValidated', () => {
    beforeEach(() => {
      registry.registerFormula('test', 'testFunc', mockFormula);
    });

    it('should mark formula as validated', () => {
      registry.markValidated('test', true);
      const formula = registry.getFormula('test');
      expect(formula?.validated).toBe(true);
    });

    it('should mark formula as not validated', () => {
      registry.markValidated('test', false);
      const formula = registry.getFormula('test');
      expect(formula?.validated).toBe(false);
    });

    it('should handle non-existent formula gracefully', () => {
      expect(() => {
        registry.markValidated('non-existent', true);
      }).not.toThrow();
    });
  });

  describe('getValidationSummary', () => {
    beforeEach(() => {
      registry.registerFormula('valid-1', 'func1', { ...mockFormula, category: 'core' });
      registry.registerFormula('valid-2', 'func2', { ...mockFormula, category: 'core' });
      registry.registerFormula('invalid-1', 'func3', { ...mockFormula, category: 'intermediate' });
      
      registry.markValidated('valid-1', true);
      registry.markValidated('valid-2', true);
      registry.markValidated('invalid-1', false);
    });

    it('should provide overall summary', () => {
      const summary = registry.getValidationSummary();
      
      expect(summary.total).toBe(3);
      expect(summary.validated).toBe(2);
      expect(summary.pending).toBe(1);
    });

    it('should provide category breakdown', () => {
      const summary = registry.getValidationSummary();
      
      expect(summary.byCategory.core.total).toBe(2);
      expect(summary.byCategory.core.validated).toBe(2);
      expect(summary.byCategory.intermediate.total).toBe(1);
      expect(summary.byCategory.intermediate.validated).toBe(0);
      expect(summary.byCategory.advanced.total).toBe(0);
      expect(summary.byCategory.assumptions.total).toBe(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.registerFormula('test1', 'func1', mockFormula, 'calculator1');
      registry.registerFormula('test2', 'func2', mockFormula, 'calculator2');
    });

    it('should clear all formulas', () => {
      expect(registry.getAllFormulas()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getAllFormulas()).toHaveLength(0);
    });

    it('should clear category indexes', () => {
      expect(registry.getFormulasByCategory('core')).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getFormulasByCategory('core')).toHaveLength(0);
    });

    it('should clear calculator indexes', () => {
      expect(registry.getFormulasByCalculator('calculator1')).toHaveLength(1);
      
      registry.clear();
      
      expect(registry.getFormulasByCalculator('calculator1')).toHaveLength(0);
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent registrations', () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(registry.registerFormula(
          `concurrent-${i}`,
          `func${i}`,
          { ...mockFormula, name: `Formula ${i}` }
        ))
      );

      return Promise.all(promises).then(() => {
        expect(registry.getAllFormulas()).toHaveLength(10);
      });
    });

    it('should handle concurrent searches', async () => {
      // Register some formulas first
      for (let i = 0; i < 5; i++) {
        registry.registerFormula(`search-${i}`, `func${i}`, {
          ...mockFormula,
          name: `Searchable Formula ${i}`
        });
      }

      const searchPromises = Array.from({ length: 10 }, () =>
        Promise.resolve(registry.searchFormulas('Searchable'))
      );

      const results = await Promise.all(searchPromises);
      
      // All searches should return the same results
      expect(results.every(result => result.length === 5)).toBe(true);
    });
  });
});