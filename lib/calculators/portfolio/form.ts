/**
 * Portfolio rebalancer form. Provisional (slice w1): today's intake
 * questions for the portfolio intent, in today's order, the shared core
 * included. Slice c5 grows it to every field the rebalancer uses and drops
 * the core screens (O5; docs/rebuild-plan.md sections 2.12 and 2.14).
 *
 * The new-cash question still writes the deprecated
 * investing.newCashThisMonth, which the profile store mirrors into the
 * Brokerage deposit; c5 decides how a deposit counts as provided.
 */

import { TARGET_MIX_OPTIONS } from '@/lib/constants/labels';
import {
  CORE_FIELDS,
  CORE_SCREENS,
  NET_PAY_AT_MOST_GROSS,
  intakeDerivedWrites,
  offeredWithSaved,
} from '@/lib/fields/shared';
import type { FieldSpec, FormSpec } from '@/lib/fields/types';

const NEW_CASH: FieldSpec = {
  path: 'investing.newCashThisMonth',
  kind: 'money',
  label: 'New cash to invest this month',
  help: 'Money you are ready to put into your accounts now.',
  min: 0,
  tier: 'details',
};

/** The three presets; a custom mix is set on the calculator (and kept here once saved). */
const TARGET_MIX: FieldSpec = {
  path: 'investing.targetMix',
  kind: 'choice',
  label: 'Target mix',
  options: offeredWithSaved(
    'investing.targetMix',
    TARGET_MIX_OPTIONS.filter((option) => option.value !== 'custom'),
    TARGET_MIX_OPTIONS
  ),
  tier: 'details',
};

export const PORTFOLIO_FORM: FormSpec = {
  id: 'portfolio',
  fields: [...CORE_FIELDS, NEW_CASH, TARGET_MIX],
  screens: [
    ...CORE_SCREENS,
    { id: 'new-cash', title: 'How much new cash are you investing this month?', tier: 'details', fields: [NEW_CASH.path] },
    {
      id: 'target-mix',
      title: 'Which stock and bond mix are you aiming for?',
      description: 'You can set a custom mix on the calculator.',
      tier: 'details',
      fields: [TARGET_MIX.path],
    },
  ],
  relations: [NET_PAY_AT_MOST_GROSS],
  onSubmit: intakeDerivedWrites,
};
