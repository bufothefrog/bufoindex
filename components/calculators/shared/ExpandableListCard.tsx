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
        <div
          className="flex items-center justify-between"
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
          <div className="flex items-center space-x-3 min-w-0">
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

          <div className="flex items-center space-x-3 shrink-0">
            {headerRight}
            {value !== undefined && (
              <div className="text-right">
                <div className="font-semibold font-mono tabular-nums">{value}</div>
                {valueSubtext && (
                  <div className="text-sm text-muted-foreground">{valueSubtext}</div>
                )}
              </div>
            )}
            {isExpandable && (
              <Chevron className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
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
