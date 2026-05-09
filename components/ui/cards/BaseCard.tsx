/**
 * Base Card Component
 * Standardized card patterns with design system integration
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComponentColor, CardVariant, ComponentSize } from '@/lib/design-system/types';
import { LucideIcon } from 'lucide-react';

interface BaseCardProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: CardVariant;
  color?: ComponentColor;
  size?: ComponentSize;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  testId?: string;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function BaseCard({
  title,
  icon: Icon,
  children,
  variant = 'default',
  color = 'sage',
  size = 'md',
  className,
  headerClassName,
  contentClassName,
  titleClassName,
  testId,
  actions,
  collapsible = false,
  defaultCollapsed = false
}: BaseCardProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  
  // Variant-specific styling
  const variantClasses = {
    default: '',
    gradient: getGradientClasses(color),
    bordered: getBorderedClasses(color),
    elevated: 'shadow-lg border-none'
  };
  
  // Size-specific styling
  const sizeClasses = {
    sm: {
      card: 'text-sm',
      header: 'p-4 pb-2',
      content: 'p-4 pt-0',
      contentStandalone: 'p-4',
      icon: 'w-4 h-4',
      title: 'text-base'
    },
    md: {
      card: '',
      header: 'p-6 pb-4',
      content: 'p-6 pt-0',
      contentStandalone: 'p-6',
      icon: 'w-5 h-5',
      title: 'text-lg'
    },
    lg: {
      card: 'text-base',
      header: 'p-8 pb-4',
      content: 'p-8 pt-0',
      contentStandalone: 'p-8',
      icon: 'w-6 h-6',
      title: 'text-xl'
    }
  };
  
  const currentSize = sizeClasses[size];
  
  return (
    <Card 
      className={cn(
        variantClasses[variant],
        currentSize.card,
        className
      )}
      data-testid={testId}
    >
      {title && (
        <CardHeader 
          className={cn(
            currentSize.header,
            headerClassName
          )}
        >
          <div className="flex items-center justify-between">
            <CardTitle className={cn(
              "flex items-center space-x-2",
              currentSize.title,
              getColorClasses(color, 'text'),
              titleClassName
            )}>
              {Icon && (
                <Icon className={cn(
                  currentSize.icon,
                  getColorClasses(color, 'icon')
                )} />
              )}
              <span>{title}</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {actions}
              {collapsible && (
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={cn(
                    "p-1 rounded hover:bg-secondary transition-colors",
                    getColorClasses(color, 'button')
                  )}
                  aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  <svg
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isCollapsed ? "rotate-180" : ""
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      
      {!isCollapsed && (
        <CardContent className={cn(
          title ? currentSize.content : currentSize.contentStandalone,
          contentClassName
        )}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Gradient background classes for different colors
 */
function getGradientClasses(color: ComponentColor): string {
  const gradients = {
    sage: 'bg-linear-to-r from-sage-50 to-sage-100 dark:from-sage-800 dark:to-sage-700 border-sage-200 dark:border-sage-600',
    success: 'bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-800 dark:to-emerald-800 border-green-200 dark:border-green-600',
    warning: 'bg-linear-to-r from-orange-50 to-yellow-50 dark:from-orange-800 dark:to-yellow-800 border-orange-200 dark:border-orange-600',
    error: 'bg-linear-to-r from-red-50 to-rose-50 dark:from-red-800 dark:to-rose-800 border-red-200 dark:border-red-600',
    info: 'bg-linear-to-r from-blue-50 to-sky-50 dark:from-blue-800 dark:to-sky-800 border-blue-200 dark:border-blue-600'
  };
  
  return gradients[color];
}

/**
 * Bordered classes for different colors
 */
function getBorderedClasses(color: ComponentColor): string {
  const borders = {
    sage: 'border-2 border-sage-200 dark:border-sage-600 hover:border-sage-300 dark:hover:border-sage-500',
    success: 'border-2 border-green-200 dark:border-green-600 hover:border-green-300 dark:hover:border-green-500',
    warning: 'border-2 border-orange-200 dark:border-orange-600 hover:border-orange-300 dark:hover:border-orange-500',
    error: 'border-2 border-red-200 dark:border-red-600 hover:border-red-300 dark:hover:border-red-500',
    info: 'border-2 border-blue-200 dark:border-blue-600 hover:border-blue-300 dark:hover:border-blue-500'
  };
  
  return borders[color];
}

