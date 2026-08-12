'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { ResponsiveCalculatorLayout } from '@/components/calculators/shared/CalculatorLayout';

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
    <ResponsiveCalculatorLayout
      title="Paycheck Allocator Calculator"
      description="Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement."
      inputSection={<InputSection />}
      resultsSection={<ResultsSection />}
      isCalculating={isCalculating}
      hasResults={!!result}
      onCalculate={handleCalculate}
      calculateButtonText="Calculate My Allocation"
      calculatingText="Calculating Optimal Allocation..."
      errors={errors}
    />
  );
}