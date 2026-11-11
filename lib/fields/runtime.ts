/**
 * Field schema runtime (docs/rebuild-plan.md section 2.4).
 *
 * Pure helpers that run a FormSpec against a value reader: which screens and
 * fields show, which screens still need answers, field validation and
 * cross-field rules, and the one-line summary of a collapsed screen. Errors
 * are keyed by profile path; row fields of a list use the absolute row path
 * ('debts.0.balance').
 */

import { rowFieldPath, rowGet } from './paths';
import type {
  FieldErrors,
  FieldOption,
  FieldSpec,
  FormSpec,
  Get,
  ScreenSpec,
  Text,
  Tier,
} from './types';

/** Error key for problems that belong to no single field. */
export const CALCULATION_ERROR_KEY = 'calculation';

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const FIELD_MAPS = new WeakMap<FormSpec, ReadonlyMap<string, FieldSpec>>();

/**
 * The form's fields keyed by path (cached per form). Throws when two fields
 * share a path or a screen lists a path the form does not define: both are
 * schema bugs that should fail the first test that touches the form.
 */
export function fieldMap(form: FormSpec): ReadonlyMap<string, FieldSpec> {
  const cached = FIELD_MAPS.get(form);
  if (cached) return cached;
  const map = new Map<string, FieldSpec>();
  for (const spec of form.fields) {
    if (map.has(spec.path)) throw new Error(`Form '${form.id}' defines '${spec.path}' twice.`);
    map.set(spec.path, spec);
  }
  for (const screen of form.screens) {
    for (const path of screen.fields) {
      if (!map.has(path)) {
        throw new Error(`Screen '${screen.id}' of form '${form.id}' lists unknown field '${path}'.`);
      }
    }
  }
  FIELD_MAPS.set(form, map);
  return map;
}

/**
 * The spec for a path, including list row fields addressed by their absolute
 * path ('debts.0.balance' -> the 'balance' row spec of 'debts').
 */
export function findField(form: FormSpec, path: string): FieldSpec | undefined {
  const map = fieldMap(form);
  const direct = map.get(path);
  if (direct) return direct;
  const match = /^(.+)\.(\d+)\.(.+)$/.exec(path);
  if (!match) return undefined;
  const list = findField(form, match[1]);
  return list?.row?.find((row) => row.path === match[3]);
}

// ---------------------------------------------------------------------------
// Copy and options
// ---------------------------------------------------------------------------

export function resolveText(text: Text | undefined, get: Get): string | undefined {
  return typeof text === 'function' ? text(get) : text;
}

export function resolveOptions(spec: FieldSpec, get: Get): readonly FieldOption[] {
  const { options } = spec;
  if (!options) return [];
  return typeof options === 'function' ? options(get) : options;
}

/** The value an override starts from when a nullable field leaves auto. */
export function resolveOverrideDefault(spec: FieldSpec, get: Get): number | undefined {
  if (!spec.nullable) return undefined;
  const { overrideDefault } = spec.nullable;
  return typeof overrideDefault === 'function' ? overrideDefault(get) : overrideDefault;
}

// ---------------------------------------------------------------------------
// Visibility and screens
// ---------------------------------------------------------------------------

export function isFieldVisible(spec: FieldSpec, get: Get): boolean {
  return spec.visibleWhen ? spec.visibleWhen(get) : true;
}

/** The screen's fields that currently show, in screen order. */
export function visibleScreenFields(form: FormSpec, screen: ScreenSpec, get: Get): FieldSpec[] {
  const map = fieldMap(form);
  const fields: FieldSpec[] = [];
  for (const path of screen.fields) {
    const spec = map.get(path);
    if (spec && isFieldVisible(spec, get)) fields.push(spec);
  }
  return fields;
}

/**
 * The paths a screen answers: its visible fields plus the sibling paths their
 * custom renderers cover. This is what a finished screen marks as provided.
 */
export function screenPaths(form: FormSpec, screen: ScreenSpec, get: Get): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  const add = (path: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    paths.push(path);
  };
  for (const spec of visibleScreenFields(form, screen, get)) {
    add(spec.path);
    for (const covered of spec.covers ?? []) add(covered);
  }
  return paths;
}

export type ProvidedPaths = ReadonlySet<string> | readonly string[];

function toSet(provided: ProvidedPaths | undefined): ReadonlySet<string> {
  if (!provided) return new Set();
  return provided instanceof Set ? provided : new Set(provided as readonly string[]);
}

