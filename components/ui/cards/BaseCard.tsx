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
    success: 'bg-linear-to-r from-success/10 to-success/20 border-success/30',
    warning: 'bg-linear-to-r from-warning/10 to-warning/20 border-warning/30',
    error: 'bg-linear-to-r from-destructive/10 to-destructive/20 border-destructive/30',
    info: 'bg-linear-to-r from-info/10 to-info/20 border-info/30'
  };
  
  return gradients[color];
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
function getColorClasses(color: ComponentColor, element: 'text' | 'icon' | 'button'): string {
  const colors = {
    sage: {
      text: 'text-sage-700 dark:text-sage-200',
      icon: 'text-sage-500 dark:text-sage-400',
      button: 'hover:bg-sage-100 dark:hover:bg-sage-700 text-sage-600 dark:text-sage-300'
    },
    success: {
      text: 'text-success',
      icon: 'text-success',
      button: 'hover:bg-success/10 text-success'
    },
    warning: {
      text: 'text-warning',
      icon: 'text-warning',
      button: 'hover:bg-warning/10 text-warning'
    },
    error: {
      text: 'text-destructive',
      icon: 'text-destructive',
      button: 'hover:bg-destructive/10 text-destructive'
    },
    info: {
      text: 'text-info',
      icon: 'text-info',
      button: 'hover:bg-info/10 text-info'
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
        required && 'after:content-[""] after:text-destructive',
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
            change.direction === 'up' && "text-success",
            change.direction === 'down' && "text-destructive",
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