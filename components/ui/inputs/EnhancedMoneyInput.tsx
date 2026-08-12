/**
 * Enhanced Money Input Component
 * Based on PaycheckAllocator's MoneyInput with design system integration
 */

import React from 'react';
import { cn, formatCurrency, formatNumberWithCommas } from '@/lib/utils';
import { BaseInput } from './BaseInput';
import { BaseInputProps } from '@/lib/design-system/types';
import { DollarSign } from 'lucide-react';

interface EnhancedMoneyInputProps extends BaseInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  allowDecimals?: boolean;
  currency?: string;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Accessible name for the input when no visible label text is rendered
   * (e.g. label="" in a composite row that draws its own label). Never pass
   * label="" without also passing ariaLabel.
   */
  ariaLabel?: string;
}

export function EnhancedMoneyInput({
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
  allowDecimals = false,
  currency = '$',
  min = 0,
  max,
  size = 'md',
  testId,
  ariaLabel,
}: EnhancedMoneyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value > 0 ? formatCurrency(value).replace('$', '') : ''
  );
  const [isFocused, setIsFocused] = React.useState(false);

  // The rendered text is derived instead of synced in an effect
  // (https://react.dev/learn/you-might-not-need-an-effect): while the field
  // is being edited the user's raw text always wins — a committed 0 mid-edit
  // must not wipe the field (typing '0.5' would otherwise lose keystrokes).
  // Unfocused, the committed value is authoritative and 0 shows empty.
  const shownValue = isFocused
    ? displayValue
    : value === 0
      ? ''
      : value > 0
        ? formatCurrency(value).replace('$', '')
        : displayValue;

  const handleFocus = () => {
    setIsFocused(true);
    // Adopt the derived text so edits start from exactly what is shown.
    if (value > 0) {
      setDisplayValue(formatCurrency(value).replace('$', ''));
    } else if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    if (allowDecimals) {
      // Allow digits, one decimal point, and commas
      const cleanValue = rawValue.replace(/[^\d.,]/g, '');
      const parts = cleanValue.split('.');
      
      if (parts.length > 2) return; // Prevent multiple decimals
      
      let formattedValue = cleanValue;
      if (parts[0]) {
        parts[0] = formatNumberWithCommas(parts[0].replace(/,/g, ''));
        formattedValue = parts.join('.');
      }
      
      setDisplayValue(formattedValue);
      
      const numericValue = parseFloat(cleanValue.replace(/,/g, '')) || 0;
      if (numericValue >= min && (!max || numericValue <= max)) {
        onChange(Math.round(numericValue * 100)); // Store as cents
      }
    } else {
      // Only allow digits and commas, no decimals
      const digitsOnly = rawValue.replace(/[^\d]/g, '');
      const formatted = formatNumberWithCommas(digitsOnly);
      setDisplayValue(formatted);
      
      const numericValue = parseInt(digitsOnly) || 0;
      if (numericValue >= min && (!max || numericValue <= max)) {
        onChange(numericValue);
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter', 'Escape'
    ];
    
    const isDigit = e.key >= '0' && e.key <= '9';
    const isDecimal = allowDecimals && e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlKey = e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());
    
    if (!isDigit && !isDecimal && !isAllowedKey && !isCtrlKey) {
      e.preventDefault();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    
    if (allowDecimals) {
      const cleanPaste = paste.replace(/[^\d.]/g, '');
      const parts = cleanPaste.split('.');
      if (parts.length <= 2) {
        const formatted = parts[0] ? formatNumberWithCommas(parts[0]) : '';
        const fullValue = parts.length > 1 ? `${formatted}.${parts[1]}` : formatted;
        setDisplayValue(fullValue);
        
        const numericValue = parseFloat(cleanPaste) || 0;
        if (numericValue >= min && (!max || numericValue <= max)) {
          onChange(Math.round(numericValue * 100));
        }
      }
    } else {
      const digitsOnly = paste.replace(/[^\d]/g, '');
      if (digitsOnly) {
        const formatted = formatNumberWithCommas(digitsOnly);
        setDisplayValue(formatted);
        const numericValue = parseInt(digitsOnly) || 0;
        if (numericValue >= min && (!max || numericValue <= max)) {
          onChange(numericValue);
        }
      }
    }
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    if (displayValue) {
      const cleanValue = displayValue.replace(/[^\d.]/g, '');
      const numericValue = allowDecimals 
        ? parseFloat(cleanValue) || 0 
        : parseInt(cleanValue.replace(/\./g, '')) || 0;
        
      if (numericValue > 0) {
        setDisplayValue(formatCurrency(numericValue).replace('$', ''));
      } else {
        setDisplayValue('');
      }
    }
  };
  
  const sizeClasses = {
    sm: 'h-8 text-sm pl-7 pr-3',
    md: 'h-10 text-sm pl-8 pr-3',
    lg: 'h-12 text-base pl-9 pr-3'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-5 h-5 left-3.5'
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
      aria-label={ariaLabel}
    >
      <div className="relative w-full">
        <span className={cn(
          "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
          iconSizes[size]
        )}>
          {currency === '$' ? <DollarSign className="w-full h-full" /> : currency}
        </span>
        <input
          type="text"
          value={shownValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            sizeClasses[size],
            "text-right font-mono tabular-nums",
            "focus:outline-hidden" // Remove default focus styles since BaseInput handles them
          )}
        />
      </div>
    </BaseInput>
  );
}

export { EnhancedMoneyInput as MoneyInput };