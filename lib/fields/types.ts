/**
 * Field schema types. A FieldSpec describes one profile field (keyed by its
 * profile path); a FormSpec groups fields into topic screens. The same spec
 * drives the wizard, the calculator sections, validation, the collapsed
 * summaries and profile completeness. See docs/rebuild-plan.md section 2.4.
 *
 * The runtime that interprets these types lives in paths.ts, runtime.ts and
 * binding.ts; edge semantics are documented there.
 */

/** design 2.4: Quick answers / Details worth looking up / Assumptions */
export type Tier = 'core' | 'details' | 'assumption';
/** Where a screen appears (default 'both'). */
export type Surface = 'both' | 'intake' | 'calculator';
export type FieldKind = 'money' | 'number' | 'percent' | 'slider' | 'select' | 'choice' | 'boolean'
  | 'state' | 'text' | 'list' | 'custom';
export type Get = (path: string) => unknown;
export type Text = string | ((get: Get) => string | undefined);
export interface FieldOption { value: string | number | boolean; label: string; description?: string }
export interface Write { path: string; value: unknown }
/** Profile path -> message; the key 'calculation' is reserved for errors with no field. */
export type FieldErrors = Record<string, string>;

export interface FieldSpec {
  /** Profile path; list row fields are relative to the row ('balance'). */
  path: string;
  kind: FieldKind;
  /** Sentence case, the calculator label. */
  label: string;
  /** Wizard heading when the field is alone on a screen. */
  question?: string;
  /** hint renders as LookupHint ("where to find this"). */
  help?: Text; hint?: Text;
  placeholder?: string; unit?: { prefix?: string; suffix?: string };
  options?: readonly FieldOption[] | ((get: Get) => readonly FieldOption[]);
  min?: number; max?: number; step?: number; precision?: number; slider?: boolean; maxLength?: number;
  required?: boolean;
  /** null = derive from the profile; overrideDefault seeds the override. */
  nullable?: { autoLabel: Text; overrideDefault: number | ((get: Get) => number) };
  tier: Tier;
  visibleWhen?: (get: Get) => boolean;
  /** Collapsed one-line summary fragment. */
  summary?: (value: unknown, get: Get) => string | null;
  /**
   * Coupled writes (pure). `get` already sees the new value; `before`, when
   * given, sees the values as they were before this change.
   */
  onChange?: (value: unknown, get: Get, before?: Get) => Write[];
  // list
  row?: readonly FieldSpec[]; newRow?: (get: Get) => Record<string, unknown>;
  itemLabel?: (row: Record<string, unknown>, index: number) => string;
  addLabel?: string; emptyText?: string; minRows?: number; maxRows?: number;
  confirmRemove?: (row: Record<string, unknown>, index: number) => string | null;
  /** Accessible name of a row's remove button (default "Remove <itemLabel>"). */
  removeLabel?: (row: Record<string, unknown>, index: number) => string;
  /** Cascading removal (accounts -> holdings). */
  removeRow?: (get: Get, index: number) => Write[];
  /** Ids into the CustomRenderers prop. */
  rowAdornment?: string; footer?: string; renderer?: string;
  /** Sibling paths a custom renderer edits. */
  covers?: readonly string[];
  /** '{i}' is replaced by the row index. */
  testId?: string;
}
export interface ScreenNote { text: Text; visibleWhen?: (get: Get) => boolean; tone?: 'info' | 'caution' }
export interface ScreenSpec {
  id: string; title: string; question?: string; description?: string;
  tier: Tier; surface?: Surface; fields: readonly string[]; notes?: readonly ScreenNote[];
}
export interface CrossFieldRule { lower: string; upper: string; strict: boolean; checkOn: string; message: string }
export interface FormSpec {
  id: string;
  fields: readonly FieldSpec[];
  screens: readonly ScreenSpec[];
  relations?: readonly CrossFieldRule[];
  /** Derived writes (preset -> months, retirementAge >= age + 1). */
  onSubmit?: (get: Get, provided: ReadonlySet<string>) => Write[];
}
