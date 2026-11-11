import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT, toneFromLegacy, type Tone } from '@/lib/design-system/tone';

type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

export type StatusAlertAppearance = 'muted' | 'tinted';

export interface StatusAlertProps {
  tone?: Tone;
  /** @deprecated Use `tone`; it maps through toneFromLegacy (danger is negative). */
  variant?: AlertVariant;
  /**
   * muted: a neutral panel where only the icon and title carry the tone.
   * tinted: the whole panel takes the tone's border and background.
   */
  appearance?: StatusAlertAppearance;
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  /** 'alert' for a warning that appears in response to an input change. */
  role?: 'alert' | 'status';
  testId?: string;
  className?: string;
}

export function StatusAlert({
  tone,
  variant,
  appearance = 'muted',
  icon: Icon,
  title,
  children,
  role,
  testId,
  className,
}: StatusAlertProps) {
  const resolved = tone ?? (variant ? toneFromLegacy(variant) : 'neutral');
  const tinted = appearance === 'tinted';
  return (
    <div
      role={role}
      data-testid={testId}
      className={cn(
        tinted
          ? cn('border rounded-lg p-3', TONE_BORDER[resolved], TONE_SURFACE[resolved])
          : 'bg-muted/50 border border-border rounded-lg p-3',
        className
      )}
    >
      <div className="flex items-start space-x-2">
        {Icon && (
          <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', TONE_TEXT[resolved])} />
        )}
        <div className="min-w-0">
          {title && (
            <div className={cn('text-sm font-medium', TONE_TEXT[resolved])}>
              {title}
            </div>
          )}
          <div className={cn('text-sm', tinted ? 'text-foreground' : 'text-muted-foreground')}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusAlert;
