'use client';

import React from 'react';
import { PAYCHECK_RENDERERS } from '@/components/calculators/renderers/paycheck';
import CalculatorPage, { type CalculatorResultsArgs } from '@/components/calculators/shared/CalculatorPage';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { usePaycheckStore } from '@/lib/store/paycheckStore';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { ResultsSection } from './ResultsSection';

function renderResults({ results, inputs, stale }: CalculatorResultsArgs<PaycheckProfile, AllocationResult>) {
  return <ResultsSection result={results} inputs={inputs} stale={stale} />;
}

/** The paycheck allocator: its form over the shared profile, live allocation results. */
export function PaycheckAllocator() {
  return (
    <CalculatorPage
      definition={PAYCHECK_CALCULATOR}
      store={usePaycheckStore}
      renderers={PAYCHECK_RENDERERS}
      renderResults={renderResults}
    />
  );
}

export default PaycheckAllocator;
