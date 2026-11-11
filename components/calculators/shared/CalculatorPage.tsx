'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, History } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { FieldSections } from '@/components/fields';
import type { CustomRenderers } from '@/components/fields';
import { NextSteps } from '@/components/guided/NextSteps';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { calculatorDisclaimer, calculatorMeta } from '@/lib/calculators/registry';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { makeGet } from '@/lib/fields/paths';
import { screenPaths } from '@/lib/fields/runtime';
import type { ScreenSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import type { CalculatorStore } from '@/lib/store/createCalculatorStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { cn } from '@/lib/utils';
import { useCalculatorBootstrap } from './useCalculatorBootstrap';
import { useCalculatorValues } from './useCalculatorValues';

export interface CalculatorResultsArgs<E, R> {
  results: R;
  /** The engine inputs that produced `results` (not the latest values). */
  inputs: E;
  values: FinancialProfile;
  /** The results predate the latest values (an invalid field or a failed run). */
  stale: boolean;
}

export interface CalculatorPageProps<E, R> {
  definition: CalculatorDefinition<E, R>;
  store: CalculatorStore<E, R>;
  renderers?: CustomRenderers;
  renderResults: (args: CalculatorResultsArgs<E, R>) => React.ReactNode;
  /** Rendered after the layout (the retirement methodology link). */
  afterLayout?: React.ReactNode;
}

/** The run store's key for an error that belongs to no field (createCalculatorStore). */
const RUN_ERROR_PATH = 'calculation';

/** Placeholder for the results column until the first run after hydration. */
function ResultsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading results" className="space-y-4">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * The one calculator page (docs/rebuild-plan.md section 2.9): the registry
 * entry for the definition's id, its form as FieldSections over the
 * profile, and its results from the run store, with live recalculation
 * (O8).
 *
 * Inputs render from the default profile on the server and during
 * hydration; the results column shows a skeleton until the first run after
 * hydration (useCalculatorBootstrap submits that one immediately). From then
 * on every profile change is submitted and the store debounces, validates
 * and memoizes. On invalid values the last results stay, marked stale
 * (O17); with no results at all the layout's live empty state shows.
 */
export default function CalculatorPage<E, R>({
  definition,
  store,
  renderers,
  renderResults,
  afterLayout,
}: CalculatorPageProps<E, R>) {
  const meta = calculatorMeta(definition.id);
  const { ready, arrivedFromProfile } = useCalculatorBootstrap(definition, store);
  const { values, get, write } = useCalculatorValues();

  const results = store((state) => state.results);
  const inputs = store((state) => state.inputs);
  const errors = store((state) => state.errors);
  const stale = store((state) => state.stale);
  const isCalculating = store((state) => state.isCalculating);
  const provided = values.provided;

  // The bootstrap's immediate submit already covers the first ready render;
  // this repeat is a memo hit (or joins the run in flight).
  useEffect(() => {
    if (ready) store.getState().submit(values);
  }, [ready, values, store]);

  // "Restore defaults" on an assumption screen: its fields go back to the
  // default profile's values and stop counting as answered.
  const restoreDefaults = (screen: ScreenSpec) => {
    const paths = screenPaths(definition.form, screen, get);
    const defaults = makeGet(getDefaultFinancialProfile());
    useProfileStore.getState().setValues(
      paths.map((path) => ({ path, value: defaults(path) })),
      { unprovide: paths }
    );
  };

  const hasErrors = Object.keys(errors).length > 0;
  // A failed run, or an engine error with no field to show it on.
  const runError = errors[RUN_ERROR_PATH];
  let resultSection: React.ReactNode;
  if (ready && results !== null && inputs !== null) {
    resultSection = (
      <>
        {stale && (
          <StatusAlert tone="caution" icon={History} title="Results out of date" role="status">
            {runError ?? 'These results come from earlier inputs and do not reflect your latest changes yet.'}
          </StatusAlert>
        )}
        <div aria-busy={stale} className={cn('space-y-6 transition-opacity', stale && 'opacity-60')}>
          {renderResults({ results, inputs, values, stale })}
        </div>
      </>
    );
  } else if (ready && runError !== undefined) {
    resultSection = (
      <StatusAlert tone="negative" icon={AlertTriangle} title="Results unavailable" role="alert">
        {runError}
      </StatusAlert>
    );
  } else if (!ready || !hasErrors) {
    resultSection = <ResultsSkeleton />;
  }

  return (
    <>
      <CalculatorLayout
        title={meta.title}
        description={meta.description}
        liveResults
        resultsLabel={meta.liveResultsLabel}
        showResultsKey={arrivedFromProfile ? 'profile' : undefined}
        inputSections={
          <FieldSections
            form={definition.form}
            get={get}
            errors={errors}
            onWrite={write}
            renderers={renderers}
            provided={provided}
            onRestoreDefaults={restoreDefaults}
          />
        }
        resultSection={resultSection}
        resultFooter={<NextSteps intent={definition.id} />}
        isCalculating={isCalculating}
        errors={errors}
        disclaimer={calculatorDisclaimer(definition.id)}
      />
      {afterLayout}
    </>
  );
}
