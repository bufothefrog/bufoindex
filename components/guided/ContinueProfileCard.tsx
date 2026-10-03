'use client';

import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { profileCompleteness } from '@/lib/profile/mappers';
import { useProfileStore } from '@/lib/store/profileStore';
import { OptionCard } from './OptionCard';

export interface ContinueProfileCardProps {
  className?: string;
}

/**
 * "Continue with my profile" shortcut for returning visitors. Renders nothing
 * until the persisted profile has hydrated (so server and client markup
 * match) and nothing when no answers are saved.
 */
export function ContinueProfileCard({ className }: ContinueProfileCardProps) {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const hasProfile = useProfileStore((state) => state.hasProfile);
  const profile = useProfileStore((state) => state.profile);

  if (!hasHydrated || !hasProfile) return null;

  const { provided, total } = profileCompleteness(profile);
  return (
    <OptionCard
      href="/overview"
      tone="emphasis"
      icon={LayoutDashboard}
      title="Continue with my profile"
      description={`${provided} of ${total} details saved in this browser.`}
      className={className}
    />
  );
}

export default ContinueProfileCard;
