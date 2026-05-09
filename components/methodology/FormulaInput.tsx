/**
 * Formula Input Components
 * Specialized input components for formula variables
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Info, DollarSign, Percent, Calendar } from 'lucide-react';
import { FormulaVariable } from '@/lib/formulas/types';

export interface FormulaInputProps {
  variable: string;
  config: FormulaVariable;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function FormulaInput({
  variable,
  config,
  value,
  onChange,
  error,
  disabled = false,
  className = ''
}: FormulaInputProps) {
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [focused, setFocused] = useState(false);

  // Update display value when prop value changes
  useEffect(() => {
    if (!focused) {
      setDisplayValue(formatDisplayValue(value, config.unit));
    }
  }, [value, config.unit, focused]);

  const handleInputChange = (inputValue: string) => {
    setDisplayValue(inputValue);
    
    // Parse numeric value
    const numericValue = parseNumericValue(inputValue, config.unit);
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    // Show raw numeric value when focused
    setDisplayValue(value.toString());
  };

  const handleBlur = () => {
    setFocused(false);
    // Format display value when blurred
    setDisplayValue(formatDisplayValue(value, config.unit));
  };

  const getInputIcon = () => {
    if (config.unit?.includes('$') || config.unit?.includes('dollar')) {
      return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    }
    if (config.unit?.includes('%') || config.unit?.includes('percent')) {
      return <Percent className="w-4 h-4 text-muted-foreground" />;
    }
    if (config.unit?.includes('year') || config.unit?.includes('month')) {
      return <Calendar className="w-4 h-4 text-muted-foreground" />;
    }
    return null;
  };

  const getStepValue = () => {
    if (config.unit?.includes('%') || config.unit?.includes('percent')) {
      return '0.01';
    }
    if (config.unit?.includes('$') || config.unit?.includes('dollar')) {
      return '0.01';
    }
    return 'any';
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-medium">
          <code className="bg-muted px-1 rounded font-mono text-xs">
            {variable}
          </code>
          <span>{config.description}</span>
          {config.unit && (
            <span className="text-muted-foreground text-xs">({config.unit})</span>
          )}
        </label>
        
        {/* Help tooltip */}
        {config.constraints && (
          <div className="group relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-foreground text-background text-xs rounded shadow-lg z-10">
              {config.constraints}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        {getInputIcon() && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {getInputIcon()}
          </div>
        )}
        
        <input
          type="number"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          step={getStepValue()}
          className={`
            w-full px-3 py-2 border rounded-md transition-colors
            ${getInputIcon() ? 'pl-10' : ''}
            ${error 
              ? 'border-destructive focus:ring-destructive focus:border-destructive' 
              : 'border-input focus:ring-ring focus:border-ring'
            }
            ${disabled 
              ? 'bg-muted cursor-not-allowed' 
              : 'bg-background focus:outline-hidden focus:ring-2'
            }
          `}
          placeholder={`Enter ${config.description.toLowerCase()}`}
        />
        
        {error && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </p>
      )}

      {/* Help text */}
      {config.constraints && !error && (
        <p className="text-xs text-muted-foreground">{config.constraints}</p>
      )}
    </div>
  );
}

/**
 * Range input for bounded variables
 */
export interface FormulaRangeInputProps extends Omit<FormulaInputProps, 'onChange'> {
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  showValue?: boolean;
}

export function FormulaRangeInput({
  variable,
  config,
  value,
  min,
  max,
  step = 1,
  onChange,
  error,
  disabled = false,
  showValue = true,
  className = ''
}: FormulaRangeInputProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-medium">
          <code className="bg-muted px-1 rounded font-mono text-xs">
            {variable}
          </code>
          <span>{config.description}</span>
          {config.unit && (
            <span className="text-muted-foreground text-xs">({config.unit})</span>
          )}
        </label>
        
        {showValue && (
          <span className="text-sm font-medium">
            {formatDisplayValue(value, config.unit)}
          </span>
        )}
      </div>

      {/* Range Input */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={`
            w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'bg-destructive/30' : ''}
          `}
        />
        
        {/* Range indicators */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatDisplayValue(min, config.unit)}</span>
          <span>{formatDisplayValue(max, config.unit)}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Select input for categorical variables
 */
export interface FormulaSelectInputProps extends Omit<FormulaInputProps, 'value' | 'onChange'> {
  value: string;
  options: Array<{ value: string; label: string; numericValue: number }>;
  onChange: (value: string, numericValue: number) => void;
}

export function FormulaSelectInput({
  variable,
  config,
  value,
  options,
  onChange,
  error,
  disabled = false,
  className = ''
}: FormulaSelectInputProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      <label className="flex items-center space-x-2 text-sm font-medium">
        <code className="bg-muted px-1 rounded font-mono text-xs">
          {variable}
        </code>
        <span>{config.description}</span>
        {config.unit && (
          <span className="text-muted-foreground text-xs">({config.unit})</span>
        )}
      </label>

      {/* Select */}
      <select
        value={value}
        onChange={(e) => {
          const selectedOption = options.find(opt => opt.value === e.target.value);
          if (selectedOption) {
            onChange(selectedOption.value, selectedOption.numericValue);
          }
        }}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-md transition-colors
          ${error 
            ? 'border-destructive focus:ring-destructive focus:border-destructive' 
            : 'border-input focus:ring-ring focus:border-ring'
          }
          ${disabled 
            ? 'bg-muted cursor-not-allowed' 
            : 'bg-background focus:outline-hidden focus:ring-2'
          }
        `}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Utility functions
 */

function formatDisplayValue(value: number, unit?: string): string {
  if (isNaN(value)) return '';
  
  if (unit?.includes('$') || unit?.includes('dollar')) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
  
  if (unit?.includes('%') || unit?.includes('percent')) {
    return `${(value * 100).toFixed(2)}%`;
  }
  
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  return value.toFixed(2);
}

function parseNumericValue(displayValue: string, unit?: string): number {
  // Remove formatting
  const cleanValue = displayValue.replace(/[$,%\s]/g, '');
  
  const numValue = parseFloat(cleanValue);
  
  if (unit?.includes('%') || unit?.includes('percent')) {
    return numValue / 100; // Convert percentage to decimal
  }
  
  return numValue;
}