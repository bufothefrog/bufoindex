'use client';

import React from 'react';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import { formatCurrency } from '@/lib/format';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';
import { isFiniteNumber } from '@/lib/fields/runtime';
import { SkippedItem } from '@/lib/types';
import { ExpandableListCard } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { AlertTriangle, Info } from 'lucide-react';
import type { Tone } from '@/lib/design-system/tone';

interface OpportunityCostCardProps {
  skippedItem: SkippedItem;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  className?: string;
}

const riskLevelIcons = {
  low: Info,
  medium: AlertTriangle,
  high: AlertTriangle,
};

const riskLevelLabels: Record<SkippedItem['riskLevel'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function riskTone(riskLevel: SkippedItem['riskLevel']): Tone {
  if (riskLevel === 'high') return 'negative';
  return 'caution';
}

/**
 * A cost of exactly zero (or a non-finite value) carries no information, so it
 * is never worth rendering as a dollar figure.
 */
function isMeaningfulCost(amount: number | undefined): amount is number {
  return isFiniteNumber(amount) && amount !== 0;
}

interface HighlightedCost {
  amount: number;
  /** Reads under the figure, so it has to be grammatical on its own. */
  subtext: string;
  /**
   * How far out the figure lies: 10 or 20 for a compounded cost (nominal,
   * converted for display), 0 for an annual cost (current-year money).
   */
  years: number;
}

/**
 * Pick the longest horizon the analysis layer supplied a cost for. Returns null
 * when no horizon has a non-zero cost, so the card can drop the dollar framing
 * entirely rather than assert "$0 cost".
 */
function getHighestOpportunityCost(
  costs: SkippedItem['opportunityCost']
): HighlightedCost | null {
  if (isMeaningfulCost(costs.twentyYear)) {
    return { amount: costs.twentyYear, subtext: 'cost over 20 years', years: 20 };
  }
  if (isMeaningfulCost(costs.tenYear)) {
    return { amount: costs.tenYear, subtext: 'cost over 10 years', years: 10 };
  }
  if (isMeaningfulCost(costs.annual)) {
    return { amount: costs.annual, subtext: 'annual cost', years: 0 };
  }
  return null;
}

export const OpportunityCostCard = React.memo(function OpportunityCostCard({
  skippedItem,
  showDetails = false,
  onToggleDetails,
  className,
}: OpportunityCostCardProps) {
  // Display only: the 10- and 20-year costs are nominal and follow the shared
  // dollar mode at the paycheck allocator's fixed inflation assumption.
  const dollars = useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' });
  const RiskIcon = riskLevelIcons[skippedItem.riskLevel];
  const highestCost = getHighestOpportunityCost(skippedItem.opportunityCost);
  const highlighted = highestCost && {
    value: formatCurrency(dollars.fromNominal(highestCost.amount, highestCost.years)),
    subtext: highestCost.years > 0 ? `${highestCost.subtext}${dollars.axisSuffix}` : highestCost.subtext,
  };

  const costRows = [
    { label: 'Monthly', amount: skippedItem.opportunityCost.monthly },
    { label: 'Annual', amount: skippedItem.opportunityCost.annual },
  ].filter((row) => isMeaningfulCost(row.amount));

  return (
    <ExpandableListCard
      icon={RiskIcon}
      title={`Deprioritized: ${skippedItem.item}`}
      subtitle={`Risk level: ${riskLevelLabels[skippedItem.riskLevel]}`}
      value={highlighted?.value}
      valueSubtext={highlighted?.subtext}
      tone={riskTone(skippedItem.riskLevel)}
      expanded={showDetails}
      onToggle={onToggleDetails}
      className={className}
    >
      <StatusAlert tone="caution" icon={AlertTriangle} title="Why skip this">
        {skippedItem.reason}
      </StatusAlert>

      <StatusAlert tone="positive" icon={Info} title="Do this instead">
        {skippedItem.alternative}
      </StatusAlert>

      {costRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {costRows.map((row) => (
            <span key={row.label}>
              {row.label}:{' '}
              <span className="font-mono tabular-nums">{formatCurrency(row.amount)}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No dollar opportunity cost is modeled for this item.
        </p>
      )}

      {skippedItem.education && (
        <StatusAlert tone="info" icon={Info} title="Why This Matters">
          {skippedItem.education}
        </StatusAlert>
      )}
    </ExpandableListCard>
  );
});
