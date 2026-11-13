/**
 * Number Input Component
 * Number input with grouped display, decimals, prefix and suffix
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { BaseInput, type InputSize } from './BaseInput';
import { fieldMessageIds } from '@/components/ui/FieldMessages';
import { BaseInputProps } from '@/lib/design-system/types';

interface NumberInputProps extends BaseInputProps {
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
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  precision?: number; // Decimal places when allowDecimals is true
  prefix?: string;
  suffix?: string;
  /** xl is the intake wizard's size. */
  size?: InputSize;
  textAlign?: 'left' | 'center' | 'right';
  /** Replaces the visible label as the input's accessible name (start it with the label). */
  ariaLabel?: string;
}

export function NumberInput({
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
  min,
  max,
  step = 1,
  allowDecimals = true,
  precision = 2,
  prefix,
  suffix,
  size = 'md',
  textAlign = 'right',
  testId,
  ariaLabel,
}: NumberInputProps) {
  const value = valueOrNull ?? 0;
  // Empty: no value (null), or a 0 the field does not show.
  const isEmpty = valueOrNull === null || (value === 0 && !showZero);
  const format = (val: number): string => {
    if (val === 0) return showZero ? '0' : '';
    if (allowDecimals) {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
      });
    }
    return val.toLocaleString('en-US');
  };
  
  const parse = (displayVal: string): number => {
    const cleaned = displayVal.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };
  
  const [displayValue, setDisplayValue] = React.useState(
    isEmpty ? '' : format(value)
  );
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Set on focus when the whole formatted text was selected (a keyboard
  // focus, or a select-then-focus fill), so the raw text that replaces it is
  // selected again and typing replaces it instead of appending to it.
  const reselectOnFocus = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!isFocused || !reselectOnFocus.current) return;
    reselectOnFocus.current = false;
    inputRef.current?.select();
  }, [isFocused]);

  // The rendered text is derived instead of synced in an effect
  // (https://react.dev/learn/you-might-not-need-an-effect): while the field
  // is being edited the user's raw text wins; otherwise the committed value
  // is authoritative. A committed value of 0 always shows an empty field.
  // While focused the user's draft text always wins (a committed 0 mid-edit
  // must not wipe the field, e.g. typing '0.5'); unfocused, 0 shows empty.
  // showZero shows a committed 0 as "0".
  const shownValue = isFocused ? displayValue : isEmpty ? '' : format(value);

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

    if (rawValue.trim() === '' && onClear) {
      onClear();
      return;
    }
    
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
    setIsFocused(false);
    // Format the final value
    if (displayValue.trim() !== '') {
      const numericValue = parse(displayValue);
      if (!isNaN(numericValue)) {
        setDisplayValue(format(numericValue));
      } else {
        setDisplayValue(isEmpty ? '' : format(value));
      }
    }
  };
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const { selectionStart, selectionEnd, value: text } = e.currentTarget;
    reselectOnFocus.current = text !== '' && selectionStart === 0 && selectionEnd === text.length;
    setIsFocused(true);
    // Show raw value for easier editing
    if (!isEmpty) {
      setDisplayValue(value.toString());
    } else {
      setDisplayValue('');
    }
  };
  
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
    xl: 'h-14 text-2xl'
  };
  
  const textAlignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };
  
  // Calculate padding based on prefix/suffix
  const large = size === 'lg' || size === 'xl';
  // A word unit (" years", " months") is wider than the fixed right padding,
  // so it sits beside the box instead of on top of the value, and joins the
  // field's accessible description. Symbols ("x", "%") stay inside the box.
  const wordUnit = suffix && /[a-z]{2,}/i.test(suffix) ? suffix.trim() : undefined;
  const inlineSuffix = wordUnit ? undefined : suffix;
  const unitId = `input-${name}-unit`;
  const describedBy = wordUnit
    ? [unitId, fieldMessageIds(`input-${name}`, help, error).describedBy].filter(Boolean).join(' ')
    : undefined;
  const paddingLeft = prefix ? (large ? 'pl-9' : size === 'sm' ? 'pl-7' : 'pl-8') : 'pl-3';
  const paddingRight = inlineSuffix ? (large ? 'pr-9' : size === 'sm' ? 'pr-7' : 'pr-8') : 'pr-3';
  
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
      size={size}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    >
      <div className={cn('relative w-full', wordUnit && 'flex items-center gap-2')}>
        {prefix && (
          <span className={cn(
            "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
            large ? 'left-3 text-base' : size === 'sm' ? 'left-2.5 text-xs' : 'left-3 text-sm'
          )}>
            {prefix}
          </span>
        )}

        <input
          ref={inputRef}
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          value={shownValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholderValue === undefined ? placeholder : format(placeholderValue) || '0'}
          min={min}
          max={max}
          step={step}
          className={cn(
            sizeClasses[size],
            textAlignClasses[textAlign],
            paddingLeft,
            paddingRight,
            wordUnit && "min-w-0 flex-1",
            "font-mono",
            "focus:outline-hidden" // BaseInput handles focus styles
          )}
        />

        {inlineSuffix && (
          <span className={cn(
            "absolute top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10",
            large ? 'right-3 text-base' : size === 'sm' ? 'right-2.5 text-xs' : 'right-3 text-sm'
          )}>
            {inlineSuffix}
          </span>
        )}

        {wordUnit && (
          <span
            id={unitId}
            className={cn(
              "shrink-0 text-muted-foreground",
              large ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm'
            )}
          >
            {wordUnit}
          </span>
        )}
      </div>
    </BaseInput>
  );
}
