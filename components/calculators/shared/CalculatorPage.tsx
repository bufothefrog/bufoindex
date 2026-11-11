'use client';

/**
 * CalculatorPage (docs/rebuild-plan.md section 2.9): the one calculator
 * shell. A calculator page is its definition, its run store, any custom
 * field renderers and a results renderer:
 *
 *   <CalculatorPage
 *     definition={RETIREMENT_CALCULATOR}
 *     store={useRetirementStore}
 *     renderers={RETIREMENT_RENDERERS}
 *     renderResults={({ results, inputs, stale }) => <ResultsSection ... />}
 *     afterLayout={<MethodologyLink />}
 *   />
 *
 * - Title, description and disclaimer come from the registry.
 * - Inputs are the shared profile, rendered by FieldSections; edits write
 *   through to the profile (O1).
 * - Results follow the inputs (O8): no Calculate button. Invalid inputs keep
 *   the last results on screen, marked stale (O17).
 * - Results show a placeholder until the profile has hydrated and the first
 *   run has finished, so server and hydration markup match.
 *
 * Every store read is a selector, so typing does not re-render the page
 * from a whole-store subscription.
 */

import React, { useCallback, useState } from 'react';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { BaseCard } from '@/components/ui/cards/BaseCard';
import { StatGrid } from '@/components/ui/results/StatGrid';
import { StatTile } from '@/components/ui/results/StatTile';
import { ChartPlaceholder } from '@/components/ui/charts/ChartPlaceholder';
import type { ChartHeight } from '@/components/ui/charts/sizes';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { FieldSections, defaultCollapsed, type CustomRenderers } from '@/components/fields';
import { NextSteps } from '@/components/guided/NextSteps';
import { calculatorMeta } from '@/lib/calculators/registry';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { composeDisclaimer } from '@/lib/constants/disclaimers';
import { isScreenComplete } from '@/lib/fields/runtime';
import type { ScreenSpec } from '@/lib/fields/types';
import type { FinancialProfile } from '@/lib/profile/types';
import type { CalculatorStore } from '@/lib/store/createCalculatorStore';
import { cn } from '@/lib/utils';
import { useCalculatorBootstrap } from './useCalculatorBootstrap';
import { useCalculatorValues } from './useCalculatorValues';

export interface CalculatorResultsArgs<E, R> {
  results: R;
  /** The engine inputs that produced `results`. */
  inputs: E;
  values: FinancialProfile;
  /** True when the inputs changed to something invalid (or a run failed) since these results. */
  stale: boolean;
}

export interface CalculatorPageProps<E, R> {
  definition: CalculatorDefinition<E, R>;
  store: CalculatorStore<E, R>;
  renderers?: CustomRenderers;
  renderResults: (args: CalculatorResultsArgs<E, R>) => React.ReactNode;
  /** Rendered after the layout (the retirement methodology link). */
  afterLayout?: React.ReactNode;
  /** Page-level notice between the header and the grid. */
  notice?: React.ReactNode;
  /** Replaces the default results placeholder (match the real results' height). */
  resultsPlaceholder?: React.ReactNode;
  className?: string;
  testId?: string;
}

export interface ResultsPlaceholderProps {
  /** Accessible name of the placeholder (the calculator's live-results label). */
  label: string;
  /** Labels of the two headline tiles, shown while their values load. */
  statLabels?: readonly [string, string];
  /** Height of the chart the results open with (ChartFrame sizes). */
  chartHeight?: ChartHeight;
}

/**
 * Shown in the results column until the first run after hydration. Built
 * from the shared loading primitives (StatTile loading, ChartPlaceholder) so
 * its height tracks the real tiles and chart.
 */
export function ResultsPlaceholder({
  label,
  statLabels = ['Headline figure', 'Second figure'],
  chartHeight = 'compact',
}: ResultsPlaceholderProps) {
  return (
    <BaseCard>
      <div role="status" aria-label={label} className="space-y-4" data-results-placeholder="">
        <StatGrid columns={2} loading>
          <StatTile label={statLabels[0]} loading />
          <StatTile label={statLabels[1]} loading />
        </StatGrid>
        <ChartPlaceholder height={chartHeight} />
      </div>
    </BaseCard>
  );
}

