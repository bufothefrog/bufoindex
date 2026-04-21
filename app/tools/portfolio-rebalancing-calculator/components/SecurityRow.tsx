'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { AssetClass, Security } from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

interface SecurityRowProps {
  security: Security;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<Security, 'id'>>) => void;
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

export function SecurityRow({
  security,
  index,
  canRemove,
  onChange,
  onRemove,
  className,
}: SecurityRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr_0.8fr_1fr_auto] gap-3 md:gap-2 items-start md:items-end p-3 rounded-lg border border-border bg-muted/30',
        className
      )}
      data-testid={`security-row-${index}`}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`security-ticker-input-${security.id}`}>
          Ticker
        </label>
        <Input
          id={`security-ticker-input-${security.id}`}
          value={security.ticker}
          onChange={e => onChange({ ticker: e.target.value.toUpperCase() })}
          placeholder="VTI"
          maxLength={10}
          className="uppercase"
          data-testid={`security-ticker-${index}`}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`security-name-input-${security.id}`}>
          Name (optional)
        </label>
        <Input
          id={`security-name-input-${security.id}`}
          value={security.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Vanguard Total US Stock"
          maxLength={64}
          data-testid={`security-name-${index}`}
        />
      </div>

      <NumberInput
        name={`security-price-${security.id}`}
        label="Price / Share"
        value={security.price}
        onChange={value => onChange({ price: value })}
        min={0}
        allowDecimals
        precision={2}
        prefix="$"
        placeholder="0.00"
        testId={`security-price-${index}`}
      />

      <div data-testid={`security-class-${index}`}>
        <SelectInput
          name={`security-class-select-${security.id}`}
          label="Asset Class"
          value={security.assetClass}
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
          aria-label={`Remove ${security.ticker || `security ${index + 1}`}`}
          data-testid={`security-remove-${index}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
