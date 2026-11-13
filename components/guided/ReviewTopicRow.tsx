import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { TopicStatus } from '@/lib/calculators/profileReview';
import { cn } from '@/lib/utils';

export interface ReviewTopicRowProps {
  /** The row's element id: the review page focuses it when Save or Cancel returns here. */
  anchorId: string;
  title: string;
  /** The answered-only summary (or "Not answered"). */
  summary: string;
  status: TopicStatus;
  /** The topic's single-screen edit page. */
  href: string;
  className?: string;
}

/** The link's visible text: "Answer" for a topic with no answer yet, otherwise "Edit". */
export function reviewLinkLabel(status: TopicStatus): string {
  return status === 'unanswered' ? 'Answer' : 'Edit';
}

/**
 * One topic on the review page: its title, the one-line summary of the
 * saved answers and a link to edit that topic alone. The link is the only
 * interactive element; its accessible name carries the topic ("Edit: Your
 * paycheck"). One column on phones, the link beside the text from sm up.
 */
export function ReviewTopicRow({ anchorId, title, summary, status, href, className }: ReviewTopicRowProps) {
  const label = reviewLinkLabel(status);
  const unanswered = status === 'unanswered';

  return (
    <div
      id={anchorId}
      tabIndex={-1}
      className={cn(
        'flex flex-col gap-1 rounded-md px-1 py-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className={cn('text-sm text-muted-foreground wrap-anywhere', unanswered && 'italic')}>
          {summary}
        </p>
      </div>
      <Link
        href={href as Route}
        aria-label={`${label}: ${title}`}
        className="inline-flex min-h-11 shrink-0 items-center self-start text-sm font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 sm:self-center dark:text-sage-300 dark:hover:text-sage-200"
      >
        {label}
      </Link>
    </div>
  );
}

export default ReviewTopicRow;
