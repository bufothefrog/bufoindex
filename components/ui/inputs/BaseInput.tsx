/**
 * Base Input Component
 * Provides common input functionality and accessibility features
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { FieldMessages, fieldMessageIds } from '@/components/ui/FieldMessages';
import { BaseInputProps, AccessibilityProps } from '@/lib/design-system/types';

/**
 * Input sizes shared by the input primitives. sm, md and lg size the control
 * only; xl is the intake wizard's size (a 56px control with large text and a
 * larger label).
 */
export type InputSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BaseInputConfig extends BaseInputProps, AccessibilityProps {
  children: React.ReactNode;
  /** Only xl changes the chrome: the label grows to text-base. */
  size?: InputSize;
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
  size = 'md',
  ...ariaProps
}: BaseInputConfig) {
  const inputId = `input-${name}`;
  const hasError = !!error;
  const errorMessage = error || undefined;
  const { describedBy } = fieldMessageIds(inputId, help, errorMessage);
  
  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      {/* Label */}
      <label 
        htmlFor={inputId}
        className={cn(
          // Size first: tailwind-merge drops leading-none when a text-* class follows it.
          size === 'xl' ? "text-base" : "text-sm",
          "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          hasError && "text-destructive"
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      {/* Input Container */}
      <div className="relative">
        {(() => {
          const wrapper = children as React.ReactElement<{ children?: React.ReactNode }>;
          return React.cloneElement(wrapper, {
            children: React.Children.map(wrapper.props.children, (child) => {
              if (React.isValidElement(child) && child.type === 'input') {
                const input = child as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
                return React.cloneElement(input, {
                  id: inputId,
                  name,
                  disabled,
                  required,
                  'aria-describedby': describedBy,
                  'aria-invalid': hasError,
                  className: cn(
                    "w-full border bg-background rounded-md text-sm transition-colors",
                    "focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring",
                    hasError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-input hover:border-ring/50",
                    disabled && "opacity-50 cursor-not-allowed",
                    input.props.className
                  ),
                  ...ariaProps
                });
              }
              return child;
            })
          });
        })()}
      </div>
      
      <FieldMessages id={inputId} help={help} error={errorMessage} />
    </div>
  );
}
