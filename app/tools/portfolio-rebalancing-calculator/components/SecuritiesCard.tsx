'use client';

import React from 'react';
import { Plus, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { SecurityRow } from './SecurityRow';

export function SecuritiesCard() {
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const addSecurity = usePortfolioRebalancingStore(s => s.addSecurity);
  const updateSecurity = usePortfolioRebalancingStore(s => s.updateSecurity);
  const removeSecurity = usePortfolioRebalancingStore(s => s.removeSecurity);

  return (
    <InputCard title="Securities" icon={Landmark}>
      <div className="space-y-3">
        {securities.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Add a security to start tracking your portfolio.
          </div>
        ) : (
          securities.map((security, index) => (
            <SecurityRow
              key={security.id}
              security={security}
              index={index}
              canRemove={securities.length > 1}
              onChange={patch => updateSecurity(security.id, patch)}
              onRemove={() => removeSecurity(security.id)}
            />
          ))
        )}

        <div className="pt-1">
          <Button
            variant="outline"
            onClick={addSecurity}
            className="gap-2"
            data-testid="add-security"
          >
            <Plus className="w-4 h-4" />
            Add Security
          </Button>
        </div>
      </div>
    </InputCard>
  );
}
