/**
 * Dot-path access for plain JSON-like values (docs/rebuild-plan.md 2.4).
 *
 * Paths are dot separated; a segment made only of digits indexes into an
 * array ('debts.0.balance'). The empty path addresses the root value.
 * setAt and applyWrites never mutate their input: they copy each container
 * on the way down and return the input itself when nothing changes.
 */

import type { Get, Write } from './types';

const INDEX_SEGMENT = /^\d+$/;

/** Splits a dot path into segments; the empty path has none. */
export function splitPath(path: string): string[] {
  return path === '' ? [] : path.split('.');
}

/** Joins path segments, skipping empty ones ('debts', 0, 'balance' -> 'debts.0.balance'). */
export function joinPath(...segments: ReadonlyArray<string | number>): string {
  return segments.filter((segment) => segment !== '').join('.');
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

/** The value at `path`, or undefined when any step is missing. */
export function getAt(values: unknown, path: string): unknown {
  let current: unknown = values;
  for (const segment of splitPath(path)) {
    if (!isContainer(current)) return undefined;
    if (Array.isArray(current)) {
      if (!INDEX_SEGMENT.test(segment)) return undefined;
      current = current[Number(segment)];
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
      current = current[segment];
    }
  }
  return current;
}

function setIn(container: unknown, segments: readonly string[], depth: number, value: unknown): unknown {
  if (depth === segments.length) return value;
  const segment = segments[depth];
  const isIndex = INDEX_SEGMENT.test(segment);

  if (Array.isArray(container) && isIndex) {
    const index = Number(segment);
    const next = setIn(container[index], segments, depth + 1, value);
    if (index < container.length && Object.is(next, container[index])) return container;
    const copy = container.slice();
    copy[index] = next;
    return copy;
  }

  if (isContainer(container) && !Array.isArray(container)) {
    const has = Object.prototype.hasOwnProperty.call(container, segment);
    const next = setIn(has ? container[segment] : undefined, segments, depth + 1, value);
    if (has && Object.is(next, container[segment])) return container;
    return { ...container, [segment]: next };
  }

  // Missing (or a primitive, or an array addressed by a key): create the container.
  if (isIndex) {
    const copy: unknown[] = [];
    copy[Number(segment)] = setIn(undefined, segments, depth + 1, value);
    return copy;
  }
  return { [segment]: setIn(undefined, segments, depth + 1, value) };
}

/**
 * Returns a copy of `values` with `value` at `path`. Containers along the path
 * are copied; untouched branches are shared. Missing containers are created
 * (an array when the next segment is an index). Returns `values` unchanged
 * when the value is already there.
 */
export function setAt<T>(values: T, path: string, value: unknown): T {
  return setIn(values, splitPath(path), 0, value) as T;
}

/** Applies writes in order (a later write to the same path wins). */
export function applyWrites<T>(values: T, writes: readonly Write[]): T {
  let next = values;
  for (const write of writes) next = setAt(next, write.path, write.value);
  return next;
}

/** A Get over `values`. */
export function makeGet(values: unknown): Get {
  return (path) => getAt(values, path);
}

/**
 * A Get for one list row: relative paths ('balance') resolve against
 * `${listPath}.${index}`; a path the row does not have falls back to `get`,
 * so row rules can still read profile-wide values ('person.age').
 */
export function rowGet(get: Get, listPath: string, index: number): Get {
  const prefix = joinPath(listPath, index);
  return (path) => {
    const value = get(joinPath(prefix, path));
    return value === undefined ? get(path) : value;
  };
}

/** The absolute path of a row field ('debts', 2, 'balance' -> 'debts.2.balance'). */
export function rowFieldPath(listPath: string, index: number, field: string): string {
  return joinPath(listPath, index, field);
}

/** Replaces every '{i}' in a test id pattern with the row index. */
export function formatTestId(pattern: string, index: number): string {
  return pattern.split('{i}').join(String(index));
}
