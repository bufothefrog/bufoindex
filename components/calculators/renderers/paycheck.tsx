/**
 * The paycheck form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer). Slice c3 adds its renderers here; the wizard
 * and the calculator page pick them up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';
import { paycheckLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

export const PAYCHECK_RENDERERS: CustomRenderers = {};

/**
 * Where the paycheck intake leads once finished, from the saved profile. Slice
 * c3 switches it to calculatorHref('paycheck', { fromProfile: true }) when
 * the calculator reads the profile; the wizard reads it through
 * INTAKE_DESTINATION in ./index.ts.
 */
export const PAYCHECK_INTAKE_DESTINATION: (profile: FinancialProfile) => string = paycheckLink;
