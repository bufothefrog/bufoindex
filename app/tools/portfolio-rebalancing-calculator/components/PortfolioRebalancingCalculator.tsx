'use client';

import React, { useEffect } from 'react';
import { SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { Button } from '@/components/ui/button';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { SetupWizard } from './SetupWizard';
import { SecuritiesCard } from './SecuritiesCard';
import { AccountsCard } from './AccountsCard';
import { TargetsCard } from './TargetsCard';
import { HoldingsCard } from './HoldingsCard';
import { SettingsCard } from './SettingsCard';
import { RebalanceResults } from './RebalanceResults';
import { PlacementAdviceCard } from './PlacementAdviceCard';

export function PortfolioRebalancingCalculator() {
  const setupMode = usePortfolioRebalancingStore(s => s.setupMode);
  const inputs = usePortfolioRebalancingStore(s => s.inputs);
  const result = usePortfolioRebalancingStore(s => s.result);
  const errors = usePortfolioRebalancingStore(s => s.errors);
  const calculate = usePortfolioRebalancingStore(s => s.calculate);
  const loadFromUrl = usePortfolioRebalancingStore(s => s.loadFromUrl);
  const restartWizard = usePortfolioRebalancingStore(s => s.restartWizard);

  useEffect(() => {
    loadFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (setupMode === null) {
    return <SetupWizard />;
  }

  const errorMap = errors.reduce<Record<string, string>>((acc, err) => {
    acc[err.field] = err.message;
    return acc;
  }, {});

  const handleChangeSetup = () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Changing setup will reset accounts, targets, and holdings specific to this mode. Continue?'
      );
      if (!confirmed) return;
    }
    restartWizard();
  };

  const showPlacementAdvice =
    inputs.showPlacementAdvice && setupMode !== 'multi-unique';

  return (
    <SimpleCalculatorLayout
      title="Portfolio Rebalancing Calculator"
      description="Rebalance through deposits, not sales. Tell us your securities, accounts, and targets — we'll figure out how many shares to buy in each account to move closer to your plan."
      onCalculate={calculate}
      calculateButtonText="Rebalance"
      errors={errorMap}
      inputSections={
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="link"
              size="sm"
              onClick={handleChangeSetup}
              data-testid="change-setup"
              className="text-xs text-muted-foreground"
            >
              Change setup
            </Button>
          </div>
          <SecuritiesCard />
          <AccountsCard />
          <TargetsCard />
          <HoldingsCard />
          <SettingsCard />
        </div>
      }
      resultSection={
        result ? (
          <div className="space-y-6">
            <RebalanceResults result={result} />
            {showPlacementAdvice && <PlacementAdviceCard />}
          </div>
        ) : undefined
      }
      disclaimer="Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice."
    />
  );
}
