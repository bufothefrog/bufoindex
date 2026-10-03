import React from 'react';
import Link from 'next/link';
import { ArrowRight, UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';

const INTAKES = [
  { href: '/start/paycheck', label: 'Start with a paycheck', description: 'Where the next paycheck goes' },
  { href: '/start/retirement', label: 'Start with retirement', description: 'Simulated odds for a retirement age' },
  { href: '/start/portfolio', label: 'Start with a portfolio', description: 'What to buy to reach a target mix' },
] as const;

/** Shown when no profile has been saved in this browser yet. */
export function EmptyOverview() {
  return (
    <div className="mx-auto max-w-xl">
      <BaseCard title="No profile yet" icon={UserRound} {...DASHBOARD_CARD_LAYOUT} testId="overview-empty">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The overview is computed from a profile saved in this browser. Answer a few questions and every card here
            fills in from the same calculators the tools use; unanswered fields use illustrative defaults.
          </p>
          <Link
            href="/start/profile"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full px-4')}
          >
            Build a profile
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Or start from one question</p>
            <ul className="space-y-2">
              {INTAKES.map((intake) => (
                <li key={intake.href}>
                  <Link
                    href={intake.href}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-sage-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-sage-500"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{intake.label}</span>
                      <span className="block text-xs text-muted-foreground">{intake.description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BaseCard>
    </div>
  );
}

export default EmptyOverview;
