/**
 * The retirement form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer), and its intake hooks. The retirement form needs
 * no custom renderer: every field is a generic kind. The wizard and the
 * calculator page pick these up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';
import { calculatorHref } from '@/lib/calculators/registry';
import type { FinancialProfile } from '@/lib/profile/types';
import { retirementRunner } from '@/lib/store/retirementStore';

export const RETIREMENT_RENDERERS: CustomRenderers = {};

/**
 * Called once while the visitor answers the retirement intake, when the
 * browser is idle (audit H5): starts the retirement worker, so the first run
 * on the calculator does not wait for it to load.
 */
export const RETIREMENT_INTAKE_PREWARM = (): void => retirementRunner.prewarm();

/** Where the retirement intake leads once finished: the calculator, which reads the saved profile. */
export const RETIREMENT_INTAKE_DESTINATION: (profile: FinancialProfile) => string = () =>
  calculatorHref('retirement', { fromProfile: true });
