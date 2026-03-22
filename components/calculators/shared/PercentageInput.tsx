'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Percent } from 'lucide-react';
import { formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PercentageInputProps {
  value: number; // Value as decimal (e.g., 0.07 for 7%)
  onChange: (value: number) => void;
  label?: string;
  min?: number; // Min as decimal (e.g., 0.01 for 1%)
  max?: number; // Max as decimal (e.g., 1.0 for 100%)
  step?: number; // Step as decimal (e.g., 0.001 for 0.1%)
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  showSlider?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
  displayMode?: 'input' | 'slider' | 'both';
}

export function PercentageInput({
  value,
  onChange,
  label,
  min = 0,
  max = 1,
  step = 0.001,
  disabled = false,
  error,
  helperText,
  className,
  showSlider = false,
  showIcon = true,
  size = 'default',
  displayMode = 'input'
}: PercentageInputProps) {
  const [displayValue, setDisplayValue] = React.useState((value * 100).toFixed(2));
  const [isFocused, setIsFocused] = React.useState(false);

  // Convert decimal to percentage for display
  const percentageValue = value * 100;
  const minPercent = min * 100;
  const maxPercent = max * 100;
  const stepPercent = step * 100;

  // Update display value when prop value changes
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue((value * 100).toFixed(2));
    }
  }, [value, isFocused]);

  const handleInputFocus = () => {
    setIsFocused(true);
    // Use toFixed to avoid floating point precision issues when focusing
    setDisplayValue((value * 100).toFixed(2));
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(displayValue) || 0;
    const clampedPercent = Math.max(minPercent, Math.min(maxPercent, numValue));
    const decimalValue = Math.round(clampedPercent * 100) / 10000; // Round to avoid floating point precision issues
    onChange(decimalValue);
    setDisplayValue(clampedPercent.toFixed(2));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Allow empty string, numbers, and decimal points
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      setDisplayValue(newValue);
      
      // Update value immediately if it's a valid number
      const numValue = parseFloat(newValue) || 0;
      if (!isNaN(numValue)) {
        const decimalValue = Math.round(numValue * 100) / 10000; // Round to avoid floating point precision issues
        onChange(decimalValue);
      }
    }
  };

  const handleSliderChange = ([newValue]: number[]) => {
    const decimalValue = Math.round(newValue * 100) / 10000; // Round to avoid floating point precision issues
    onChange(decimalValue);
  };

  const inputSizeClasses = {
    sm: 'text-sm',
    default: 'text-sm', // Use smaller, consistent sizing
    lg: 'text-base' // Reduced from text-lg
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    default: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const shouldShowSlider = displayMode === 'slider' || displayMode === 'both' || showSlider;
  const shouldShowInput = displayMode === 'input' || displayMode === 'both';

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium flex items-center">
          {showIcon && <Percent className={cn('mr-1', iconSizeClasses[size])} />}
          {label}
        </label>
      )}
      
      {shouldShowInput && (
        <div className="relative">
          <Input
            type="text"
            value={isFocused ? displayValue : percentageValue.toFixed(2)}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            disabled={disabled}
            className={cn(
              'font-mono tabular-nums text-right pr-8',
              inputSizeClasses[size],
              showIcon && !label && 'pl-8',
              error && 'border-destructive'
            )}
          />
          
          <div className={cn(
            'absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground',
            inputSizeClasses[size]
          )}>
            %
          </div>
          
          {showIcon && !label && (
            <Percent className={cn(
              'absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground',
              iconSizeClasses[size]
            )} />
          )}
        </div>
      )}

      {shouldShowSlider && (
        <div className="px-3">
          <Slider
            value={[percentageValue]}
            onValueChange={handleSliderChange}
            min={minPercent}
            max={maxPercent}
            step={stepPercent}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatPercent(min)}</span>
            <span className="font-medium">{formatPercent(value)}</span>
            <span>{formatPercent(max)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      {helperText && !error && (
        <div className="text-xs text-muted-foreground">
          {helperText}
        </div>
      )}
    </div>
  );
}

// Preset variants for common use cases
export function InterestRateInput(props: Omit<PercentageInputProps, 'min' | 'max' | 'step'>) {
  return (
    <PercentageInput 
      {...props} 
      min={0}
      max={0.20} // 20%
      step={0.001} // 0.1%
    />
  );
}

export function SavingsRateInput(props: Omit<PercentageInputProps, 'min' | 'max' | 'step' | 'displayMode'>) {
  return (
    <PercentageInput 
      {...props} 
      min={0}
      max={1} // 100%
      step={0.01} // 1%
      displayMode="both"
    />
  );
}

export function AllocationPercentInput(props: Omit<PercentageInputProps, 'min' | 'max' | 'step'>) {
  return (
    <PercentageInput 
      {...props} 
      min={0}
      max={1} // 100%
      step={0.01} // 1%
    />
  );
}