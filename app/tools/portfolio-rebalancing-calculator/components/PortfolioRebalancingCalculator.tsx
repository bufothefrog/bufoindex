'use client';

import React, { useEffect } from 'react';
import { SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { NextSteps } from '@/components/guided/NextSteps';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { AccountsCard } from './AccountsCard';
import { TargetsCard } from './TargetsCard';
import { SettingsCard } from './SettingsCard';
import { RebalanceResults } from './RebalanceResults';
import { PlacementAdviceCard } from './PlacementAdviceCard';

export function PortfolioRebalancingCalculator() {
  const result = usePortfolioRebalancingStore(s => s.result);
  const errors = usePortfolioRebalancingStore(s => s.errors);
  const calculate = usePortfolioRebalancingStore(s => s.calculate);
  const loadFromUrl = usePortfolioRebalancingStore(s => s.loadFromUrl);

  useEffect(() => {
    loadFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errorMap = errors.reduce<Record<string, string>>((acc, err) => {
    acc[err.field] = err.message;
    return acc;
  }, {});

  return (
    <SimpleCalculatorLayout
      title="Portfolio Rebalancing Calculator"
      description="Rebalance toward your asset-class targets using new deposits across one or more accounts, with whole or fractional shares and tax-aware placement advice."
      onCalculate={calculate}
      calculateButtonText="Rebalance"
      errors={errorMap}
      inputSections={
        <div className="space-y-6">
          <TargetsCard />
          <AccountsCard />
          <SettingsCard />
        </div>
      }
      resultSection={
        result ? (
          <div className="space-y-6">
            <RebalanceResults result={result} />
            <PlacementAdviceCard />
          </div>
        ) : undefined
      }
      resultFooter={<NextSteps intent="portfolio" />}
      disclaimer="Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice."
    />
  );
}
