/**
 * Input Components Index
 * Exports all standardized input components
 */

export { BaseInput, useInputState } from './BaseInput';
export { EnhancedMoneyInput, MoneyInput } from './EnhancedMoneyInput';
export { PercentInput, formatPercent, parsePercent } from './PercentInput';
export { NumberInput, NumberInputPresets } from './NumberInput';

// Re-export existing components for compatibility
export { StateSelector, US_STATES } from '../../shared/inputs/StateSelector';

// Types
export type { BaseInputProps } from '../../../lib/design-system/types';