export const STALE_RESULTS_MESSAGE =
  'These results are from your last valid inputs. They update once the marked fields are fixed.';

export function CalculatorPage<E, R>({
  definition,
  store,
  renderers,
  renderResults,
  afterLayout,
  notice,
  resultsPlaceholder,
  className,
  testId,
}: CalculatorPageProps<E, R>) {
  const meta = calculatorMeta(definition.id);
  const { form } = definition;
  const { ready, arrivedFromProfile } = useCalculatorBootstrap(store);
  const { values, get, provided, write, restoreDefaults } = useCalculatorValues();

  const results = store((s) => s.results);
  const resultsInputs = store((s) => s.resultsInputs);
  const errors = store((s) => s.errors);
  const stale = store((s) => s.stale);
  const isCalculating = store((s) => s.isCalculating);

  // Core screens start collapsed when every core field was already answered
  // on arrival. The decision is taken once, the first render `ready` is true,
  // and then frozen: every edit marks its path provided, so recomputing it
  // would collapse the core card (unmounting the focused input) on the first
  // keystroke into the last unanswered core field.
  const [coreCollapsedAtReady, setCoreCollapsedAtReady] = useState<boolean | null>(null);
  if (ready && coreCollapsedAtReady === null) {
    setCoreCollapsedAtReady(
      form.screens
        .filter((screen) => screen.tier === 'core')
        .every((screen) => isScreenComplete(form, screen, get, provided))
    );
  }
  const coreCollapsed = coreCollapsedAtReady ?? false;
  const initiallyCollapsed = useCallback(
    (screen: ScreenSpec) => (screen.tier === 'core' ? coreCollapsed : defaultCollapsed(screen)),
    [coreCollapsed]
  );
  const handleRestoreDefaults = useCallback(
    (screen: ScreenSpec) => restoreDefaults(form, screen),
    [form, restoreDefaults]
  );

  const hasErrors = Object.keys(errors).length > 0;
  const hasResults = ready && results !== null && resultsInputs !== null;

  let resultSection: React.ReactNode;
  if (hasResults) {
    resultSection = (
      <div className="space-y-4">
        {stale && (
          <StatusAlert tone="caution" role="status" testId="stale-results">
            {STALE_RESULTS_MESSAGE}
          </StatusAlert>
        )}
        <div
          data-stale={stale ? '' : undefined}
          aria-busy={isCalculating || undefined}
          className={cn('space-y-6', stale && 'border-l-4 border-dashed border-warning pl-3')}
        >
          {renderResults({ results, inputs: resultsInputs, values, stale })}
        </div>
      </div>
    );
  } else if (!ready || !hasErrors) {
    resultSection = resultsPlaceholder ?? <ResultsPlaceholder label={meta.liveResultsLabel} />;
  }

  return (
    <>
      <CalculatorLayout
        title={meta.title}
        description={meta.description}
        className={className}
        testId={testId}
        liveResults
        notice={notice}
        inputSections={
          <FieldSections
            form={form}
            get={get}
            errors={ready ? errors : {}}
            onWrite={write}
            renderers={renderers}
            surface="calculator"
            initiallyCollapsed={initiallyCollapsed}
            onRestoreDefaults={handleRestoreDefaults}
          />
        }
        resultSection={resultSection}
        resultFooter={hasResults ? <NextSteps intent={definition.id} /> : undefined}
        isCalculating={isCalculating}
        calculatingText={meta.liveResultsLabel}
        errors={ready ? errors : {}}
        showResultsKey={arrivedFromProfile && hasResults ? 'from-profile' : undefined}
        disclaimer={composeDisclaimer(...meta.disclaimer)}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {ready && isCalculating ? meta.liveResultsLabel : ''}
      </p>
      {afterLayout}
    </>
  );
}

export default CalculatorPage;
