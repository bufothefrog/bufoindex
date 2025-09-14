/**
 * Base Input Component
 * Provides common input functionality and accessibility features
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { BaseInputProps, ComponentState, AccessibilityProps } from '@/lib/design-system/types';

export interface BaseInputConfig extends BaseInputProps, AccessibilityProps {
  children: React.ReactNode;
  state?: ComponentState;
}

export function BaseInput({
  name,
  label,
  required = false,
  help,
  error,
  disabled = false,
  className,
  testId,
  children,
  state,
  ...ariaProps
}: BaseInputConfig) {
  const inputId = `input-${name}`;
  const helpId = help ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  
  const hasError = !!(error || (state && !state.isValid && state.error));
  const errorMessage = error || (state?.error);
  
  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      {/* Label */}
      <label 
        htmlFor={inputId}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          hasError && "text-red-600"
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Input Container */}
      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          id: inputId,
          name,
          disabled,
          required,
          'aria-describedby': [helpId, errorId].filter(Boolean).join(' ') || undefined,
          'aria-invalid': hasError,
          className: cn(
            "w-full border bg-background rounded-md text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-sage-400",
            hasError 
              ? "border-red-300 focus:border-red-500 focus:ring-red-200" 
              : "border-input hover:border-sage-300",
            disabled && "opacity-50 cursor-not-allowed",
            (children as React.ReactElement).props.className
          ),
          ...ariaProps
        })}
      </div>
      
      {/* Help Text */}
      {help && !hasError && (
        <p 
          id={helpId}
          className="text-xs text-gray-500"
        >
          {help}
        </p>
      )}
      
      {/* Error Message */}
      {hasError && errorMessage && (
        <p 
          id={errorId}
          className="text-xs text-red-600 flex items-start space-x-1"
          role="alert"
        >
          <span className="text-red-500 font-bold">⚠</span>
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Hook for managing input component state
 */
export function useInputState<T = string>(initialValue: T) {
  const [value, setValue] = React.useState(initialValue);
  const [state, setState] = React.useState<ComponentState>({
    isValid: true,
    isDirty: false,
    isTouched: false
  });
  
  const updateValue = React.useCallback((newValue: T) => {
    setValue(newValue);
    setState(prev => ({
      ...prev,
      isDirty: newValue !== initialValue,
      isValid: true, // Reset validation on change
      error: undefined
    }));
  }, [initialValue]);
  
  const setError = React.useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      isValid: false,
      error
    }));
  }, []);
  
  const setTouched = React.useCallback(() => {
    setState(prev => ({
      ...prev,
      isTouched: true
    }));
  }, []);
  
  return {
    value,
    state,
    updateValue,
    setError,
    setTouched,
    reset: () => {
      setValue(initialValue);
      setState({
        isValid: true,
        isDirty: false,
        isTouched: false
      });
    }
  };
}