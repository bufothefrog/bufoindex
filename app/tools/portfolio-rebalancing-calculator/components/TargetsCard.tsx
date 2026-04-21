'use client';

import React, { useState, useMemo } from 'react';
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
 * Returns the set of asset classes to render target rows for. Includes:
 *   • every class held in scope,
 *   • every class with a declared target in scope,
 *   • a default trio (US / Intl / Bonds) when the scope has no holdings yet,
 *     so the user always has somewhere to type — without this trio collapsing
 *     to one row the moment the user enters the first percent.
 */
function relevantClasses(
  holdings: Holding[],
  securities: Security[],
  classTargets: ClassTarget[],
  accountId: string | null
): AssetClass[] {
  const securityClass = new Map(securities.map(s => [s.id, s.assetClass]));
  const shown = new Set<AssetClass>();

  let hasHoldingsInScope = false;
  holdings.forEach(h => {
    if (accountId !== null && h.accountId !== accountId) return;
    const cls = securityClass.get(h.securityId);
    if (cls) {
      shown.add(cls);
      hasHoldingsInScope = true;
    }
  });

  classTargets.forEach(t => {
    if (t.accountId === accountId && t.target > 0) shown.add(t.assetClass);
  });

  if (!hasHoldingsInScope) {
    (['us-stock', 'intl-stock', 'bonds'] as AssetClass[]).forEach(c => shown.add(c));
  }

  return ASSET_CLASSES.filter(c => shown.has(c));
}

export function TargetsCard() {
  const setupMode = usePortfolioRebalancingStore(s => s.setupMode);
  const accounts = usePortfolioRebalancingStore(s => s.inputs.accounts);
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const holdings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const classTargets = usePortfolioRebalancingStore(s => s.inputs.classTargets);
  const setClassTarget = usePortfolioRebalancingStore(s => s.setClassTarget);

  // multi-unique tabs — null for the first-account default.
  const [activeTab, setActiveTab] = useState<string | null>(null);

  if (setupMode === null) return null;

  if (setupMode === 'single' || setupMode === 'multi-shared') {
    const classes = relevantClasses(holdings, securities, classTargets, null);
    return (
      <InputCard title="Target Allocation" icon={TargetIcon}>
        <TargetsList
          accountId={null}
          classes={classes}
          classTargets={classTargets}
          onSetTarget={setClassTarget}
        />
      </InputCard>
    );
  }

  // multi-unique — tabs per account.
  const selectedAccountId = activeTab ?? accounts[0]?.id ?? null;

  return (
    <InputCard title="Target Allocation" icon={TargetIcon}>
      {accounts.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground">
          Add an account first.
        </div>
      ) : (
        <div className="space-y-4">
          <div
            role="tablist"
            className="flex flex-wrap gap-2 border-b border-border pb-2"
            data-testid="targets-tablist"
          >
            {accounts.map(account => {
              const isActive = account.id === selectedAccountId;
              return (
                <button
                  key={account.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(account.id)}
                  data-testid={`targets-tab-${account.id}`}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400',
                    isActive
                      ? 'bg-sage-100 text-sage-800 dark:bg-sage-700/40 dark:text-sage-100 font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {account.name || 'Untitled'}
                </button>
              );
            })}
          </div>

          {selectedAccountId && (
            <TargetsList
              key={selectedAccountId}
              accountId={selectedAccountId}
              classes={relevantClasses(holdings, securities, classTargets, selectedAccountId)}
              classTargets={classTargets}
              onSetTarget={setClassTarget}
            />
          )}
        </div>
      )}
    </InputCard>
  );
}

interface TargetsListProps {
  accountId: string | null;
  classes: AssetClass[];
  classTargets: ClassTarget[];
  onSetTarget: (accountId: string | null, assetClass: AssetClass, target: number) => void;
}

function TargetsList({ accountId, classes, classTargets, onSetTarget }: TargetsListProps) {
  const scopeTargets = useMemo(
    () => classTargets.filter(t => t.accountId === accountId),
    [classTargets, accountId]
  );
  const targetFor = (cls: AssetClass): number =>
    scopeTargets.find(t => t.assetClass === cls)?.target ?? 0;

  const sum = classes.reduce((acc, cls) => acc + targetFor(cls), 0);
  const sumPercent = sum * 100;
  const isBalanced = Math.abs(sum - 1) < 0.0001;

  const testScope = accountId ?? 'portfolio';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {classes.map(cls => (
          <div
            key={cls}
            className="grid grid-cols-[1fr_auto] items-center gap-3 p-2.5 rounded border border-border/60 bg-background"
            data-testid={`target-row-${testScope}-${cls}`}
          >
            <span className="text-sm font-medium">{ASSET_CLASS_LABELS[cls]}</span>
            <div className="w-32" data-testid={`target-${testScope}-${cls}`}>
              <PercentInput
                name={`target-${testScope}-${cls}`}
                label=""
                value={targetFor(cls)}
                onChange={value => onSetTarget(accountId, cls, value)}
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
          isBalanced ? 'text-sage-600 dark:text-sage-300' : 'text-destructive'
        )}
        data-testid={`target-sum-${testScope}`}
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
  );
}
