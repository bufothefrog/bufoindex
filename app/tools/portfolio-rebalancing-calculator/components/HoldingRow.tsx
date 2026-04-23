'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/inputs';
import { TickerCombobox } from '@/components/ui/inputs/TickerCombobox';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import {
  AssetClass,
  Holding,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import { cn, formatCurrency } from '@/lib/utils';

interface HoldingRowProps {
  holding: Holding;
  security: Security | null;
  securities: Security[];
  index: number;
  canRemove: boolean;
  onChangeHolding: (patch: Partial<Omit<Holding, 'id'>>) => void;
  /** Edits price / asset class on the paired security. Ticker edits go through the combobox. */
  onChangeSecurity: (patch: Partial<Omit<Security, 'id' | 'ticker'>>) => void;
  onSelectSecurity: (securityId: string) => void;
  onCommitTicker: (ticker: string) => void;
  onRemove: () => void;
  className?: string;
}

const ASSET_CLASS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: 'us-stock', label: 'US Stock' },
  { value: 'intl-stock', label: 'Intl Stock' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'reits', label: 'REITs' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function HoldingRow({
  holding,
  security,
  securities,
  index,
  canRemove,
  onChangeHolding,
  onChangeSecurity,
  onSelectSecurity,
  onCommitTicker,
  onRemove,
  className,
}: HoldingRowProps) {
  const ticker = security?.ticker ?? '';
  const price = security?.price ?? 0;
  const assetClass = security?.assetClass ?? 'other';
  const totalValue = price * holding.shares;

  const tickerOptions = securities.map(s => ({
    id: s.id,
    ticker: s.ticker,
    price: s.price,
  }));

  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-[0.8fr_1fr_1fr_0.8fr_auto] gap-3 md:gap-2 items-start md:items-end p-3 rounded-lg border border-border bg-muted/30',
        className,
      )}
      data-testid={`holding-row-${index}`}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`holding-ticker-${holding.id}`}>
          Ticker
        </label>
        <TickerCombobox
          id={`holding-ticker-${holding.id}`}
          value={ticker}
          options={tickerOptions}
          currentId={holding.securityId || undefined}
          onSelectExisting={onSelectSecurity}
          onCommitNewTicker={onCommitTicker}
          testId={`holding-ticker-${index}`}
        />
      </div>

      <NumberInput
        name={`holding-price-${holding.id}`}
        label="Price / share"
        value={price}
        onChange={value => onChangeSecurity({ price: value })}
        min={0}
        allowDecimals
        precision={2}
        prefix="$"
        placeholder="0.00"
        testId={`holding-price-${index}`}
      />

      <div data-testid={`holding-class-${index}`}>
        <SelectInput
          name={`holding-class-select-${holding.id}`}
          label="Asset class"
          value={assetClass}
          onChange={value => onChangeSecurity({ assetClass: value as AssetClass })}
          options={ASSET_CLASS_OPTIONS}
        />
      </div>

      <NumberInput
        name={`holding-shares-${holding.id}`}
        label="Shares"
        value={holding.shares}
        onChange={value => onChangeHolding({ shares: value })}
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

      {price > 0 && holding.shares > 0 && (
        <div
          className="md:col-span-full text-xs text-muted-foreground font-mono tabular-nums"
          data-testid={`holding-preview-${index}`}
        >
          {ticker || '—'} @ {formatCurrency(price)} ×{' '}
          {holding.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} ={' '}
          <span className="text-foreground">{formatCurrency(totalValue)}</span>
        </div>
      )}
    </div>
  );
}
