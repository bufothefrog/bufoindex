/**
 * Formula Metadata Extractor
 * Build-time extraction of formula metadata for static generation
 */

import { formulaRegistry } from '../formulas/registry';
import { FormulaRegistryEntry, FormulaCategory } from '../formulas/types';

export interface ExtractedMethodologyData {
  calculatorName: string;
  formulas: {
    core: FormulaRegistryEntry[];
    intermediate: FormulaRegistryEntry[];
    advanced: FormulaRegistryEntry[];
    assumptions: FormulaRegistryEntry[];
  };
  metadata: {
    totalFormulas: number;
    lastUpdated: string;
    validationStatus: {
      validated: number;
      total: number;
    };
  };
}

export class MethodologyExtractor {
  /**
   * Extract all formula metadata for a specific calculator
   */
  static extractForCalculator(calculatorName: string): ExtractedMethodologyData {
    const allFormulas = formulaRegistry.getFormulasByCalculator(calculatorName);
    
    // Group formulas by category
    const formulasByCategory = {
      core: [] as FormulaRegistryEntry[],
      intermediate: [] as FormulaRegistryEntry[],
      advanced: [] as FormulaRegistryEntry[],
      assumptions: [] as FormulaRegistryEntry[]
    };

    allFormulas.forEach(formula => {
      formulasByCategory[formula.category].push(formula);
    });

    // Sort each category by name for consistent ordering
    Object.keys(formulasByCategory).forEach(category => {
      formulasByCategory[category as FormulaCategory].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    });

    const validationSummary = formulaRegistry.getValidationSummary();

    return {
      calculatorName,
      formulas: formulasByCategory,
      metadata: {
        totalFormulas: allFormulas.length,
        lastUpdated: new Date().toISOString(),
        validationStatus: {
          validated: validationSummary.validated,
          total: validationSummary.total
        }
      }
    };
  }

  /**
   * Extract methodology data for all calculators
   */
  static extractAll(): Record<string, ExtractedMethodologyData> {
    const results: Record<string, ExtractedMethodologyData> = {};
    
    // Get all unique calculators from the registry
    const calculatorNames = Object.keys(formulaRegistry.byCalculator);
    
    calculatorNames.forEach(calculatorName => {
      results[calculatorName] = this.extractForCalculator(calculatorName);
    });

    return results;
  }

  /**
   * Generate static JSON files for each calculator's methodology
   */
  static async generateStaticData(outputDir: string = 'public/data/methodology'): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Extract data for all calculators
      const allData = this.extractAll();

      // Write individual calculator files
      for (const [calculatorName, data] of Object.entries(allData)) {
        const filename = `${calculatorName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(
          filepath, 
          JSON.stringify(data, null, 2), 
          'utf-8'
        );
        
        console.log(`Generated methodology data: ${filepath}`);
      }

      // Write combined index file
      const indexPath = path.join(outputDir, 'index.json');
      const indexData = {
        calculators: Object.keys(allData),
        totalFormulas: Object.values(allData).reduce((sum, data) => sum + data.metadata.totalFormulas, 0),
        lastGenerated: new Date().toISOString(),
        files: Object.keys(allData).map(name => 
          `${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
        )
      };

      await fs.writeFile(
        indexPath,
        JSON.stringify(indexData, null, 2),
        'utf-8'
      );

      console.log(`Generated methodology index: ${indexPath}`);
    } catch (error) {
      console.error('Failed to generate static methodology data:', error);
      throw error;
    }
  }

  /**
   * Validate all formulas during build time
   */
  static async validateDuringBuild(): Promise<boolean> {
    const { FormulaValidator } = await import('../formulas/validator');
    
    console.log('Validating formulas during build...');
    const validationResults = await FormulaValidator.validateAllRegisteredFormulas();
    
    const { summary, details } = FormulaValidator.generateValidationReport(validationResults.results);
    console.log(summary);

    // Log details for failed validations
    const failures = details.filter(d => d.status === 'FAIL');
    if (failures.length > 0) {
      console.error('\nValidation Failures:');
      failures.forEach(failure => {
        console.error(`- ${failure.formulaId}:`);
        failure.errors.forEach(error => console.error(`  * ${error}`));
      });
    }

    // Log warnings
    const warnings = details.filter(d => d.warnings.length > 0);
    if (warnings.length > 0) {
      console.warn('\nValidation Warnings:');
      warnings.forEach(warning => {
        console.warn(`- ${warning.formulaId}:`);
        warning.warnings.forEach(warn => console.warn(`  * ${warn}`));
      });
    }

    return validationResults.summary.failed === 0;
  }

  /**
   * Check if methodology data is up to date
   */
  static async isDataUpToDate(
    calculatorName: string, 
    dataFilePath: string
  ): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const stat = await fs.stat(dataFilePath);
      const fileModTime = stat.mtime;

      // Get the latest formula update time for this calculator
      const formulas = formulaRegistry.getFormulasByCalculator(calculatorName);
      const latestFormulaUpdate = formulas.reduce((latest, formula) => {
        const formulaTime = new Date(formula.lastUpdated || 0);
        return formulaTime > latest ? formulaTime : latest;
      }, new Date(0));

      return fileModTime >= latestFormulaUpdate;
    } catch (error) {
      // If file doesn't exist or can't be read, it's not up to date
      return false;
    }
  }

  /**
   * Get performance metrics for formula extraction
   */
  static getExtractionMetrics(): {
    totalFormulas: number;
    byCategory: Record<FormulaCategory, number>;
    byCalculator: Record<string, number>;
    memoryUsage: number;
  } {
    const allFormulas = formulaRegistry.getAllFormulas();
    
    const byCategory: Record<FormulaCategory, number> = {
      core: 0,
      intermediate: 0,
      advanced: 0,
      assumptions: 0
    };

    const byCalculator: Record<string, number> = {};

    allFormulas.forEach(formula => {
      byCategory[formula.category]++;
      
      // Extract calculator from file path or use 'unknown'
      const calculator = this.inferCalculatorFromPath(formula.filePath);
      byCalculator[calculator] = (byCalculator[calculator] || 0) + 1;
    });

    return {
      totalFormulas: allFormulas.length,
      byCategory,
      byCalculator,
      memoryUsage: this.estimateRegistryMemoryUsage()
    };
  }

  /**
   * Infer calculator name from file path
   * @private
   */
  private static inferCalculatorFromPath(filePath: string): string {
    // Extract calculator name from path patterns like:
    // /lib/calculations/retirement.ts -> retirement
    // /components/retirement-calculator/ -> retirement
    
    const pathSegments = filePath.split('/');
    
    // Look for common patterns
    for (const segment of pathSegments) {
      if (segment.includes('retirement')) return 'retirement';
      if (segment.includes('paycheck')) return 'paycheck';
      if (segment.includes('mortgage')) return 'mortgage';
      if (segment.includes('investment')) return 'investment';
    }

    return 'unknown';
  }

  /**
   * Estimate memory usage of the formula registry
   * @private
   */
  private static estimateRegistryMemoryUsage(): number {
    const allFormulas = formulaRegistry.getAllFormulas();
    let totalSize = 0;

    allFormulas.forEach(formula => {
      totalSize += JSON.stringify(formula).length * 2; // Rough estimate with overhead
    });

    return totalSize;
  }
}