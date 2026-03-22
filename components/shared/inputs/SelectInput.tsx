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
}

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
}: SelectInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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