/**
 * The portfolio form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer). Slice c5 adds its renderers here; the wizard
 * and the calculator page pick them up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';
import { portfolioLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

export const PORTFOLIO_RENDERERS: CustomRenderers = {};

/**
 * Where the portfolio intake leads once finished, from the saved profile. Slice
 * c5 switches it to calculatorHref('portfolio', { fromProfile: true }) when
 * the calculator reads the profile; the wizard reads it through
 * INTAKE_DESTINATION in ./index.ts.
 */
export const PORTFOLIO_INTAKE_DESTINATION: (profile: FinancialProfile) => string = portfolioLink;
