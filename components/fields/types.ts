/**
 * Props of the generic field renderers (docs/rebuild-plan.md section 2.10).
 * One component tree renders any FieldSpec, on the calculator page (size
 * 'md') and in the intake wizard (size 'lg').
 *
 * Writes. Every change reaches the caller as one Write[] in one onWrite
 * call: the field's own write first, then the spec's onChange writes. The
 * paths are profile paths (list rows by canonical index), so the profile
 * store's setValues and the wizard's applyWrites both accept them.
 */

import type React from 'react';
import type { FieldErrors, FieldOption, FieldSpec, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';

export type FieldSize = 'md' | 'lg';

export interface CustomRendererProps {
  spec: FieldSpec;
  /** Scoped like the spec's callbacks: a row Get for a list row adornment. */
  get: Get;
  value: unknown;
  /** Paths in the same scope as `get`. */
  onWrite(w: Write[]): void;
  error?: string;
  size: FieldSize;
}
export type CustomRenderer = (p: CustomRendererProps) => React.ReactNode;
export type CustomRenderers = Readonly<Record<string, CustomRenderer>>;

export interface FieldInputProps {
  spec: FieldSpec;
  get: Get;
  onWrite(w: Write[]): void;
  /** The field's own error (errors[spec.path]). */
  error?: string;
  /**
   * All errors in the same scope as `get`. A list field reads its row errors
   * here ('debts.0.balance'); other kinds ignore it.
   */
  errors?: FieldErrors;
  size?: FieldSize;
  /** Visually hide the label of a choice group (the wizard heading asks it). */
  hideLabel?: boolean;
  renderers?: CustomRenderers;
  /** Enter on a choice option selects it and advances (the wizard). */
  onChooseAndAdvance?(v: FieldOption['value']): void;
  /** Prefix of the control's name and id (default 'field'); keeps ids unique per page. */
  idPrefix?: string;
}

export interface FieldSectionProps {
  form: FormSpec;
  screen: ScreenSpec;
  get: Get;
  errors: FieldErrors;
  onWrite(w: Write[]): void;
  renderers?: CustomRenderers;
  /** Show the one-line summary instead of the fields (ignored while a field on it has an error). */
  collapsed?: boolean;
  /**
   * False shows the screen description while collapsed instead of the
   * summary (an unanswered core screen, whose values are only defaults).
   * Default true.
   */
  summarize?: boolean;
  /** Renders the Edit / Show toggle; without it the section has no toggle. */
  onToggle?(): void;
  /** Renders "Restore defaults" on an assumption-tier screen. */
  onRestoreDefaults?(): void;
}

export interface FieldSectionsProps {
  form: FormSpec;
  get: Get;
  errors: FieldErrors;
  onWrite(w: Write[]): void;
  renderers?: CustomRenderers;
  /** The screens shown: the calculator surface ('both' and 'calculator' screens). The default. */
  surface?: 'calculator';
  /**
   * The answered paths (profile.provided). A core screen starts collapsed
   * once every visible field on it is provided; without this set core
   * screens start expanded.
   */
  provided?: ReadonlySet<string> | readonly string[];
  /** Replaces the default rule for whether a screen starts collapsed. */
  initiallyCollapsed?(s: ScreenSpec): boolean;
  onRestoreDefaults?(s: ScreenSpec): void;
  /** Merged onto the wrapper of the cards (a layout, e.g. a row of cards from lg). */
  className?: string;
}

export interface FieldListProps {
  spec: FieldSpec;
  get: Get;
  onWrite(w: Write[]): void;
  /** Errors in the scope of `get`: the list path and the row field paths under it. */
  errors: FieldErrors;
  renderers?: CustomRenderers;
  size?: FieldSize;
  /** Prefix of the row controls' names and ids (default 'field'). */
  idPrefix?: string;
}
