'use client';

import React, { useCallback, useMemo } from 'react';
import type { Route } from 'next';
import { Disclaimer } from '@/components/ui/results';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { calculatorHref } from '@/lib/calculators/registry';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { composeDisclaimer, DISCLAIMER } from '@/lib/constants/disclaimers';
import { STRATEGY_PRESET_LABELS, STRATEGY_PRESET_OPTIONS, TARGET_MIX_LABELS } from '@/lib/constants/labels';
import { strategyDescription } from '@/lib/dashboard/derive';
import { PRESET_EMERGENCY_MONTHS } from '@/lib/profile/defaults';
import type { FinancialProfile, ProfilePatch, StrategyPreset } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import type { AllocationResult } from '@/lib/types';
import { AutomationChecklistCard } from './AutomationChecklistCard';
import { CardLinkButton } from './CardLinkButton';
import { CashBufferCard } from './CashBufferCard';
import { EmptyOverview } from './EmptyOverview';
import { LeverageCard } from './LeverageCard';
import { OverviewSkeleton } from './OverviewSkeleton';
import { PaycheckCard } from './PaycheckCard';
import { ProfileCompletenessCard } from './ProfileCompletenessCard';
import { ResetProfileButton } from './ResetProfileButton';
import { RetirementOddsCard } from './RetirementOddsCard';

export interface OverviewDashboardProps {
  className?: string;
}

const OVERVIEW_DISCLAIMER = composeDisclaimer(DISCLAIMER.overview, DISCLAIMER.overviewModel, DISCLAIMER.consultAdvisor);

/** The strategy control shows each preset's label only; the description is in the summary below it. */
const STRATEGY_OPTIONS = STRATEGY_PRESET_OPTIONS.map(({ value, label }) => ({ value, label }));

/**
 * /overview: one screen computed from the shared profile. Rendering waits for
 * the persisted profile to hydrate so server and client markup match.
 */
export function OverviewDashboard({ className }: OverviewDashboardProps) {
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const hasProfile = useProfileStore((s) => s.hasProfile);
  const profile = useProfileStore((s) => s.profile);
  const setFields = useProfileStore((s) => s.setFields);
  const reset = useProfileStore((s) => s.reset);

  const handleStrategyChange = useCallback(
    (preset: StrategyPreset) => {
      const patch: ProfilePatch = { strategy: { preset } };
      // A preset only sets the cash target while the user has not chosen one.
      if (!profile.provided.includes('cash.targetMonths')) {
        patch.cash = { targetMonths: PRESET_EMERGENCY_MONTHS[preset] };
      }
      setFields(patch, ['strategy.preset']);
    },
    [profile.provided, setFields]
  );

  const ready = hasHydrated && hasProfile;

  return (
    <div className={className ?? 'mx-auto max-w-6xl py-4 sm:py-6'}>
      <header className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:gap-6 md:space-y-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Your overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Each card runs one of the calculators on your profile and links to the full tool with the same inputs.
          </p>
        </div>
        {ready && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SegmentedControl
              label="Strategy"
              options={STRATEGY_OPTIONS}
              value={profile.strategy.preset}
              onChange={handleStrategyChange}
              size="md"
              fullWidth
              className="w-full sm:w-auto"
            />
            <ResetProfileButton onReset={reset} />
          </div>
        )}
      </header>

      {!hasHydrated ? (
        <OverviewSkeleton />
      ) : !hasProfile ? (
        <EmptyOverview />
      ) : (
        <ProfileOverview profile={profile} />
      )}

      <Disclaimer text={OVERVIEW_DISCLAIMER} />
    </div>
  );
}

interface ProfileOverviewProps {
  profile: FinancialProfile;
}

function ProfileOverview({ profile }: ProfileOverviewProps) {
  const paycheckInputs = useMemo(() => engineInputsFor(PAYCHECK_CALCULATOR, profile), [profile]);
  const allocation = useMemo<AllocationResult | null>(() => {
    try {
      return PAYCHECK_CALCULATOR.calculate(paycheckInputs);
    } catch {
      return null;
    }
  }, [paycheckInputs]);

  return (
    <div className="space-y-4 md:space-y-6">
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{STRATEGY_PRESET_LABELS[profile.strategy.preset]}:</span>{' '}
        {strategyDescription(profile.strategy.preset, profile.strategy.leverageRatio)} Switch the preset above to see
        the alternative; the cash buffer card shows both targets either way.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <PaycheckCard inputs={paycheckInputs} allocation={allocation} />
        <RetirementOddsCard profile={profile} />
        <CashBufferCard profile={profile} />
        <LeverageCard profile={profile} />
        <AutomationChecklistCard profile={profile} allocation={allocation} />
        <ProfileCompletenessCard profile={profile} />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Also seeded from this profile: the portfolio rebalancer, with the{' '}
          {TARGET_MIX_LABELS[profile.investing.targetMix].toLowerCase()} target mix and this month&apos;s new cash.
        </p>
        <CardLinkButton href={calculatorHref('portfolio', { fromProfile: true }) as Route}>Open the rebalancer</CardLinkButton>
      </div>
    </div>
  );
}

export default OverviewDashboard;
