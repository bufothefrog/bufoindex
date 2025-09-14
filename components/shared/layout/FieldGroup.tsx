import React from 'react';
import { cn } from '@/lib/utils';

interface FieldGroupProps {
  columns?: 1 | 2 | 3;
  responsive?: boolean;
  gap?: 2 | 3 | 4 | 6;
  children: React.ReactNode;
  className?: string;
}

/**
 * FieldGroup - Handles consistent grid layouts for form fields
 * 
 * @param columns - Number of columns (default: 2)
 * @param responsive - Whether to be responsive (default: true, single column on mobile)
 * @param gap - Tailwind gap value (default: 4)
 */
export function FieldGroup({
  columns = 2,
  responsive = true,
  gap = 4,
  children,
  className,
}: FieldGroupProps) {
  const getGridClass = () => {
    const baseClass = 'grid';
    
    // Gap class
    const gapClass = `gap-${gap}`;
    
    // Columns class
    let columnsClass: string;
    if (responsive) {
      // Single column on mobile, then specified columns on md+
      columnsClass = `grid-cols-1 md:grid-cols-${columns}`;
    } else {
      // Fixed columns at all breakpoints
      columnsClass = `grid-cols-${columns}`;
    }
    
    return `${baseClass} ${columnsClass} ${gapClass}`;
  };

  return (
    <div className={cn(getGridClass(), className)}>
      {children}
    </div>
  );
}

/**
 * FieldColumn - For explicit column spanning within FieldGroup
 */
interface FieldColumnProps {
  span?: 1 | 2 | 3 | 'full';
  children: React.ReactNode;
  className?: string;
}

export function FieldColumn({
  span = 1,
  children,
  className,
}: FieldColumnProps) {
  const getSpanClass = () => {
    switch (span) {
      case 'full':
        return 'col-span-full';
      case 1:
        return 'col-span-1';
      case 2:
        return 'col-span-2';
      case 3:
        return 'col-span-3';
      default:
        return 'col-span-1';
    }
  };

  return (
    <div className={cn(getSpanClass(), className)}>
      {children}
    </div>
  );
}

/**
 * Pre-configured field group variants for common patterns
 */

/**
 * TwoColumnFields - Most common layout: two equal columns
 */
export function TwoColumnFields({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <FieldGroup columns={2} responsive={true} className={className}>
      {children}
    </FieldGroup>
  );
}

/**
 * ThreeColumnFields - Three equal columns  
 */
export function ThreeColumnFields({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <FieldGroup columns={3} responsive={true} className={className}>
      {children}
    </FieldGroup>
  );
}

/**
 * SingleColumnFields - Single column layout with consistent spacing
 */
export function SingleColumnFields({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <FieldGroup columns={1} responsive={false} className={className}>
      {children}
    </FieldGroup>
  );
}