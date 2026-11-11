/**
 * Retirement calculator form. Provisional (slice w1): today's intake
 * questions for the retirement intent, in today's order. Slice c1 grows it
 * to every field the calculator uses (docs/rebuild-plan.md sections 2.12 and
 * 2.14).
 */

import {
  CORE_FIELDS,
  CORE_SCREENS,
  INVESTED_BALANCE,
  MONTHLY_INVESTING,
  NET_PAY_AT_MOST_GROSS,
  RETIREMENT_AFTER_AGE,
  RETIREMENT_AGE,
  intakeDerivedWrites,
} from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';

export const RETIREMENT_FORM: FormSpec = {
  id: 'retirement',
  fields: [...CORE_FIELDS, RETIREMENT_AGE, INVESTED_BALANCE, MONTHLY_INVESTING],
  screens: [
    ...CORE_SCREENS,
    { id: 'retire-age', title: 'When would you like to retire?', tier: 'details', fields: [RETIREMENT_AGE.path] },
    { id: 'invested', title: 'Roughly how much do you have invested?', tier: 'details', fields: [INVESTED_BALANCE.path] },
    {
      id: 'monthly-investing',
      title: 'How much do you invest each month?',
      tier: 'details',
      fields: [MONTHLY_INVESTING.path],
    },
  ],
  relations: [NET_PAY_AT_MOST_GROSS, RETIREMENT_AFTER_AGE],
  onSubmit: intakeDerivedWrites,
};
