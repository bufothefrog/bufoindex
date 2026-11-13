import React from 'react';
import { ChevronLeft } from 'lucide-react';

export interface BackControlProps {
  onBack(): void;
}

/**
 * The wizard's Back control, beside the progress display: one screen back,
 * answers kept. The wizard leaves it out on the first screen (the site
 * header already links home). Keeping a Back control at all is a default of
 * the guided-flow design on an open question, so it lives here alone.
 */
export function BackControl({ onBack }: BackControlProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </button>
  );
}

export default BackControl;
