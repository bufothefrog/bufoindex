/**
 * Portfolio rebalancer form (provisional, w1).
 *
 * The rebalancer reads none of the shared basics, so this form has no core
 * screen and /start/portfolio skips the core gate (O5). The screens carry the
 * two portfolio questions the guided intake asked before the rebuild (new
 * cash this month, target mix). Slice c5 expands this to targets, accounts,
 * holdings and settings in the same change that makes the calculator read
 * those fields (which also retires investing.newCashThisMonth), and swaps the
 * intake destination for calculatorHref('portfolio', { fromProfile: true }).
 */

import { intakeOnSubmit } from '@/lib/fields/shared';
import type { FieldSpec, FormSpec } from '@/lib/fields/types';
import { TARGET_MIX_OPTIONS } from '@/lib/constants/labels';
import { portfolioLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

export const NEW_CASH: FieldSpec = {
  path: 'investing.newCashThisMonth',
  kind: 'money',
  label: 'New cash to invest this month',
  help: 'Money you are ready to put into your accounts now.',
  min: 0,
  tier: 'details',
};

export const TARGET_MIX: FieldSpec = {
  path: 'investing.targetMix',
  kind: 'choice',
  label: 'Target mix',
  options: TARGET_MIX_OPTIONS,
  tier: 'details',
};

export const PORTFOLIO_FORM: FormSpec = {
  id: 'portfolio',
  fields: [NEW_CASH, TARGET_MIX],
  screens: [
    { id: 'new-cash', title: 'How much new cash are you investing this month?', tier: 'details', fields: [NEW_CASH.path] },
    {
      id: 'target-mix',
      title: 'Which stock and bond mix are you aiming for?',
      description: 'You can set a custom mix on the calculator.',
      tier: 'details',
      fields: [TARGET_MIX.path],
    },
  ],
  onSubmit: intakeOnSubmit,
};

/** Where the portfolio intake leads once finished (today's hash link until c5). */
export function portfolioIntakeDestination(profile: FinancialProfile): string {
  return portfolioLink(profile);
}
