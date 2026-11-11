'use client';

import React from 'react';
import { PORTFOLIO_RENDERERS } from '@/components/calculators/renderers/portfolio';
import CalculatorPage, { type CalculatorResultsArgs } from '@/components/calculators/shared/CalculatorPage';
import type { RebalanceInputsV2, RebalanceResultV2 } from '@/lib/calculations/portfolioRebalancing';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { PlacementAdviceCard } from './PlacementAdviceCard';
import { RebalanceResults } from './RebalanceResults';

/** Module scope, so the memoized results body sees one function across renders. */
function renderResults({ results, inputs }: CalculatorResultsArgs<RebalanceInputsV2, RebalanceResultV2>) {
  return (
    <>
      <RebalanceResults result={results} customAssetClasses={inputs.customAssetClasses} />
      {inputs.showPlacementAdvice && <PlacementAdviceCard inputs={inputs} />}
    </>
  );
}

/** The portfolio rebalancer on the shared calculator page, reading and writing the profile. */
export function PortfolioRebalancingCalculator() {
  return (
    <CalculatorPage
      definition={PORTFOLIO_CALCULATOR}
      store={usePortfolioRebalancingStore}
      renderers={PORTFOLIO_RENDERERS}
      renderResults={renderResults}
    />
  );
}

export default PortfolioRebalancingCalculator;
