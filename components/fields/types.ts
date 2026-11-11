/**
 * Renderer types for the field schema (docs/rebuild-plan.md section 2.10).
 *
 * The components in this folder render a FieldSpec / ScreenSpec / FormSpec
 * from lib/fields against a value reader (`get`) and report edits as Write[]
 * (`onWrite`). They never touch a store: the caller decides where writes go
 * (the profile store in the calculators and the wizard, local state in tests
 * and the demo).
 */

import type { ReactNode } from 'react';
import type { FieldErrors, FieldSpec, Get, Write } from '@/lib/fields/types';

/**
 * 'md' is the calculator size; 'lg' is the guided-intake size (56px
 * controls, Yes/No choice cards for booleans). 'lg' maps onto the
 * primitives' 'xl' size.
 */
export type FieldSize = 'md' | 'lg';

export interface CustomRendererProps {
  spec: FieldSpec;
  get: Get;
  value: unknown;
  onWrite: (writes: Write[]) => void;
  /** The error keyed by the field's own path. */
  error?: string;
  /** Every error the caller holds, for renderers that edit nested rows. */
  errors?: FieldErrors;
  size: FieldSize;
  /** Prefix for element ids, unique per rendered form. */
  idPrefix: string;
  /** Set when the renderer is a list row adornment. */
  rowIndex?: number;
}

/** Renders a 'custom' field, a list row adornment or a list footer. */
export type CustomRenderer = (props: CustomRendererProps) => ReactNode;

/** Keyed by FieldSpec.renderer, rowAdornment or footer (falls back to the path for 'custom'). */
export type CustomRenderers = Readonly<Record<string, CustomRenderer>>;
