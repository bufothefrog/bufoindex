'use client';

import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { ResultCard } from '@/components/ui/cards/BaseCard';
import { placementAdvice, PlacementSuggestion } from '@/lib/calculations/assetLocation';
import {
  AccountType,
  AssetClass,
  RebalanceAsset,
  RebalanceInputsV2,
  getAssetClassLabel,
} from '@/lib/calculations/portfolioRebalancing';
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants/labels';
import { MISSING_VALUE } from '@/lib/design-system/stat';

/** In-sentence account type: "in taxable", "moving to tax-deferred". */
function accountPhrase(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type].toLowerCase();
}

/**
 * Tax-efficient placement suggestions. Iterates all holdings and emits
 * one suggestion per (security, account) pair where `placementAdvice`
 * returns a non-null recommendation.
 *
 * Duplicate suggestions (same ticker in same account type held twice) are
 * collapsed to a single entry.
 */
export interface PlacementAdviceCardProps {
  /** The inputs of the rebalance on display. */
  inputs: RebalanceInputsV2;
}

export function PlacementAdviceCard({ inputs }: PlacementAdviceCardProps) {
  const { securities, accounts, holdings, customAssetClasses } = inputs;

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
                  <span className="font-semibold">{s.ticker || MISSING_VALUE}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    ({getAssetClassLabel(s.assetClass, customAssetClasses)}, in {accountPhrase(s.accountType)})
                  </span>{' '}
                  {'\u2192'} consider moving to {accountPhrase(s.advice.preferredAccount)}.
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

export default PlacementAdviceCard;
