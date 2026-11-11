/**
 * The retirement form's custom renderers, by renderer id (FieldSpec.renderer,
 * rowAdornment and footer). Slice c1 adds its renderers here; the wizard
 * and the calculator page pick them up through RENDERERS in ./index.ts.
 */

import type { CustomRenderers } from '@/components/fields/types';

export const RETIREMENT_RENDERERS: CustomRenderers = {};

/**
 * Called once while the visitor answers the retirement intake, when the
 * browser is idle (audit H5), so the first run on the calculator does not
 * wait for the worker to start. Slice c1 points it at the retirement worker
 * runner's prewarm(); while it is undefined the intake does nothing.
 */
export const RETIREMENT_INTAKE_PREWARM: (() => void) | undefined = undefined;
