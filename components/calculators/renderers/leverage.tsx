/**
 * The leverage form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer): only the shared account list (./accounts.tsx);
 * every other leverage field renders with a generic renderer. The wizard and
 * the calculator page pick it up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';
import { calculatorHref } from '@/lib/calculators/registry';
import type { FinancialProfile } from '@/lib/profile/types';
import { ACCOUNTS_RENDERERS } from './accounts';

export const LEVERAGE_RENDERERS: CustomRenderers = { ...ACCOUNTS_RENDERERS };

/**
 * Where the leverage intake leads once finished: the comparison, which reads
 * the saved profile itself, so the link carries only the handoff marker. The
 * wizard reads it through INTAKE_DESTINATION in ./index.ts.
 */
export const LEVERAGE_INTAKE_DESTINATION: (profile: FinancialProfile) => string = () =>
  calculatorHref('leverage', { fromProfile: true });
