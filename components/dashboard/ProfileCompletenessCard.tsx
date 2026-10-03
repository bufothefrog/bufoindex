import React from 'react';
import { UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { remainingIntakeScreens } from '@/lib/constants/intake';
import { profileCompleteness } from '@/lib/profile/mappers';
import type { FinancialProfile } from '@/lib/profile/types';
import { CardLinkButton } from './CardLinkButton';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { formatMonths, STRATEGY_LABELS } from './derive';

export interface ProfileCompletenessCardProps {
  profile: FinancialProfile;
}

const MAX_MISSING = 6;

export function ProfileCompletenessCard({ profile }: ProfileCompletenessCardProps) {
  const { provided, total, missing } = profileCompleteness(profile);
  const share = total > 0 ? provided / total : 0;
  const shownMissing = missing.slice(0, MAX_MISSING);
  // /start/profile asks only the questions not answered yet and opens this
  // page when none are left, so once they run out the action edits the
  // basics instead of bouncing straight back here.
  const questionsLeft = remainingIntakeScreens('profile', profile).length > 0;

  return (
    <BaseCard title="Profile completeness" icon={UserRound} {...DASHBOARD_CARD_LAYOUT} testId="overview-completeness">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground">
              <span className="font-semibold tabular-nums">
                {provided} of {total}
              </span>{' '}
              fields answered
            </span>
            <span className="tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-muted"
            role="progressbar"
            aria-label="Profile fields answered"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={provided}
          >
            <div
              className="h-2 rounded-full bg-sage-500 transition-all duration-300 dark:bg-sage-400"
              style={{ width: `${Math.round(share * 100)}%` }}
            />
          </div>
        </div>

        {missing.length > 0 ? (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Still using illustrative defaults, which every card on this page reflects:
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {shownMissing.map((field) => (
                <li key={field.path} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted-foreground">
                    -
                  </span>
                  <span>
                    {field.label}
                    {field.path === 'cash.targetMonths' && (
                      <span className="text-muted-foreground">
                        {' '}
                        (follows the {STRATEGY_LABELS[profile.strategy.preset]} preset:{' '}
                        {formatMonths(profile.cash.targetMonths)})
                      </span>
                    )}
                  </span>
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
          <p className="text-sm text-muted-foreground">Every field has an answer from you.</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {questionsLeft ? (
          <CardLinkButton href="/start/profile">Fill in the rest</CardLinkButton>
        ) : (
          <CardLinkButton href="/start">Edit the basics</CardLinkButton>
        )}
        <CardLinkButton href="/start/review">Review all answers</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default ProfileCompletenessCard;
