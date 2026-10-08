'use client';

import React from 'react';
import type { Route } from 'next';
import { UserRound } from 'lucide-react';
import { LEARN_CHOOSER_PATH, coreSummary } from '@/lib/constants/intake';
import { profileCompleteness } from '@/lib/profile/mappers';
import { useProfileStore } from '@/lib/store/profileStore';
import { OptionCard } from './OptionCard';

export interface ContinueProfileCardProps {
  className?: string;
}

/**
 * "Continue with my profile" shortcut for returning visitors: leads to the
 * "What do you want to learn?" chooser, with a one-line summary of the
 * basics answered so far. The chooser owns the "are the basics done?" check
 * and sends the visitor back to the core intake when they are not.
 *
 * Renders nothing until the persisted profile has hydrated (so server and
 * client markup match) and nothing when no answers are saved.
 */
export function ContinueProfileCard({ className }: ContinueProfileCardProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const hasProfile = useProfileStore((state) => state.hasProfile);
  const profile = useProfileStore((state) => state.profile);

  if (!hasHydrated || !hasProfile) return null;

  const { provided, total } = profileCompleteness(profile);
  const saved = `${provided} of ${total} details saved in this browser.`;
  const summary = coreSummary(profile);

  return (
    <OptionCard
      href={LEARN_CHOOSER_PATH as Route}
      tone="emphasis"
      icon={UserRound}
      title="Continue with my profile"
      description={summary ? `${summary}. ${saved}` : saved}
      className={className}
    />
  );
}

export default ContinueProfileCard;
