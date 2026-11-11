/**
 * Leverage comparison form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the comparison uses.
 *
 * - comparison (calculator only): the contribution, the horizon and the
 *   starting balance as nullable overrides whose auto values come from the
 *   profile, and the leverage ratio.
 * - facts (intake only): the profile facts those overrides derive from, and
 *   the leverage ratio. It also asks the age, which the intake drops in
 *   'remaining' mode because the core asked it.
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
import { DEFAULT_LEVERAGE_PATHS } from '@/lib/constants/leverage';
import {
  LEVERAGE_RATIO,
  MARKET_FIELDS,
  MONTHLY_CONTRIBUTION,
  STARTING_BALANCE,
  YEARS,
} from './fields';

const STOP_AGE: FieldSpec = withOverrides(RETIREMENT_AGE, { label: 'Age you plan to stop contributing' });

const INVESTED: FieldSpec = withOverrides(INVESTED_BALANCE, {
  label: 'Starting balance',
  help: 'What you already have invested. A rough number is fine.',
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
      description:
        'The comparison runs from now until you plan to stop contributing. The leverage comparison applies to taxable contributions, outside retirement accounts.',
      tier: 'details',
      surface: 'intake',
      fields: [AGE.path, STOP_AGE.path, TAXABLE_MONTHLY.path, INVESTED.path, LEVERAGE_RATIO.path],
    },
    {
      id: 'market',
      title: 'Assumptions',
      question: 'Which market assumptions should the comparison use?',
      description:
        'Defaults are long-run planning figures with sources listed under Model and caveats. Change them to test a flat decade or higher borrowing costs.',
      tier: 'assumption',
      fields: MARKET_FIELDS.map((spec) => spec.path),
      notes: [
        {
          text: `${DEFAULT_LEVERAGE_PATHS} simulated paths with a fixed seed, so the same inputs always give the same results. A different seed would move the summary figures by a few percentage points.`,
        },
      ],
    },
  ],
  relations: [RETIREMENT_AFTER_AGE],
  onSubmit: intakeDerivedWrites,
};
