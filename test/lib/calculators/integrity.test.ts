/**
 * Schema integrity across every form and calculator (docs/rebuild-plan.md
 * section 3, x1): the field specs, the profile and the engine bindings agree.
 *
 * - Every FieldSpec path (and every list row field) is a profile path.
 * - Every profile leaf and list has an input: a FieldSpec, or a custom
 *   renderer's `covers` entry, with no exception.
 * - Every engine leaf is bound or listed in its calculator's ENGINE_ONLY.
 * - No FieldSpec is defined twice: a path appears once per form, and a path
 *   that several forms ask comes from one shared spec, the forms changing
 *   only its wording (withOverrides).
 */

import { describe, expect, it } from 'vitest';
import { CORE_FORM, FORMS, PROFILE_FORM } from '@/lib/calculators/forms';
import { LEVERAGE_ENGINE_ONLY } from '@/lib/calculators/leverage/bindings';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_ENGINE_ONLY } from '@/lib/calculators/paycheck/bindings';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PORTFOLIO_ENGINE_ONLY } from '@/lib/calculators/portfolio/bindings';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { RETIREMENT_ENGINE_ONLY } from '@/lib/calculators/retirement/bindings';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { isRecord } from '@/lib/fields/paths';
import * as shared from '@/lib/fields/shared';
import type { FieldSpec, FormSpec } from '@/lib/fields/types';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS, isProfilePath } from '@/lib/profile/defaults';

const ALL_FORMS: readonly FormSpec[] = [CORE_FORM, ...Object.values(FORMS), PROFILE_FORM];

/** The FieldSpec keys a form may change on a shared spec: wording and tier only. */
const WORDING_KEYS: ReadonlySet<string> = new Set(['label', 'question', 'help', 'hint', 'placeholder', 'summary', 'tier']);

function isFieldSpec(value: unknown): value is FieldSpec {
  return isRecord(value) && typeof value.path === 'string' && typeof value.kind === 'string';
}

/** The specs lib/fields/shared exports, by path. */
const SHARED_SPECS: ReadonlyMap<string, FieldSpec> = new Map(
  Object.values(shared)
    .filter(isFieldSpec)
    .map((spec) => [spec.path, spec])
);

/** Every engine leaf: objects recurse, while arrays and scalars are leaves. */
function engineLeaves(value: unknown, prefix = ''): string[] {
  if (!isRecord(value) || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => engineLeaves(child, prefix ? `${prefix}.${key}` : key));
}

interface EngineCase {
  name: string;
  leaves: readonly string[];
  bound: readonly string[];
  engineOnly: Readonly<Record<string, string>>;
}

function engineCase<E, R>(def: CalculatorDefinition<E, R>, engineOnly: Readonly<Record<string, string>>): EngineCase {
  return {
    name: def.id,
    leaves: engineLeaves(def.engineBase()),
    bound: def.bindings.map((binding) => binding.engine),
    engineOnly,
  };
}

const ENGINES: readonly EngineCase[] = [
  engineCase(PAYCHECK_CALCULATOR, PAYCHECK_ENGINE_ONLY),
  engineCase(RETIREMENT_CALCULATOR, RETIREMENT_ENGINE_ONLY),
  engineCase(PORTFOLIO_CALCULATOR, PORTFOLIO_ENGINE_ONLY),
  engineCase(LEVERAGE_CALCULATOR, LEVERAGE_ENGINE_ONLY),
];

describe('field specs and the profile', () => {
  it('gives every FieldSpec a profile path, list row fields included', () => {
    for (const form of ALL_FORMS) {
      for (const spec of form.fields) {
        expect(isProfilePath(spec.path), `${form.id}: ${spec.path}`).toBe(true);
        for (const row of spec.row ?? []) {
          expect(isProfilePath(`${spec.path}.0.${row.path}`), `${form.id}: ${spec.path} row ${row.path}`).toBe(true);
        }
        for (const covered of spec.covers ?? []) {
          expect(isProfilePath(covered), `${form.id}: ${spec.path} covers ${covered}`).toBe(true);
        }
      }
    }
  });

  it('gives every profile leaf and list an input', () => {
    const asked = new Set<string>();
    for (const form of ALL_FORMS) {
      for (const spec of form.fields) {
        asked.add(spec.path);
        for (const covered of spec.covers ?? []) asked.add(covered);
      }
    }
    const missing = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS].filter((path) => !asked.has(path));
    expect(missing).toEqual([]);
  });

  it('does not count version, updatedAt or provided as profile paths', () => {
    for (const path of ['version', 'updatedAt', 'provided']) {
      expect(PROFILE_LEAF_PATHS, path).not.toContain(path);
      expect(isProfilePath(path), path).toBe(false);
    }
  });
});

