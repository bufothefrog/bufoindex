/**
 * Paycheck allocator form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the allocator uses, in topic screens. The calculator page
 * shows them all; the paycheck intake asks the six profile screens after
 * the core, debts included (O4). The assumptions are a collapsed card on the
 * page only (the intakes do not ask tier 'assumption' screens).
 */

import {
  AGE,
  CORE_FIELDS,
  CORE_SCREENS,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_MONTHS,
  GROSS_PAY,
  NECESSARY_MONTHLY,
  NET_PAY,
  NET_PAY_AT_MOST_GROSS,
  TAXABLE_MONTHLY,
  intakeDerivedWrites,
  withOverrides,
} from '@/lib/fields/shared';
import type { FieldSpec, FormSpec, ScreenSpec } from '@/lib/fields/types';
import { formatCurrency, formatPercent } from '@/lib/format';
import {
  AFTER_TAX_AVAILABLE,
  BONUS_AMOUNT,
  BONUS_FREQUENCY,
  BONUS_NOTE,
  CONTRIBUTION_PERCENT,
  CONTRIBUTION_TYPE,
  DEBTS,
  EXPECTED_RETIREMENT_BRACKET,
  FUN_MONEY_MAX,
  FUN_MONEY_MIN,
  FUN_MONEY_RANGE,
  HAS_401K,
  HAS_BONUS,
  HSA_COVERAGE,
  HSA_ELIGIBLE,
  HSA_EMPLOYER_CONTRIBUTION,
  HSA_INVESTING,
  HSA_MONTHLY_CONTRIBUTION,
  IRA_ROTH,
  IRA_ROTH_BALANCE,
  IRA_ROTH_MONTHLY,
  IRA_TRADITIONAL,
  IRA_TRADITIONAL_BALANCE,
  IRA_TRADITIONAL_MONTHLY,
  MATCH_LIMIT,
  MATCH_PERCENT,
  OPTIMIZATION_GOAL,
  RISK_TOLERANCE,
  ROTH_CONTRIBUTION_PERCENT,
  TAX_NOTE,
} from './fields';

// The basics as the allocator page asks them: the shared help, with the
// old input cards' placeholders. Core screens show on the calculator page
// only (the intake asks the shared core).
const BASICS_OWN: readonly FieldSpec[] = [
  withOverrides(AGE, { placeholder: '25' }),
  withOverrides(GROSS_PAY, { placeholder: '2,500' }),
  withOverrides(NET_PAY, { placeholder: '1,900' }),
  withOverrides(NECESSARY_MONTHLY, { placeholder: '2,500' }),
];
const BASICS: readonly FieldSpec[] = CORE_FIELDS.map(
  (spec) => BASICS_OWN.find((own) => own.path === spec.path) ?? spec
);

// Placeholders show only while a field is empty; help on the screens the
// wizard also asks stays the intake's, word for word.
const EMERGENCY_BALANCE = withOverrides(EMERGENCY_FUND_BALANCE, {
  placeholder: '10,000',
  summary: (value) => `${formatCurrency(value as number)} saved`,
});
const EMERGENCY_APY = withOverrides(EMERGENCY_FUND_APY, {
  summary: (value) => `${formatPercent(value as number)} APY`,
});
const TAXABLE = withOverrides(TAXABLE_MONTHLY, {
  summary: (value) => ((value as number) > 0 ? `taxable ${formatCurrency(value as number)}/mo` : 'no taxable investing'),
});

/** The core screens, with the tax note (O9) on the one that asks state and filing status. */
const PAYCHECK_CORE_SCREENS: readonly ScreenSpec[] = CORE_SCREENS.map((screen) =>
  screen.id === 'about' ? { ...screen, notes: [TAX_NOTE] } : screen
);

