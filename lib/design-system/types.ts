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
