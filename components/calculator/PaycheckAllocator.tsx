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
      title="Optimize Your Next Paycheck"
      description="Smart monthly allocation for your next paycheck. Get a clear priority list that maximizes tax efficiency and exposes financial industry myths."
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