/**
 * The leverage form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer). Slice c7 adds its renderers here; the wizard
 * and the calculator page pick them up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';
import { leverageLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

export const LEVERAGE_RENDERERS: CustomRenderers = {};

/**
 * Where the leverage intake leads once finished, from the saved profile. Slice
 * c7 switches it to calculatorHref('leverage', { fromProfile: true }) when
 * the calculator reads the profile; the wizard reads it through
 * INTAKE_DESTINATION in ./index.ts.
 */
export const LEVERAGE_INTAKE_DESTINATION: (profile: FinancialProfile) => string = leverageLink;
