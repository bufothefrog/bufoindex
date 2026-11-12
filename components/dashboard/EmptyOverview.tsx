import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, UserRound } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { buttonVariants } from '@/components/ui/button';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { CalculatorLinks } from '@/components/shared/CalculatorLinks';
import { CORE_START_PATH } from '@/lib/constants/intake';
import { cn } from '@/lib/utils';

/**
 * Shown when no profile has been saved in this browser yet: the shared basics
 * as the primary action, and each calculator linked directly below it (a
 * calculator page reads the saved profile, or the defaults, without asking).
 */
export function EmptyOverview() {
  return (
    <div className="mx-auto max-w-xl">
      <BaseCard title="No profile yet" icon={UserRound} {...DENSE_CARD_CLASSES} testId="overview-empty">
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
          <CalculatorLinks label="Or open a calculator directly" />
        </div>
      </BaseCard>
    </div>
  );
}

export default EmptyOverview;
