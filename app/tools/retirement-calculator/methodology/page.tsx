/**
 * Retirement Calculator Methodology Page
 * Displays the mathematical formulas and assumptions used in retirement calculations
 */

import { MethodologyLayout } from '@/components/methodology/MethodologyLayout';
import { formulaRegistry } from '@/lib/formulas/registry';
import '@/lib/formulas/retirement-formulas'; // Ensure formulas are registered

export default function RetirementMethodologyPage() {
  // Get retirement formulas from the registry
  const retirementFormulas = formulaRegistry.getFormulasByCalculator('retirement');
  
  // Group formulas by category
  const groupedFormulas = {
    core: retirementFormulas.filter(f => f.category === 'core'),
    intermediate: retirementFormulas.filter(f => f.category === 'intermediate'),
    advanced: retirementFormulas.filter(f => f.category === 'advanced'),
    assumptions: retirementFormulas.filter(f => f.category === 'assumptions')
  };

  const metadata = {
    totalFormulas: retirementFormulas.length,
    lastUpdated: new Date().toISOString(),
    validationStatus: {
      validated: retirementFormulas.filter(f => f.validated).length,
      total: retirementFormulas.length
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <MethodologyLayout
        calculatorName="retirement-calculator"
        title="Retirement Calculator Methodology"
        description="Explore the mathematical formulas, assumptions, and data sources behind our retirement planning calculations. This methodology ensures transparency and enables you to verify the accuracy of your retirement projections."
        formulas={groupedFormulas}
        metadata={metadata}
      />
    </div>
  );
}

export const metadata = {
  title: 'Retirement Calculator Methodology | BufoIndex',
  description: 'Mathematical formulas and assumptions used in retirement planning calculations. Transparent methodology with interactive examples and source citations.',
  keywords: 'retirement calculator methodology, financial formulas, compound interest, safe withdrawal rate, retirement planning math',
};