export const PAYCHECK_FORM: FormSpec = {
  id: 'paycheck',
  fields: [
    ...BASICS,
    FUN_MONEY_MIN,
    FUN_MONEY_MAX,
    HAS_BONUS,
    BONUS_AMOUNT,
    BONUS_FREQUENCY,
    EMERGENCY_BALANCE,
    EMERGENCY_APY,
    EMERGENCY_FUND_MONTHS,
    HAS_401K,
    MATCH_PERCENT,
    MATCH_LIMIT,
    CONTRIBUTION_TYPE,
    CONTRIBUTION_PERCENT,
    ROTH_CONTRIBUTION_PERCENT,
    AFTER_TAX_AVAILABLE,
    HSA_ELIGIBLE,
    HSA_COVERAGE,
    HSA_MONTHLY_CONTRIBUTION,
    HSA_EMPLOYER_CONTRIBUTION,
    HSA_INVESTING,
    IRA_TRADITIONAL,
    IRA_TRADITIONAL_MONTHLY,
    IRA_TRADITIONAL_BALANCE,
    IRA_ROTH,
    IRA_ROTH_MONTHLY,
    IRA_ROTH_BALANCE,
    TAXABLE,
    DEBTS,
    RISK_TOLERANCE,
    OPTIMIZATION_GOAL,
    EXPECTED_RETIREMENT_BRACKET,
  ],
  screens: [
    ...PAYCHECK_CORE_SCREENS,
    {
      id: 'spending-bonus',
      title: 'Fun money and bonuses',
      question: 'How much fun money do you want each month?',
      tier: 'details',
      fields: [FUN_MONEY_MIN.path, FUN_MONEY_MAX.path, HAS_BONUS.path, BONUS_AMOUNT.path, BONUS_FREQUENCY.path],
      notes: [BONUS_NOTE],
    },
    {
      id: 'emergency-fund',
      title: 'Emergency fund',
      question: 'What does your emergency fund look like today?',
      tier: 'details',
      fields: [EMERGENCY_BALANCE.path, EMERGENCY_APY.path, EMERGENCY_FUND_MONTHS.path],
    },
    {
      id: '401k',
      title: '401(k) or similar plan',
      question: 'Does your employer offer a 401(k) or similar plan?',
      tier: 'details',
      fields: [
        HAS_401K.path,
        MATCH_PERCENT.path,
        MATCH_LIMIT.path,
        CONTRIBUTION_TYPE.path,
        CONTRIBUTION_PERCENT.path,
        ROTH_CONTRIBUTION_PERCENT.path,
        AFTER_TAX_AVAILABLE.path,
      ],
    },
    {
      id: 'hsa',
      title: 'Health savings account',
      question: 'Do you have a health savings account (HSA)?',
      tier: 'details',
      fields: [
        HSA_ELIGIBLE.path,
        HSA_COVERAGE.path,
        HSA_MONTHLY_CONTRIBUTION.path,
        HSA_EMPLOYER_CONTRIBUTION.path,
        HSA_INVESTING.path,
      ],
    },
    {
      id: 'ira-taxable',
      title: 'IRAs and taxable investing',
      question: 'Do you invest in an IRA or a taxable account?',
      tier: 'details',
      fields: [
        IRA_TRADITIONAL.path,
        IRA_TRADITIONAL_MONTHLY.path,
        IRA_TRADITIONAL_BALANCE.path,
        IRA_ROTH.path,
        IRA_ROTH_MONTHLY.path,
        IRA_ROTH_BALANCE.path,
        TAXABLE.path,
      ],
    },
    {
      id: 'debts',
      title: 'Debts',
      question: 'Do you have any debts?',
      tier: 'details',
      fields: [DEBTS.path],
    },
    {
      id: 'assumptions',
      title: 'Assumptions',
      question: 'Which assumptions should the allocation use?',
      tier: 'assumption',
      fields: [RISK_TOLERANCE.path, OPTIMIZATION_GOAL.path, EXPECTED_RETIREMENT_BRACKET.path],
    },
  ],
  relations: [NET_PAY_AT_MOST_GROSS, FUN_MONEY_RANGE],
  onSubmit: intakeDerivedWrites,
};
