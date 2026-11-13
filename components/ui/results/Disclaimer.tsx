import React from 'react';
import { cn } from '@/lib/utils';

export interface DisclaimerProps {
  /** The footer text, composed with composeDisclaimer() from lib/constants/disclaimers. */
  text: string;
  className?: string;
}

/** The disclaimer line at the foot of a calculator or the overview. */
export function Disclaimer({ text, className }: DisclaimerProps) {
  return (
    <div className={cn('mt-8 text-center lg:mt-12', className)}>
      <p className="text-sm text-muted-foreground max-w-prose mx-auto">
        <strong>Disclaimer:</strong> {text}
      </p>
    </div>
  );
}

export default Disclaimer;
