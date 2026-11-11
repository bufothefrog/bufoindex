/**
 * Percent Input Component
 * Smart percentage input with automatic formatting and validation
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { BaseInput } from './BaseInput';
import { BaseInputProps } from '@/lib/design-system/types';

interface PercentInputProps extends BaseInputProps {
  value: number; // 0-1 decimal format (e.g., 0.05 for 5%)
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number; // In decimal format (e.g., 0 for 0%)
  max?: number; // In decimal format (e.g., 1 for 100%)
  precision?: number; // Decimal places to show (default: 1)
  size?: 'sm' | 'md' | 'lg';
  step?: number; // Step size in decimal format
  showSlider?: boolean; // Render a range slider below the input
  /**
   * Accessible name for the input when no visible label text is rendered
   * (e.g. label="" in a composite row that draws its own label). Never pass
   * label="" without also passing ariaLabel.
   */
  ariaLabel?: string;
}

export function PercentInput({
  name,
  label,
  value,
  onChange,
  className,
  placeholder = "0.0",
  required = false,
  help,
  error,
  disabled = false,
  min = 0,
  max = 1,
  precision = 1,
  size = 'md',
  step = 0.001,
  testId,
  showSlider = false,
  ariaLabel,
}: PercentInputProps) {
  // Convert decimal to percentage for display
  const percentValue = value * 100;
  const [displayValue, setDisplayValue] = React.useState(
    percentValue > 0 ? percentValue.toFixed(precision) : ''
  );
  const [isFocused, setIsFocused] = React.useState(false);

  // The rendered text is derived instead of synced in an effect
  // (https://react.dev/learn/you-might-not-need-an-effect): while the field
  // is being edited the user's raw text wins; otherwise a positive committed
  // value is authoritative (negative values keep the raw text, matching the
  // long-standing sync behavior). While focused the user's draft text always
  // wins — a committed 0 mid-edit must not wipe the field (typing '0.5'
  // would otherwise lose its leading keystrokes). Unfocused, 0 shows empty.
  const shownValue = isFocused
    ? displayValue
    : value === 0
      ? ''
      : value > 0
        ? (value * 100).toFixed(precision)
        : displayValue;

  const handleFocus = () => {
    setIsFocused(true);
    // Adopt the derived text so edits start from exactly what is shown.
    if (value > 0) {
      setDisplayValue((value * 100).toFixed(precision));
    } else if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Allow digits, one decimal point, and negative sign
    const cleanValue = rawValue.replace(/[^\d.-]/g, '');
    
    // Prevent multiple decimals or negative signs
    const parts = cleanValue.split('.');
    const negativeParts = cleanValue.split('-');
    
    if (parts.length > 2 || negativeParts.length > 2) return;
    
    // Format display value
    let formattedValue = cleanValue;
    if (parts[0] && parts[0] !== '-') {
      // Add commas to integer part if needed (for large percentages)
      const integerPart = parts[0].replace(/-/g, '');
      const isNegative = cleanValue.startsWith('-');
      const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formattedValue = (isNegative ? '-' : '') + formatted;
      if (parts.length > 1) {
        formattedValue += '.' + parts[1];
      }
    }
    
    setDisplayValue(formattedValue);
    
    // Convert percentage back to decimal for onChange
    const numericPercent = parseFloat(cleanValue.replace(/,/g, '')) || 0;
    const decimalValue = numericPercent / 100;
    
    // Validate range
    if (decimalValue >= min && decimalValue <= max) {
      onChange(decimalValue);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter', 'Escape'
    ];
    
    const isDigit = e.key >= '0' && e.key <= '9';
    const isDecimal = e.key === '.';
    const isMinus = e.key === '-' && min < 0; // Allow negative if min allows it
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlKey = e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());
    
    // Handle arrow key incrementing
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const increment = e.key === 'ArrowUp' ? step : -step;
      const newValue = Math.max(min, Math.min(max, value + increment));
      onChange(newValue);
      return;
    }
    
    if (!isDigit && !isDecimal && !isMinus && !isAllowedKey && !isCtrlKey) {
      e.preventDefault();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    
    // Clean paste data
    const cleanPaste = paste.replace(/[^\d.-]/g, '');
    const parts = cleanPaste.split('.');
    
    if (parts.length <= 2) {
      let formattedValue = cleanPaste;
      if (parts[0] && parts[0] !== '-') {
        const integerPart = parts[0].replace(/-/g, '');
        const isNegative = cleanPaste.startsWith('-');
        const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formattedValue = (isNegative ? '-' : '') + formatted;
        if (parts.length > 1) {
          formattedValue += '.' + parts[1];
        }
      }
      
      setDisplayValue(formattedValue);
      
      const numericPercent = parseFloat(cleanPaste.replace(/,/g, '')) || 0;
      const decimalValue = numericPercent / 100;
      
      if (decimalValue >= min && decimalValue <= max) {
        onChange(decimalValue);
      }
    }
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    if (displayValue) {
      const cleanValue = displayValue.replace(/[^\d.-]/g, '');
      const numericPercent = parseFloat(cleanValue) || 0;
      
      if (numericPercent !== 0) {
        setDisplayValue(numericPercent.toFixed(precision));
      } else {
        setDisplayValue('');
      }
    }
  };
  
  const sizeClasses = {
    sm: 'h-8 text-sm pl-3 pr-7',
    md: 'h-10 text-sm pl-3 pr-8',
    lg: 'h-12 text-base pl-3 pr-9'
  };
  
  const suffixPositions = {
    sm: 'right-2.5',
    md: 'right-3',
    lg: 'right-3.5'
  };

  const inputField = (
    <BaseInput
      name={name}
      label={label}
      required={required}
      help={help}
      error={error}
      disabled={disabled}
      className={showSlider ? undefined : className}
      testId={showSlider ? undefined : testId}
      aria-label={ariaLabel}
    >
      <div className="relative w-full">
        <input
          type="text"
          inputMode="decimal"
          value={shownValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min * 100}
          max={max * 100}
          step={step * 100}
          className={cn(
            sizeClasses[size],
            "text-right font-mono tabular-nums",
            "focus:outline-hidden" // BaseInput handles focus styles
          )}
        />
        <span className={cn(
          "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none text-xs z-10",
          suffixPositions[size]
        )}>
          %
        </span>
      </div>
    </BaseInput>
  );

  if (!showSlider) {
    return inputField;
  }

  const handleSliderChange = ([percent]: number[]) => {
    // Round to avoid floating point precision issues (4 decimal places)
    onChange(Math.round(percent * 100) / 10000);
  };

  return (
    <div className={cn('space-y-2', className)} data-testid={testId}>
      {inputField}
      <div className="px-3">
        <Slider
          value={[value * 100]}
          onValueChange={handleSliderChange}
          min={min * 100}
          max={max * 100}
          step={step * 100}
          disabled={disabled}
          className="w-full"
          aria-label={label || ariaLabel || undefined}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatPercent(min)}</span>
          <span className="font-medium">{formatPercent(value)}</span>
          <span>{formatPercent(max)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to format percentage for display
 */
export function formatPercent(decimal: number, precision: number = 1): string {
  return (decimal * 100).toFixed(precision) + '%';
}

/**
 * Helper function to parse percentage string to decimal
 */
export function parsePercent(percentString: string): number {
  const numeric = parseFloat(percentString.replace(/[^\d.-]/g, ''));
  return (numeric || 0) / 100;
}