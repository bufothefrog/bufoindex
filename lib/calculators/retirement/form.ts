/**
 * Retirement calculator form (provisional, w1).
 *
 * Behaviour-preserving: the screens carry exactly the questions the guided
 * intake asked before the rebuild (the shared core, then retirement age,
 * invested balance and monthly investing, one per screen). Slice c1 expands
 * this to the full field set (savings, target, ss-healthcare, assumptions)
 * in the same change that makes the calculator read those fields, and swaps
 * the intake destination for calculatorHref('retirement', { fromProfile: true }).
 */

import {
  AGE_BELOW_RETIREMENT,
  CORE_FIELDS,
  CORE_RELATIONS,
  CORE_SCREENS,
  INVESTED_BALANCE,
  MONTHLY_INVESTING,
  RETIREMENT_AGE,
  intakeOnSubmit,
} from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';
import { retirementLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

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
  relations: [...CORE_RELATIONS, AGE_BELOW_RETIREMENT],
  onSubmit: intakeOnSubmit,
};

/**
 * Where the retirement intake leads once finished. Until c1 lands this is
 * today's hash link (O6: the wizard keeps producing it for unmigrated
 * calculators).
 */
export function retirementIntakeDestination(profile: FinancialProfile): string {
  return retirementLink(profile);
}
