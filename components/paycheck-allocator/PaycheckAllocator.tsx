'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';

export function PaycheckAllocator() {
  const { 
    result, 
    isCalculating, 
    errors, 
    calculate,
    clearErrors,
    loadFromUrl
  } = useCalculatorStore();
  
  React.useEffect(() => {
    // Clear errors and load from URL if present when component mounts
    clearErrors();
    loadFromUrl();
  }, [clearErrors, loadFromUrl]);
  
  const handleCalculate = async () => {
    await calculate();
  };

  
  return (
    <CalculatorLayout
      title="Paycheck Allocator Calculator"
      description="Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement."
      inputSections={<InputSection />}
      resultSection={result ? <ResultsSection /> : undefined}
      isCalculating={isCalculating}
      onCalculate={handleCalculate}
      calculateButtonText="Calculate My Allocation"
      calculatingText="Calculating Optimal Allocation..."
      errors={errors}
      emptyStateConfig={{
        title: 'Ready to Calculate',
        description: 'Review your inputs and run the analysis',
        features: []
      }}
    />
  );
}