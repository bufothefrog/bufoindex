/**
 * Retirement calculator form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the retirement engine uses, in topic screens. The calculator
 * page shows them all; the retirement intake asks the four screens after
 * the core, the assumptions last (O3).
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
  withOverrides,
} from '@/lib/fields/shared';
import type { FormSpec } from '@/lib/fields/types';
import { formatCurrency } from '@/lib/format';
import {
  ACCUMULATION_RETURN,
  ANNUAL_HEALTHCARE_COST,
  EFFECTIVE_TAX_RATE,
  HEALTHCARE_COST_MULTIPLIER,
  INFLATION_RATE,
  LIFE_EXPECTANCY,
  LIFE_EXPECTANCY_AFTER_RETIREMENT,
  RETIREMENT_RETURN,
  RISK_PROFILE,
  SOCIAL_SECURITY_AGE,
  SOCIAL_SECURITY_BENEFIT,
  TARGET_RETIREMENT_INCOME,
  VOLATILITY,
} from './fields';

const MONTHLY_SAVINGS = withOverrides(MONTHLY_INVESTING, {
  summary: (value) => `saving ${formatCurrency(value as number)}/mo`,
});
const STARTING_BALANCE = withOverrides(INVESTED_BALANCE, {
  summary: (value) => `${formatCurrency(value as number)} invested`,
});
const RETIRE_AT = withOverrides(RETIREMENT_AGE, { summary: (value) => `retire at ${value as number}` });

export const RETIREMENT_FORM: FormSpec = {
  id: 'retirement',
  fields: [
    ...CORE_FIELDS,
    MONTHLY_SAVINGS,
    STARTING_BALANCE,
    RETIRE_AT,
    TARGET_RETIREMENT_INCOME,
    LIFE_EXPECTANCY,
    SOCIAL_SECURITY_BENEFIT,
    SOCIAL_SECURITY_AGE,
    ANNUAL_HEALTHCARE_COST,
    RISK_PROFILE,
    ACCUMULATION_RETURN,
    RETIREMENT_RETURN,
    VOLATILITY,
    INFLATION_RATE,
    EFFECTIVE_TAX_RATE,
    HEALTHCARE_COST_MULTIPLIER,
  ],
  screens: [
    ...CORE_SCREENS,
    {
      id: 'savings',
      title: 'What are you investing today?',
      tier: 'details',
      fields: [MONTHLY_SAVINGS.path, STARTING_BALANCE.path],
    },
    {
      id: 'target',
      title: 'When would you like to retire?',
      description: "Your target income is in today's dollars.",
      tier: 'details',
      fields: [RETIRE_AT.path, TARGET_RETIREMENT_INCOME.path, LIFE_EXPECTANCY.path],
    },
    {
      id: 'ss-healthcare',
      title: 'Social Security and healthcare',
      question: 'What will Social Security and healthcare look like?',
      description: "Estimates in today's dollars are fine.",
      tier: 'details',
      fields: [SOCIAL_SECURITY_BENEFIT.path, SOCIAL_SECURITY_AGE.path, ANNUAL_HEALTHCARE_COST.path],
    },
    {
      id: 'assumptions',
      title: 'Assumptions',
      question: 'Which assumptions should the projection use?',
      tier: 'assumption',
      fields: [
        RISK_PROFILE.path,
        ACCUMULATION_RETURN.path,
        RETIREMENT_RETURN.path,
        VOLATILITY.path,
        INFLATION_RATE.path,
        EFFECTIVE_TAX_RATE.path,
        HEALTHCARE_COST_MULTIPLIER.path,
      ],
    },
  ],
  relations: [NET_PAY_AT_MOST_GROSS, RETIREMENT_AFTER_AGE, LIFE_EXPECTANCY_AFTER_RETIREMENT],
  onSubmit: intakeDerivedWrites,
};
