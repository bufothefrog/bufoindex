/**
 * Leverage comparison form. Provisional (slice w1): today's intake
 * questions for the leverage intent, in today's order. It has no core
 * screens; the horizon screen asks the age itself, and in 'remaining' mode
 * the intake drops it there because the core flow asked it. Slice c7 grows
 * the form to every field the comparison uses (docs/rebuild-plan.md
 * sections 2.12 and 2.14).
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

const STOP_AGE: FieldSpec = withOverrides(RETIREMENT_AGE, { label: 'Age you plan to stop contributing' });

const STARTING_BALANCE: FieldSpec = withOverrides(INVESTED_BALANCE, {
  label: 'Starting balance',
  help: 'What you already have invested. A rough number is fine.',
});

export const LEVERAGE_FORM: FormSpec = {
  id: 'leverage',
  fields: [AGE, STOP_AGE, TAXABLE_MONTHLY, STARTING_BALANCE],
  screens: [
    {
      id: 'horizon',
      title: 'What is your time horizon?',
      description: 'The comparison runs from now until you plan to stop contributing.',
      tier: 'details',
      fields: [AGE.path, STOP_AGE.path],
    },
    {
      id: 'taxable-investing',
      title: 'How much goes into a taxable brokerage account each month?',
      description: 'The leverage comparison applies to taxable contributions, outside retirement accounts.',
      tier: 'details',
      fields: [TAXABLE_MONTHLY.path],
    },
    { id: 'invested', title: 'Roughly how much do you have invested?', tier: 'details', fields: [STARTING_BALANCE.path] },
  ],
  relations: [RETIREMENT_AFTER_AGE],
  onSubmit: intakeDerivedWrites,
};
