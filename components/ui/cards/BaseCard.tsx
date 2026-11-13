/**
 * Base Card Component
 * Standardized card patterns with design system integration
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TONE_BORDER, TONE_TEXT, type Tone } from '@/lib/design-system/tone';
import { LucideIcon } from 'lucide-react';

/** default: the plain card; bordered: a 2px border in the card's tone (ResultCard). */
type BaseCardVariant = 'default' | 'bordered';

/** The tones a result card can take; without one the card uses the sage brand chrome. */
export type CardTone = Extract<Tone, 'positive' | 'caution' | 'negative' | 'info'>;

/** The hover border of a bordered card in a tone (TONE_BORDER at 50% instead of 30%). */
const TONE_BORDER_HOVER: Readonly<Record<CardTone, string>> = {
  positive: 'hover:border-success/50',
  caution: 'hover:border-warning/50',
  negative: 'hover:border-destructive/50',
  info: 'hover:border-info/50',
};

const BRAND_BORDER = 'border-sage-200 dark:border-sage-600 hover:border-sage-300 dark:hover:border-sage-500';
const BRAND_TITLE = 'text-sage-700 dark:text-sage-200';
const BRAND_ICON = 'text-sage-500 dark:text-sage-400';

interface BaseCardProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: BaseCardVariant;
  /** Colors the title, the icon and (bordered) the border; sage without one. */
  tone?: CardTone;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  testId?: string;
  actions?: React.ReactNode;
}

export function BaseCard({
  title,
  icon: Icon,
  children,
  variant = 'default',
  tone,
  className,
  headerClassName,
  contentClassName,
  testId,
  actions,
}: BaseCardProps) {
  return (
    <Card
      className={cn(
        variant === 'bordered' && cn('border-2', tone ? cn(TONE_BORDER[tone], TONE_BORDER_HOVER[tone]) : BRAND_BORDER),
        className
      )}
      data-testid={testId}
    >
      {title && (
        <CardHeader
          className={cn(
            'p-6 pb-4',
            headerClassName
          )}
        >
          <div className="flex items-center justify-between">
            <CardTitle className={cn(
              "flex items-center space-x-2",
              'text-lg',
              tone ? TONE_TEXT[tone] : BRAND_TITLE
            )}>
              {Icon && (
                <Icon className={cn(
                  'w-5 h-5 shrink-0',
                  tone ? TONE_TEXT[tone] : BRAND_ICON
                )} />
              )}
              <span>{title}</span>
            </CardTitle>

            <div className="flex items-center space-x-2">
              {actions}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(
        title ? 'p-6 pt-0' : 'p-6',
        contentClassName
      )}>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Input Card - Specialized card for form sections
 */
type InputCardProps = Omit<BaseCardProps, 'variant'>;

export function InputCard(props: InputCardProps) {
  return <BaseCard {...props} variant="default" />;
}

/**
 * Result Card - Specialized card for displaying results
 */
type ResultCardProps = Omit<BaseCardProps, 'variant'>;

export function ResultCard(props: ResultCardProps) {
  return <BaseCard {...props} variant="bordered" />;
}
