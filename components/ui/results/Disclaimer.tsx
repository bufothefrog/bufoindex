import React from 'react';
import { cn } from '@/lib/utils';
import { DISCLAIMER, composeDisclaimer, type DisclaimerFragment } from '@/lib/constants/disclaimers';

/** The generic calculator disclaimer (today's DisclaimerFooter default, verbatim). */
export const DEFAULT_DISCLAIMER_TEXT = `This calculator provides educational information only and should not be considered personalized financial advice. ${DISCLAIMER.consultAdvisor}`;

export interface DisclaimerProps {
  /** Full text; wins over `fragments`. */
  text?: string;
  /** Composed with composeDisclaimer when no `text` is given. */
  fragments?: ReadonlyArray<DisclaimerFragment>;
  align?: 'center' | 'start';
  className?: string;
}

/** The page disclaimer. Text comes from lib/constants/disclaimers.ts so every page spells it the same way. */
export function Disclaimer({ text, fragments, align = 'center', className }: DisclaimerProps) {
  const body =
    text ?? (fragments && fragments.length > 0 ? composeDisclaimer(...fragments) : DEFAULT_DISCLAIMER_TEXT);
  return (
    <div role="note" aria-label="Disclaimer" className={cn('mt-8 lg:mt-12', align === 'center' && 'text-center', className)}>
      <p className={cn('max-w-4xl text-sm text-muted-foreground', align === 'center' && 'mx-auto')}>
        <strong>Disclaimer:</strong> {body}
      </p>
    </div>
  );
}

export default Disclaimer;
