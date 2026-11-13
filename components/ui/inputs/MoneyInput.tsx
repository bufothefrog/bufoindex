/**
 * Money Input Component
 * A dollar amount input on the shared BaseInput chrome
 */

import React from 'react';
import { formatCurrency } from '@/lib/format';
import { cn, formatNumberWithCommas } from '@/lib/utils';
import { BaseInput, type InputSize } from './BaseInput';
import { BaseInputProps } from '@/lib/design-system/types';
import { DollarSign } from 'lucide-react';

interface MoneyInputProps extends BaseInputProps {
  /** null renders the field empty (an unanswered intake field). */
  value: number | null;
  onChange: (value: number) => void;
  placeholder?: string;
  /**
   * A number shown as the placeholder, formatted as the field formats its
   * value (the intake's typical value); wins over `placeholder`.
   */
  placeholderValue?: number;
  /** Show a committed 0 as "0" instead of an empty field (the intake). */
  showZero?: boolean;
  /**
   * Called instead of onChange(0) when the visitor empties the field, so the
   * caller can treat it as unanswered again.
   */
  onClear?: () => void;
  allowDecimals?: boolean;
  min?: number;
  max?: number;
  /** xl is the intake wizard's size. */
  size?: InputSize;
  /**
   * Accessible name for the input when no visible label text is rendered
   * (e.g. label="" in a composite row that draws its own label). Never pass
   * label="" without also passing ariaLabel.
   */
  ariaLabel?: string;
}

export function MoneyInput({
  name,
  label,
  value: valueOrNull,
  onChange,
  className,
  placeholder = "0",
  placeholderValue,
  showZero = false,
  onClear,
  required = false,
  help,
  error,
  disabled = false,
  allowDecimals = false,
  min = 0,
  max,
  size = 'md',
  testId,
  ariaLabel,
}: MoneyInputProps) {
  const value = valueOrNull ?? 0;
  // Empty: no value (null), or a 0 the field does not show.
  const isEmpty = valueOrNull === null || (value === 0 && !showZero);
  const format = (n: number) => formatCurrency(n).replace('$', '');
  const [displayValue, setDisplayValue] = React.useState(
    !isEmpty && value >= 0 ? format(value) : ''
  );
  const [isFocused, setIsFocused] = React.useState(false);

  // The rendered text is derived instead of synced in an effect
  // (https://react.dev/learn/you-might-not-need-an-effect): while the field
  // is being edited the user's raw text always wins: a committed 0 mid-edit
  // must not wipe the field (typing '0.5' would otherwise lose keystrokes).
  // Unfocused, the committed value is authoritative and 0 shows empty
  // (or "0" with showZero).
  const shownValue = isFocused
    ? displayValue
    : isEmpty
      ? ''
      : value >= 0
        ? format(value)
        : displayValue;

  const handleFocus = () => {
    setIsFocused(true);
    // Adopt the derived text so edits start from exactly what is shown.
    if (isEmpty) {
      setDisplayValue('');
    } else if (value >= 0) {
      setDisplayValue(format(value));
    }
  };

  /** Commits typed text; an emptied field goes to onClear when there is one. */
  const commit = (text: string, numericValue: number) => {
    if (text === '' && onClear) {
      onClear();
      return;
    }
    if (numericValue >= min && (!max || numericValue <= max)) {
      onChange(numericValue);
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
      commit(cleanValue, Math.round(numericValue * 100)); // Store as cents
    } else {
      // Only allow digits and commas, no decimals
      const digitsOnly = rawValue.replace(/[^\d]/g, '');
      const formatted = formatNumberWithCommas(digitsOnly);
      setDisplayValue(formatted);
      
      commit(digitsOnly, parseInt(digitsOnly) || 0);
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
        
      if (numericValue > 0 || (showZero && cleanValue !== '')) {
        setDisplayValue(format(numericValue));
      } else {
        setDisplayValue('');
      }
    }
  };
  
  const sizeClasses = {
    sm: 'h-8 text-sm pl-7 pr-3',
    md: 'h-10 text-sm pl-8 pr-3',
    lg: 'h-12 text-base pl-9 pr-3',
    xl: 'h-14 text-2xl pl-9 pr-3'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-5 h-5 left-3.5',
    xl: 'w-5 h-5 left-3.5'
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
      size={size}
    >
      <div className="relative w-full">
        <span className={cn(
          "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
          iconSizes[size]
        )}>
          <DollarSign className="w-full h-full" />
        </span>
        <input
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          value={shownValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholderValue === undefined ? placeholder : format(placeholderValue)}
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
