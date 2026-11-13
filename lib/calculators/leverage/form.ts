/**
 * Leverage comparison form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the comparison uses.
 *
 * - comparison (calculator only): the contribution, the horizon and the
 *   starting balance as nullable overrides whose auto values come from the
 *   profile, and the leverage ratio. The leverage ratio is a parameter of
 *   one comparison run, not a fact about the person, so this is the only
 *   screen that asks it.
 * - facts (intake only): the profile facts those overrides derive from. It
 *   also asks the age, which the intake drops in 'remaining' mode because
 *   the core asked it.
 * - market (assumptions): the five rates, with Restore defaults.
 */

import {
  AGE,
  INVESTED_BALANCE,
  RETIREMENT_AFTER_AGE,
  RETIREMENT_AGE,
  TAXABLE_MONTHLY,
  intakeDerivedWrites,
  withOverrides,
} from '@/lib/fields/shared';
import type { FieldSpec, FormSpec } from '@/lib/fields/types';
import {
  LEVERAGE_RATIO,
  MARKET_FIELDS,
  MONTHLY_CONTRIBUTION,
  STARTING_BALANCE,
  YEARS,
} from './fields';

const STOP_AGE: FieldSpec = withOverrides(RETIREMENT_AGE, { label: 'Age you plan to stop contributing' });

// The shared help names 401(k) and IRA money; this comparison is about
// taxable money, so the leverage intake keeps the calculator's own wording.
const INVESTED: FieldSpec = withOverrides(INVESTED_BALANCE, {
  label: 'Starting balance',
  help: 'Money already invested; 0 compares contributions only.',
});

export const LEVERAGE_FORM: FormSpec = {
  id: 'leverage',
  fields: [
    MONTHLY_CONTRIBUTION,
    YEARS,
    STARTING_BALANCE,
    LEVERAGE_RATIO,
    AGE,
    STOP_AGE,
    TAXABLE_MONTHLY,
    INVESTED,
    ...MARKET_FIELDS,
  ],
  screens: [
    {
      id: 'comparison',
      title: 'Contributions',
      tier: 'details',
      surface: 'calculator',
      fields: [MONTHLY_CONTRIBUTION.path, YEARS.path, STARTING_BALANCE.path, LEVERAGE_RATIO.path],
    },
    {
      id: 'facts',
      title: 'What goes into the comparison?',
      tier: 'details',
      surface: 'intake',
      fields: [AGE.path, STOP_AGE.path, TAXABLE_MONTHLY.path, INVESTED.path],
    },
    {
      id: 'market',
      title: 'Assumptions',
      question: 'Which market assumptions should the comparison use?',
      tier: 'assumption',
      fields: MARKET_FIELDS.map((spec) => spec.path),
    },
  ],
  relations: [RETIREMENT_AFTER_AGE],
  onSubmit: intakeDerivedWrites,
};
