/**
 * BufoIndex Design System Colors
 * Standardized color palette using RetirementCalculator's lighter sage tones
 */

export const BufoColors = {
  // Primary Sage (using RetirementCalculator lighter tones)
  sage: {
    50: '#f8faf9',
    100: '#f0f4f1', 
    200: '#d9e5dc',
    300: '#b8d0be',
    400: '#9ca3af', // RetirementCalculator primary
    500: '#6b7280', // RetirementCalculator secondary  
    600: '#4b5563', // Darker for emphasis
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },
  
  // Status colors
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b'
  },
  
  warning: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12'
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },
  
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  
  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  }
} as const;

export type ColorVariant = keyof typeof BufoColors;
export type ColorShade = keyof (typeof BufoColors)['sage'];

/**
 * Get a color value from the design system
 */
export function getColor(variant: ColorVariant, shade: ColorShade): string {
  return BufoColors[variant][shade];
}

/**
 * Tailwind class names for design system colors
 */
export const TailwindColors = {
  sage: {
    bg: {
      50: 'bg-sage-50',
      100: 'bg-sage-100',
      200: 'bg-sage-200',
      300: 'bg-sage-300',
      400: 'bg-sage-400',
      500: 'bg-sage-500',
      600: 'bg-sage-600',
      700: 'bg-sage-700',
      800: 'bg-sage-800',
      900: 'bg-sage-900'
    },
    text: {
      50: 'text-sage-50',
      100: 'text-sage-100',
      200: 'text-sage-200',
      300: 'text-sage-300',
      400: 'text-sage-400',
      500: 'text-sage-500',
      600: 'text-sage-600',
      700: 'text-sage-700',
      800: 'text-sage-800',
      900: 'text-sage-900'
    },
    border: {
      50: 'border-sage-50',
      100: 'border-sage-100',
      200: 'border-sage-200',
      300: 'border-sage-300',
      400: 'border-sage-400',
      500: 'border-sage-500',
      600: 'border-sage-600',
      700: 'border-sage-700',
      800: 'border-sage-800',
      900: 'border-sage-900'
    }
  }
} as const;

/**
 * Design system spacing and sizing
 */
export const BufoSpacing = {
  // Input heights
  input: {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  },
  
  // Button sizes
  button: {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-lg'
  },
  
  // Card padding
  card: {
    header: 'p-6 pb-4',
    content: 'p-6 pt-0',
    contentStandalone: 'p-6'
  }
} as const;