'use client';

import React, { useEffect } from 'react';
import { SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
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
      description="Rebalance through deposits, not sales. Set your target allocation, list your accounts and holdings, and we'll figure out how many shares to buy in each account to move closer to your plan."
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
      disclaimer="Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice."
    />
  );
}
