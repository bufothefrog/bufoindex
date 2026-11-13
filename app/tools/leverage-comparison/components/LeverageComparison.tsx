'use client';

import React from 'react';
import { LEVERAGE_RENDERERS } from '@/components/calculators/renderers/leverage';
import CalculatorPage, { type CalculatorResultsArgs } from '@/components/calculators/shared/CalculatorPage';
import type { DcaComparisonInputs, DcaComparisonResult } from '@/lib/calculations/leverageComparison';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { useLeverageStore } from '@/lib/store/leverageStore';
import { LeverageResults } from './LeverageResults';

/** Module scope, so the memoized results body sees one function across renders. */
function renderResults({ results, inputs }: CalculatorResultsArgs<DcaComparisonInputs, DcaComparisonResult>) {
  return <LeverageResults result={results} inputs={inputs} />;
}

/**
 * The leverage comparison on the shared calculator page, reading and writing
 * the profile. Its few inputs sit in a row of collapsed cards above
 * full-width results from lg up.
 */
export function LeverageComparison() {
  return (
    <CalculatorPage
      definition={LEVERAGE_CALCULATOR}
      store={useLeverageStore}
      renderers={LEVERAGE_RENDERERS}
      renderResults={renderResults}
      inputsPlacement="above"
    />
  );
}

export default LeverageComparison;
