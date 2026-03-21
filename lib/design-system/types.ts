/**
 * Design System Type Definitions
 */

import { ColorVariant, ColorShade } from './colors';

// Re-export color types
export type { ColorVariant, ColorShade };

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
 * Input formatting options
 */
export interface FormatOptions {
  allowDecimals?: boolean;
  precision?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * URL state persistence
 */
export interface URLSerializableInputs {
  calculator: 'paycheck' | 'retirement';
  inputs: Record<string, unknown>;
  version: number;
  timestamp?: number;
}

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

/**
 * Common component props
 */
export interface CommonProps {
  className?: string;
  testId?: string;
  children?: React.ReactNode;
}

/**
 * Loading state props
 */
export interface LoadingProps {
  isLoading?: boolean;
  loadingText?: string;
}