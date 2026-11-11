import React from 'react';
import { UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { ProgressBar } from '@/components/ui/progress-bar';
import { profileCompleteness } from '@/lib/calculators/forms';
import { isProfileFinished } from '@/lib/constants/intake';
import { formatPercent } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';
import { CardLinkButton } from './CardLinkButton';

export interface ProfileCompletenessCardProps {
  profile: FinancialProfile;
}

const MAX_MISSING = 6;

/** How many profile topics are answered (O14: counted by topic screen), and which are not. */
export function ProfileCompletenessCard({ profile }: ProfileCompletenessCardProps) {
  const { provided, total, missing } = profileCompleteness(profile);
  const share = total > 0 ? provided / total : 0;
  const shownMissing = missing.slice(0, MAX_MISSING);

  return (
    <BaseCard title="Profile completeness" icon={UserRound} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-completeness">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground">
              <span className="font-semibold tabular-nums">
                {provided} of {total}
              </span>{' '}
              topics answered
            </span>
            <span className="tabular-nums text-muted-foreground">{formatPercent(share, { digits: 0 })}</span>
          </div>
          <ProgressBar label="Profile topics answered" value={provided} max={total} />
        </div>

        {missing.length > 0 ? (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Still using illustrative defaults, which every card on this page reflects:
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {shownMissing.map((screen) => (
                <li key={screen.id} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">
                    -
                  </span>
                  <span>{screen.title}</span>
                </li>
              ))}
            </ul>
            {missing.length > shownMissing.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                and {missing.length - shownMissing.length} more.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Every topic has an answer from you.</p>
        )}
      </div>

      {/* /start/profile asks only the questions not answered yet and opens this
          page when none are left, so once they run out the action edits the
          basics instead of bouncing straight back here. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isProfileFinished(profile) ? (
          <CardLinkButton href="/start">Edit the basics</CardLinkButton>
        ) : (
          <CardLinkButton href="/start/profile">Fill in the rest</CardLinkButton>
        )}
        <CardLinkButton href="/start/review">Review all answers</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default ProfileCompletenessCard;
