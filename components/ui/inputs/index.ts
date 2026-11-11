/**
 * Input Components Index
 * Exports all standardized input components
 */

export { BaseInput, useInputState } from './BaseInput';
export type { InputSize } from './BaseInput';
export { EnhancedMoneyInput, MoneyInput } from './EnhancedMoneyInput';
// PercentInput's own formatPercent is not re-exported: it collides with the
// site-wide formatPercent in lib/format.
export { PercentInput, parsePercent } from './PercentInput';
export { NumberInput, NumberInputPresets } from './NumberInput';
export { SliderField } from './SliderField';
export type { SliderFieldProps } from './SliderField';

// Re-export existing components for compatibility
export { StateSelector, US_STATES } from '../../shared/inputs/StateSelector';

// Types
export type { BaseInputProps } from '../../../lib/design-system/types';