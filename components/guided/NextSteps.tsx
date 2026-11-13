'use client';

import React from 'react';
import type { Route } from 'next';
import { ClipboardList, LayoutDashboard, Signpost, UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { CalculatorLinks } from '@/components/shared/CalculatorLinks';
import { profileCompleteness, topicsAnsweredText } from '@/lib/calculators/forms';
import {
  coreStartLink,
  isProfileFinished,
  type IntakeIntent,
} from '@/lib/constants/intake';
import { useProfileStore } from '@/lib/store/profileStore';
import { OptionCard } from './OptionCard';

export interface NextStepsProps {
  /** The calculator this card sits on; used for the no-profile intake link. */
  intent: Exclude<IntakeIntent, 'profile'>;
  /**
   * 'stack' (the default): one column at every width. 'columns': from lg the
   * card's body sits in two columns (the profile line and its link, then the
   * calculator links), for a card as wide as the page, so no line runs long.
   */
  layout?: NextStepsLayout;
  className?: string;
}

export type NextStepsLayout = 'stack' | 'columns';

/** The card body: one column, or two from lg with 'columns'. */
const BODY_CLASSES: Record<NextStepsLayout, string> = {
  stack: 'space-y-3',
  columns: 'space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0',
};

/**
 * "What next?" card rendered at the end of a calculator's results.
 *
 * With a saved profile it offers to finish the profile (or open the overview
 * once nothing is left to finish, see isProfileFinished) and links straight
 * to the other three calculators, which read the same saved profile without
 * asking. Without one it offers the shared core
 * questions, returning to this calculator afterwards. Renders nothing until
 * the persisted profile has hydrated, so server and client markup match.
 */
export function NextSteps({ intent, layout = 'stack', className }: NextStepsProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const hasProfile = useProfileStore((state) => state.hasProfile);
  const profile = useProfileStore((state) => state.profile);

  if (!hasHydrated) return null;

  const cardProps = {
    title: 'What next?',
    icon: Signpost,
    className,
    ...DENSE_CARD_CLASSES,
    testId: 'next-steps',
  } as const;

  if (!hasProfile) {
    return (
      <BaseCard {...cardProps}>
        <div className={BODY_CLASSES[layout]}>
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

  // Offer the overview once nothing is left to finish: no profile questions
  // left (skipped basics are edited through /start, and a few fields are not
  // asked by any intake, so /start/profile would only redirect to the
  // overview).
  const finished = isProfileFinished(profile);
  const finishDescription = `${topicsAnsweredText(profileCompleteness(profile))}. Answer the rest once; every calculator and your overview use it.`;

  return (
    <BaseCard {...cardProps}>
      <div className={BODY_CLASSES[layout]}>
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
          </ul>
        </div>
        <CalculatorLinks label="Try another calculator" exclude={[intent]} />
      </div>
    </BaseCard>
  );
}

export default NextSteps;
