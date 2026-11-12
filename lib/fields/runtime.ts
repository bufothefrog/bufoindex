/**
 * Field-schema runtime: screen selection, validation and summaries for a
 * FormSpec. Pure; every value is read through a Get.
 *
 * Semantics the plan leaves open, decided here:
 *
 * - Visibility. A field whose visibleWhen returns false is hidden. Hidden
 *   fields are not validated, do not count toward 'remaining' mode (neither
 *   provided nor missing), are left out of summaries and screenPaths, and
 *   switch off any relation that names them. A screen with no visible field
 *   is dropped in every mode.
 * - Provided. A field counts as provided when its own path is in `provided`.
 *   For a list that is the list path ('debts'); row paths are never consulted.
 *   For a custom field it is the field's path; its `covers` are marked
 *   provided alongside it through screenPaths, so they are not checked.
 * - Remaining mode drops a screen only when every visible field on it is
 *   provided. A partly answered screen keeps all of its fields (prefilled).
 * - Nullable. null is a valid answer ("derive"), so a nullable field holding
 *   null passes every check. undefined is still empty.
 * - Empty values are undefined, null, NaN, a blank string and an empty list.
 *   An empty optional field passes every check, except that an empty list
 *   fails a minRows above 0. Infinity and -Infinity are not numbers here.
 * - List rows. Row specs use paths relative to the row. Their callbacks
 *   (visibleWhen, options, help, ...) receive rowGet(get, listPath, index),
 *   which resolves paths inside that row only. Row errors are keyed by the
 *   absolute path ('debts.0.balance'). minRows / maxRows are checked on the
 *   list path.
 * - Custom fields get the generic checks only on their own path (required,
 *   and min/max etc. when the spec sets them); their covers are not checked.
 * - Relations are keyed by checkOn. With a screen they run only when checkOn
 *   is a visible field of that screen; without one, they all run. A relation
 *   is skipped unless both ends are finite numbers. A field's own error wins
 *   over a relation error on the same path.
 */

import { formatCount } from '@/lib/format';
import { joinPath } from './paths';
import type {
  CrossFieldRule,
  FieldErrors,
  FieldOption,
  FieldSpec,
  FormSpec,
  Get,
  ScreenNote,
  ScreenSpec,
  Surface,
  Text,
  Tier,
  Write,
} from './types';

const FIELD_MAPS = new WeakMap<FormSpec, ReadonlyMap<string, FieldSpec>>();

/**
 * The form's fields keyed by path, built once per form. Throws on a path
 * defined twice, which is a schema bug.
 */
export function fieldMap(form: FormSpec): ReadonlyMap<string, FieldSpec> {
  const cached = FIELD_MAPS.get(form);
  if (cached) return cached;
  const map = new Map<string, FieldSpec>();
  for (const spec of form.fields) {
    if (map.has(spec.path)) {
      throw new Error(`Form "${form.id}" defines the field "${spec.path}" twice`);
    }
    map.set(spec.path, spec);
  }
  FIELD_MAPS.set(form, map);
  return map;
}

export function resolveText(text: Text | undefined, get: Get): string | undefined {
  return typeof text === 'function' ? text(get) : text;
}

/** The field's options; an empty list when it has none. */
export function resolveOptions(spec: FieldSpec, get: Get): readonly FieldOption[] {
  const { options } = spec;
  if (!options) return [];
  return typeof options === 'function' ? options(get) : options;
}

/** The value a nullable field switches to when the user overrides "auto". */
export function resolveOverrideDefault(spec: FieldSpec, get: Get): number | undefined {
  const fallback = spec.nullable?.overrideDefault;
  return typeof fallback === 'function' ? fallback(get) : fallback;
}

export function isFieldVisible(spec: FieldSpec, get: Get): boolean {
  return spec.visibleWhen ? spec.visibleWhen(get) : true;
}

/** A Get scoped to one list row: rowGet(get, 'debts', 0)('balance') reads 'debts.0.balance'. */
export function rowGet(get: Get, listPath: string, index: number): Get {
  return (path) => get(joinPath(listPath, index, path));
}

