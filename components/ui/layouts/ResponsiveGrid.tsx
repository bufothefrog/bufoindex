/**
 * Responsive Grid Layout System
 * Smart grid that adapts based on content and screen size
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type LayoutMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
export type GridSpan = 1 | 2 | 3;

const MAX_WIDTH_CLASSES: Record<LayoutMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

const SPAN_CLASSES: Record<GridSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
};

const GAP_CLASSES = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
  xl: 'gap-12',
} as const;

const PADDING_CLASSES = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-12',
} as const;

export interface ResponsiveGridProps {
  children: React.ReactNode;
  hasResults?: boolean;
  className?: string;
  maxWidth?: LayoutMaxWidth;
  gap?: keyof typeof GAP_CLASSES;
  testId?: string;
}

export function ResponsiveGrid({
  children,
  hasResults = false,
  className,
  maxWidth = '7xl',
  gap = 'md',
  testId,
}: ResponsiveGridProps) {
  return (
    <div
      className={cn(
        'grid transition-all duration-500',
        GAP_CLASSES[gap],
        // Results present: two columns; otherwise three, with the empty state in the last.
        hasResults ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3',
        MAX_WIDTH_CLASSES[maxWidth],
        'mx-auto',
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/**
 * Grid Section Components
 */
export interface GridSectionProps {
  children: React.ReactNode;
  className?: string;
  span?: GridSpan;
}

/** One column of the calculator grid (inputs or results). */
export function GridSection({ children, className, span }: GridSectionProps) {
  return <div className={cn('space-y-6', span && SPAN_CLASSES[span], className)}>{children}</div>;
}

/** The inputs column. */
export const InputSection = GridSection;
/** The results column. */
export const ResultSection = GridSection;

/**
 * Empty State Section
 */
export type FeatureDotColor = 'success' | 'info' | 'warning' | 'destructive' | 'primary';

const featureDotClasses: Record<FeatureDotColor, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  primary: 'bg-primary',
};

export interface EmptyStateSectionProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  features?: Array<{
    color: FeatureDotColor;
    text: string;
  }>;
  className?: string;
  id?: string;
}

export function EmptyStateSection({
  title,
  description,
  icon: Icon,
  features = [],
  className,
  id,
}: EmptyStateSectionProps) {
  return (
    <div id={id} className={cn('lg:col-span-1', className)}>
      <div className="h-full bg-card border border-border rounded-lg shadow-xs">
        {/* Shorter on phones so the empty state never reads as dead space */}
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center h-full min-h-[240px] lg:min-h-[400px]">
          {Icon && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sage-100 dark:bg-sage-800 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-sage-400 dark:text-sage-300" />
            </div>
          )}

          <h3 className="text-xl font-semibold text-foreground mb-2 sm:mb-4">{title}</h3>

          <p className="text-muted-foreground mb-4 sm:mb-6 max-w-sm">{description}</p>

          {features.length > 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center justify-center space-x-2">
                  <div className={cn('w-2 h-2 rounded-full', featureDotClasses[feature.color])} />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Container wrapper for consistent page layout
 */
export interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: LayoutMaxWidth;
  padding?: keyof typeof PADDING_CLASSES;
  className?: string;
}

export function Container({ children, maxWidth = '7xl', padding = 'md', className }: ContainerProps) {
  return (
    <div className={cn(MAX_WIDTH_CLASSES[maxWidth], PADDING_CLASSES[padding], 'mx-auto', className)}>
      {children}
    </div>
  );
}

export default ResponsiveGrid;
