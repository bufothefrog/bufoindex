import React from 'react';
import { formatCount } from '@/lib/format';

export interface SimulationRegionProps {
  /** True while the simulation for the current inputs has not finished. */
  pending: boolean;
  /** Simulated paths per run, named in the pending note. */
  paths: number;
  /** Stands in for the figures while pending, at about their height. */
  placeholder: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A polite live region around a card's simulated figures: a note and a
 * placeholder while the run is pending, then the figures.
 */
export function SimulationRegion({ pending, paths, placeholder, children }: SimulationRegionProps) {
  return (
    <div aria-live="polite" aria-busy={pending}>
      {pending ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Running {formatCount(paths)} simulated market paths...</p>
          {placeholder}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default SimulationRegion;
