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

import React, { useCallback } from 'react';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { BaseCard } from '@/components/ui/cards/BaseCard';
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

/** Shown in the results column until the first run after hydration. */
export function ResultsPlaceholder({ label }: { label: string }) {
  return (
    <BaseCard>
      <div role="status" aria-label={label} className="space-y-4" data-results-placeholder="">
        <div className="h-6 w-1/2 animate-pulse rounded-md bg-muted" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          <div className="h-20 animate-pulse rounded-lg bg-muted/70" />
          <div className="h-20 animate-pulse rounded-lg bg-muted/70" />
        </div>
        <div className="h-56 animate-pulse rounded-lg bg-muted/50" aria-hidden="true" />
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

  // Core screens start collapsed once every core field has been answered.
  const coreComplete =
    ready &&
    form.screens
      .filter((screen) => screen.tier === 'core')
      .every((screen) => isScreenComplete(form, screen, get, provided));
  const initiallyCollapsed = useCallback(
    (screen: ScreenSpec) => (screen.tier === 'core' ? coreComplete : defaultCollapsed(screen)),
    [coreComplete]
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
          className={cn('space-y-6 transition-opacity', stale && 'opacity-60')}
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
