/**
 * Responsive Grid Layout System
 * Smart grid that adapts based on content and screen size
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: React.ReactNode;
  hasResults?: boolean;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  testId?: string;
}

export function ResponsiveGrid({
  children,
  hasResults = false,
  className,
  maxWidth = '7xl',
  gap = 'md',
  testId
}: ResponsiveGridProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  };
  
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12'
  };
  
  // Dynamic grid based on content state
  const gridClasses = cn(
    "grid transition-all duration-500",
    gapClasses[gap],
    hasResults 
      ? "grid-cols-1 lg:grid-cols-2" // Results present: 2-column layout
      : "grid-cols-1 lg:grid-cols-3", // No results: 3-column with empty state
    maxWidthClasses[maxWidth],
    "mx-auto"
  );
  
  return (
    <div 
      className={cn(gridClasses, className)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/**
 * Grid Section Components
 */
interface GridSectionProps {
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3;
}

export function InputSection({ children, className, span }: GridSectionProps) {
  const spanClasses = {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2', 
    3: 'lg:col-span-3'
  };
  
  return (
    <div className={cn(
      "space-y-6",
      span && spanClasses[span],
      className
    )}>
      {children}
    </div>
  );
}

export function ResultSection({ children, className, span }: GridSectionProps) {
  const spanClasses = {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3'
  };
  
  return (
    <div className={cn(
      "space-y-6",
      span && spanClasses[span],
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Empty State Section
 */
export type FeatureDotColor = 'success' | 'info' | 'warning' | 'destructive' | 'primary';

const featureDotClasses: Record<FeatureDotColor, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  primary: 'bg-primary'
};

interface EmptyStateSectionProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  features?: Array<{
    color: FeatureDotColor;
    text: string;
  }>;
  className?: string;
}

export function EmptyStateSection({
  title,
  description, 
  icon: Icon,
  features = [],
  className
}: EmptyStateSectionProps) {
  return (
    <div className={cn("lg:col-span-1", className)}>
      <div className="h-full bg-card border border-border rounded-lg shadow-xs">
        <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
          {Icon && (
            <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mb-6">
              <Icon className="w-10 h-10 text-sage-400" />
            </div>
          )}
          
          <h3 className="text-xl font-semibold text-foreground mb-4">
            {title}
          </h3>
          
          <p className="text-muted-foreground mb-6 max-w-sm">
            {description}
          </p>
          
          {features.length > 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center justify-center space-x-2">
                  <div
                    className={cn("w-2 h-2 rounded-full", featureDotClasses[feature.color])}
                  />
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
 * Flexible Grid - For custom layouts
 */
interface FlexibleGridProps {
  children: React.ReactNode;
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function FlexibleGrid({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
  gap = 'md',
  className
}: FlexibleGridProps) {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6', 
    lg: 'gap-8',
    xl: 'gap-12'
  };
  
  const gridCols = cn(
    'grid',
    gapClasses[gap],
    columns.sm && `grid-cols-${columns.sm}`,
    columns.md && `md:grid-cols-${columns.md}`,
    columns.lg && `lg:grid-cols-${columns.lg}`,
    columns.xl && `xl:grid-cols-${columns.xl}`
  );
  
  return (
    <div className={cn(gridCols, className)}>
      {children}
    </div>
  );
}

/**
 * Container wrapper for consistent page layout
 */
interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Container({
  children,
  maxWidth = '7xl',
  padding = 'md',
  className
}: ContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg', 
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  };
  
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-12'
  };
  
  return (
    <div className={cn(
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      'mx-auto',
      className
    )}>
      {children}
    </div>
  );
}