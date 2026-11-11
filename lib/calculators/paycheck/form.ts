/**
 * Paycheck allocator form (provisional, w1).
 *
 * Behaviour-preserving: the screens carry exactly the questions the guided
 * intake asked before the rebuild (the shared core, the fun-money range, the
 * workplace plan and, with a plan, its match terms). Slice c3 expands this
 * to the full field set (spending-bonus, emergency-fund, 401k, hsa,
 * ira-taxable, debts, assumptions) in the same change that makes the
 * calculator read those fields, and swaps the intake destination for
 * calculatorHref('paycheck', { fromProfile: true }).
 */

import { CORE_FIELDS, CORE_RELATIONS, CORE_SCREENS, intakeOnSubmit } from '@/lib/fields/shared';
import type { CrossFieldRule, FieldSpec, FormSpec, Get } from '@/lib/fields/types';
import { paycheckLink } from '@/lib/profile/links';
import type { FinancialProfile } from '@/lib/profile/types';

export const FUN_MONEY_MIN: FieldSpec = {
  path: 'spending.funMoneyMin',
  kind: 'money',
  label: 'At least, per month',
  min: 0,
  tier: 'details',
};

export const FUN_MONEY_MAX: FieldSpec = {
  path: 'spending.funMoneyMax',
  kind: 'money',
  label: 'At most, per month',
  min: 0,
  tier: 'details',
};

export const HAS_401K: FieldSpec = {
  path: 'workplace.has401k',
  kind: 'boolean',
  label: 'Workplace retirement plan',
  options: [
    { value: true, label: 'Yes', description: 'Not sure? Pick Yes and check your benefits portal later.' },
    { value: false, label: 'No' },
  ],
  tier: 'details',
};

const hasPlan = (get: Get) => get(HAS_401K.path) === true;

export const MATCH_PERCENT: FieldSpec = {
  path: 'workplace.matchPercent',
  kind: 'percent',
  label: 'Employer match rate',
  help: 'What your employer adds per dollar you contribute. 50% means 50 cents per dollar.',
  min: 0,
  max: 2,
  tier: 'details',
  visibleWhen: hasPlan,
};

export const MATCH_LIMIT: FieldSpec = {
  path: 'workplace.matchLimit',
  kind: 'percent',
  label: 'Matched up to this share of your pay',
  help: 'In "50% of the first 6%", this is the 6%.',
  min: 0,
  max: 1,
  tier: 'details',
  visibleWhen: hasPlan,
};

export const FUN_MONEY_RANGE: CrossFieldRule = {
  lower: FUN_MONEY_MIN.path,
  upper: FUN_MONEY_MAX.path,
  strict: false,
  checkOn: FUN_MONEY_MAX.path,
  message: 'The minimum is above the maximum. Adjust one of them.',
};

export const PAYCHECK_FORM: FormSpec = {
  id: 'paycheck',
  fields: [...CORE_FIELDS, FUN_MONEY_MIN, FUN_MONEY_MAX, HAS_401K, MATCH_PERCENT, MATCH_LIMIT],
  screens: [
    ...CORE_SCREENS,
    {
      id: 'fun-money',
      title: 'How much fun money do you want each month?',
      description: 'Spending on things you enjoy, beyond the must-pay costs. A range is fine.',
      tier: 'details',
      fields: [FUN_MONEY_MIN.path, FUN_MONEY_MAX.path],
    },
    {
      id: 'workplace',
      title: 'Does your employer offer a 401(k) or similar plan?',
      tier: 'details',
      fields: [HAS_401K.path],
    },
    {
      id: 'match',
      title: 'How does the employer match work?',
      description:
        'Often written as "50% of the first 6% of pay". A guess is fine; your benefits portal has the exact terms.',
      tier: 'details',
      fields: [MATCH_PERCENT.path, MATCH_LIMIT.path],
    },
  ],
  relations: [...CORE_RELATIONS, FUN_MONEY_RANGE],
  onSubmit: intakeOnSubmit,
};

/** Where the paycheck intake leads once finished (today's hash link until c3). */
export function paycheckIntakeDestination(profile: FinancialProfile): string {
  return paycheckLink(profile);
}
