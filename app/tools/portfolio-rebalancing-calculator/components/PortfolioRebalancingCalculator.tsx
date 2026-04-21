'use client';

import React, { useEffect } from 'react';
import { SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { AssetListCard } from './AssetListCard';
import { DepositAndModeCard } from './DepositAndModeCard';
import { RebalanceResults } from './RebalanceResults';
import { PlacementAdviceCard } from './PlacementAdviceCard';

export function PortfolioRebalancingCalculator() {
  const {
    inputs,
    result,
    errors,
    calculate,
    updateAsset,
    addAsset,
    removeAsset,
    setDeposit,
    setMode,
    setAllowTaxableSelling,
    setShowPlacementAdvice,
    loadFromUrl,
  } = usePortfolioRebalancingStore();

  useEffect(() => {
    loadFromUrl();
  }, [loadFromUrl]);

  const errorMap = errors.reduce<Record<string, string>>((acc, err) => {
    acc[err.field] = err.message;
    return acc;
  }, {});

  return (
    <SimpleCalculatorLayout
      title="Portfolio Rebalancing Calculator"
      description="Rebalance through deposits, not sales. Tell us your holdings, targets, and new cash — we'll figure out how many shares to buy to move closer to your plan without triggering taxes."
      onCalculate={calculate}
      calculateButtonText="Rebalance"
      errors={errorMap}
      inputSections={
        <div className="space-y-6">
          <AssetListCard
            assets={inputs.assets}
            onUpdateAsset={updateAsset}
            onAddAsset={addAsset}
            onRemoveAsset={removeAsset}
          />
          <DepositAndModeCard
            deposit={inputs.deposit}
            mode={inputs.mode}
            allowTaxableSelling={inputs.allowTaxableSelling}
            showPlacementAdvice={inputs.showPlacementAdvice}
            onDepositChange={setDeposit}
            onModeChange={setMode}
            onAllowTaxableSellingChange={setAllowTaxableSelling}
            onShowPlacementAdviceChange={setShowPlacementAdvice}
          />
        </div>
      }
      resultSection={
        result ? (
          <div className="space-y-6">
            <RebalanceResults result={result} />
            {inputs.showPlacementAdvice && (
              <PlacementAdviceCard assets={inputs.assets} />
            )}
          </div>
        ) : undefined
      }
      disclaimer="Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice."
    />
  );
}
