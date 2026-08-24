import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { SkippedItem } from '@/lib/types';
import { ExpandableListCard, CardVariant } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { AlertTriangle, Info } from 'lucide-react';

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

function mapRiskToVariant(riskLevel: SkippedItem['riskLevel']): CardVariant {
  if (riskLevel === 'high') return 'danger';
  return 'warning';
}

/**
 * A cost of exactly zero (or a non-finite value) carries no information, so it
 * is never worth rendering as a dollar figure.
 */
function isMeaningfulCost(amount: number | undefined): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount !== 0;
}

interface HighlightedCost {
  amount: number;
  /** Reads under the figure, so it has to be grammatical on its own. */
  subtext: string;
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
    return { amount: costs.twentyYear, subtext: 'cost over 20 years' };
  }
  if (isMeaningfulCost(costs.tenYear)) {
    return { amount: costs.tenYear, subtext: 'cost over 10 years' };
  }
  if (isMeaningfulCost(costs.annual)) {
    return { amount: costs.annual, subtext: 'annual cost' };
  }
  return null;
}

export const OpportunityCostCard = React.memo(function OpportunityCostCard({
  skippedItem,
  showDetails = false,
  onToggleDetails,
  className,
}: OpportunityCostCardProps) {
  const RiskIcon = riskLevelIcons[skippedItem.riskLevel];
  const highestCost = getHighestOpportunityCost(skippedItem.opportunityCost);

  const costRows = [
    { label: 'Monthly', amount: skippedItem.opportunityCost.monthly },
    { label: 'Annual', amount: skippedItem.opportunityCost.annual },
  ].filter((row) => isMeaningfulCost(row.amount));

  return (
    <ExpandableListCard
      icon={RiskIcon}
      title={`Deprioritized: ${skippedItem.item}`}
      subtitle={`Risk level: ${riskLevelLabels[skippedItem.riskLevel]}`}
      value={highestCost ? formatCurrency(highestCost.amount) : undefined}
      valueSubtext={highestCost?.subtext}
      variant={mapRiskToVariant(skippedItem.riskLevel)}
      expanded={showDetails}
      onToggle={onToggleDetails}
      className={className}
    >
      <StatusAlert variant="warning" icon={AlertTriangle} title="Why skip this">
        {skippedItem.reason}
      </StatusAlert>

      <StatusAlert variant="success" icon={Info} title="Do this instead">
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
        <StatusAlert variant="info" icon={Info} title="Why This Matters">
          {skippedItem.education}
        </StatusAlert>
      )}
    </ExpandableListCard>
  );
});
