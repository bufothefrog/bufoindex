'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { RETIREMENT_INTAKE_PREWARM, RETIREMENT_RENDERERS } from '@/components/calculators/renderers/retirement';
import CalculatorPage, { type CalculatorResultsArgs } from '@/components/calculators/shared/CalculatorPage';
import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { ResultsSection } from './ResultsSection';

// The O10 filing-status note is a note on the form's 'about' screen
// (lib/calculators/retirement/form.ts), so it shows with or without results.
function renderResults({ results, inputs, stale }: CalculatorResultsArgs<RetirementInputs, RetirementResults>) {
  return <ResultsSection results={results} inputs={inputs} stale={stale} />;
}

const METHODOLOGY_LINK = (
  <p className="mt-6 text-center text-sm text-muted-foreground">
    How these numbers are computed {'\u2014'}{' '}
    <Link
      href="/tools/retirement-calculator/methodology"
      className="underline underline-offset-4 hover:text-foreground"
    >
      Methodology
    </Link>
  </p>
);

/** The retirement calculator: its form over the shared profile, live Monte Carlo results. */
export function RetirementCalculator() {
  // Start the worker on mount (audit H5), so a first run that waits for the
  // profile to hydrate finds it loaded; once a run has started it is a no-op.
  useEffect(() => {
    RETIREMENT_INTAKE_PREWARM();
  }, []);

  return (
    <CalculatorPage
      definition={RETIREMENT_CALCULATOR}
      store={useRetirementStore}
      renderers={RETIREMENT_RENDERERS}
      renderResults={renderResults}
      afterLayout={METHODOLOGY_LINK}
    />
  );
}

export default RetirementCalculator;
