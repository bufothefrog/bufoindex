'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';
import { TrendingUp } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { formatCurrency, formatPercent } from '@/lib/calculations/core';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import { retirementLink } from '@/lib/profile/links';
import { toRetirementInputs } from '@/lib/profile/mappers';
import type { FinancialProfile } from '@/lib/profile/types';
import { CardLinkButton } from './CardLinkButton';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { StatTile } from './StatTile';
import { summarizeRetirement, type RetirementOutcome } from './derive';

export interface RetirementOddsCardProps {
  profile: FinancialProfile;
}

interface ComputedOutcome {
  key: string;
  outcome: RetirementOutcome;
}

/**
 * The retirement analysis runs several 1,000-path Monte Carlo simulations,
 * so it is deferred until after the browser has painted the loading state
 * (requestAnimationFrame, then a macrotask). The inputs are keyed by their
 * serialized form so edits elsewhere in the profile (strategy preset, cash
 * target) do not re-run it.
 */
export function RetirementOddsCard({ profile }: RetirementOddsCardProps) {
  const inputsKey = useMemo(() => JSON.stringify(toRetirementInputs(profile)), [profile]);
  const [computed, setComputed] = useState<ComputedOutcome | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        const inputs = JSON.parse(inputsKey) as RetirementInputs;
        setComputed({ key: inputsKey, outcome: summarizeRetirement(inputs) });
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [inputsKey]);

  const isLoading = computed === null || computed.key !== inputsKey;
  const outcome = isLoading ? null : computed.outcome;

  return (
    <BaseCard title="Retirement odds" icon={TrendingUp} {...DASHBOARD_CARD_LAYOUT} testId="overview-retirement">
      <div aria-live="polite" aria-busy={isLoading}>
        {isLoading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Running 1,000 simulated market paths...</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-[74px] animate-pulse rounded-lg bg-muted" />
              <div className="h-[74px] animate-pulse rounded-lg bg-muted" />
              <div className="col-span-2 h-[74px] animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        )}

        {outcome?.status === 'invalid' && (
          <div className="space-y-2 text-sm">
            <p className="text-foreground">The retirement inputs from the profile need attention:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {outcome.messages.slice(0, 3).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {outcome?.status === 'ok' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                className="col-span-2"
                label="Simulated success rate"
                value={formatPercent(outcome.summary.successProbability)}
                hint={`Share of ${outcome.summary.runs.toLocaleString('en-US')} seeded paths with money left at age ${outcome.summary.lifeExpectancy}, retiring at ${outcome.summary.retirementAge}`}
              />
              <StatTile
                label="Projected at retirement"
                value={formatCurrency(outcome.summary.projectedBalanceToday)}
                hint="Today's dollars"
              />
              <StatTile
                label="Balance the 4% guideline implies"
                value={formatCurrency(outcome.summary.requiredBalanceToday)}
                hint="Today's dollars"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Saving{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(outcome.summary.lever.extraMonthly)}
              </span>{' '}
              more per month moves the simulated success rate from{' '}
              <span className="tabular-nums">{formatPercent(outcome.summary.successProbability)}</span> to{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatPercent(outcome.summary.lever.successProbability)}
              </span>{' '}
              and the projected balance to{' '}
              <span className="tabular-nums">{formatCurrency(outcome.summary.lever.projectedBalanceToday)}</span>{' '}
              (same simulated markets).
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <CardLinkButton href={retirementLink(profile) as Route}>Open the retirement calculator</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default RetirementOddsCard;
