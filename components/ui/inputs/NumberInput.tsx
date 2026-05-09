/**
 * Number Input Component
 * Flexible number input with customizable formatting and validation
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { BaseInput } from './BaseInput';
import { BaseInputProps } from '@/lib/design-system/types';

interface NumberInputProps extends BaseInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  precision?: number; // Decimal places when allowDecimals is true
  formatDisplay?: (value: number) => string;
  parseValue?: (displayValue: string) => number;
  prefix?: string;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  textAlign?: 'left' | 'center' | 'right';
}

export function NumberInput({
  name,
  label,
  value,
  onChange,
  className,
  placeholder = "0",
  required = false,
  help,
  error,
  disabled = false,
  min,
  max,
  step = 1,
  allowDecimals = true,
  precision = 2,
  formatDisplay,
  parseValue,
  prefix,
  suffix,
  size = 'md',
  textAlign = 'right',
  testId,
}: NumberInputProps) {
  // Default formatters
  const defaultFormatDisplay = (val: number): string => {
    if (val === 0) return '';
    if (allowDecimals) {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
      });
    }
    return val.toLocaleString('en-US');
  };
  
  const defaultParseValue = (displayVal: string): number => {
    const cleaned = displayVal.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };
  
  const format = formatDisplay || defaultFormatDisplay;
  const parse = parseValue || defaultParseValue;
  
  const [displayValue, setDisplayValue] = React.useState(
    value !== 0 ? format(value) : ''
  );
  
  // Sync with external value changes
  React.useEffect(() => {
    if (value === 0 && displayValue !== '') {
      setDisplayValue('');
    } else if (value !== 0) {
      const formatted = format(value);
      if (displayValue !== formatted && document.activeElement?.getAttribute('name') !== name) {
        setDisplayValue(formatted);
      }
    }
  }, [value, displayValue, name, format]);
  
  const validateAndUpdate = (newValue: number) => {
    // Apply min/max constraints
    let constrainedValue = newValue;
    if (typeof min === 'number' && constrainedValue < min) {
      constrainedValue = min;
    }
    if (typeof max === 'number' && constrainedValue > max) {
      constrainedValue = max;
    }
    
    // Apply step constraint if specified
    if (step !== 1 && typeof min === 'number') {
      const steps = Math.round((constrainedValue - min) / step);
      constrainedValue = min + (steps * step);
    }
    
    onChange(constrainedValue);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Allow input while typing
    setDisplayValue(rawValue);
    
    // Parse and validate
    const numericValue = parse(rawValue);
    if (!isNaN(numericValue)) {
      validateAndUpdate(numericValue);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter', 'Escape'
    ];
    
    const isDigit = e.key >= '0' && e.key <= '9';
    const isDecimal = allowDecimals && e.key === '.';
    const isMinus = e.key === '-' && (typeof min !== 'number' || min < 0);
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlKey = e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());
    
    // Handle arrow key incrementing
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
      e.preventDefault();
      const increment = e.key === 'ArrowUp' ? step : -step;
      const newValue = value + increment;
      validateAndUpdate(newValue);
      return;
    }
    
    if (!isDigit && !isDecimal && !isMinus && !isAllowedKey && !isCtrlKey) {
      e.preventDefault();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    
    const numericValue = parse(paste);
    if (!isNaN(numericValue)) {
      setDisplayValue(paste);
      validateAndUpdate(numericValue);
    }
  };
  
  const handleBlur = () => {
    // Format the final value
    if (displayValue.trim() !== '') {
      const numericValue = parse(displayValue);
      if (!isNaN(numericValue)) {
        setDisplayValue(format(numericValue));
      } else {
        setDisplayValue(value !== 0 ? format(value) : '');
      }
    }
  };
  
  const handleFocus = () => {
    // Show raw value for easier editing
    if (value !== 0) {
      setDisplayValue(value.toString());
    }
  };
  
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base'
  };
  
  const textAlignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };
  
  // Calculate padding based on prefix/suffix
  const paddingLeft = prefix ? (size === 'lg' ? 'pl-9' : size === 'sm' ? 'pl-7' : 'pl-8') : 'pl-3';
  const paddingRight = suffix ? (size === 'lg' ? 'pr-9' : size === 'sm' ? 'pr-7' : 'pr-8') : 'pr-3';
  
  return (
    <BaseInput
      name={name}
      label={label}
      required={required}
      help={help}
      error={error}
      disabled={disabled}
      className={className}
      testId={testId}
    >
      <div className="relative w-full">
        {prefix && (
          <span className={cn(
            "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
            size === 'lg' ? 'left-3 text-base' : size === 'sm' ? 'left-2.5 text-xs' : 'left-3 text-sm'
          )}>
            {prefix}
          </span>
        )}

        <input
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={cn(
            sizeClasses[size],
            textAlignClasses[textAlign],
            paddingLeft,
            paddingRight,
            "font-mono",
            "focus:outline-hidden" // BaseInput handles focus styles
          )}
        />

        {suffix && (
          <span className={cn(
            "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
            size === 'lg' ? 'right-3 text-base' : size === 'sm' ? 'right-2.5 text-xs' : 'right-3 text-sm'
          )}>
            {suffix}
          </span>
        )}
      </div>
    </BaseInput>
  );
}

/**
 * Preset configurations for common number input types
 */
export const NumberInputPresets = {
  integer: {
    allowDecimals: false,
    textAlign: 'right' as const,
    min: 0
  },
  
  currency: {
    allowDecimals: true,
    precision: 2,
    prefix: '$',
    textAlign: 'right' as const,
    min: 0
  },
  
  percentage: {
    allowDecimals: true,
    precision: 1,
    suffix: '%',
    textAlign: 'center' as const,
    min: 0,
    max: 100
  },
  
  age: {
    allowDecimals: false,
    textAlign: 'center' as const,
    min: 0,
    max: 150,
    step: 1
  },
  
  year: {
    allowDecimals: false,
    textAlign: 'center' as const,
    min: 1900,
    max: 2100,
    step: 1
  }
} as const;