/**
 * BufoIndex Design System
 * Main exports for the unified design system
 */

// Colors and theming
export { 
  BufoColors,
  TailwindColors,
  BufoSpacing,
  getColor 
} from './colors';

// Types
export type { 
  ColorVariant,
  ColorShade,
  BaseInputProps,
  ComponentSize,
  ComponentColor,
  CardVariant,
  FormatOptions,
  URLSerializableInputs,
  ComponentState,
  AccessibilityProps,
  CommonProps,
  LoadingProps 
} from './types';

// URL State Management
export {
  detectCalculatorType,
  sanitizeInputsOnly,
  serializeInputsToURL,
  deserializeInputsFromURL,
  updateURLWithInputs,
  loadInputsFromURL,
  clearURLState,
  migrateInputsToCurrentVersion,
  generateShareableURL,
  isValidURLState
} from '../state/url-persistence';

// Input Components
export {
  BaseInput,
  useInputState,
  MoneyInput,
  EnhancedMoneyInput,
  PercentInput,
  NumberInput,
  NumberInputPresets,
  formatPercent,
  parsePercent
} from '../../components/ui/inputs';

// Card Components
export {
  BaseCard,
  InputCard,
  ResultCard,
  SummaryCard
} from '../../components/ui/cards';

// Layout Components
export {
  ResponsiveGrid,
  InputSection,
  ResultSection,
  EmptyStateSection,
  FlexibleGrid,
  Container,
  CalculatorLayout,
  CalculatorHeader,
  CalculateButton,
  DisclaimerFooter,
  SimpleCalculatorLayout,
  AdvancedCalculatorLayout,
  ComparisonCalculatorLayout
} from '../../components/ui/layouts';