'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OpportunityCostCard } from '@/components/shared/cards/OpportunityCostCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { KeyValueList } from '@/components/ui/results';
import { PayrollSetupGuide } from './PayrollSetupGuide';
import { PaycheckBreakdown } from './PaycheckBreakdown';
import { QuickActions } from './QuickActions';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { useDollarDisplay } from '@/components/shared/useDollarDisplay';
import { TONE_TEXT } from '@/lib/design-system/tone';
import { formatCurrency, formatYearsAndMonths } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { DISPLAY_INFLATION_ASSUMPTION } from '@/lib/utils/displayDollars';
import { PROJECTION_YEARS } from '@/lib/calculations/projections';
import {
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';

export interface ResultsSectionProps {
  result: AllocationResult;
  /** The engine inputs that produced `result`. */
  inputs: PaycheckProfile;
  /**
   * The result predates the latest values. The calculator page already marks
   * stale results, so nothing here changes with it.
   */
  stale: boolean;
}

export const ResultsSection = React.memo(function ResultsSection({ result, inputs: profile }: ResultsSectionProps) {
  const dollars = useDollarDisplay(DISPLAY_INFLATION_ASSUMPTION, { basis: 'fixed' });
  const [expandedSkipped, setExpandedSkipped] = React.useState<string | null>(null);
  const [showAllSkipped, setShowAllSkipped] = React.useState(false);

  // Display-only conversion for multi-year projections: per-paycheck
  // allocation amounts are current-year money and are never converted.
  // Deflation is linear, so applying it to each path and to their difference
  // stays internally consistent: the sign of the difference cannot flip.
  const toDisplayTenYear = (nominalAmount: number) => dollars.fromNominal(nominalAmount, PROJECTION_YEARS);

  // The projection compares the same universe of dollars on both paths, but the
  // recommended split can still come out behind, e.g. when part of the paycheck
  // is left unallocated. Read the sign off the rounded figure so a difference
  // that renders as $0 is labelled neither a gain nor a shortfall.
  const improvementValue = toDisplayTenYear(result.projections.improvement.tenYear);
  const roundedImprovement = Math.round(improvementValue);
  const isGain = roundedImprovement > 0;
  const isShortfall = roundedImprovement < 0;

  const visibleSkippedItems = showAllSkipped
    ? result.skippedItems
    : result.skippedItems.slice(0, 2);

  // Per-paycheck dollars by which necessary expenses exceed net pay; set only
  // when positive.
  const incomeShortfall = result.incomeShortfall;

  return (
    <div className="space-y-6">
      {incomeShortfall !== undefined && incomeShortfall > 0 && (
        <StatusAlert
          tone="caution"
          icon={AlertTriangle}
          title="Necessary expenses exceed take-home pay"
        >
          Your necessary expenses are {formatCurrency(incomeShortfall)} more than
          your net pay per paycheck, so nothing is left to allocate
          {result.allocations.length === 0 && ' and no allocations were generated'}.
          The figures below are calculated from the same inputs; changing the
          expense, income, or pay-frequency figures changes this gap.
        </StatusAlert>
      )}

      {/* Paycheck Breakdown */}
      <PaycheckBreakdown profile={profile} allocations={result.allocations} />

      {/* Quick Actions - Action-focused priority items */}
      <QuickActions profile={profile} />

      {/* Notes on this allocation / Skipped Items */}
      {result.skippedItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground flex items-center space-x-2">
              <AlertTriangle className={cn('w-5 h-5', TONE_TEXT.caution)} aria-hidden="true" />
              <span>Notes on This Allocation</span>
            </h3>
          </div>

          <StatusAlert tone="caution" icon={AlertTriangle} title="Items this allocation deprioritized">
            Based on your inputs, these items ranked below the allocations above on
            expected after-tax return. Each note shows the opportunity cost so you can
            weigh it against your own risk preferences.
          </StatusAlert>

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
              aria-expanded={showAllSkipped}
            >
              {showAllSkipped ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" aria-hidden="true" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" aria-hidden="true" />
                  Show {result.skippedItems.length - 2} More Notes
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
              <span>Long-Term Impact</span>
            </CardTitle>
            <DollarModeToggle value={dollars.mode} onChange={dollars.setMode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Both paths start from the same balances and payroll contributions and
            assume today&apos;s split continues for ten years.{' '}
            {dollars.caption}
          </p>
          <div className="space-y-3">
            <KeyValueList
              items={[
                {
                  id: 'current',
                  label: 'Current Path (10 years)',
                  value: toDisplayTenYear(result.projections.currentPath.tenYear),
                  format: 'currency',
                },
                {
                  id: 'optimized',
                  label: 'Optimized Path (10 years)',
                  value: toDisplayTenYear(result.projections.optimizedPath.tenYear),
                  format: 'currency',
                  tone: isShortfall ? 'neutral' : 'positive',
                },
              ]}
            />
            <hr className="border" />
            <KeyValueList
              items={[
                {
                  id: 'improvement',
                  label: isShortfall ? 'Difference' : 'Improvement',
                  value: Math.abs(improvementValue),
                  format: 'currency',
                  prefix: isGain ? '+' : isShortfall ? '-' : '',
                  tone: isGain ? 'positive' : isShortfall ? 'negative' : 'neutral',
                },
              ]}
            />
          </div>

          {isShortfall && (
            <StatusAlert
              tone="caution"
              icon={AlertTriangle}
              title="This split projects below your current path"
            >
              The allocation above directs less money toward net worth than your
              current saving rate implies, or routes it to lower-yielding
              accounts. Anything left unallocated is treated as spent{' \u2014 '}check
              your necessary expenses and fun-money inputs.
            </StatusAlert>
          )}

          {result.projections.improvement.fiYearsEarlier > 0 && (
            <StatusAlert tone="info">
              <div className="text-center">
                <div className="text-sm font-medium">Financial Independence</div>
                <div className={cn('text-lg font-bold', TONE_TEXT.info)}>
                  {formatYearsAndMonths(result.projections.improvement.fiYearsEarlier)} earlier
                </div>
              </div>
            </StatusAlert>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default ResultsSection;
