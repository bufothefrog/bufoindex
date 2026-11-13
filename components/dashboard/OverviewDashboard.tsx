'use client';

import React, { useMemo } from 'react';
import type { Route } from 'next';
import { Disclaimer } from '@/components/ui/results';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { calculatorHref } from '@/lib/calculators/registry';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { composeDisclaimer, DISCLAIMER } from '@/lib/constants/disclaimers';
import { TARGET_MIX_LABELS } from '@/lib/constants/labels';
import { withDerivedValues } from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { useProfileStore } from '@/lib/store/profileStore';
import type { AllocationResult } from '@/lib/types';
import { AccountsCard } from './AccountsCard';
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

/**
 * /overview: one screen computed from the shared profile. Rendering waits for
 * the persisted profile to hydrate so server and client markup match.
 */
export function OverviewDashboard({ className }: OverviewDashboardProps) {
  const hasHydrated = useProfileStore((s) => s.hasHydrated);
  const hasProfile = useProfileStore((s) => s.hasProfile);
  const stored = useProfileStore((s) => s.profile);
  // Every card reads the profile with its unanswered derived leaves filled
  // (lib/profile/derived.ts), as the calculators do.
  const profile = useMemo(() => withDerivedValues(stored), [stored]);
  const reset = useProfileStore((s) => s.reset);

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

  // The retirement and leverage cards show balances that lie in the future;
  // each follows the one site-wide dollar mode. The toggle shows while at
  // least one of them has inputs its calculator accepts.
  const showsFutureDollars = useMemo(
    () =>
      Object.keys(RETIREMENT_CALCULATOR.validate(engineInputsFor(RETIREMENT_CALCULATOR, profile))).length === 0 ||
      Object.keys(LEVERAGE_CALCULATOR.validate(engineInputsFor(LEVERAGE_CALCULATOR, profile))).length === 0,
    [profile]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {showsFutureDollars && <OverviewDollarMode />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <PaycheckCard inputs={paycheckInputs} allocation={allocation} />
        <RetirementOddsCard profile={profile} />
        <CashBufferCard profile={profile} />
        <AccountsCard profile={profile} />
        <LeverageCard profile={profile} />
        <AutomationChecklistCard profile={profile} allocation={allocation} />
        <ProfileCompletenessCard profile={profile} />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Also seeded from this profile: the portfolio rebalancer, with the{' '}
          {TARGET_MIX_LABELS[profile.investing.targetMix].toLowerCase()} target mix and your accounts.
        </p>
        <CardLinkButton href={calculatorHref('portfolio', { fromProfile: true }) as Route}>Open the rebalancer</CardLinkButton>
      </div>
    </div>
  );
}

const DOLLAR_MODE_NOTE = {
  today: "Future balances on the retirement and leverage cards are shown in today's dollars.",
  nominal: 'Future balances on the retirement and leverage cards are shown in future dollars.',
} as const;

/** The one dollar display toggle on /overview; the same stored preference as every calculator page. */
function OverviewDollarMode() {
  const mode = usePreferencesStore((s) => s.displayMode);
  const setMode = usePreferencesStore((s) => s.setDisplayMode);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="overview-dollar-mode">
      <p className="text-sm text-muted-foreground">{DOLLAR_MODE_NOTE[mode]}</p>
      <DollarModeToggle value={mode} onChange={setMode} />
    </div>
  );
}

export default OverviewDashboard;
