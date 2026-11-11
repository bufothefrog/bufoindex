import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT, type Tone } from '@/lib/design-system/tone';

export type StatTileSize = 'md' | 'lg';
export type StatTileAlign = 'start' | 'center';

export interface StatTileProps {
  label: string;
  /** Preformatted value; ignored while `loading`. */
  value?: React.ReactNode;
  hint?: React.ReactNode;
  badge?: string;
  /** Colors the value; with `emphasis` it also tints the tile. Default neutral. */
  tone?: Tone;
  /** Tinted surface and border (the tone's, or the brand's for a neutral tone). */
  emphasis?: boolean;
  size?: StatTileSize;
  align?: StatTileAlign;
  /** Keeps the tile's frame and label and pulses a placeholder for the value. */
  loading?: boolean;
  className?: string;
  testId?: string;
}

const VALUE_SIZE: Record<StatTileSize, string> = {
  md: 'text-lg',
  lg: 'text-2xl',
};

const PLACEHOLDER_SIZE: Record<StatTileSize, string> = {
  md: 'h-7',
  lg: 'h-8',
};

/**
 * One labelled figure. The tile is a named group (its label), values use
 * tabular numerals so tiles in a grid line up, and long values wrap rather
 * than overflow a 390px phone.
 */
export function StatTile({
  label,
  value,
  hint,
  badge,
  tone = 'neutral',
  emphasis = false,
  size = 'md',
  align = 'start',
  loading = false,
  className,
  testId,
}: StatTileProps) {
  const labelId = useId();
  const surfaceTone: Tone = tone === 'neutral' ? 'brand' : tone;
  const centered = align === 'center';

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      data-testid={testId}
      data-tone={tone}
      className={cn(
        'min-w-0 rounded-lg border p-3',
        emphasis ? [TONE_BORDER[surfaceTone], TONE_SURFACE[surfaceTone]] : 'border-border bg-muted/40',
        centered && 'text-center',
        className
      )}
    >
      <div className={cn('flex items-start gap-2', centered ? 'justify-center' : 'justify-between')}>
        <div id={labelId} className="text-xs text-muted-foreground">
          {label}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium leading-4 text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <div
          aria-hidden="true"
          className={cn(
            'mt-1 w-2/3 animate-pulse rounded-md bg-muted',
            PLACEHOLDER_SIZE[size],
            centered && 'mx-auto'
          )}
        />
      ) : (
        <div className={cn('mt-1 break-words font-semibold tabular-nums', VALUE_SIZE[size], TONE_TEXT[tone])}>
          {value}
        </div>
      )}
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default StatTile;
