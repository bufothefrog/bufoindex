/**
 * Profile <-> engine bindings (docs/rebuild-plan.md section 2.5).
 *
 * A Binding maps one engine input path to the profile. A direct binding copies
 * one profile path to one engine path. A derived binding computes the engine
 * value from the profile (read) and, optionally, maps an engine value back to
 * profile writes (write). Engine paths use the same dot syntax as profile
 * paths; the empty engine path addresses the whole engine object.
 */

import { getAt, setAt } from './paths';
import { CALCULATION_ERROR_KEY } from './runtime';
import type { FieldErrors, Get, Write } from './types';

export interface DirectBinding {
  /** Profile path read and written as-is. */
  profile: string;
  /** Engine path. */
  engine: string;
}

export interface DerivedBinding<E> {
  /** Engine path ('' replaces the whole engine object). */
  engine: string;
  /**
   * Computes the engine value. `current` is the engine object built so far
   * (base plus the bindings listed before this one).
   */
  read: (get: Get, current: E) => unknown;
  /** Maps the engine value back to profile writes (legacy imports, scenarios). */
  write?: (value: unknown, engine: E) => Write[];
  /** Profile path that engine errors at this binding are shown on; 'calculation' when omitted. */
  errorPath?: string;
}

export type Binding<E> = DirectBinding | DerivedBinding<E>;

export function isDirectBinding<E>(binding: Binding<E>): binding is DirectBinding {
  return 'profile' in binding;
}

/**
 * Builds engine inputs: starts from `base` and applies each binding in order.
 * A binding whose value is undefined leaves the base value in place.
 */
export function toEngineInputs<E>(bindings: readonly Binding<E>[], base: E, get: Get): E {
  let engine = base;
  for (const binding of bindings) {
    const value = isDirectBinding(binding) ? get(binding.profile) : binding.read(get, engine);
    if (value === undefined) continue;
    engine = setAt(engine, binding.engine, value);
  }
  return engine;
}

/**
 * The reverse direction: profile writes for an engine object. Direct bindings
 * copy their value back; derived bindings contribute their write() result, or
 * nothing when they have none. Undefined engine values are skipped.
 */
export function fromEngineInputs<E>(bindings: readonly Binding<E>[], engine: E): Write[] {
  const writes: Write[] = [];
  for (const binding of bindings) {
    const value = getAt(engine, binding.engine);
    if (isDirectBinding(binding)) {
      if (value !== undefined) writes.push({ path: binding.profile, value });
    } else if (binding.write && value !== undefined) {
      writes.push(...binding.write(value, engine));
    }
  }
  return writes;
}

function bindingErrorTarget<E>(binding: Binding<E>, key: string): string | null {
  const prefix = binding.engine;
  const inside = prefix === '' || key === prefix || key.startsWith(`${prefix}.`);
  if (!inside) return null;
  if (!isDirectBinding(binding)) return binding.errorPath ?? CALCULATION_ERROR_KEY;
  const rest = prefix === '' ? key : key.slice(prefix.length);
  if (prefix === '') return rest ? `${binding.profile}.${rest}` : binding.profile;
  return `${binding.profile}${rest}`;
}

/**
 * Maps engine-path errors to profile paths. Each error goes to the binding
 * with the longest matching engine path (a direct binding keeps the suffix:
 * engine 'debts' -> profile 'debts', so 'debts.0.balance' stays on that row).
 * Errors no binding claims go to 'calculation'. When several errors land on
 * one key the first wins, except on 'calculation', where distinct messages
 * are joined.
 */
export function engineErrorsToFields<E>(bindings: readonly Binding<E>[], errors: FieldErrors): FieldErrors {
  const result: FieldErrors = {};
  for (const [key, message] of Object.entries(errors)) {
    let best: Binding<E> | null = null;
    for (const binding of bindings) {
      if (bindingErrorTarget(binding, key) === null) continue;
      if (!best || binding.engine.length > best.engine.length) best = binding;
    }
    const target = best ? (bindingErrorTarget(best, key) as string) : CALCULATION_ERROR_KEY;
    const existing = result[target];
    if (existing === undefined) {
      result[target] = message;
    } else if (target === CALCULATION_ERROR_KEY && !existing.includes(message)) {
      result[target] = `${existing} ${message}`;
    }
  }
  return result;
}

function stableSerialize(value: unknown): string | undefined {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : `"${String(value)}"`;
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'bigint':
      return `"${value.toString()}n"`;
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    default:
      break;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item) ?? 'null').join(',')}]`;
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const serialized = stableSerialize(record[key]);
    if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * A deterministic string for memoization: JSON with object keys sorted at
 * every depth, so equal inputs in a different key order share a key.
 * Undefined object entries are dropped (as JSON does), non-finite numbers are
 * kept distinct ("NaN", "Infinity").
 */
export function stableKey(value: unknown): string {
  return stableSerialize(value) ?? 'undefined';
}
