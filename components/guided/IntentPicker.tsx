import React from 'react';
import type { Route } from 'next';
import { INTENT_OPTIONS } from '@/lib/constants/intake';
import { cn } from '@/lib/utils';
import { OptionCard } from './OptionCard';

export interface IntentPickerProps {
  /** Rendered between the question and the options, e.g. a "Continue with my profile" card. */
  leading?: React.ReactNode;
  className?: string;
}

/**
 * The landing-page question: one full-width card per intent, each linking to
 * its intake wizard at /start/<intent>. Server-renderable.
 */
export function IntentPicker({ leading, className }: IntentPickerProps) {
  const lastIndex = INTENT_OPTIONS.length - 1;
  const oddCount = INTENT_OPTIONS.length % 2 === 1;

  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
        What do you want to do with your money today?
      </h2>
      {leading}
      <ul className="grid gap-3 md:grid-cols-2">
        {INTENT_OPTIONS.map((option, index) => (
          <li
            key={option.id}
            className={cn('flex', oddCount && index === lastIndex && 'md:col-span-2')}
          >
            <OptionCard
              href={`/start/${option.id}` as Route}
              title={option.title}
              description={option.description}
              icon={option.icon}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default IntentPicker;