/**
 * True when every visible field on the screen is provided (a field counts by
 * its own path). A screen with no visible fields counts as complete.
 */
export function isScreenComplete(
  form: FormSpec,
  screen: ScreenSpec,
  get: Get,
  provided: ProvidedPaths
): boolean {
  const set = toSet(provided);
  return visibleScreenFields(form, screen, get).every((spec) => set.has(spec.path));
}

export interface ScreensForOptions {
  /** 'all' (default) keeps every screen; 'remaining' drops screens whose visible fields are all provided. */
  mode?: 'all' | 'remaining';
  provided?: ProvidedPaths;
  /** Keep only these tiers. */
  tiers?: readonly Tier[];
  /** Keep only screens shown on this surface (screens with surface 'both' or none always match). */
  surface?: 'intake' | 'calculator';
}

/**
 * The screens to show, in form order. Screens with no visible field are
 * dropped in every mode. In 'remaining' mode a partly answered screen keeps
 * all of its fields (the renderer prefills them).
 */
export function screensFor(form: FormSpec, get: Get, options: ScreensForOptions = {}): ScreenSpec[] {
  const { mode = 'all', tiers, surface } = options;
  const provided = toSet(options.provided);
  return form.screens.filter((screen) => {
    if (tiers && !tiers.includes(screen.tier)) return false;
    const screenSurface = screen.surface ?? 'both';
    if (surface && screenSurface !== 'both' && screenSurface !== surface) return false;
    const visible = visibleScreenFields(form, screen, get);
    if (visible.length === 0) return false;
    if (mode === 'remaining' && visible.every((spec) => provided.has(spec.path))) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const NUMERIC_KINDS: ReadonlySet<FieldSpec['kind']> = new Set(['money', 'number', 'percent', 'slider']);

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (typeof value === 'number' && Number.isNaN(value))
  );
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function trimNumber(value: number, maxDigits: number): string {
  const fixed = value.toFixed(maxDigits);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  const [whole, fraction] = trimmed.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const grouped = groupThousands(sign ? whole.slice(1) : whole);
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Formats a numeric field value the way it is entered: money as whole
 * dollars, percent fields (stored as fractions) as percents, other numbers
 * with the spec's unit. Allocation-free on the hot path (no Intl).
 */
export function formatFieldNumber(spec: FieldSpec, value: number): string {
  if (spec.kind === 'money') {
    const sign = value < 0 ? '-' : '';
    return `${sign}$${trimNumber(Math.abs(value), spec.precision ?? 0)}`;
  }
  if (spec.kind === 'percent') return `${trimNumber(value * 100, spec.precision ?? 2)}%`;
  const text = trimNumber(value, spec.precision ?? 2);
  return `${spec.unit?.prefix ?? ''}${text}${spec.unit?.suffix ?? ''}`;
}

function validateValue(spec: FieldSpec, value: unknown, get: Get): string | null {
  if (spec.nullable && value === null) return null;
  if (isBlank(value)) {
    if (spec.required) return spec.kind === 'list' ? 'Add at least one item.' : 'Enter a value.';
    if (NUMERIC_KINDS.has(spec.kind) && typeof value === 'number') return 'Enter a number.';
    return null;
  }

  if (NUMERIC_KINDS.has(spec.kind)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
    const belowMin = spec.min !== undefined && value < spec.min;
    const aboveMax = spec.max !== undefined && value > spec.max;
    if (belowMin || aboveMax) {
      if (spec.min !== undefined && spec.max !== undefined) {
        return `Enter a value between ${formatFieldNumber(spec, spec.min)} and ${formatFieldNumber(spec, spec.max)}.`;
      }
      if (belowMin) return `Enter a value of at least ${formatFieldNumber(spec, spec.min as number)}.`;
      return `Enter a value of at most ${formatFieldNumber(spec, spec.max as number)}.`;
    }
    return null;
  }

  if (spec.kind === 'boolean') return typeof value === 'boolean' ? null : 'Choose yes or no.';

  if (spec.kind === 'text' || spec.kind === 'state') {
    if (typeof value !== 'string') return 'Enter text.';
    if (spec.maxLength !== undefined && value.length > spec.maxLength) {
      return `Use at most ${spec.maxLength} characters.`;
    }
  }

  if (spec.kind === 'select' || spec.kind === 'choice' || spec.kind === 'state') {
    const options = resolveOptions(spec, get);
    if (options.length > 0 && !options.some((option) => option.value === value)) {
      return 'Choose one of the listed options.';
    }
  }

  if (spec.kind === 'list') {
    if (!Array.isArray(value)) return 'Expected a list.';
    if (spec.minRows !== undefined && value.length < spec.minRows) {
      return spec.minRows === 1 ? 'Add at least one item.' : `Add at least ${spec.minRows} items.`;
    }
    if (spec.maxRows !== undefined && value.length > spec.maxRows) {
      return `Use at most ${spec.maxRows} items.`;
    }
  }

  return null;
}

function validateField(spec: FieldSpec, get: Get, errors: FieldErrors): void {
  const value = get(spec.path);
  const message = validateValue(spec, value, get);
  if (message) errors[spec.path] = message;
  const rows = spec.row;
  if (spec.kind !== 'list' || !rows || !Array.isArray(value)) return;
  value.forEach((_row, index) => {
    const getRow = rowGet(get, spec.path, index);
    for (const rowSpec of rows) {
      if (!isFieldVisible(rowSpec, getRow)) continue;
      const rowMessage = validateValue(rowSpec, getRow(rowSpec.path), getRow);
      if (rowMessage) errors[rowFieldPath(spec.path, index, rowSpec.path)] = rowMessage;
    }
  });
}

export interface ValidateOptions {
  /** Validate only this screen's visible fields and the relations checked on it. */
  screen?: ScreenSpec;
}

/**
 * Validates visible fields (required, min/max, maxLength, option membership,
 * list rows) and cross-field relations. With a screen, only that screen's
 * fields and the relations whose checkOn is shown on it. A field's own error
 * wins over a relation error on the same path. Empty object means valid.
 */
export function validateFields(form: FormSpec, get: Get, options: ValidateOptions = {}): FieldErrors {
  const errors: FieldErrors = {};
  const fields = options.screen
    ? visibleScreenFields(form, options.screen, get)
    : form.fields.filter((spec) => isFieldVisible(spec, get));
  const shown = new Set(fields.map((spec) => spec.path));

  for (const spec of fields) validateField(spec, get, errors);

  for (const rule of form.relations ?? []) {
    if (!shown.has(rule.checkOn) || errors[rule.checkOn]) continue;
    const lower = get(rule.lower);
    const upper = get(rule.upper);
    if (typeof lower !== 'number' || typeof upper !== 'number') continue;
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) continue;
    if (rule.strict ? lower >= upper : lower > upper) errors[rule.checkOn] = rule.message;
  }
  return errors;
}

/**
 * The subset of `errors` that belongs to the screen: keys equal to one of its
 * paths (screenPaths) or inside one ('debts.0.balance' belongs to 'debts').
 */
export function screenErrors(form: FormSpec, screen: ScreenSpec, get: Get, errors: FieldErrors): FieldErrors {
  const paths = screenPaths(form, screen, get);
  const result: FieldErrors = {};
  for (const [key, message] of Object.entries(errors)) {
    if (paths.some((path) => key === path || key.startsWith(`${path}.`))) result[key] = message;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * The display text of a value for a collapsed summary. Options show their
 * label, booleans Yes/No, nullable nulls their auto label, lists a count.
 * Returns null for a blank value.
 */
export function formatFieldValue(spec: FieldSpec, value: unknown, get: Get): string | null {
  if (spec.nullable && value === null) return resolveText(spec.nullable.autoLabel, get) ?? null;
  if (isBlank(value)) return null;
  const option = resolveOptions(spec, get).find((candidate) => candidate.value === value);
  if (option) return option.label;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return formatFieldNumber(spec, value);
  if (Array.isArray(value)) return value.length === 1 ? '1 item' : `${value.length} items`;
  if (typeof value === 'string') return value;
  return null;
}

/**
 * One line for a collapsed screen: each visible field's summary fragment
 * (spec.summary, or "Label: value"), joined with ' · '. Fragments that are
 * null are left out.
 */
export function summarizeScreen(form: FormSpec, screen: ScreenSpec, get: Get): string {
  const fragments: string[] = [];
  for (const spec of visibleScreenFields(form, screen, get)) {
    const value = get(spec.path);
    let fragment: string | null;
    if (spec.summary) {
      fragment = spec.summary(value, get);
    } else {
      const display = formatFieldValue(spec, value, get);
      fragment = display === null ? null : `${spec.label}: ${display}`;
    }
    if (fragment) fragments.push(fragment);
  }
  return fragments.join(' · ');
}
