import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumberInputProps {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  help?: string; // Help text displayed below the input
  min?: number;
  max?: number;
  step?: number;
  suffix?: string; // For units like "years", "%", etc.
  error?: string; // Error message to display
}

export function NumberInput({
  name,
  label,
  value,
  onChange,
  className,
  placeholder,
  required = false,
  help,
  min,
  max,
  step,
  suffix,
  error,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Handle empty string - don't auto-set to min, let user type
    if (rawValue === '') {
      onChange(0);
      return;
    }
    
    const numericValue = parseFloat(rawValue);
    
    // Only update if it's a valid number - don't clamp during typing
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  const handleBlur = () => {
    // Only clamp the value when the user finishes editing (on blur)
    if (typeof min === 'number' && value < min) {
      onChange(min);
    }
    if (typeof max === 'number' && value > max) {
      onChange(max);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, period/decimal
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    // Allow decimal point if step allows decimals
    if (step && step < 1) {
      allowedKeys.push('.', ',');
    }
    
    const isDigit = e.key >= '0' && e.key <= '9';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlKey = e.ctrlKey || e.metaKey;
    
    if (!isDigit && !isAllowedKey && !isCtrlKey) {
      e.preventDefault();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <div className="relative">
        <Input
          id={name}
          name={name}
          type="number"
          value={value || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={cn(
            "font-mono tabular-nums text-right", 
            suffix && "pr-12",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          required={required}
        />
        
        {suffix && (
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      
      {help && !error && (
        <p className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}