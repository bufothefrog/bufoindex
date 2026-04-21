'use client';

import React from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { EnhancedMoneyInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { AccountType, Account } from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax-deferred', label: 'Tax-Deferred' },
  { value: 'tax-free', label: 'Tax-Free' },
];

export function AccountsCard() {
  const setupMode = usePortfolioRebalancingStore(s => s.setupMode);
  const accounts = usePortfolioRebalancingStore(s => s.inputs.accounts);
  const addAccount = usePortfolioRebalancingStore(s => s.addAccount);
  const updateAccount = usePortfolioRebalancingStore(s => s.updateAccount);
  const removeAccount = usePortfolioRebalancingStore(s => s.removeAccount);

  // Single-mode users have one implicit account — no accounts UI.
  if (setupMode === 'single') return null;

  return (
    <InputCard title="Accounts" icon={Wallet}>
      <div className="space-y-3">
        {accounts.map((account, index) => (
          <AccountRow
            key={account.id}
            account={account}
            index={index}
            canRemove={accounts.length > 1}
            onChange={patch => updateAccount(account.id, patch)}
            onRemove={() => removeAccount(account.id)}
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
            Add Account
          </Button>
        </div>
      </div>
    </InputCard>
  );
}

interface AccountRowProps {
  account: Account;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<Account, 'id'>>) => void;
  onRemove: () => void;
  className?: string;
}

function AccountRow({
  account,
  index,
  canRemove,
  onChange,
  onRemove,
  className,
}: AccountRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 md:gap-2 items-start md:items-end p-3 rounded-lg border border-border bg-muted/30',
        className
      )}
      data-testid={`account-row-${index}`}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`account-name-${account.id}`}>
          Account name
        </label>
        <Input
          id={`account-name-${account.id}`}
          value={account.name}
          onChange={e => onChange({ name: e.target.value })}
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
          onChange={value => onChange({ accountType: value as AccountType })}
          options={ACCOUNT_TYPE_OPTIONS}
        />
      </div>

      <div data-testid={`account-deposit-${index}`}>
        <EnhancedMoneyInput
          name={`account-deposit-input-${account.id}`}
          label="New cash"
          value={account.deposit}
          onChange={value => onChange({ deposit: value })}
          placeholder="0"
        />
      </div>

      <div className="flex items-end md:pb-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${account.name || `account ${index + 1}`}`}
          data-testid={`account-remove-${index}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
