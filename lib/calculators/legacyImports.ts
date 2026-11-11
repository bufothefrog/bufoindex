/**
 * The old localStorage keys the one-time import reads (O7), in the order
 * importLegacyStorage handles them: the paycheck allocator first (its pay is
 * the complete record: gross, take-home and frequency), then the retirement
 * calculator. Every calculator page runs the import with this list
 * (useCalculatorBootstrap), so the result does not depend on which page a
 * returning visitor opens first. Only each calculator's legacy.ts and
 * bindings.ts are imported, not its definition or form.
 */

import type { PaycheckProfile } from '@/lib/types';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import type { LegacyImport } from './types';
import { PAYCHECK_BINDINGS } from './paycheck/bindings';
import { PAYCHECK_LEGACY } from './paycheck/legacy';
import { RETIREMENT_BINDINGS } from './retirement/bindings';
import { RETIREMENT_LEGACY } from './retirement/legacy';

export const LEGACY_IMPORTS: readonly [LegacyImport<PaycheckProfile>, LegacyImport<RetirementInputs>] = [
  { legacy: PAYCHECK_LEGACY, bindings: PAYCHECK_BINDINGS },
  { legacy: RETIREMENT_LEGACY, bindings: RETIREMENT_BINDINGS },
];
