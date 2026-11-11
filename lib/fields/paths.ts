/**
 * Dot-path access for plain data (the profile, wizard answers, engine
 * inputs). Pure and immutable.
 *
 * - A path is dot separated: 'person.age', 'debts.0.balance'. The empty path
 *   addresses the root value.
 * - A numeric segment ('0', '12') addresses a list row when the container is
 *   an array. getAt reads own properties only, so 'constructor' or
 *   'toString' never resolve to inherited members.
 * - setAt copies only the containers along the path (structural sharing) and
 *   returns the input unchanged (same reference) when the value is already
 *   equal (Object.is). Missing containers are created: an array when the next
 *   segment is numeric, otherwise an object.
 */

import type { Get, Write } from './types';

const INDEX = /^(0|[1-9]\d*)$/;
const UNSAFE_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return typeof value === 'object' && value !== null;
}

function hasOwn(container: Container, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(container, key);
}

/** The segments of a dot path; the empty path has none. */
export function splitPath(path: string): string[] {
  return path === '' ? [] : path.split('.');
}

/** Joins path parts, skipping empty ones: joinPath('debts', 0, 'balance'). */
export function joinPath(...parts: readonly (string | number)[]): string {
  return parts.filter((part) => part !== '').join('.');
}

/**
 * Rewrites bracket notation into a dot path, so engine error keys such as
 * 'accounts[0].deposit' or "classTargets[acct-1].sum" read as
 * 'accounts.0.deposit' and 'classTargets.acct-1.sum'.
 */
export function toDotPath(path: string): string {
  return path.replace(/\[([^\]]*)\]/g, '.$1').replace(/^\./, '');
}

/** The value at `path`, or undefined when any segment is missing. */
export function getAt(values: unknown, path: string): unknown {
  let current = values;
  for (const segment of splitPath(path)) {
    if (!isContainer(current) || !hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function assign(node: unknown, segments: readonly string[], depth: number, value: unknown, path: string): unknown {
  const segment = segments[depth];
  if (UNSAFE_SEGMENTS.has(segment)) {
    throw new Error(`setAt: unsafe segment "${segment}" in "${path}"`);
  }
  const container: unknown = node === undefined || node === null ? (INDEX.test(segment) ? [] : {}) : node;
  if (!isContainer(container)) {
    throw new TypeError(`setAt: cannot set "${path}": "${segments.slice(0, depth).join('.')}" is not an object or list`);
  }
  const exists = hasOwn(container, segment);
  const current = exists ? (container as Record<string, unknown>)[segment] : undefined;
  const next = depth === segments.length - 1 ? value : assign(current, segments, depth + 1, value, path);
  if (exists && Object.is(current, next)) return container;

  if (Array.isArray(container)) {
    // Rows are addressed by index; writing one past the end appends, and
    // anything further would leave holes, so it is refused.
    if (!INDEX.test(segment) || Number(segment) > container.length) {
      throw new RangeError(`setAt: "${segment}" is not a row index of "${segments.slice(0, depth).join('.')}" in "${path}"`);
    }
    const copy = container.slice();
    copy[Number(segment)] = next;
    return copy;
  }
  return { ...container, [segment]: next };
}

/**
 * A copy of `values` with `value` at `path`. Only the containers along the
 * path are copied. The empty path replaces the root.
 */
export function setAt<T>(values: T, path: string, value: unknown): T {
  const segments = splitPath(path);
  if (segments.length === 0) return value as T;
  return assign(values, segments, 0, value, path) as T;
}

/** Applies writes in order; a later write to the same path wins. */
export function applyWrites<T>(values: T, writes: readonly Write[]): T {
  let out = values;
  for (const write of writes) out = setAt(out, write.path, write.value);
  return out;
}

/** A Get bound to `values`. */
export function makeGet(values: unknown): Get {
  return (path) => getAt(values, path);
}
