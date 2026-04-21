'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NumberInput, PercentInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import {
  AccountType,
  AssetClass,
  RebalanceAsset,
} from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

interface AssetRowProps {
  asset: RebalanceAsset;
  index: number;
  canRemove: boolean;
  onChange: (updates: Partial<Omit<RebalanceAsset, 'id'>>) => void;
  onRemove: () => void;
  className?: string;
}

const ACCOUNT_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'tax-deferred', label: 'Tax-Deferred' },
  { value: 'tax-free', label: 'Tax-Free' },
];

const ASSET_CLASS_OPTIONS: { value: AssetClass; label: string }[] = [
  { value: 'us-stock', label: 'US Stock' },
  { value: 'intl-stock', label: 'Intl Stock' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'reits', label: 'REITs' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export function AssetRow({
  asset,
  index,
  canRemove,
  onChange,
  onRemove,
  className,
}: AssetRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_1fr_1fr_auto] gap-3 md:gap-2 items-start md:items-end p-3 rounded-lg border border-border bg-muted/30',
        className
      )}
      data-testid={`asset-row-${index}`}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`ticker-${asset.id}`}>
          Ticker
        </label>
        <Input
          id={`ticker-${asset.id}`}
          value={asset.ticker}
          onChange={e => onChange({ ticker: e.target.value.toUpperCase() })}
          placeholder="VTI"
          maxLength={10}
          className="uppercase"
          data-testid={`ticker-${index}`}
        />
      </div>

      <NumberInput
        name={`shares-${asset.id}`}
        label="Current Shares"
        value={asset.currentShares}
        onChange={value => onChange({ currentShares: value })}
        min={0}
        allowDecimals
        precision={4}
        placeholder="0"
        testId={`shares-${index}`}
      />

      <NumberInput
        name={`price-${asset.id}`}
        label="Price / Share"
        value={asset.price}
        onChange={value => onChange({ price: value })}
        min={0}
        allowDecimals
        precision={2}
        prefix="$"
        placeholder="0.00"
        testId={`price-${index}`}
      />

      <PercentInput
        name={`target-${asset.id}`}
        label="Target %"
        value={asset.targetAllocation}
        onChange={value => onChange({ targetAllocation: value })}
        min={0}
        max={1}
        precision={1}
        testId={`target-${index}`}
      />

      <div data-testid={`account-${index}`}>
        <SelectInput
          name={`account-${asset.id}`}
          label="Account"
          value={asset.accountType}
          onChange={value => onChange({ accountType: value as AccountType })}
          options={ACCOUNT_OPTIONS}
        />
      </div>

      <div data-testid={`class-${index}`}>
        <SelectInput
          name={`class-${asset.id}`}
          label="Class"
          value={asset.assetClass}
          onChange={value => onChange({ assetClass: value as AssetClass })}
          options={ASSET_CLASS_OPTIONS}
        />
      </div>

      <div className="flex items-end md:pb-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${asset.ticker || `asset ${index + 1}`}`}
          data-testid={`remove-${index}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
