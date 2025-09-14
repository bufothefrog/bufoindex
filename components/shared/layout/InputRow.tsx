import React from 'react';
import { cn } from '@/lib/utils';

interface InputRowProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  ratio?: '2:1' | '1:1' | '3:1' | '3:2';
  gap?: 2 | 3 | 4 | 6;
  responsive?: boolean;
  className?: string;
}

/**
 * InputRow - Handles the common pattern of a wide input next to a narrow input
 * 
 * @param primary - The main/wider input field
 * @param secondary - The smaller/narrower input field  
 * @param ratio - Width ratio between primary and secondary (default: '2:1')
 * @param gap - Tailwind gap value (default: 4)
 * @param responsive - Whether to stack on mobile (default: true)
 */
export function InputRow({
  primary,
  secondary,
  ratio = '2:1',
  gap = 4,
  responsive = true,
  className,
}: InputRowProps) {
  const getRatioClasses = () => {
    const gapClass = `gap-${gap}`;
    
    switch (ratio) {
      case '2:1':
        return responsive 
          ? `grid grid-cols-1 md:grid-cols-3 ${gapClass}` 
          : `grid grid-cols-3 ${gapClass}`;
      case '3:1':
        return responsive
          ? `grid grid-cols-1 md:grid-cols-4 ${gapClass}`
          : `grid grid-cols-4 ${gapClass}`;
      case '3:2':
        return responsive
          ? `grid grid-cols-1 md:grid-cols-5 ${gapClass}`
          : `grid grid-cols-5 ${gapClass}`;
      case '1:1':
        return responsive
          ? `grid grid-cols-1 md:grid-cols-2 ${gapClass}`
          : `grid grid-cols-2 ${gapClass}`;
      default:
        return responsive 
          ? `grid grid-cols-1 md:grid-cols-3 ${gapClass}` 
          : `grid grid-cols-3 ${gapClass}`;
    }
  };

  const getPrimarySpan = () => {
    switch (ratio) {
      case '2:1':
        return responsive ? 'md:col-span-2' : 'col-span-2';
      case '3:1':
        return responsive ? 'md:col-span-3' : 'col-span-3';
      case '3:2':
        return responsive ? 'md:col-span-3' : 'col-span-3';
      case '1:1':
        return responsive ? 'md:col-span-1' : 'col-span-1';
      default:
        return responsive ? 'md:col-span-2' : 'col-span-2';
    }
  };

  const getSecondarySpan = () => {
    switch (ratio) {
      case '2:1':
        return responsive ? 'md:col-span-1' : 'col-span-1';
      case '3:1':
        return responsive ? 'md:col-span-1' : 'col-span-1';
      case '3:2':
        return responsive ? 'md:col-span-2' : 'col-span-2';
      case '1:1':
        return responsive ? 'md:col-span-1' : 'col-span-1';
      default:
        return responsive ? 'md:col-span-1' : 'col-span-1';
    }
  };

  return (
    <div className={cn(getRatioClasses(), className)}>
      <div className={cn('col-span-1', getPrimarySpan())}>
        {primary}
      </div>
      <div className={cn('col-span-1', getSecondarySpan())}>
        {secondary}
      </div>
    </div>
  );
}

/**
 * Pre-configured row variants for common patterns
 */

/**
 * PrimarySecondaryRow - 2:1 ratio (most common)
 * Example: Wide money input + narrow age input
 */
export function PrimarySecondaryRow({ 
  primary, 
  secondary, 
  className 
}: { 
  primary: React.ReactNode; 
  secondary: React.ReactNode; 
  className?: string;
}) {
  return (
    <InputRow 
      primary={primary} 
      secondary={secondary} 
      ratio="2:1" 
      className={className} 
    />
  );
}

/**
 * EqualRow - 1:1 ratio
 * Example: Two equally important fields
 */
export function EqualRow({ 
  left, 
  right, 
  className 
}: { 
  left: React.ReactNode; 
  right: React.ReactNode; 
  className?: string;
}) {
  return (
    <InputRow 
      primary={left} 
      secondary={right} 
      ratio="1:1" 
      className={className} 
    />
  );
}

/**
 * DominantRow - 3:1 ratio
 * Example: Very wide main input + small supplementary input
 */
export function DominantRow({ 
  primary, 
  secondary, 
  className 
}: { 
  primary: React.ReactNode; 
  secondary: React.ReactNode; 
  className?: string;
}) {
  return (
    <InputRow 
      primary={primary} 
      secondary={secondary} 
      ratio="3:1" 
      className={className} 
    />
  );
}