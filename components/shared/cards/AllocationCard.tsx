import React from 'react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { AllocationItem } from '@/lib/types';
import { ExpandableListCard, CardVariant } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { DollarSign, TrendingUp, Percent, Shield, CreditCard, Info } from 'lucide-react';

interface AllocationCardProps {
  allocation: AllocationItem;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  className?: string;
}

const categoryIcons = {
  employer_match: DollarSign,
  high_interest_debt: TrendingUp,
  tax_advantaged: Percent,
  tax_optimization: Percent,
  investment: TrendingUp,
  emergency_fund: Shield,
  debt_payoff: CreditCard,
};

function mapPriorityToVariant(priority: number): CardVariant {
  if (priority <= 2) return 'success';
  if (priority <= 4) return 'warning';
  return 'default';
}

export const AllocationCard = React.memo(function AllocationCard({
  allocation,
  showDetails = false,
  onToggleDetails,
  className,
}: AllocationCardProps) {
  const IconComponent = categoryIcons[allocation.category] || DollarSign;

  return (
    <ExpandableListCard
      icon={IconComponent}
      title={allocation.account}
      subtitle={`Priority #${allocation.priority} • ${formatPercent(allocation.percentage)} of income`}
      value={formatCurrency(allocation.amount)}
      valueSubtext="per month"
      variant={mapPriorityToVariant(allocation.priority)}
      expanded={showDetails}
      onToggle={onToggleDetails}
      className={className}
    >
      <p className="text-sm text-muted-foreground">{allocation.reasoning}</p>

      {allocation.taxImpact < 0 && (
        <StatusAlert variant="success" icon={DollarSign} title="Tax Savings">
          Monthly: {formatCurrency(Math.abs(allocation.taxImpact))} &bull; Annual: {formatCurrency(Math.abs(allocation.taxImpact) * 12)}
        </StatusAlert>
      )}

      <StatusAlert variant="info" icon={Info} title="Implementation">
        {allocation.implementation}
      </StatusAlert>
    </ExpandableListCard>
  );
});
