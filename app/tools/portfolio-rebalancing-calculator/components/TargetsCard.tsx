'use client';

import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Target as TargetIcon } from 'lucide-react';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { PercentInput } from '@/components/ui/inputs';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import {
  AssetClass,
  ClassTarget,
  Holding,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

const ASSET_CLASSES: AssetClass[] = [
  'us-stock',
  'intl-stock',
  'bonds',
  'reits',
  'cash',
  'other',
];

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  'us-stock': 'US Stock',
  'intl-stock': 'Intl Stock',
  'bonds': 'Bonds',
  'reits': 'REITs',
  'cash': 'Cash',
  'other': 'Other',
};

/**
 * Asset classes to render rows for: every class with a holding, every class
 * with a declared target, plus the default trio (US / Intl / Bonds) when the
 * portfolio is still empty so the user has somewhere to type.
 */
function relevantClasses(
  holdings: Holding[],
  securities: Security[],
  classTargets: ClassTarget[],
): AssetClass[] {
  const securityClass = new Map(securities.map(s => [s.id, s.assetClass]));
  const shown = new Set<AssetClass>();

  let hasHoldings = false;
  holdings.forEach(h => {
    const cls = securityClass.get(h.securityId);
    if (cls) {
      shown.add(cls);
      hasHoldings = true;
    }
  });

  classTargets.forEach(t => {
    if (t.target > 0) shown.add(t.assetClass);
  });

  if (!hasHoldings) {
    (['us-stock', 'intl-stock', 'bonds'] as AssetClass[]).forEach(c => shown.add(c));
  }

  return ASSET_CLASSES.filter(c => shown.has(c));
}

export function TargetsCard() {
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const holdings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const classTargets = usePortfolioRebalancingStore(s => s.inputs.classTargets);
  const setClassTarget = usePortfolioRebalancingStore(s => s.setClassTarget);

  const classes = useMemo(
    () => relevantClasses(holdings, securities, classTargets),
    [holdings, securities, classTargets],
  );

  const targetFor = (cls: AssetClass): number =>
    classTargets.find(t => t.accountId === null && t.assetClass === cls)?.target ?? 0;

  const sum = classes.reduce((acc, cls) => acc + targetFor(cls), 0);
  const sumPercent = sum * 100;
  const isBalanced = Math.abs(sum - 1) < 0.0001;

  return (
    <InputCard title="Target Allocation" icon={TargetIcon}>
      <div className="space-y-3">
        <div className="space-y-2">
          {classes.map(cls => (
            <div
              key={cls}
              className="grid grid-cols-[1fr_auto] items-center gap-3 p-2.5 rounded border border-border/60 bg-background"
              data-testid={`target-row-portfolio-${cls}`}
            >
              <span className="text-sm font-medium">{ASSET_CLASS_LABELS[cls]}</span>
              <div className="w-32" data-testid={`target-portfolio-${cls}`}>
                <PercentInput
                  name={`target-portfolio-${cls}`}
                  label=""
                  value={targetFor(cls)}
                  onChange={value => setClassTarget(cls, value)}
                  min={0}
                  max={1}
                  precision={1}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            'flex items-center gap-2 text-sm font-medium tabular-nums pt-1',
            isBalanced ? 'text-sage-600 dark:text-sage-300' : 'text-destructive',
          )}
          data-testid="target-sum-portfolio"
        >
          {isBalanced ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          Targets total: {sumPercent.toFixed(1)}%
          {!isBalanced && (
            <span className="text-xs font-normal">(must equal 100%)</span>
          )}
        </div>
      </div>
    </InputCard>
  );
}
