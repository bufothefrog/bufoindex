/**
 * Leverage comparison form (provisional, w1).
 *
 * Behaviour-preserving: the screens carry exactly the questions the guided
 * intake asked before the rebuild (the horizon as current age and the age
 * contributions stop, the monthly taxable contribution, the starting
 * balance). Age is a core path, so in 'remaining' mode the intake drops it
 * from the horizon screen. Slice c7 reshapes this into comparison, facts and
 * market screens in the same change that makes the calculator read those
 * fields, and swaps the intake destination for
 * calculatorHref('leverage', { fromProfile: true }).
 */

import {
  AGE,
  AGE_BELOW_RETIREMENT,
  INVESTED_BALANCE,
  RETIREMENT_AGE,
  TAXABLE_MONTHLY,
  intakeOnSubmit,
  withOverrides,
} from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';
import { leverageLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

const STOP_AGE = withOverrides(RETIREMENT_AGE, { label: 'Age you plan to stop contributing' });

const STARTING_BALANCE = withOverrides(INVESTED_BALANCE, {
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
  relations: [AGE_BELOW_RETIREMENT],
  onSubmit: intakeOnSubmit,
};

/** Where the leverage intake leads once finished (today's query link until c7). */
export function leverageIntakeDestination(profile: FinancialProfile): string {
  return leverageLink(profile);
}
