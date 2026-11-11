'use client';

import React from 'react';
import type { Route } from 'next';
import { ClipboardList, Compass, LayoutDashboard, Signpost, UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import {
  LEARN_CHOOSER_PATH,
  coreStartLink,
  isProfileFinished,
  type IntakeIntent,
} from '@/lib/constants/intake';
import { profileCompleteness } from '@/lib/profile/mappers';
import { useProfileStore } from '@/lib/store/profileStore';
import { OptionCard } from './OptionCard';

export interface NextStepsProps {
  /** The calculator this card sits on; used for the no-profile intake link. */
  intent: Exclude<IntakeIntent, 'profile'>;
  className?: string;
}

/**
 * "What next?" card rendered at the end of a calculator's results.
 *
 * With a saved profile it offers to finish the profile (or open the overview
 * once nothing is left to finish, see isProfileFinished) and to try another
 * calculator via the chooser. Without one it offers the shared core
 * questions, returning to this calculator afterwards. Renders nothing until
 * the persisted profile has hydrated, so server and client markup match.
 */
export function NextSteps({ intent, className }: NextStepsProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const hasProfile = useProfileStore((state) => state.hasProfile);
  const profile = useProfileStore((state) => state.profile);

  if (!hasHydrated) return null;

  const cardProps = {
    title: 'What next?',
    icon: Signpost,
    className,
    headerClassName: 'p-4 pb-3 sm:p-6 sm:pb-4',
    contentClassName: 'p-4 pt-0 sm:p-6 sm:pt-0',
    testId: 'next-steps',
  } as const;

  if (!hasProfile) {
    return (
      <BaseCard {...cardProps}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Answer once and the answers carry across every calculator.
          </p>
          <OptionCard
            href={coreStartLink(intent) as Route}
            tone="emphasis"
            icon={ClipboardList}
            title="Answer a few quick questions"
            description="A few questions on age, state, filing status, pay, and must-pay costs. Saved only in this browser."
          />
        </div>
      </BaseCard>
    );
  }

  // Offer the overview once nothing is left to finish: every field answered,
  // or no profile questions left (a few fields are not asked by any intake,
  // so /start/profile would only redirect to the overview).
  const finished = isProfileFinished(profile);
  const { provided, total } = profileCompleteness(profile);
  const finishDescription = `${provided} of ${total} details answered. Answer the rest once; every calculator and your overview use it.`;

  return (
    <BaseCard {...cardProps}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Your answers are saved in this browser.</p>
        <ul className="space-y-2">
          <li className="flex">
            {finished ? (
              <OptionCard
                href="/overview"
                tone="emphasis"
                icon={LayoutDashboard}
                title="See your overview"
                description="Every calculator's result from the same answers, on one page."
              />
            ) : (
              <OptionCard
                href={'/start/profile' as Route}
                tone="emphasis"
                icon={UserRound}
                title="Finish your profile"
                description={finishDescription}
              />
            )}
          </li>
          <li className="flex">
            <OptionCard
              href={LEARN_CHOOSER_PATH as Route}
              icon={Compass}
              title="Try another calculator"
              description="Pick the next question to answer with the same profile."
            />
          </li>
        </ul>
      </div>
    </BaseCard>
  );
}

export default NextSteps;
