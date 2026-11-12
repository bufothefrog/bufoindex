/**
 * Design System Type Definitions
 */

/**
 * Base props for all input components
 */
export interface BaseInputProps {
  name: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Size variants for components
 */
export type ComponentSize = 'sm' | 'md' | 'lg';

/**
 * Color variants for components
 */
export type ComponentColor = 'sage' | 'success' | 'warning' | 'error' | 'info';

/**
 * Card variants
 */
export type CardVariant = 'default' | 'gradient' | 'bordered' | 'elevated';

/**
 * Component state types
 */
export interface ComponentState {
  isValid: boolean;
  error?: string;
  isDirty: boolean;
  isTouched: boolean;
}

/**
 * Accessibility props
 */
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  role?: string;
}