/** The rows of a list field; an empty list when the value is not an array. */
export function listRows(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function screenFields(form: FormSpec, screen: ScreenSpec): FieldSpec[] {
  const map = fieldMap(form);
  return screen.fields.map((path) => {
    const spec = map.get(path);
    if (!spec) {
      throw new Error(`Screen "${screen.id}" of form "${form.id}" lists "${path}", which the form does not define`);
    }
    return spec;
  });
}

/** The screen's fields that are currently visible, in screen order. */
export function visibleScreenFields(form: FormSpec, screen: ScreenSpec, get: Get): FieldSpec[] {
  return screenFields(form, screen).filter((spec) => isFieldVisible(spec, get));
}

/** The screen's notes that are currently visible, with their text resolved. */
export function visibleScreenNotes(
  screen: ScreenSpec,
  get: Get
): { text: string; tone: NonNullable<ScreenNote['tone']> }[] {
  const out: { text: string; tone: NonNullable<ScreenNote['tone']> }[] = [];
  for (const note of screen.notes ?? []) {
    if (note.visibleWhen && !note.visibleWhen(get)) continue;
    const text = resolveText(note.text, get);
    if (text) out.push({ text, tone: note.tone ?? 'info' });
  }
  return out;
}

export interface ScreensForOptions {
  /** 'all' keeps every screen; 'remaining' drops screens whose visible fields are all provided. */
  mode: 'all' | 'remaining';
  /** Answered paths (profile.provided); only 'remaining' mode reads it. */
  provided?: ReadonlySet<string> | readonly string[];
  /** Keep only screens of these tiers. */
  tiers?: readonly Tier[];
  /**
   * Keep only screens shown on this surface: 'intake' keeps 'both' and
   * 'intake' screens, 'calculator' keeps 'both' and 'calculator' screens,
   * 'both' (or leaving it out) keeps every screen.
   */
  surface?: Surface;
}

function toSet(values: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  if (!values) return new Set();
  return Array.isArray(values) ? new Set(values) : (values as ReadonlySet<string>);
}

/** The screens to show, in form order. */
export function screensFor(form: FormSpec, get: Get, options: ScreensForOptions): ScreenSpec[] {
  const provided = toSet(options.provided);
  const surface = options.surface ?? 'both';
  return form.screens.filter((screen) => {
    if (options.tiers && !options.tiers.includes(screen.tier)) return false;
    const screenSurface = screen.surface ?? 'both';
    if (surface !== 'both' && screenSurface !== 'both' && screenSurface !== surface) return false;
    const fields = visibleScreenFields(form, screen, get);
    if (fields.length === 0) return false;
    if (options.mode === 'remaining') return fields.some((spec) => !provided.has(spec.path));
    return true;
  });
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const NUMERIC_KINDS: ReadonlySet<FieldSpec['kind']> = new Set(['money', 'number', 'percent', 'slider']);
const FIELD_DIGITS = { maxDigits: 2 } as const;

/**
 * A number as the field displays it, with up to 2 decimals: a percent as
 * 0-100 with "%", money with "$", otherwise the spec's unit prefix and
 * suffix ("-$0.5", "0.5 mo", "200%"). Validation messages print their bounds
 * with it, and the field renderers print a nullable field's auto value.
 */
export function formatFieldValue(spec: FieldSpec, value: number): string {
  if (spec.kind === 'percent') return `${formatCount(value * 100, FIELD_DIGITS)}%`;
  const prefix = spec.unit?.prefix ?? (spec.kind === 'money' ? '$' : '');
  const suffix = spec.unit?.suffix ?? '';
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${formatCount(Math.abs(value), FIELD_DIGITS)}${suffix}`;
}

function entries(count: number): string {
  return count === 1 ? '1 entry' : `${count} entries`;
}

/**
 * The error for one value of one field, or undefined when it is fine.
 * `get` is the scope the spec's callbacks see (rowGet for a list row).
 * List rows are not checked here; validateFields walks them.
 */
export function fieldError(spec: FieldSpec, value: unknown, get: Get): string | undefined {
  if (spec.nullable && value === null) return undefined;
  if (isEmptyValue(value)) {
    if (spec.required) return `${spec.label} is required.`;
    // minRows > 0 means the list must not be empty, required or not.
    if (Array.isArray(value) && spec.minRows !== undefined && spec.minRows > 0) {
      return `${spec.label} needs at least ${entries(spec.minRows)}.`;
    }
    return undefined;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `${spec.label} must be a number.`;
    const { min, max } = spec;
    const below = min !== undefined && value < min;
    const above = max !== undefined && value > max;
    if (below || above) {
      if (min !== undefined && max !== undefined) {
        return `${spec.label} must be between ${formatFieldValue(spec, min)} and ${formatFieldValue(spec, max)}.`;
      }
      return below
        ? `${spec.label} must be at least ${formatFieldValue(spec, min as number)}.`
        : `${spec.label} must be at most ${formatFieldValue(spec, max as number)}.`;
    }
  } else if (NUMERIC_KINDS.has(spec.kind)) {
    return `${spec.label} must be a number.`;
  }

  if (typeof value === 'string' && spec.maxLength !== undefined && value.length > spec.maxLength) {
    return `${spec.label} must be ${spec.maxLength} characters or fewer.`;
  }

  if (Array.isArray(value)) {
    if (spec.minRows !== undefined && value.length < spec.minRows) {
      return `${spec.label} needs at least ${entries(spec.minRows)}.`;
    }
    if (spec.maxRows !== undefined && value.length > spec.maxRows) {
      return `${spec.label} allows at most ${entries(spec.maxRows)}.`;
    }
  }

  const options = resolveOptions(spec, get);
  if (options.length > 0 && !options.some((option) => option.value === value)) {
    return `${spec.label} must be one of the listed options.`;
  }
  return undefined;
}

function collectErrors(spec: FieldSpec, path: string, get: Get, scope: Get, out: FieldErrors): void {
  const value = get(path);
  const error = fieldError(spec, value, scope);
  if (error) out[path] = error;
  if (spec.kind !== 'list' || !spec.row) return;
  // An empty list has no rows; fieldError has already checked minRows on it.
  listRows(value).forEach((_, index) => {
    const rowScope = rowGet(get, path, index);
    for (const rowSpec of spec.row ?? []) {
      if (!isFieldVisible(rowSpec, rowScope)) continue;
      collectErrors(rowSpec, joinPath(path, index, rowSpec.path), get, rowScope, out);
    }
  });
}

function isRelationLive(rule: CrossFieldRule, map: ReadonlyMap<string, FieldSpec>, get: Get): boolean {
  return [rule.lower, rule.upper, rule.checkOn].every((path) => {
    const spec = map.get(path);
    return !spec || isFieldVisible(spec, get);
  });
}

/** Own keys only, so a path such as 'toString' is not mistaken for an existing error. */
function hasError(errors: FieldErrors, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(errors, path);
}

/** True for a number that is not NaN or an infinity. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface ValidateOptions {
  /** Limit validation to this screen's visible fields and the relations checked on them. */
  screen?: ScreenSpec;
}

/**
 * Relation (cross-field) errors only, keyed by checkOn. The wizard shows
 * these as the screen-level alert.
 */
export function relationErrors(form: FormSpec, get: Get, options: ValidateOptions = {}): FieldErrors {
  const map = fieldMap(form);
  const onScreen = options.screen
    ? new Set(visibleScreenFields(form, options.screen, get).map((spec) => spec.path))
    : null;
  const out: FieldErrors = {};
  for (const rule of form.relations ?? []) {
    if (onScreen && !onScreen.has(rule.checkOn)) continue;
    if (!isRelationLive(rule, map, get)) continue;
    const lower = get(rule.lower);
    const upper = get(rule.upper);
    if (!isFiniteNumber(lower) || !isFiniteNumber(upper)) continue;
    const broken = rule.strict ? lower >= upper : lower > upper;
    if (broken && !hasError(out, rule.checkOn)) out[rule.checkOn] = rule.message;
  }
  return out;
}

/**
 * Field errors keyed by path: required, min/max, maxLength, option
 * membership, list row counts and rows, then relations. With a screen, only
 * that screen's visible fields; without one, every visible field of the form.
 */
export function validateFields(form: FormSpec, get: Get, options: ValidateOptions = {}): FieldErrors {
  const specs = options.screen
    ? visibleScreenFields(form, options.screen, get)
    : form.fields.filter((spec) => isFieldVisible(spec, get));
  const out: FieldErrors = {};
  for (const spec of specs) collectErrors(spec, spec.path, get, get, out);
  for (const [path, message] of Object.entries(relationErrors(form, get, options))) {
    if (!hasError(out, path)) out[path] = message;
  }
  return out;
}

/** A list's noun from its label: 'Debts' -> 'debts' and, for one row, 'debt'. */
function countNoun(label: string, count: number): string {
  const plural = label.toLowerCase();
  return count === 1 && plural.endsWith('s') ? plural.slice(0, -1) : plural;
}

/**
 * The generic fragment of a field with no summary of its own:
 *
 * - a list: its row count with the label as the noun ("2 debts", "1 debt",
 *   "no debts");
 * - a nullable field holding null: "<label>: Auto";
 * - a value that matches an option: "<label>: <option label>";
 * - a number: "<label>: <formatFieldValue>" ("Your age: 30", "Rate: 4.5%");
 * - a boolean without options: "<label>: Yes" or "No";
 * - a non-blank string: "<label>: <string>".
 *
 * An empty value, or one of a kind it cannot word (an object), gives null.
 */
export function fallbackSummary(spec: FieldSpec, value: unknown, get: Get): string | null {
  if (spec.kind === 'list') {
    const count = listRows(value).length;
    return count === 0 ? `no ${countNoun(spec.label, 2)}` : `${formatCount(count)} ${countNoun(spec.label, count)}`;
  }
  if (spec.nullable && value === null) return `${spec.label}: Auto`;
  if (isEmptyValue(value)) return null;
  const option = resolveOptions(spec, get).find((candidate) => candidate.value === value);
  if (option) return `${spec.label}: ${option.label}`;
  if (isFiniteNumber(value)) return `${spec.label}: ${formatFieldValue(spec, value)}`;
  if (typeof value === 'boolean') return `${spec.label}: ${value ? 'Yes' : 'No'}`;
  if (typeof value === 'string') return `${spec.label}: ${value.trim()}`;
  return null;
}

/**
 * The collapsed one-line summary: fragments of the visible fields, in screen
 * order, joined with ', '.
 *
 * - First, each field's own summary. A field without one is left out, and a
 *   summary that returns null or '' leaves its field out on purpose: a
 *   screen with hand-written summaries words exactly what its author chose
 *   (a yes/no that the next fragment covers, a balance kept off the line).
 * - When that gives nothing (no field on the screen has a summary, or every
 *   summary returned null), every visible field contributes its generic
 *   fallbackSummary instead ("Your age: 30, Tax filing status: Single"), so
 *   a card that holds values never shows an empty line.
 *
 * The result is '' only when no visible field holds a value.
 */
export function summarizeScreen(form: FormSpec, screen: ScreenSpec, get: Get): string {
  const fields = visibleScreenFields(form, screen, get);
  const join = (fragment: (spec: FieldSpec, value: unknown) => string | null | undefined) =>
    fields
      .map((spec) => fragment(spec, get(spec.path)))
      .filter((part): part is string => Boolean(part))
      .join(', ');
  return join((spec, value) => spec.summary?.(value, get)) || join((spec, value) => fallbackSummary(spec, value, get));
}

/**
 * The profile paths a screen answers: each visible field's path (a list
 * contributes its list path, never row paths), followed by the field's
 * covers. Deduplicated, in screen order. The wizard writes and marks
 * provided exactly these paths.
 */
export function screenPaths(form: FormSpec, screen: ScreenSpec, get: Get): string[] {
  const paths = new Set<string>();
  for (const spec of visibleScreenFields(form, screen, get)) {
    paths.add(spec.path);
    for (const covered of spec.covers ?? []) paths.add(covered);
  }
  return Array.from(paths);
}

/**
 * The writes for setting `spec` to `value`: its own write, then the spec's
 * coupled writes (onChange). The Get handed to onChange already sees the new
 * value, so a coupled write derives from what the visitor just entered; the
 * third argument still sees the value before the change. The calculator's
 * FieldInput and the intake wizard both build writes with this.
 */
export function fieldWrites(spec: FieldSpec, value: unknown, get: Get): Write[] {
  const after: Get = (path) => (path === spec.path ? value : get(path));
  return [{ path: spec.path, value }, ...(spec.onChange?.(value, after, get) ?? [])];
}
