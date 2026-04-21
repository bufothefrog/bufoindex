'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards/BaseCard';
import { placementAdvice } from '@/lib/calculations/assetLocation';
import {
  AccountType,
  AssetClass,
  RebalanceAsset,
} from '@/lib/calculations/portfolioRebalancing';

interface PlacementAdviceCardProps {
  assets: RebalanceAsset[];
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  'us-stock': 'US Stock',
  'intl-stock': 'Intl Stock',
  'bonds': 'Bonds',
  'reits': 'REITs',
  'cash': 'Cash',
  'other': 'Other',
};

const ACCOUNT_LABELS: Record<AccountType, string> = {
  'taxable': 'taxable',
  'tax-deferred': 'tax-deferred',
  'tax-free': 'tax-free',
};

export function PlacementAdviceCard({ assets }: PlacementAdviceCardProps) {
  const suggestions = assets
    .map(asset => ({ asset, advice: placementAdvice(asset) }))
    .filter((entry): entry is { asset: RebalanceAsset; advice: NonNullable<ReturnType<typeof placementAdvice>> } => entry.advice !== null);

  return (
    <div data-testid="placement-advice-card">
      <ResultCard title="Tax-Efficient Placement" icon={Lightbulb} status="info">
        {suggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Your assets are already in tax-efficient accounts.
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map(({ asset, advice }) => (
              <li
                key={asset.id}
                className="text-sm"
                data-testid={`placement-advice-${asset.id}`}
              >
                <div className="text-foreground">
                  <span className="font-semibold">{asset.ticker || '—'}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    ({ASSET_CLASS_LABELS[asset.assetClass]}, {ACCOUNT_LABELS[asset.accountType]})
                  </span>{' '}
                  → consider moving to {ACCOUNT_LABELS[advice.preferredAccount]}.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {advice.reason}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ResultCard>
    </div>
  );
}
