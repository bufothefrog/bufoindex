/**
 * Input Components Index
 * Exports all standardized input components
 */

export { BaseInput, useInputState } from './BaseInput';
export { EnhancedMoneyInput, MoneyInput } from './EnhancedMoneyInput';
export { PercentInput, parsePercent } from './PercentInput';
export type { InputSize } from './BaseInput';
export { SliderField } from './SliderField';
export type { SliderFieldProps } from './SliderField';
export { NumberInput, NumberInputPresets } from './NumberInput';

// Re-export existing components for compatibility
export { StateSelector, US_STATES } from '../../shared/inputs/StateSelector';

// Types
export type { BaseInputProps } from '../../../lib/design-system/types';