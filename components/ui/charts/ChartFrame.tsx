'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export type ChartFrameHeight = 'compact' | 'tall';

export interface ChartFrameProps {
  /** Shown under the chart; also the figure's accessible name. */
  caption: React.ReactNode;
  /** A short line above the chart, e.g. which dollars the values are in. */
  modeNote?: React.ReactNode;
  /** compact: h-72, h-96 from md up. tall: h-96 at every width. */
  height?: ChartFrameHeight;
  /**
   * Mount the chart only once the frame is within about one viewport of the
   * screen. A placeholder of the same height holds the space until then.
   */
  deferUntilVisible?: boolean;
  /** One Recharts chart element; ResponsiveContainer sizes it. */
  children: React.ReactElement;
  className?: string;
}

const HEIGHT_CLASS: Record<ChartFrameHeight, string> = {
  compact: 'h-72 md:h-96',
  tall: 'h-96',
};

/** One viewport of margin around the screen for deferred mounting. */
const DEFER_ROOT_MARGIN = '100% 0px';

/** Without IntersectionObserver there is nothing to wait for; the server always waits. */
function mountsImmediately(): boolean {
  return typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined';
}

/** The shared chart scaffold: fixed height, caption, mode note and ResponsiveContainer. */
export function ChartFrame({
  caption,
  modeNote,
  height = 'compact',
  deferUntilVisible = false,
  children,
  className,
}: ChartFrameProps) {
  const captionId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(mountsImmediately);
  const mounted = visible || !deferUntilVisible;

  useEffect(() => {
    const node = plotRef.current;
    if (mounted || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setVisible(true);
        }
      },
      { rootMargin: DEFER_ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <figure aria-labelledby={captionId} className={cn('space-y-2', className)}>
      {modeNote && <p className="text-right text-xs text-muted-foreground">{modeNote}</p>}
      <div ref={plotRef} className={HEIGHT_CLASS[height]}>
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div aria-hidden="true" className="h-full w-full rounded-md bg-muted/40" />
        )}
      </div>
      <figcaption id={captionId} className="text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export default ChartFrame;
