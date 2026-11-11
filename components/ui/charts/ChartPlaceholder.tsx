'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { CHART_HEIGHT_CLASS, CHART_MODE_NOTE_CLASS, type ChartHeight } from './sizes';

/**
 * Recharts-free pieces for loading charts off the critical path. Import them
 * from '@/components/ui/charts/ChartPlaceholder' (not the barrel) in the
 * module that calls next/dynamic, so Recharts stays out of the page chunk:
 *
 *   const MonteCarloChart = dynamic(() => import('./MonteCarloChart'), {
 *     ssr: false,
 *     loading: chartLoading('tall', { modeNote: true }),
 *   });
 *
 *   <ChartViewportMount height="tall" modeNote>
 *     <MonteCarloChart {...props} />
 *   </ChartViewportMount>
 *
 * next/dynamic requires its options to be an object literal at the call
 * site, so this module supplies the `loading` value rather than wrapping
 * dynamic() itself.
 */

export interface ChartPlaceholderProps {
  /** Must match the ChartFrame `height` of the chart it stands in for. */
  height?: ChartHeight;
  /** Reserve the mode-note line that ChartFrame renders above the plot. */
  modeNote?: boolean;
  /** Reserve one caption line below the plot. */
  caption?: boolean;
  /** Accessible status text. */
  label?: string;
  className?: string;
}

export function ChartPlaceholder({
  height = 'compact',
  modeNote = false,
  caption = false,
  label = 'Loading chart',
  className,
}: ChartPlaceholderProps) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label={label} data-chart-placeholder="">
      {modeNote && <div className={CHART_MODE_NOTE_CLASS} aria-hidden="true" />}
      <div
        className={cn(CHART_HEIGHT_CLASS[height], 'w-full animate-pulse rounded-lg bg-muted/50')}
        aria-hidden="true"
      />
      {caption && <div className="h-4 text-xs" aria-hidden="true" />}
    </div>
  );
}

/** Builds the `loading` option for next/dynamic: a placeholder of the chart's real height. */
export function chartLoading(
  height: ChartHeight = 'compact',
  options: Omit<ChartPlaceholderProps, 'height'> = {}
) {
  function ChartLoading() {
    return <ChartPlaceholder height={height} {...options} />;
  }
  return ChartLoading;
}

const subscribeNever = () => () => {};
const isObserverMissing = () => typeof IntersectionObserver === 'undefined';

export interface ChartViewportMountProps extends Omit<ChartPlaceholderProps, 'label'> {
  /** The chart, normally a next/dynamic component. Mounted once near the viewport. */
  children: React.ReactNode;
  /** IntersectionObserver root margin; about one viewport ahead by default. */
  rootMargin?: string;
}

/**
 * Renders the placeholder until it comes within `rootMargin` of the viewport,
 * then mounts `children` and stays mounted. Without IntersectionObserver
 * (old browsers, tests) the children mount right after hydration. The first
 * render is always the placeholder, on the server and the client alike, so
 * hydration never sees different markup.
 */
export function ChartViewportMount({
  children,
  rootMargin = '100% 0px',
  height = 'compact',
  modeNote,
  caption,
  className,
}: ChartViewportMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The server snapshot is false, so hydration renders the placeholder on
  // both sides; the client then re-renders with its real support.
  const observerMissing = useSyncExternalStore(subscribeNever, isObserverMissing, () => false);
  const [seen, setNear] = useState(false);
  const near = seen || observerMissing;

  useEffect(() => {
    // The hydration pass commits with the server snapshot, so check support here too.
    if (near || isObserverMissing()) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return (
    <div ref={ref}>
      {near ? (
        children
      ) : (
        <ChartPlaceholder height={height} modeNote={modeNote} caption={caption} className={className} />
      )}
    </div>
  );
}

export default ChartPlaceholder;
