'use client';

import React from 'react';
import { Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { AccountSection } from './AccountSection';

export function AccountsCard() {
  const accounts = usePortfolioRebalancingStore(s => s.inputs.accounts);
  const addAccount = usePortfolioRebalancingStore(s => s.addAccount);

  return (
    <InputCard title="Accounts" icon={Wallet}>
      <div className="space-y-4">
        {accounts.map((account, index) => (
          <AccountSection
            key={account.id}
            account={account}
            index={index}
            canRemove={accounts.length > 1}
          />
        ))}

        <div className="pt-1">
          <Button
            variant="outline"
            onClick={addAccount}
            className="gap-2"
            data-testid="add-account"
          >
            <Plus className="w-4 h-4" />
            Add account
          </Button>
        </div>
      </div>
    </InputCard>
  );
}
