import React from 'react';

/**
 * Neutral placeholder rendered on the server and during the hydration pass,
 * before the persisted profile has been read from localStorage.
 */
export function OverviewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your overview" className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-11 w-full animate-pulse rounded bg-muted sm:w-48" />
        </div>
      ))}
    </div>
  );
}

export default OverviewSkeleton;
