import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { AllocationItem } from '@/lib/types';
import { ChevronDown, ChevronRight, TrendingUp, DollarSign, Percent, Shield, CreditCard } from 'lucide-react';

interface AllocationCardProps {
  allocation: AllocationItem;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  className?: string;
}

const priorityStyles = {
  1: 'border-l-sage-500',
  2: 'border-l-sage-400',
  3: 'border-l-sage-300',
  4: 'border-l-primary/50',
  5: 'border-l-primary/40',
  6: 'border-l-primary/30',
  7: 'border-l-border',
};

const categoryIcons = {
  employer_match: DollarSign,
  high_interest_debt: TrendingUp,
  tax_advantaged: Percent,
  tax_optimization: Percent,
  investment: TrendingUp,
  emergency_fund: Shield,
  debt_payoff: CreditCard,
};

export const AllocationCard = React.memo(function AllocationCard({
  allocation,
  showDetails = false,
  onToggleDetails,
  className,
}: AllocationCardProps) {
  const priorityStyle = priorityStyles[allocation.priority as keyof typeof priorityStyles] || priorityStyles[7];
  const IconComponent = categoryIcons[allocation.category] || DollarSign;
  
  return (
    <Card className={cn(
      "border-l-4 transition-all duration-200 hover:shadow-md",
      priorityStyle,
      className
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-card shadow-sm">
              <IconComponent className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{allocation.account}</CardTitle>
              <div className="text-sm text-muted-foreground">
                Priority #{allocation.priority} • <span className="font-mono tabular-nums">{formatPercent(allocation.percentage)}</span> of income
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-success font-mono tabular-nums">
              {formatCurrency(allocation.amount)}
            </div>
            <div className="text-sm text-muted-foreground">
              per month
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {allocation.reasoning}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              {allocation.taxImpact < 0 && (
                <div className="text-success font-medium">
                  Tax savings: <span className="font-mono tabular-nums">{formatCurrency(Math.abs(allocation.taxImpact))}/month</span>
                </div>
              )}
            </div>
            
            {onToggleDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleDetails}
                className="text-xs"
              >
                {showDetails ? (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Show Math
                  </>
                )}
              </Button>
            )}
          </div>
          
          {showDetails && (
            <div className="mt-4 p-4 bg-muted/50 rounded-md border border-border">
              <h4 className="font-medium text-sm mb-2">Implementation:</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {allocation.implementation}
              </p>
              
              {allocation.taxImpact < 0 && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Monthly tax savings: <span className="font-mono tabular-nums">{formatCurrency(Math.abs(allocation.taxImpact))}</span></div>
                  <div>Annual tax savings: <span className="font-mono tabular-nums">{formatCurrency(Math.abs(allocation.taxImpact) * 12)}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});