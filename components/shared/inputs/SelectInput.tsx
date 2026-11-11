import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectInputProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  required?: boolean;
  help?: string;
  error?: string;
  disabled?: boolean;
  /**
   * Accessible name for the select when no visible label text is rendered
   * (e.g. label="" in a composite row that draws its own label).
   */
  ariaLabel?: string;
  /** md: 40px; lg: 48px with base text (calculator); xl: 56px with a larger label (guided intake). */
  size?: SelectInputSize;
}

export type SelectInputSize = 'md' | 'lg' | 'xl';

const SELECT_SIZE_CLASSES: Record<SelectInputSize, string> = {
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
  xl: 'h-14 text-lg',
};

export function SelectInput({
  name,
  label,
  value,
  onChange,
  options,
  className,
  placeholder,
  required = false,
  help,
  error,
  disabled = false,
  ariaLabel,
  size = 'md',
}: SelectInputProps) {
  const helpId = help && !error ? `${name}-help` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={name} className={cn(size === 'xl' ? "text-base" : "text-sm", "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background",
            SELECT_SIZE_CLASSES[size],
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:border-ring/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            "appearance-none pr-10", // Remove default arrow, add padding for custom arrow
            error && "border-destructive focus-visible:ring-destructive"
          )}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
      
      {help && !error && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}