/**
 * Percent Input Component
 * Smart percentage input with automatic formatting and validation
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { BaseInput } from './BaseInput';
import { BaseInputProps } from '@/lib/design-system/types';
import { Percent } from 'lucide-react';

interface PercentInputProps extends BaseInputProps {
  value: number; // 0-1 decimal format (e.g., 0.05 for 5%)
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number; // In decimal format (e.g., 0 for 0%)
  max?: number; // In decimal format (e.g., 1 for 100%)
  precision?: number; // Decimal places to show (default: 1)
  size?: 'sm' | 'md' | 'lg';
  step?: number; // Step size in decimal format
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
}: PercentInputProps) {
  // Convert decimal to percentage for display
  const percentValue = value * 100;
  const [displayValue, setDisplayValue] = React.useState(
    percentValue > 0 ? percentValue.toFixed(precision) : ''
  );
  
  // Sync with external value changes
  React.useEffect(() => {
    const newPercentValue = value * 100;
    if (value === 0 && displayValue !== '') {
      setDisplayValue('');
    } else if (value > 0) {
      const formatted = newPercentValue.toFixed(precision);
      if (displayValue !== formatted && document.activeElement?.getAttribute('name') !== name) {
        setDisplayValue(formatted);
      }
    }
  }, [value, displayValue, name, precision]);
  
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
    sm: 'h-8 text-sm pl-7 pr-7',
    md: 'h-10 text-sm pl-8 pr-8',
    lg: 'h-12 text-base pl-9 pr-9'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  const iconPositions = {
    sm: 'left-2.5',
    md: 'left-3',
    lg: 'left-3.5'
  };
  
  const suffixPositions = {
    sm: 'right-2.5',
    md: 'right-3',
    lg: 'right-3.5'
  };
  
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
        <span className={cn(
          "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
          iconPositions[size]
        )}>
          <Percent className={iconSizes[size]} />
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min * 100}
          max={max * 100}
          step={step * 100}
          className={cn(
            sizeClasses[size],
            "text-center font-mono",
            "focus:outline-none" // BaseInput handles focus styles
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