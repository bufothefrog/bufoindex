import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT, toneFromLegacy, type Tone } from '@/lib/design-system/tone';

/** Deprecated spelling of `tone`; kept until every caller moves (x2 removes it). */
export type StatusAlertVariant = 'info' | 'warning' | 'danger' | 'success';

/** muted: neutral surface, tone only on the icon and title; tinted: the tone's surface and border. */
export type StatusAlertAppearance = 'muted' | 'tinted';

export interface StatusAlertProps {
  /** Default 'info'. Wins over `variant`. */
  tone?: Tone;
  /** @deprecated Use `tone` (success -> positive, warning -> caution, danger -> negative). */
  variant?: StatusAlertVariant;
  appearance?: StatusAlertAppearance;
  icon?: LucideIcon;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** 'alert' or 'status' when the message appears in response to input; none by default. */
  role?: 'alert' | 'status';
  className?: string;
  testId?: string;
}

export function StatusAlert({
  tone,
  variant,
  appearance = 'muted',
  icon: Icon,
  title,
  children,
  role,
  className,
  testId,
}: StatusAlertProps) {
  const resolved: Tone = tone ?? toneFromLegacy(variant, 'info');
  const tinted = appearance === 'tinted';
  return (
    <div
      role={role}
      data-testid={testId}
      data-tone={resolved}
      className={cn(
        'rounded-lg border p-3',
        tinted ? [TONE_BORDER[resolved], TONE_SURFACE[resolved]] : 'border-border bg-muted/50',
        className
      )}
    >
      <div className="flex items-start gap-2">
        {Icon && <Icon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_TEXT[resolved])} />}
        <div className="min-w-0">
          {title && <div className={cn('text-sm font-medium', TONE_TEXT[resolved])}>{title}</div>}
          <div className={cn('text-sm', tinted ? 'text-foreground' : 'text-muted-foreground')}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default StatusAlert;
