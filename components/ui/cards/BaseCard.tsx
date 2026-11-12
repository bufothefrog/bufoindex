/**
 * Base Card Component
 * Standardized card patterns with design system integration
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComponentColor } from '@/lib/design-system/types';
import { LucideIcon } from 'lucide-react';

/** default: the plain card; bordered: a 2px border in the card's color (ResultCard). */
type BaseCardVariant = 'default' | 'bordered';

interface BaseCardProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: BaseCardVariant;
  color?: ComponentColor;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  testId?: string;
  actions?: React.ReactNode;
}

export function BaseCard({
  title,
  icon: Icon,
  children,
  variant = 'default',
  color = 'sage',
  className,
  headerClassName,
  contentClassName,
  titleClassName,
  testId,
  actions,
}: BaseCardProps) {
  return (
    <Card
      className={cn(
        variant === 'bordered' && getBorderedClasses(color),
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
              getColorClasses(color, 'text'),
              titleClassName
            )}>
              {Icon && (
                <Icon className={cn(
                  'w-5 h-5',
                  getColorClasses(color, 'icon')
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
 * Bordered classes for different colors
 */
function getBorderedClasses(color: ComponentColor): string {
  const borders = {
    sage: 'border-2 border-sage-200 dark:border-sage-600 hover:border-sage-300 dark:hover:border-sage-500',
    success: 'border-2 border-success/30 hover:border-success/50',
    warning: 'border-2 border-warning/30 hover:border-warning/50',
    error: 'border-2 border-destructive/30 hover:border-destructive/50',
    info: 'border-2 border-info/30 hover:border-info/50'
  };

  return borders[color];
}

/**
 * Color classes for different elements
 */
function getColorClasses(color: ComponentColor, element: 'text' | 'icon'): string {
  const colors = {
    sage: {
      text: 'text-sage-700 dark:text-sage-200',
      icon: 'text-sage-500 dark:text-sage-400',
    },
    success: {
      text: 'text-success',
      icon: 'text-success',
    },
    warning: {
      text: 'text-warning',
      icon: 'text-warning',
    },
    error: {
      text: 'text-destructive',
      icon: 'text-destructive',
    },
    info: {
      text: 'text-info',
      icon: 'text-info',
    }
  };

  return colors[color][element];
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
interface ResultCardProps extends Omit<BaseCardProps, 'variant' | 'color'> {
  status?: 'success' | 'warning' | 'error' | 'info';
}

export function ResultCard({
  status,
  ...props
}: ResultCardProps) {
  return (
    <BaseCard
      {...props}
      variant="bordered"
      color={status || 'sage'}
    />
  );
}
