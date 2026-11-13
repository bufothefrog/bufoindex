/**
 * Portfolio rebalancer form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the rebalancer uses, settings last (O3).
 *
 * - targets: the target mix, Custom included; Custom shows the class-targets
 *   editor (which also registers custom asset classes). Shown while at least
 *   one account is rebalanced.
 * - accounts: the shared account list (lib/fields/shared.ts), the single
 *   record of what the visitor owns.
 * - holdings: what each account holds, at what price; shown while an
 *   account has holdings.
 * - new-cash (calculator only): this run's new cash per account, Auto from
 *   the normal contributions.
 * - settings: whole or fractional shares, taxable selling and placement
 *   advice.
 *
 * There is no core screen: the rebalancer uses none of the basics, so
 * /start/portfolio does not ask them first (O5).
 */

import { ACCOUNTS, ACCOUNTS_SCREEN, intakeDerivedWrites } from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';
import { notRebalancedNote } from '@/lib/profile/accounts';
import {
  ALLOW_TAXABLE_SELLING,
  CLASS_TARGETS,
  HOLDINGS,
  MODE,
  NEW_CASH,
  SETTINGS_FIELDS,
  SHOW_PLACEMENT_ADVICE,
  TARGET_MIX,
} from './fields';

export const PORTFOLIO_FORM: FormSpec = {
  id: 'portfolio',
  fields: [TARGET_MIX, CLASS_TARGETS, ACCOUNTS, HOLDINGS, NEW_CASH, ...SETTINGS_FIELDS],
  screens: [
    {
      id: 'targets',
      title: 'Target allocation',
      question: 'Which stock and bond mix are you aiming for?',
      tier: 'details',
      fields: [TARGET_MIX.path, CLASS_TARGETS.path],
    },
    ACCOUNTS_SCREEN,
    {
      id: 'holdings',
      title: 'Holdings',
      question: 'What does each account hold today?',
      description: 'Prices are taken as current and executable.',
      tier: 'details',
      fields: [HOLDINGS.path],
    },
    {
      // Calculator-only: one run's new cash, Auto from the normal
      // contributions (Surface in lib/fields/types.ts).
      id: 'new-cash',
      title: 'New cash this month',
      tier: 'details',
      surface: 'calculator',
      fields: [NEW_CASH.path],
      notes: [{ text: (get) => notRebalancedNote(get) ?? undefined }],
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