describe('engine leaves and the bindings', () => {
  it.each(ENGINES)('$name: binds each engine leaf or lists it in ENGINE_ONLY', ({ leaves, bound, engineOnly }) => {
    expect(leaves.length).toBeGreaterThan(0);
    const boundSet = new Set(bound);
    for (const leaf of leaves) {
      expect(boundSet.has(leaf) || leaf in engineOnly, leaf).toBe(true);
    }
    for (const [leaf, reason] of Object.entries(engineOnly)) {
      expect(leaves, leaf).toContain(leaf);
      expect(reason.length, leaf).toBeGreaterThan(0);
    }
  });
});

/** Every distinct spec object the forms use for each path. */
function specsByPath(forms: readonly FormSpec[]): Map<string, Set<FieldSpec>> {
  const byPath = new Map<string, Set<FieldSpec>>();
  for (const form of forms) {
    for (const spec of form.fields) {
      const specs = byPath.get(spec.path) ?? new Set<FieldSpec>();
      specs.add(spec);
      byPath.set(spec.path, specs);
    }
  }
  return byPath;
}

/**
 * "path: key" for each key outside WORDING_KEYS where a form's spec differs
 * from the shared spec of its path, or "path: no shared spec" for a path that
 * several distinct specs define with no shared spec behind them. Every shared
 * path is checked, however many forms ask it.
 */
function specDrift(forms: readonly FormSpec[]): string[] {
  const drift: string[] = [];
  for (const [path, specs] of specsByPath(forms)) {
    const base = SHARED_SPECS.get(path);
    if (!base) {
      if (specs.size > 1) drift.push(`${path}: no shared spec`);
      continue;
    }
    const baseFields: Record<string, unknown> = { ...base };
    for (const variant of specs) {
      const variantFields: Record<string, unknown> = { ...variant };
      const keys = new Set([...Object.keys(baseFields), ...Object.keys(variantFields)]);
      for (const key of keys) {
        if (!WORDING_KEYS.has(key) && baseFields[key] !== variantFields[key]) drift.push(`${path}: ${key}`);
      }
    }
  }
  return drift;
}

describe('no FieldSpec is defined twice', () => {
  it('asks each path once per form, and each row field once per list', () => {
    for (const form of ALL_FORMS) {
      const paths = form.fields.map((spec) => spec.path);
      expect(new Set(paths).size, form.id).toBe(paths.length);
      for (const spec of form.fields) {
        const rows = (spec.row ?? []).map((row) => row.path);
        expect(new Set(rows).size, `${form.id}: ${spec.path}`).toBe(rows.length);
      }
    }
  });

  it('takes a path several forms ask from one shared spec, changing only its wording', () => {
    // person.age is asked by the core and reworded by calculator forms.
    expect(specsByPath(ALL_FORMS).get('person.age')?.size).toBeGreaterThan(1);
    expect(specDrift(ALL_FORMS)).toEqual([]);
  });

  it('checks a shared path even when only one form asks it', () => {
    // A form that redefines a shared spec beyond its wording is caught although
    // no other form asks that path (one distinct spec object for the path).
    const [path, base] = [...SHARED_SPECS].find(([key]) => specsByPath(ALL_FORMS).get(key)?.size === 1) ?? [];
    expect(path).toBeDefined();
    const form = ALL_FORMS.find((candidate) => candidate.fields.some((spec) => spec.path === path));
    expect(form).toBeDefined();
    if (!form || !base) return;
    const diverged: FormSpec = {
      ...form,
      fields: form.fields.map((spec) => (spec.path === path ? { ...spec, min: -123 } : spec)),
    };
    expect(specDrift([diverged])).toEqual([`${path}: min`]);
  });
});
