'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnhancedMoneyInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { Account, AccountType } from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';
import { HoldingRow } from './HoldingRow';

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax-deferred', label: 'Tax-Deferred' },
  { value: 'tax-free', label: 'Tax-Free' },
];

interface AccountSectionProps {
  account: Account;
  index: number;
  canRemove: boolean;
  className?: string;
}

export function AccountSection({
  account,
  index,
  canRemove,
  className,
}: AccountSectionProps) {
  const allHoldings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const updateAccount = usePortfolioRebalancingStore(s => s.updateAccount);
  const removeAccount = usePortfolioRebalancingStore(s => s.removeAccount);
  const addHolding = usePortfolioRebalancingStore(s => s.addHolding);
  const updateHolding = usePortfolioRebalancingStore(s => s.updateHolding);
  const removeHolding = usePortfolioRebalancingStore(s => s.removeHolding);
  const updateSecurity = usePortfolioRebalancingStore(s => s.updateSecurity);

  const holdings = allHoldings.filter(h => h.accountId === account.id);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background p-4 space-y-4',
        className,
      )}
      data-testid={`account-section-${index}`}
    >
      <div
        className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 md:gap-2 items-start md:items-end"
        data-testid={`account-row-${index}`}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`account-name-${account.id}`}>
            Account name
          </label>
          <Input
            id={`account-name-${account.id}`}
            value={account.name}
            onChange={e => updateAccount(account.id, { name: e.target.value })}
            placeholder="Fidelity Roth IRA"
            maxLength={40}
            data-testid={`account-name-${index}`}
          />
        </div>

        <div data-testid={`account-type-${index}`}>
          <SelectInput
            name={`account-type-select-${account.id}`}
            label="Type"
            value={account.accountType}
            onChange={value => updateAccount(account.id, { accountType: value as AccountType })}
            options={ACCOUNT_TYPE_OPTIONS}
          />
        </div>

        <div data-testid={`account-deposit-${index}`}>
          <EnhancedMoneyInput
            name={`account-deposit-input-${account.id}`}
            label="New cash"
            value={account.deposit}
            onChange={value => updateAccount(account.id, { deposit: value })}
            placeholder="0"
          />
        </div>

        <div className="flex items-end md:pb-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeAccount(account.id)}
            disabled={!canRemove}
            aria-label={`Remove ${account.name || `account ${index + 1}`}`}
            data-testid={`account-remove-${index}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-3">
        <div className="text-sm font-medium text-muted-foreground">Holdings</div>

        {holdings.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            No holdings yet. Add one below.
          </div>
        ) : (
          <div className="space-y-2">
            {holdings.map(holding => {
              const security = securities.find(s => s.id === holding.securityId) ?? null;
              const globalIndex = allHoldings.findIndex(h => h.id === holding.id);
              return (
                <HoldingRow
                  key={holding.id}
                  holding={holding}
                  security={security}
                  index={globalIndex}
                  canRemove
                  onChangeHolding={patch => updateHolding(holding.id, patch)}
                  onChangeSecurity={patch =>
                    holding.securityId && updateSecurity(holding.securityId, patch)
                  }
                  onRemove={() => removeHolding(holding.id)}
                />
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => addHolding(account.id)}
          className="gap-2"
          data-testid={`add-holding-${index}`}
        >
          <Plus className="w-4 h-4" />
          Add holding
        </Button>
      </div>
    </div>
  );
}
