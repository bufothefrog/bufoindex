import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { buttonVariants } from '@/components/ui/button';
import { CORE_START_PATH, coreStartLink } from '@/lib/constants/intake';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';

// Every path starts with the shared basics; `next` picks the calculator the
// intake continues to once they are answered.
const INTAKES: ReadonlyArray<{ href: Route; label: string; description: string }> = [
  { href: coreStartLink('paycheck') as Route, label: 'Then a paycheck', description: 'Where the next paycheck goes' },
  { href: coreStartLink('retirement') as Route, label: 'Then retirement', description: 'Simulated odds for a retirement age' },
  { href: coreStartLink('portfolio') as Route, label: 'Then a portfolio', description: 'What to buy to reach a target mix' },
  { href: coreStartLink('leverage') as Route, label: 'Then the leverage comparison', description: 'A 2x fund next to a plain index fund' },
];

/** Shown when no profile has been saved in this browser yet. */
export function EmptyOverview() {
  return (
    <div className="mx-auto max-w-xl">
      <BaseCard title="No profile yet" icon={UserRound} {...DASHBOARD_CARD_LAYOUT} testId="overview-empty">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The overview is computed from a profile saved in this browser. The basics take a few questions;
            after that you pick what to learn, and every card here fills in from the same calculators the tools use.
            Unanswered fields use illustrative defaults.
          </p>
          <Link
            href={CORE_START_PATH as Route}
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'h-auto min-h-12 w-full px-4 py-3 text-base')}
          >
            Start with the basics
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Or answer the basics, then go straight to one calculator
            </p>
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
