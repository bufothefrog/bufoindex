/**
 * Form to bindings: every fact a calculator form asks is read by one of that
 * calculator's bindings, so no field on a calculator page can hold its
 * results back (a field error or a relation marks them out of date) without
 * feeding them. The bindings tests check the other direction (every bound
 * profile path is asked).
 *
 * A path counts as read when a binding reads it, or reads a list or section
 * that holds it, for at least one of the profiles below (a field behind a
 * visibleWhen is read only in the state that shows it).
 */

import { describe, expect, it } from 'vitest';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { PORTFOLIO_CALCULATOR } from '@/lib/calculators/portfolio/definition';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import type { CalculatorDefinition } from '@/lib/calculators/types';
import { toEngineInputs } from '@/lib/fields/binding';
import type { Get } from '@/lib/fields/types';
import { fromDefaults } from '@/test/utils/intake';

/** Profiles that between them make every binding read every path it can. */
const STATES: readonly Get[] = [
  fromDefaults(),
  fromDefaults({ 'investing.targetMix': 'custom', 'assumptions.retirement.riskProfile': 'custom' }),
];

function readPaths<E, R>(def: CalculatorDefinition<E, R>): Set<string> {
  const read = new Set<string>();
  for (const get of STATES) {
    const recording: Get = (path) => {
      read.add(path);
      return get(path);
    };
    toEngineInputs(def.bindings, def.engineBase(), recording);
  }
  return read;
}

const covers = (read: ReadonlySet<string>, path: string) =>
  [...read].some((each) => each === path || path.startsWith(`${each}.`));

describe.each([
  ['retirement', RETIREMENT_CALCULATOR],
  ['paycheck', PAYCHECK_CALCULATOR],
  ['portfolio', PORTFOLIO_CALCULATOR],
  ['leverage', LEVERAGE_CALCULATOR],
] as const)('%s: every asked fact feeds the engine', (_id, def) => {
  it('is read by a binding', () => {
    const read = readPaths(def as CalculatorDefinition<unknown, unknown>);
    const asked = def.form.fields.flatMap((spec) => [spec.path, ...(spec.covers ?? [])]);
    const unread = asked.filter((path) => !covers(read, path));
    expect(unread).toEqual([]);
  });
});

describe('retirement: take-home pay', () => {
  it('is neither asked nor checked against gross pay, since no retirement binding reads it', () => {
    expect(RETIREMENT_CALCULATOR.form.fields.map((spec) => spec.path)).not.toContain('income.netPerPaycheck');
    expect((RETIREMENT_CALCULATOR.form.relations ?? []).map((rule) => rule.lower)).not.toContain('income.netPerPaycheck');
  });
});
