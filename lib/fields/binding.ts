/**
 * Bindings: the mapping between profile paths and engine-input paths that
 * each calculator declares once (lib/calculators/<id>/bindings.ts). Pure.
 *
 * - A 1:1 binding copies one profile value to one engine path. A derived
 *   binding computes the engine value from the whole profile (read) and can
 *   map it back to profile writes (write) for the one-time legacy storage
 *   import.
 * - toEngineInputs starts from `base` (the calculator's engineBase()) and
 *   applies the bindings in order, so a later binding to the same engine path
 *   wins. A 1:1 binding whose profile value is undefined keeps the base
 *   value; null is copied (nullable overrides are resolved by derived
 *   bindings). Unbound engine paths keep their base value, and values are not
 *   cloned, so engines must not mutate their inputs.
 * - Engine paths may address nested values ('taxes.state') and list rows.
 */

import { getAt, setAt, splitPath, toDotPath } from './paths';
import type { FieldErrors, Get, Write } from './types';

export interface DirectBinding {
  profile: string;
  engine: string;
}

export interface DerivedBinding<E> {
  engine: string;
  read: (get: Get) => unknown;
  /** Profile writes that reproduce `value` (the engine value at `engine`); omit for one-way bindings. */
  write?: (value: unknown, engine: E) => Write[];
  /** The profile path that engine errors at this binding are shown on; omit to show them as 'calculation'. */
  errorPath?: string;
}

export type Binding<E> = DirectBinding | DerivedBinding<E>;

export function isDerivedBinding<E>(binding: Binding<E>): binding is DerivedBinding<E> {
  return 'read' in binding;
}

/** Engine inputs from the profile: `base` with every binding applied. */
export function toEngineInputs<E>(bindings: readonly Binding<E>[], base: E, get: Get): E {
  let engine = base;
  for (const binding of bindings) {
    const value = isDerivedBinding(binding) ? binding.read(get) : get(binding.profile);
    if (value === undefined) continue;
    engine = setAt(engine, binding.engine, value);
  }
  return engine;
}

/**
 * Profile writes that reproduce `engine`, in binding order. Used only for the
 * one-time legacy localStorage import (O7). Engine values that are undefined
 * and derived bindings without `write` produce nothing.
 */
export function fromEngineInputs<E>(bindings: readonly Binding<E>[], engine: E): Write[] {
  const writes: Write[] = [];
  for (const binding of bindings) {
    const value = getAt(engine, binding.engine);
    if (isDerivedBinding(binding)) {
      if (binding.write) writes.push(...binding.write(value, engine));
    } else if (value !== undefined) {
      writes.push({ path: binding.profile, value });
    }
  }
  return writes;
}

/** True when `path` is `prefix` or lies under it. Both are segment arrays. */
function startsWithSegments(path: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, i) => path[i] === segment);
}

/**
 * Engine validation errors moved onto profile paths. Keys in bracket form
 * ('accounts[0].deposit') are read as dot paths. Each key goes to the binding
 * with the longest engine path equal to it or containing it:
 *
 * - 1:1 binding: the profile path plus the rest of the key, so a row error
 *   ('debts.0.balance' under a 'debts' binding) lands on the same row.
 * - derived binding: its errorPath, or 'calculation' when it has none.
 * - no binding: 'calculation'.
 *
 * When two errors land on the same key, the first one is kept.
 */
export function engineErrorsToFields<E>(bindings: readonly Binding<E>[], errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  const enginePaths = bindings.map((binding) => splitPath(binding.engine));
  for (const [key, message] of Object.entries(errors)) {
    const segments = splitPath(toDotPath(key));
    let best = -1;
    enginePaths.forEach((enginePath, i) => {
      const longer = best < 0 || enginePath.length > enginePaths[best].length;
      if (longer && startsWithSegments(segments, enginePath)) best = i;
    });
    let target = 'calculation';
    if (best >= 0) {
      const binding = bindings[best];
      if (!isDerivedBinding(binding)) {
        target = [binding.profile, ...segments.slice(enginePaths[best].length)].join('.');
      } else if (binding.errorPath) {
        target = binding.errorPath;
      }
    }
    if (!Object.prototype.hasOwnProperty.call(out, target)) out[target] = message;
  }
  return out;
}

function serialize(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return String(value);
    case 'number':
      // NaN and the infinities stay distinct from null (JSON would merge them).
      return Number.isFinite(value) ? JSON.stringify(value) : String(value);
    case 'bigint':
      return `${value}n`;
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => serialize(item) ?? 'null').join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const item = serialize(record[key]);
    if (item !== undefined) parts.push(`${JSON.stringify(key)}:${item}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * A memoization key: JSON-like, with object keys sorted at every depth, so
 * two values that differ only in key order get the same key. Like JSON,
 * undefined and function members are left out (and become null in lists);
 * unlike JSON, NaN and the infinities keep their own spelling. Values must
 * be plain, acyclic data (no Dates, Maps or class instances).
 */
export function stableKey(value: unknown): string {
  return serialize(value) ?? 'undefined';
}
