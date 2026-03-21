import React from 'react';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency, formatNumberWithCommas } from '@/lib/utils';

interface MoneyInputProps {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  recordable?: boolean; // Future data recording capability
  help?: string; // Help text displayed below the input
}

export function MoneyInput({
  name,
  label,
  value,
  onChange,
  className,
  placeholder = "$0",
  required = false,
  recordable = false,
  help,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(
    value > 0 ? formatCurrency(value).replace('$', '') : ''
  );
  
  React.useEffect(() => {
    if (value === 0 && displayValue !== '') {
      setDisplayValue('');
    } else if (value > 0) {
      const formatted = formatCurrency(value).replace('$', '');
      if (displayValue !== formatted && document.activeElement?.getAttribute('name') !== name) {
        setDisplayValue(formatted);
      }
    }
  }, [value, displayValue, name]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    
    // Only allow digits and commas, no decimals
    const digitsOnly = rawValue.replace(/[^\d]/g, '');
    
    // Format with commas as user types
    const formatted = formatNumberWithCommas(digitsOnly);
    setDisplayValue(formatted);
    
    // Parse and update the actual value
    const numericValue = parseInt(digitsOnly) || 0;
    onChange(numericValue);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent decimal point and other non-digit keys (except backspace, delete, arrow keys, etc.)
    const allowedKeys = [
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'Tab', 'Enter', 'Escape'
    ];
    
    const isDigit = e.key >= '0' && e.key <= '9';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlA = e.ctrlKey && e.key === 'a';
    const isCtrlC = e.ctrlKey && e.key === 'c';
    const isCtrlV = e.ctrlKey && e.key === 'v';
    const isCtrlX = e.ctrlKey && e.key === 'x';
    
    if (!isDigit && !isAllowedKey && !isCtrlA && !isCtrlC && !isCtrlV && !isCtrlX) {
      e.preventDefault();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    const digitsOnly = paste.replace(/[^\d]/g, '');
    
    if (digitsOnly) {
      const formatted = formatNumberWithCommas(digitsOnly);
      setDisplayValue(formatted);
      const numericValue = parseInt(digitsOnly) || 0;
      onChange(numericValue);
    }
  };
  
  const handleBlur = () => {
    // Ensure proper formatting on blur
    if (displayValue) {
      const digitsOnly = displayValue.replace(/[^\d]/g, '');
      const numericValue = parseInt(digitsOnly) || 0;
      if (numericValue > 0) {
        setDisplayValue(formatCurrency(numericValue).replace('$', ''));
      } else {
        setDisplayValue('');
      }
    }
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id={name}
          name={name}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={placeholder.replace('$', '')}
          className={cn("pl-8 text-right font-mono tabular-nums", className)}
          required={required}
        />
      </div>
      {help && (
        <p className="text-xs text-gray-500 mt-1">
          {help}
        </p>
      )}
    </div>
  );
}