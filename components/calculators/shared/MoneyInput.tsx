'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export function MoneyInput({
  value,
  onChange,
  label,
  placeholder = "0",
  min = 0,
  max,
  step = 1,
  disabled = false,
  error,
  helperText,
  className,
  showIcon = true,
  size = 'default'
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(value.toString());
  const [isFocused, setIsFocused] = React.useState(false);

  // Update display value when prop value changes
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toString());
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number when focused for easier editing
    setDisplayValue(value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(displayValue) || 0;
    const clampedValue = Math.max(min, max ? Math.min(max, numValue) : numValue);
    onChange(clampedValue);
    setDisplayValue(clampedValue.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Allow empty string, numbers, and decimal points
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      setDisplayValue(newValue);
      
      // Update value immediately if it's a valid number
      const numValue = parseFloat(newValue) || 0;
      if (!isNaN(numValue)) {
        const clampedValue = Math.max(min, max ? Math.min(max, numValue) : numValue);
        onChange(clampedValue);
      }
    }
  };

  const inputSizeClasses = {
    sm: 'text-sm',
    default: 'text-base',
    lg: 'text-lg'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    default: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium flex items-center">
          {showIcon && <DollarSign className={cn('mr-1', iconSizeClasses[size])} />}
          {label}
        </label>
      )}
      
      <div className="relative">
        <Input
          type="text"
          value={isFocused ? displayValue : value === 0 ? '' : value.toLocaleString()}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'font-mono tabular-nums text-right pr-3',
            inputSizeClasses[size],
            showIcon && !label && 'pl-8',
            error && 'border-red-500'
          )}
          min={min}
          max={max}
          step={step}
        />
        
        {showIcon && !label && (
          <DollarSign className={cn(
            'absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground',
            iconSizeClasses[size]
          )} />
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 flex items-center">
          <span>{error}</span>
        </div>
      )}

      {helperText && !error && (
        <div className="text-sm text-muted-foreground">
          {helperText}
        </div>
      )}
    </div>
  );
}

// Preset variants for common use cases
export function SmallMoneyInput(props: Omit<MoneyInputProps, 'size'>) {
  return <MoneyInput {...props} size="sm" />;
}

export function LargeMoneyInput(props: Omit<MoneyInputProps, 'size'>) {
  return <MoneyInput {...props} size="lg" />;
}