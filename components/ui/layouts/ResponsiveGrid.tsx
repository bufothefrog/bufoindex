/**
 * Responsive Grid Layout System
 * Smart grid that adapts based on content and screen size
 */

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Where the inputs sit from lg up: 'beside' the results (two columns) or
 * 'above' them (one column: the inputs, then full-width results). Below lg
 * both are one column.
 */
export type InputsPlacement = 'beside' | 'above';

export interface ResponsiveGridProps {
  children: React.ReactNode;
  hasResults?: boolean;
  /** Default 'beside'. */
  inputsPlacement?: InputsPlacement;
}

/**
 * Beside: two columns with results, three (inputs over two) without; one
 * column below lg. Above: one column at every width.
 */
export function ResponsiveGrid({ children, hasResults = false, inputsPlacement = 'beside' }: ResponsiveGridProps) {
  let columns: string;
  if (inputsPlacement === 'above') columns = 'grid-cols-1';
  else if (hasResults) columns = 'grid-cols-1 lg:grid-cols-2'; // Results present: 2-column layout
  else columns = 'grid-cols-1 lg:grid-cols-3'; // No results: 3-column with empty state
  return (
    <div className={cn("grid transition-all duration-500", "gap-6", columns)}>
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
  span?: 1 | 2 | 3;
}

const SPAN_CLASSES: Record<NonNullable<GridSectionProps['span']>, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3'
};

/** One column of the grid; InputSection and ResultSection are the same element. */
function GridSection({ children, className, span }: GridSectionProps) {
  return (
    <div className={cn(
      "space-y-6",
      span && SPAN_CLASSES[span],
      className
    )}>
      {children}
    </div>
  );
}

export const InputSection = GridSection;
export const ResultSection = GridSection;

/**
 * Empty State Section
 */
export interface EmptyStateSectionProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  id?: string;
}

export function EmptyStateSection({
  title,
  description, 
  icon: Icon,
  className,
  id
}: EmptyStateSectionProps) {
  return (
    <div id={id} className={cn("lg:col-span-1", className)}>
      <div className="h-full bg-card border border-border rounded-lg shadow-xs">
        {/* Shorter on phones so the empty state never reads as dead space */}
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center h-full min-h-[240px] lg:min-h-[400px]">
          {Icon && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sage-100 dark:bg-sage-800 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-sage-400 dark:text-sage-300" />
            </div>
          )}
          
          <h3 className="text-xl font-semibold text-foreground mb-2 sm:mb-4">
            {title}
          </h3>
          
          <p className="text-muted-foreground mb-4 sm:mb-6 max-w-sm">
            {description}
          </p>
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
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn('max-w-7xl', 'p-6', 'mx-auto', className)}>
      {children}
    </div>
  );
}

export default ResponsiveGrid;
