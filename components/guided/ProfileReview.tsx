'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { profileCompleteness, topicsAnsweredText } from '@/lib/calculators/forms';
import { profileReview, reviewTopicAnchor, reviewTopicEditHref } from '@/lib/calculators/profileReview';
import { useProfileStore } from '@/lib/store/profileStore';
import { ReviewTopicRow } from './ReviewTopicRow';

const LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 dark:text-sage-300 dark:hover:text-sage-200';

function ReviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your answers">
      <div className="h-5 w-32 rounded bg-muted" />
      <div className="h-12 w-full rounded-md bg-muted" />
      <div className="h-12 w-full rounded-md bg-muted" />
      <div className="h-12 w-full rounded-md bg-muted" />
    </div>
  );
}

/**
 * The read-only review of the saved profile (/start/review): one group per
 * profile section, one row per topic with the answered-only summary
 * (lib/calculators/profileReview.ts) and a link to edit that topic alone.
 * When the URL names a topic's row (#topic-<id>, where Save and Cancel on
 * the edit page return), that row is focused, which scrolls it into view.
 * Renders after the profile store hydrates.
 */
export function ProfileReview() {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);

  useEffect(() => {
    if (!hasHydrated) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.focus();
  }, [hasHydrated]);

  const review = hasHydrated ? profileReview(profile) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">Your profile</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Review your answers</h1>
        {hasHydrated && (
          <p className="text-sm text-muted-foreground">{topicsAnsweredText(profileCompleteness(profile))}</p>
        )}
      </header>

      {review ? (
        <>
          {review.groups.map((group) => {
            const headingId = `review-section-${group.section}`;
            return (
              <section key={group.section} aria-labelledby={headingId} className="space-y-1">
                <h2 id={headingId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border px-3">
                  {group.topics.map((topic) => (
                    <li key={topic.id}>
                      <ReviewTopicRow
                        anchorId={reviewTopicAnchor(topic.id)}
                        title={topic.title}
                        summary={topic.summary}
                        status={topic.status}
                        href={reviewTopicEditHref(topic.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {review.hasUnansweredRequired && (
              <Link href="/start/profile" className={LINK_CLASS}>
                Answer the remaining questions
              </Link>
            )}
            <Link href="/overview" className={LINK_CLASS}>
              Go to your overview
            </Link>
          </div>
        </>
      ) : (
        <ReviewSkeleton />
      )}
    </div>
  );
}

export default ProfileReview;
