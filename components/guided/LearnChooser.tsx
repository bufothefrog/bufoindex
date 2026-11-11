'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { LayoutDashboard } from 'lucide-react';
import {
  CORE_START_PATH,
  LEARN_OPTIONS,
  isProfileFinished,
  remainingIntakeScreens,
  type IntentOption,
} from '@/lib/constants/intake';
import { profileCompleteness } from '@/lib/profile/mappers';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { cn } from '@/lib/utils';
import { CoreSummary } from './CoreSummary';
import { OptionCard } from './OptionCard';
import { isCoreReady } from './Wizard';

export interface LearnChooserProps {
  className?: string;
}

interface ChooserEntry {
  id: string;
  href: Route;
  title: string;
  description: string;
  icon: IntentOption['icon'];
  tone: 'default' | 'emphasis';
}

/** Counts screens: each poses one question, a few with two related fields. */
function remainingHint(count: number): string {
  if (count === 0) return 'Nothing more to ask; opens with your answers.';
  return count === 1 ? '1 more question.' : `${count} more questions.`;
}

/**
 * What the overview card says once nothing is left to finish. The intake
 * does not ask a few profile fields (and skipped basics are edited through
 * "Edit the basics"), so running out of questions can still leave some
 * fields on typical values; the overview lists them.
 */
function overviewDescription(missingCount: number): string {
  if (missingCount === 0) return 'Every detail is saved. The overview runs each calculator from your profile.';
  const onDefaults = missingCount === 1 ? '1 detail that still uses' : `${missingCount} details that still use`;
  return `No questions left to ask. The overview runs each calculator from your profile and lists the ${onDefaults} a typical value.`;
}

function buildEntries(profile: FinancialProfile): ChooserEntry[] {
  return LEARN_OPTIONS.map((option): ChooserEntry => {
    if (option.id === 'profile' && isProfileFinished(profile)) {
      return {
        id: 'overview',
        href: '/overview',
        title: 'See your overview',
        description: overviewDescription(profileCompleteness(profile).missing.length),
        icon: LayoutDashboard,
        tone: 'emphasis',
      };
    }

    const remaining = remainingIntakeScreens(option.id, profile).length;
    return {
      id: option.id,
      href: `/start/${option.id}` as Route,
      title: option.title,
      description: `${option.description} ${remainingHint(remaining)}`,
      icon: option.icon,
      tone: option.id === 'profile' ? 'emphasis' : 'default',
    };
  });
}

function ChooserSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading your answers">
      <div className="h-12 w-full rounded-lg bg-muted" />
      {Array.from({ length: LEARN_OPTIONS.length }, (_, index) => (
        <div key={index} className="h-20 w-full rounded-xl bg-muted" />
      ))}
    </div>
  );
}

/**
 * "What do you want to learn?" chooser shown after the shared core intake.
 * Option one finishes the profile (or opens the overview once nothing is
 * left to finish, see isProfileFinished); the rest open a calculator's
 * remaining questions. Renders a
 * skeleton until the profile store hydrates, and sends a visitor who has not
 * been through the basics back to /start.
 */
export function LearnChooser({ className }: LearnChooserProps) {
  const router = useRouter();
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  const ready = hasHydrated && isCoreReady(profile);

  useEffect(() => {
    if (hasHydrated && !isCoreReady(profile)) router.replace(CORE_START_PATH as Route);
  }, [hasHydrated, profile, router]);

  return (
    <div className={cn('space-y-6', className)}>
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">
          Guided start
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">What do you want to learn?</h1>
        <p className="text-sm text-muted-foreground">
          Each choice asks only what it still needs, then shows your results.
        </p>
      </header>

      {ready ? (
        <>
          <CoreSummary profile={profile} />
          <ul className="grid gap-3 md:grid-cols-2">
            {buildEntries(profile).map((entry, index) => (
              <li key={entry.id} className={cn('flex', index === 0 && 'md:col-span-2')}>
                <OptionCard
                  href={entry.href}
                  title={entry.title}
                  description={entry.description}
                  icon={entry.icon}
                  tone={entry.tone}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Your answers are saved only in this browser. To change a saved answer,{' '}
            <Link
              href="/start/review"
              className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground"
            >
              review all answers
            </Link>
            .
          </p>
        </>
      ) : (
        <ChooserSkeleton />
      )}
    </div>
  );
}

export default LearnChooser;
