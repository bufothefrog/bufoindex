/**
 * Portfolio rebalancer form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the rebalancer uses, on four screens that the calculator page
 * shows and the portfolio intake asks, settings last (O3).
 *
 * - targets: the target mix, Custom included; Custom shows the class-targets
 *   editor (which also registers custom asset classes).
 * - accounts: each account's name, type and new cash. The deposits are the
 *   one record of the new cash: an account list in profile.provided means
 *   they are answered. The deprecated investing.newCashThisMonth is no
 *   longer asked; a saved answer to it already sits in the Brokerage deposit
 *   (migrateProfile), and the accounts screen shows it prefilled until the
 *   list itself is answered.
 * - holdings: what each account holds, at what price.
 * - settings: whole or fractional shares, taxable selling and placement
 *   advice.
 *
 * There is no core screen: the rebalancer uses none of the basics, so
 * /start/portfolio does not ask them first (O5).
 */

import { intakeDerivedWrites } from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';
import {
  ACCOUNTS,
  ALLOW_TAXABLE_SELLING,
  CLASS_TARGETS,
  HOLDINGS,
  MODE,
  SETTINGS_FIELDS,
  SHOW_PLACEMENT_ADVICE,
  TARGET_MIX,
} from './fields';

export const PORTFOLIO_FORM: FormSpec = {
  id: 'portfolio',
  fields: [TARGET_MIX, CLASS_TARGETS, ACCOUNTS, HOLDINGS, ...SETTINGS_FIELDS],
  screens: [
    {
      id: 'targets',
      title: 'Target allocation',
      question: 'Which stock and bond mix are you aiming for?',
      tier: 'details',
      fields: [TARGET_MIX.path, CLASS_TARGETS.path],
    },
    {
      id: 'accounts',
      title: 'Accounts',
      question: 'How much new cash are you investing this month?',
      description: 'List each account you invest through and the new cash going into it.',
      tier: 'details',
      fields: [ACCOUNTS.path],
    },
    {
      id: 'holdings',
      title: 'Holdings',
      question: 'What does each account hold today?',
      description: 'A ticker, its current price and your shares. Prices are taken as current and executable.',
      tier: 'details',
      fields: [HOLDINGS.path],
    },
    {
      id: 'settings',
      title: 'Settings',
      question: 'How should the rebalance trade?',
      tier: 'assumption',
      fields: [MODE.path, ALLOW_TAXABLE_SELLING.path, SHOW_PLACEMENT_ADVICE.path],
      notes: [
        {
          text: 'Selling in taxable may trigger capital gains tax.',
          tone: 'caution',
          visibleWhen: (get) => get(ALLOW_TAXABLE_SELLING.path) === true,
        },
      ],
    },
  ],
  onSubmit: intakeDerivedWrites,
};
