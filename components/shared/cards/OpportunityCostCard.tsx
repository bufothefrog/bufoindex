import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { SkippedItem } from '@/lib/types';
import { AlertTriangle, TrendingDown, Info, ChevronDown, ChevronRight } from 'lucide-react';

interface OpportunityCostCardProps {
  skippedItem: SkippedItem;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  className?: string;
}

const riskLevelStyles = {
  low: 'border-l-yellow-400 dark:border-l-yellow-500 bg-yellow-50 dark:bg-yellow-800',
  medium: 'border-l-orange-500 dark:border-l-orange-600 bg-orange-50 dark:bg-orange-800',
  high: 'border-l-red-500 dark:border-l-red-600 bg-red-50 dark:bg-red-800',
};

const riskLevelIcons = {
  low: Info,
  medium: AlertTriangle,
  high: AlertTriangle,
};

export function OpportunityCostCard({
  skippedItem,
  showDetails = false,
  onToggleDetails,
  className,
}: OpportunityCostCardProps) {
  const riskStyle = riskLevelStyles[skippedItem.riskLevel];
  const RiskIcon = riskLevelIcons[skippedItem.riskLevel];
  
  const getHighestOpportunityCost = () => {
    const costs = skippedItem.opportunityCost;
    if (costs.twentyYear) return { amount: costs.twentyYear, period: '20 years' };
    if (costs.tenYear) return { amount: costs.tenYear, period: '10 years' };
    return { amount: costs.annual, period: 'annually' };
  };
  
  const highestCost = getHighestOpportunityCost();
  
  return (
    <Card className={cn(
      "border-l-4 transition-all duration-200 hover:shadow-md",
      riskStyle,
      className
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-white shadow-sm">
              <RiskIcon className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center">
                <span className="mr-2">🚫</span>
                SKIP {skippedItem.item}
              </CardTitle>
              <div className="text-sm text-muted-foreground capitalize">
                {skippedItem.riskLevel} risk optimization
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-orange-600 font-mono tabular-nums">
              {formatCurrency(highestCost.amount)}
            </div>
            <div className="text-sm text-muted-foreground">
              cost over {highestCost.period}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="p-3 bg-white rounded-md border border-gray-200">
            <div className="font-medium text-sm text-gray-700 mb-1">Why skip this:</div>
            <p className="text-sm text-gray-600">
              {skippedItem.reason}
            </p>
          </div>
          
          <div className="p-3 bg-white rounded-md border border-green-200">
            <div className="font-medium text-sm text-green-700 mb-1">Do this instead:</div>
            <p className="text-sm text-gray-600">
              {skippedItem.alternative}
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Monthly: <span className="font-mono tabular-nums">{formatCurrency(skippedItem.opportunityCost.monthly)}</span></span>
              <span>Annual: <span className="font-mono tabular-nums">{formatCurrency(skippedItem.opportunityCost.annual)}</span></span>
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
                    Hide Math
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
          
          {showDetails && skippedItem.education && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-800 rounded-md border border-blue-200 dark:border-blue-600">
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-50 mb-2 flex items-center">
                <Info className="w-4 h-4 mr-1" />
                Why This Matters:
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-100">
                {skippedItem.education}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}