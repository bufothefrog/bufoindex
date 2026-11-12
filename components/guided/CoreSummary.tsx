import React from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { coreSummary } from '@/lib/constants/intake';
import type { FinancialProfile } from '@/lib/profile/types';
import { cn } from '@/lib/utils';

export interface CoreSummaryProps {
  profile: FinancialProfile;
  className?: string;
}

/**
 * One-line recap of the saved core answers ("30, TX, single, $3,500 gross
 * every 2 weeks, $2,600 take-home, $3,000 a month in must-pay costs", the
 * same pieces the collapsed core cards show) with an "Edit the basics" link
 * to the core intake (/start). Pure and server-renderable; client parents pass the
 * hydrated profile.
 */
export function CoreSummary({ profile, className }: CoreSummaryProps) {
  const summary = coreSummary(profile);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 rounded-lg border border-border bg-muted/40 px-4 py-1',
        className
      )}
    >
      <p className="min-w-0 py-2 text-sm text-muted-foreground wrap-anywhere">
        <span className="font-medium text-foreground">Your basics: </span>
        {summary || 'none saved yet, so the calculators use typical values.'}
      </p>
      <Link
        href="/start"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 dark:text-sage-300 dark:hover:text-sage-200"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit the basics
      </Link>
    </div>
  );
}

export default CoreSummary;
