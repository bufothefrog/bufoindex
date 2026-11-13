'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_TEXT, type Tone } from '@/lib/design-system/tone';

interface ExpandableListCardProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  value?: string | number;
  valueSubtext?: string;
  tone?: Tone;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

/** The left accent border per tone. */
const TONE_BORDER_LEFT: Readonly<Record<Tone, string>> = {
  neutral: 'border-l-border',
  positive: 'border-l-success',
  caution: 'border-l-warning',
  negative: 'border-l-destructive',
  info: 'border-l-info',
  brand: 'border-l-sage-500 dark:border-l-sage-400',
};

/** The header icon per tone; a neutral icon stays muted. */
function iconClass(tone: Tone): string {
  return tone === 'neutral' ? 'text-muted-foreground' : TONE_TEXT[tone];
}

export function ExpandableListCard({
  icon: Icon,
  title,
  subtitle,
  value,
  valueSubtext,
  tone = 'neutral',
  expanded,
  onToggle,
  children,
  headerRight,
  className,
}: ExpandableListCardProps) {
  const isExpandable = onToggle !== undefined;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <Card
      className={cn(
        'border-l-4 transition-all duration-200',
        TONE_BORDER_LEFT[tone],
        isExpandable && 'hover:shadow-md cursor-pointer',
        className
      )}
    >
      <CardContent className="p-4">
        {/* The chevron sits outside the wrapping block, so it stays at the right
            edge of the first row's block at every width. Inside the block,
            flex-wrap with a 12rem basis on the title column drops the figures
            below the title on a narrow screen instead of squeezing the title
            under them, and min-w-0 lets the figures wrap instead of
            overflowing the card. */}
        <div
          className="flex items-center gap-3"
          onClick={onToggle}
          role={isExpandable ? 'button' : undefined}
          tabIndex={isExpandable ? 0 : undefined}
          onKeyDown={isExpandable ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle?.();
            }
          } : undefined}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center space-x-3 min-w-0 flex-1 basis-48">
              {Icon && (
                <Icon className={cn('w-5 h-5 shrink-0', iconClass(tone))} />
              )}
              <div className="min-w-0">
                <h4 className="font-semibold text-sm">{title}</h4>
                {subtitle && (
                  <div className="text-sm text-muted-foreground">{subtitle}</div>
                )}
              </div>
            </div>

            <div className="flex min-w-0 max-w-full items-center space-x-3 empty:hidden">
              {headerRight}
              {value !== undefined && (
                <div className="min-w-0 text-right">
                  <div className="font-semibold font-mono tabular-nums">{value}</div>
                  {valueSubtext && (
                    <div className="text-sm text-muted-foreground">{valueSubtext}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isExpandable && (
            <Chevron className="w-4 h-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {expanded && children && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
