'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import {
  Account,
  Holding,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import { cn, formatCurrency } from '@/lib/utils';

interface HoldingRowProps {
  holding: Holding;
  index: number;
  accounts: Account[];
  securities: Security[];
  showAccountSelector: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<Holding, 'id'>>) => void;
  onRemove: () => void;
  className?: string;
}

export function HoldingRow({
  holding,
  index,
  accounts,
  securities,
  showAccountSelector,
  canRemove,
  onChange,
  onRemove,
  className,
}: HoldingRowProps) {
  const security = securities.find(s => s.id === holding.securityId) ?? null;

  const accountOptions = accounts.map(a => ({
    value: a.id,
    label: a.name || '(Untitled account)',
  }));

  const securityOptions = securities.length === 0
    ? [{ value: '', label: 'No securities yet' }]
    : securities.map(s => ({
        value: s.id,
        label: s.ticker ? `${s.ticker}${s.name ? ` — ${s.name}` : ''}` : '(Unnamed)',
      }));

  const totalValue = security ? security.price * holding.shares : 0;

  const gridCols = showAccountSelector
    ? 'md:grid-cols-[1fr_1.2fr_0.8fr_auto]'
    : 'md:grid-cols-[1.2fr_0.8fr_auto]';

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 md:gap-2 items-start md:items-end p-3 rounded-lg border border-border bg-muted/30',
        gridCols,
        className
      )}
      data-testid={`holding-row-${index}`}
    >
      {showAccountSelector && (
        <div data-testid={`holding-account-${index}`}>
          <SelectInput
            name={`holding-account-select-${holding.id}`}
            label="Account"
            value={holding.accountId}
            onChange={value => onChange({ accountId: value })}
            options={accountOptions}
            placeholder={accounts.length === 0 ? 'Add an account' : undefined}
          />
        </div>
      )}

      <div data-testid={`holding-security-${index}`}>
        <SelectInput
          name={`holding-security-select-${holding.id}`}
          label="Security"
          value={holding.securityId}
          onChange={value => onChange({ securityId: value })}
          options={securityOptions}
          placeholder={
            securities.length === 0
              ? 'Add a security'
              : !holding.securityId
                ? 'Select a security'
                : undefined
          }
        />
      </div>

      <NumberInput
        name={`holding-shares-${holding.id}`}
        label="Shares"
        value={holding.shares}
        onChange={value => onChange({ shares: value })}
        min={0}
        allowDecimals
        precision={4}
        placeholder="0"
        testId={`holding-shares-${index}`}
      />

      <div className="flex items-end md:pb-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove holding ${index + 1}`}
          data-testid={`holding-remove-${index}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {security && holding.shares > 0 && (
        <div
          className="md:col-span-full text-xs text-muted-foreground font-mono tabular-nums"
          data-testid={`holding-preview-${index}`}
        >
          {security.ticker || '—'} @ {formatCurrency(security.price)} × {holding.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} ={' '}
          <span className="text-foreground">{formatCurrency(totalValue)}</span>
        </div>
      )}
    </div>
  );
}
