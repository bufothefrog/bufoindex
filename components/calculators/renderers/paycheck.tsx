/**
 * The paycheck form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer). Slice c3 adds its renderers here; the wizard
 * and the calculator page pick them up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';

export const PAYCHECK_RENDERERS: CustomRenderers = {};
