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

function mapRiskToVariant(riskLevel: SkippedItem['riskLevel']): CardVariant {
  if (riskLevel === 'high') return 'danger';
  return 'warning';
}

export const OpportunityCostCard = React.memo(function OpportunityCostCard({
  skippedItem,
  showDetails = false,
  onToggleDetails,
  className,
}: OpportunityCostCardProps) {
  const RiskIcon = riskLevelIcons[skippedItem.riskLevel];

  const getHighestOpportunityCost = () => {
    const costs = skippedItem.opportunityCost;
    if (costs.twentyYear) return { amount: costs.twentyYear, period: '20 years' };
    if (costs.tenYear) return { amount: costs.tenYear, period: '10 years' };
    return { amount: costs.annual, period: 'annually' };
  };

  const highestCost = getHighestOpportunityCost();

  return (
    <ExpandableListCard
      icon={RiskIcon}
      title={`SKIP ${skippedItem.item}`}
      subtitle={`${skippedItem.riskLevel} risk optimization`}
      value={formatCurrency(highestCost.amount)}
      valueSubtext={`cost over ${highestCost.period}`}
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

      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
        <span>Monthly: <span className="font-mono tabular-nums">{formatCurrency(skippedItem.opportunityCost.monthly)}</span></span>
        <span>Annual: <span className="font-mono tabular-nums">{formatCurrency(skippedItem.opportunityCost.annual)}</span></span>
      </div>

      {skippedItem.education && (
        <StatusAlert variant="info" icon={Info} title="Why This Matters">
          {skippedItem.education}
        </StatusAlert>
      )}
    </ExpandableListCard>
  );
});
