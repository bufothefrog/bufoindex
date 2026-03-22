'use client';

import React from 'react';
import { useResult, useProfile, useCalculatorStore } from '@/lib/store/calculatorStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AllocationCard } from '@/components/shared/cards/AllocationCard';
import { OpportunityCostCard } from '@/components/shared/cards/OpportunityCostCard';
import { PayrollSetupGuide } from './PayrollSetupGuide';
import { PaycheckBreakdown } from './PaycheckBreakdown';
import { QuickActions } from './QuickActions';
import { formatCurrency, formatYearsAndMonths } from '@/lib/utils';
import { 
  TrendingUp, 
  ChevronDown,
  ChevronUp,
  Calculator,
  AlertTriangle
} from 'lucide-react';

export function ResultsSection() {
  const result = useResult();
  const profile = useProfile();
  const [expandedAllocation, setExpandedAllocation] = React.useState<string | null>(null);
  const [expandedSkipped, setExpandedSkipped] = React.useState<string | null>(null);
  const [showAllSkipped, setShowAllSkipped] = React.useState(false);
  
  // Load from URL on component mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !result) {
      const { loadFromUrl } = useCalculatorStore.getState();
      loadFromUrl();
    }
  }, [result]);
  
  if (!result) return null;
  
  
  const visibleSkippedItems = showAllSkipped 
    ? result.skippedItems 
    : result.skippedItems.slice(0, 2);
  
  return (
    <div className="space-y-6">
      {/* Paycheck Breakdown */}
      <PaycheckBreakdown 
        profile={profile}
        allocations={result.allocations}
        skippedItems={result.skippedItems}
        remainingAmount={result.remainingAmount}
        funMoneyAllocated={result.funMoneyAllocated}
      />

      {/* Quick Actions - Action-focused priority items */}
      <QuickActions 
        profile={profile}
        allocations={result.allocations}
        skippedItems={result.skippedItems}
      />
      
      {/* Contrarian Advice / Skipped Items */}
      {result.skippedItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span>Contrarian Recommendations</span>
            </h3>
          </div>
          
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-md">
            <p className="text-sm text-foreground">
              <strong>Reject financial myths:</strong> These recommendations go against 
              traditional financial advice but are mathematically optimized for your situation. 
              Review the math and make informed decisions.
            </p>
          </div>
          
          {visibleSkippedItems.map((skippedItem) => (
            <OpportunityCostCard
              key={skippedItem.id}
              skippedItem={skippedItem}
              showDetails={expandedSkipped === skippedItem.id}
              onToggleDetails={() => 
                setExpandedSkipped(
                  expandedSkipped === skippedItem.id ? null : skippedItem.id
                )
              }
            />
          ))}
          
          {result.skippedItems.length > 2 && (
            <Button
              variant="outline"
              onClick={() => setShowAllSkipped(!showAllSkipped)}
              className="w-full"
            >
              {showAllSkipped ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show {result.skippedItems.length - 2} More Recommendations
                </>
              )}
            </Button>
          )}
        </div>
      )}


      
      
      
      {/* Payroll Setup Guide */}
      <PayrollSetupGuide profile={profile} result={result} />
      
      {/* Future Projections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span>Long-Term Impact</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Path (10 years)</span>
              <span className="font-semibold">
                {formatCurrency(result.projections.currentPath.tenYear)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Optimized Path (10 years)</span>
              <span className="font-semibold text-success">
                {formatCurrency(result.projections.optimizedPath.tenYear)}
              </span>
            </div>
            <hr className="border" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">Improvement</span>
              <span className="font-bold text-success text-lg">
                +{formatCurrency(result.projections.improvement.tenYear)}
              </span>
            </div>
          </div>
          
          {result.projections.improvement.fiYearsEarlier > 0 && (
            <div className="p-3 bg-info/10 rounded-md text-center">
              <div className="text-sm font-medium text-foreground">Financial Independence</div>
              <div className="text-lg font-bold text-info">
                {formatYearsAndMonths(result.projections.improvement.fiYearsEarlier)} earlier
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}