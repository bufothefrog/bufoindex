'use client';

import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards/BaseCard';
import { placementAdvice, PlacementSuggestion } from '@/lib/calculations/assetLocation';
import {
  AccountType,
  AssetClass,
  RebalanceAsset,
  getAssetClassLabel,
} from '@/lib/calculations/portfolioRebalancing';
import {
  selectCustomAssetClasses,
  usePortfolioRebalancingStore,
} from '@/lib/store/portfolioRebalancingStore';

const ACCOUNT_LABELS: Record<AccountType, string> = {
  'taxable': 'taxable',
  'tax-deferred': 'tax-deferred',
  'tax-free': 'tax-free',
};

/**
 * Tax-efficient placement suggestions. Iterates all holdings and emits
 * one suggestion per (security, account) pair where `placementAdvice`
 * returns a non-null recommendation.
 *
 * Duplicate suggestions (same ticker in same account type held twice) are
 * collapsed to a single entry.
 */
export function PlacementAdviceCard() {
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const accounts = usePortfolioRebalancingStore(s => s.inputs.accounts);
  const holdings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const customAssetClasses = usePortfolioRebalancingStore(selectCustomAssetClasses);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      key: string;
      ticker: string;
      assetClass: AssetClass;
      accountType: AccountType;
      accountName: string;
      advice: PlacementSuggestion;
    }> = [];

    for (const holding of holdings) {
      const security = securities.find(s => s.id === holding.securityId);
      const account = accounts.find(a => a.id === holding.accountId);
      if (!security || !account) continue;

      // Adapt to the Phase 1 placementAdvice signature by constructing a
      // minimal RebalanceAsset. Only assetClass + accountType are inspected.
      const asset: RebalanceAsset = {
        id: holding.id,
        ticker: security.ticker,
        currentShares: holding.shares,
        price: security.price,
        targetAllocation: 0,
        accountType: account.accountType,
        assetClass: security.assetClass,
      };
      const advice = placementAdvice(asset);
      if (!advice) continue;

      const dedupeKey = `${security.id}-${account.accountType}-${advice.preferredAccount}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      out.push({
        key: dedupeKey,
        ticker: security.ticker,
        assetClass: security.assetClass,
        accountType: account.accountType,
        accountName: account.name,
        advice,
      });
    }
    return out;
  }, [holdings, securities, accounts]);

  return (
    <div data-testid="placement-advice-card">
      <ResultCard title="Tax-Efficient Placement" icon={Lightbulb} status="info">
        {suggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Your holdings are already in tax-efficient accounts.
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map(s => (
              <li
                key={s.key}
                className="text-sm"
                data-testid={`placement-advice-${s.key}`}
              >
                <div className="text-foreground">
                  <span className="font-semibold">{s.ticker || '—'}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    ({getAssetClassLabel(s.assetClass, customAssetClasses)}, in {ACCOUNT_LABELS[s.accountType]})
                  </span>{' '}
                  → consider moving to {ACCOUNT_LABELS[s.advice.preferredAccount]}.
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.advice.reason}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ResultCard>
    </div>
  );
}
