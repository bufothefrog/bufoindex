'use client';

import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalculatorLayout, type ShareResult } from '@/components/ui/layouts/CalculatorLayout';
import { NextSteps } from '@/components/guided/NextSteps';
import {
  simulateDcaComparison,
  type DcaComparisonInputs,
} from '@/lib/calculations/leverageComparison';
import { LeverageInputs } from './LeverageInputs';
import { LeverageResults } from './LeverageResults';
import { comparisonHref, inputsFromQuery } from './queryParams';

export interface LeverageComparisonProps {
  /** Optional override for the initial inputs (otherwise read from the query string). */
  initialInputs?: DcaComparisonInputs;
}

export function LeverageComparison({ initialInputs }: LeverageComparisonProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [inputs, setInputs] = useState<DcaComparisonInputs>(
    () => initialInputs ?? inputsFromQuery(searchParams),
  );
  // Arriving from a profile link or a shared URL (?c=&y=...) means the inputs
  // are already filled in, so phones open on Results, like the hash-seeded
  // calculators do after their automatic first run. This subtree only renders
  // on the client (useSearchParams inside Suspense), so it cannot mismatch.
  const [arrivedWithInputs] = useState(() => !initialInputs && searchParams.has('c'));

  // The simulation is cheap (tens of ms), so results track the inputs; the
  // deferred copy keeps typing responsive on slower phones.
  const deferredInputs = useDeferredValue(inputs);
  const result = useMemo(() => simulateDcaComparison(deferredInputs), [deferredInputs]);
  const isStale = deferredInputs !== inputs;

  const handleChange = useCallback((patch: Partial<DcaComparisonInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (inputs.monthlyContribution <= 0 && inputs.startingBalance <= 0) {
      out.monthlyContribution = 'Enter a monthly contribution or a starting balance.';
    }
    return out;
  }, [inputs.monthlyContribution, inputs.startingBalance]);

  // "Compare" commits the current inputs to the URL (so reloads and the back
  // button keep them). Below lg, CalculatorLayout's action bar switches to the
  // Results tab and scrolls it into view after this synchronous handler runs.
  const handleCompare = () => {
    router.replace(comparisonHref(inputs) as Route, { scroll: false });
  };

  const handleShare = async (): Promise<ShareResult | void> => {
    const url = `${window.location.origin}${comparisonHref(inputs)}`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'BufoIndex Leverage Comparison',
          text: 'Index fund vs leveraged fund with monthly contributions',
          url,
        });
        return { status: 'shared' };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Otherwise fall through to the clipboard fallback
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      return { status: 'copied' };
    } catch {
      return { status: 'error', url };
    }
  };

  return (
    <CalculatorLayout
      title="Leverage Comparison"
      description="Monthly contributions into a plain index fund versus the same contributions into a daily-reset leveraged fund, across simulated markets, alongside the usual lump-sum framing on the same dollars."
      defaultMobileTab={arrivedWithInputs ? 'results' : 'inputs'}
      inputSections={<LeverageInputs inputs={inputs} onChange={handleChange} />}
      resultSection={<LeverageResults result={result} inputs={deferredInputs} isStale={isStale} />}
      resultFooter={<NextSteps intent="leverage" />}
      onCalculate={handleCompare}
      onShare={handleShare}
      calculateButtonText="Compare"
      errors={errors}
      disclaimer="Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Leveraged ETFs can lose most of their value in a severe decline. Not tax or investment advice."
    />
  );
}

export default LeverageComparison;
