'use client';

import React from 'react';
import { Plus, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { HoldingRow } from './HoldingRow';

export function HoldingsCard() {
  const setupMode = usePortfolioRebalancingStore(s => s.setupMode);
  const accounts = usePortfolioRebalancingStore(s => s.inputs.accounts);
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const holdings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const addHolding = usePortfolioRebalancingStore(s => s.addHolding);
  const updateHolding = usePortfolioRebalancingStore(s => s.updateHolding);
  const removeHolding = usePortfolioRebalancingStore(s => s.removeHolding);

  const showAccountSelector = setupMode !== 'single';

  return (
    <InputCard title="Holdings" icon={PieChart}>
      <div className="space-y-3">
        {holdings.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Add a holding to record shares you already own.
          </div>
        ) : (
          holdings.map((holding, index) => (
            <HoldingRow
              key={holding.id}
              holding={holding}
              index={index}
              accounts={accounts}
              securities={securities}
              showAccountSelector={showAccountSelector}
              canRemove={holdings.length > 1}
              onChange={patch => updateHolding(holding.id, patch)}
              onRemove={() => removeHolding(holding.id)}
            />
          ))
        )}

        <div className="pt-1">
          <Button
            variant="outline"
            onClick={() => addHolding()}
            className="gap-2"
            data-testid="add-holding"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>
      </div>
    </InputCard>
  );
}
