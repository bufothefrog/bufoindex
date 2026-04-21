'use client';

import React from 'react';
import { Plus, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { RebalanceAsset } from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';
import { AssetRow } from './AssetRow';

interface AssetListCardProps {
  assets: RebalanceAsset[];
  onUpdateAsset: (id: string, updates: Partial<Omit<RebalanceAsset, 'id'>>) => void;
  onAddAsset: () => void;
  onRemoveAsset: (id: string) => void;
}

export function AssetListCard({
  assets,
  onUpdateAsset,
  onAddAsset,
  onRemoveAsset,
}: AssetListCardProps) {
  const targetSum = assets.reduce((s, a) => s + a.targetAllocation, 0);
  const targetSumPercent = targetSum * 100;
  const isBalanced = Math.abs(targetSum - 1) < 0.0001;

  return (
    <InputCard title="Your Holdings" icon={Wallet}>
      <div className="space-y-3">
        {assets.map((asset, index) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            index={index}
            canRemove={assets.length > 1}
            onChange={updates => onUpdateAsset(asset.id, updates)}
            onRemove={() => onRemoveAsset(asset.id)}
          />
        ))}

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={onAddAsset} className="gap-2" data-testid="add-asset">
            <Plus className="w-4 h-4" />
            Add Asset
          </Button>

          <div
            className={cn(
              'flex items-center gap-2 text-sm font-medium tabular-nums',
              isBalanced ? 'text-sage-600 dark:text-sage-300' : 'text-destructive'
            )}
            data-testid="target-sum"
          >
            {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            Targets total: {targetSumPercent.toFixed(1)}%
            {!isBalanced && <span className="text-xs font-normal">(must equal 100%)</span>}
          </div>
        </div>
      </div>
    </InputCard>
  );
}
