/**
 * Field schema types (docs/rebuild-plan.md section 2.4).
 *
 * A FieldSpec describes one input, keyed by its FinancialProfile dot path. A
 * FormSpec is a calculator's input surface: its fields, the topic screens that
 * group them, and the cross-field rules between them. The same FormSpec drives
 * the wizard screen, the calculator section, validation, the collapsed summary
 * and profile completeness.
 *
 * Pure types only: no React, no DOM, no storage.
 */

/** Quick answers / Details worth looking up / Assumptions (design 2.4). */
export type Tier = 'core' | 'details' | 'assumption';

/** Where a screen appears. Screens without a surface appear on both. */
export type Surface = 'both' | 'intake' | 'calculator';

export type FieldKind =
  | 'money'
  | 'number'
  | 'percent'
  | 'slider'
  | 'select'
  | 'choice'
  | 'boolean'
  | 'state'
  | 'text'
  | 'list'
  | 'custom';

/** Reads a value by dot path (numeric segments index into arrays). */
export type Get = (path: string) => unknown;

/** Static copy, or copy computed from the current values. */
export type Text = string | ((get: Get) => string | undefined);

export type FieldOptionValue = string | number | boolean;

export interface FieldOption {
  value: FieldOptionValue;
  label: string;
  description?: string;
}

/** One value written to one path. Writes apply in order. */
export interface Write {
  path: string;
  value: unknown;
}

/** Profile path -> message. The key 'calculation' is reserved for errors with no field. */
export type FieldErrors = Record<string, string>;

export interface NullableSpec {
  /** Describes the derived value shown while the field is null ("Auto: from your profile"). */
  autoLabel: Text;
  /** The value an override starts from when the user switches off auto. */
  overrideDefault: number | ((get: Get) => number);
}

export interface FieldSpec {
  /** Profile path; list row fields are relative to the row ('balance'). */
  path: string;
  kind: FieldKind;
  /** Sentence case, the calculator label. */
  label: string;
  /** Wizard heading when the field is alone on a screen. */
  question?: string;
  help?: Text;
  /** Rendered as a LookupHint ("where to find this"). */
  hint?: Text;
  placeholder?: string;
  unit?: { prefix?: string; suffix?: string };
  options?: readonly FieldOption[] | ((get: Get) => readonly FieldOption[]);
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  slider?: boolean;
  maxLength?: number;
  required?: boolean;
  /** null means "derive from the profile"; a number is an override. */
  nullable?: NullableSpec;
  tier: Tier;
  visibleWhen?: (get: Get) => boolean;
  /** Collapsed one-line summary fragment; null leaves the field out. */
  summary?: (value: unknown, get: Get) => string | null;
  /** Coupled writes (pure). The renderer writes the field itself plus these. */
  onChange?: (value: unknown, get: Get) => Write[];
  // list
  row?: readonly FieldSpec[];
  newRow?: (get: Get) => Record<string, unknown>;
  itemLabel?: (row: Record<string, unknown>, index: number) => string;
  addLabel?: string;
  emptyText?: string;
  minRows?: number;
  maxRows?: number;
  confirmRemove?: (row: Record<string, unknown>, index: number) => string | null;
  /** Cascading removal (accounts -> holdings). */
  removeRow?: (get: Get, index: number) => Write[];
  /** Ids into the CustomRenderers prop. */
  rowAdornment?: string;
  footer?: string;
  renderer?: string;
  /** Sibling paths a custom renderer edits. */
  covers?: readonly string[];
  /** '{i}' is replaced by the row index. */
  testId?: string;
}

export interface ScreenNote {
  text: Text;
  visibleWhen?: (get: Get) => boolean;
  tone?: 'info' | 'caution';
}

export interface ScreenSpec {
  id: string;
  title: string;
  question?: string;
  description?: string;
  tier: Tier;
  surface?: Surface;
  /** Field paths (keys into FormSpec.fields), in display order. */
  fields: readonly string[];
  notes?: readonly ScreenNote[];
  skipLabel?: string;
}

export interface CrossFieldRule {
  lower: string;
  upper: string;
  /** True when lower must be strictly below upper. */
  strict: boolean;
  /** The rule is checked where this path is shown; the error is keyed by it. */
  checkOn: string;
  message: string;
}

export interface FormSpec {
  id: string;
  fields: readonly FieldSpec[];
  screens: readonly ScreenSpec[];
  relations?: readonly CrossFieldRule[];
  /** Derived writes on finish (preset -> months, retirementAge >= age + 1). */
  onSubmit?: (get: Get, provided: ReadonlySet<string>) => Write[];
}
