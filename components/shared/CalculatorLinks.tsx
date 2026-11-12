import React, { useId } from 'react';
import type { Route } from 'next';
import { OptionCard } from '@/components/guided/OptionCard';
import { CALCULATOR_IDS, CALCULATORS, calculatorHref } from '@/lib/calculators/registry';
import type { CalculatorId } from '@/lib/calculators/types';
import { getIntentOption } from '@/lib/constants/intake';
import { cn } from '@/lib/utils';

export interface CalculatorLinksProps {
  /** The plain line above the list; it also names the list. */
  label: string;
  /** Calculators to leave out, e.g. the one the visitor is on. */
  exclude?: readonly CalculatorId[];
  className?: string;
}

/**
 * A labelled list of direct links to the calculators, in registry order. Each
 * link goes to the bare calculator path (calculatorHref, no `?from=profile`):
 * the calculator page reads the saved profile on its own and never asks. The
 * name comes from the registry, the icon and the one-line description from
 * the intent options, so the home page, the chooser and this list agree.
 *
 * Server-renderable (no state or effects).
 */
export function CalculatorLinks({ label, exclude = [], className }: CalculatorLinksProps) {
  const labelId = useId();
  const ids = CALCULATOR_IDS.filter((id) => !exclude.includes(id));

  return (
    <div className={cn('space-y-2', className)}>
      <p id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <ul aria-labelledby={labelId} className="space-y-2">
        {ids.map((id) => {
          const { icon, description } = getIntentOption(id);
          return (
            <li key={id} className="flex">
              <OptionCard
                href={calculatorHref(id) as Route}
                icon={icon}
                title={CALCULATORS[id].shortTitle}
                description={description}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CalculatorLinks;