/**
 * Color classes for different elements
 */
function getColorClasses(color: ComponentColor, element: 'text' | 'icon' | 'button'): string {
  const colors = {
    sage: {
      text: 'text-sage-700 dark:text-sage-200',
      icon: 'text-sage-500 dark:text-sage-400',
      button: 'hover:bg-sage-100 dark:hover:bg-sage-700 text-sage-600 dark:text-sage-300'
    },
    success: {
      text: 'text-green-700 dark:text-green-200',
      icon: 'text-green-500 dark:text-green-400',
      button: 'hover:bg-green-100 dark:hover:bg-green-700 text-green-600 dark:text-green-300'
    },
    warning: {
      text: 'text-orange-700 dark:text-orange-200',
      icon: 'text-orange-500 dark:text-orange-400',
      button: 'hover:bg-orange-100 dark:hover:bg-orange-700 text-orange-600 dark:text-orange-300'
    },
    error: {
      text: 'text-red-700 dark:text-red-200',
      icon: 'text-red-500 dark:text-red-400',
      button: 'hover:bg-red-100 dark:hover:bg-red-700 text-red-600 dark:text-red-300'
    },
    info: {
      text: 'text-blue-700 dark:text-blue-200',
      icon: 'text-blue-500 dark:text-blue-400',
      button: 'hover:bg-blue-100 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-300'
    }
  };
  
  return colors[color][element];
}

/**
 * Input Card - Specialized card for form sections
 */
interface InputCardProps extends Omit<BaseCardProps, 'variant'> {
  required?: boolean;
}

export function InputCard({ 
  required = false, 
  title, 
  ...props 
}: InputCardProps) {
  const displayTitle = required && title ? `${title} *` : title;
  
  return (
    <BaseCard
      {...props}
      title={displayTitle}
      variant="default"
      titleClassName={cn(
        required && 'after:content-[""] after:text-red-500 dark:after:text-red-300',
        props.titleClassName
      )}
    />
  );
}

/**
 * Result Card - Specialized card for displaying results
 */
interface ResultCardProps extends Omit<BaseCardProps, 'variant' | 'color'> {
  status?: 'success' | 'warning' | 'error' | 'info';
  highlight?: boolean;
}

export function ResultCard({ 
  status, 
  highlight = false,
  ...props 
}: ResultCardProps) {
  const color: ComponentColor = status || 'sage';
  const variant: CardVariant = highlight ? 'gradient' : 'bordered';
  
  return (
    <BaseCard
      {...props}
      variant={variant}
      color={color}
    />
  );
}

/**
 * Summary Card - For displaying key metrics
 */
interface SummaryCardProps extends Omit<BaseCardProps, 'children'> {
  value: string | number;
  label: string;
  change?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
  };
  secondaryValue?: string;
}

export function SummaryCard({
  value,
  label,
  change,
  secondaryValue,
  ...props
}: SummaryCardProps) {
  return (
    <BaseCard {...props} size="sm">
      <div className="text-center space-y-2">
        <div className="text-2xl font-bold text-foreground">
          {value}
        </div>
        <div className="text-sm text-muted-foreground">
          {label}
        </div>
        {change && (
          <div className={cn(
            "text-xs flex items-center justify-center space-x-1",
            change.direction === 'up' && "text-green-600 dark:text-green-300",
            change.direction === 'down' && "text-red-600 dark:text-red-300",
            change.direction === 'neutral' && "text-muted-foreground"
          )}>
            {change.direction !== 'neutral' && (
              <span>{change.direction === 'up' ? '↑' : '↓'}</span>
            )}
            <span>{change.value}</span>
          </div>
        )}
        {secondaryValue && (
          <div className="text-xs text-muted-foreground">
            {secondaryValue}
          </div>
        )}
      </div>
    </BaseCard>
  );
}