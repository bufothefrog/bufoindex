/**
 * Retirement calculator form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the retirement engine uses, in topic screens. The calculator
 * page shows them all; the retirement intake asks the profile screens after
 * the core (the shared accounts screen and the target). Monthly investing
 * is a calculator-only control: Auto is the sum of the normal
 * contributions, Custom one run's own figure. The optional Social Security and healthcare
 * screen is asked by the profile form only, the claiming age is a
 * calculator-only control, and the assumptions are a collapsed card on the
 * page. The basics are the core facts the
 * engine reads, with the shared help; take-home pay is not one.
 */

import {
  ACCOUNTS,
  ACCOUNTS_SCREEN,
  CORE_FIELDS,
  CORE_SCREENS,
  FILING_STATUS,
  MONTHLY_INVESTING,
  NECESSARY_MONTHLY,
  NET_PAY,
  RETIREMENT_AFTER_AGE,
  RETIREMENT_AGE,
  STATE,
  filingStatusSummary,
  intakeDerivedWrites,
  withOverrides,
} from '@/lib/fields/shared';
import type { FieldSpec, FormSpec, ScreenNote, ScreenSpec } from '@/lib/fields/types';
import { formatCurrency } from '@/lib/format';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import { monthlyInvestingAuto } from '@/lib/profile/accounts';
import type { FilingStatus } from '@/lib/profile/types';
import { filingStatusNote, retirementFilingStatus } from './bindings';
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

// The basics as the retirement page asks them: the shared help, with the
// old calculator's placeholders. Core screens show on the calculator page
// only (the intake asks the shared core).
const HOME_STATE = withOverrides(STATE, { placeholder: 'Select your state...' });
const MUST_PAY = withOverrides(NECESSARY_MONTHLY, { placeholder: '4,000' });

/**
 * O10: the filing status says when the saved one runs as single, whatever
 * the results column shows (none yet, out of date, or a failed run): in full
 * as a note on the open card, and in the collapsed card's summary. A status
 * that runs as-is shows as the shared summary piece ("single").
 */
const FILING = withOverrides(FILING_STATUS, {
  summary: (value) => {
    const status = value as FilingStatus;
    return retirementFilingStatus(status) === status
      ? filingStatusSummary(status)
      : `${FILING_STATUS_META[status].phrase}, run here as single`;
  },
});

const FILING_STATUS_NOTE: ScreenNote = {
  text: (get) => filingStatusNote(get(FILING_STATUS.path) as FilingStatus) ?? undefined,
};

/**
 * The basics the retirement engine reads: every core fact except take-home
 * pay, which no retirement binding reads (so neither does its relation to
 * gross pay hold results back here).
 */
const BASICS: readonly FieldSpec[] = CORE_FIELDS.filter((spec) => spec !== NET_PAY).map(
  (spec) => [HOME_STATE, FILING, MUST_PAY].find((own) => own.path === spec.path) ?? spec
);

const BASICS_SCREENS: readonly ScreenSpec[] = CORE_SCREENS.map((screen) => ({
  ...screen,
  fields: screen.fields.filter((path) => path !== NET_PAY.path),
  ...(screen.id === 'about' ? { notes: [FILING_STATUS_NOTE] } : {}),
}));

// The help on the target and Social Security screens stays the intake's,
// word for word: the wizard asks these screens too.
const MONTHLY_SAVINGS = withOverrides(MONTHLY_INVESTING, {
  summary: (value, get) =>
    `saving ${formatCurrency(typeof value === 'number' ? value : monthlyInvestingAuto(get))}/mo`,
});
const RETIRE_AT = withOverrides(RETIREMENT_AGE, { summary: (value) => `retire at ${value as number}` });

export const RETIREMENT_FORM: FormSpec = {
  id: 'retirement',
  fields: [
    ...BASICS,
    ACCOUNTS,
    MONTHLY_SAVINGS,
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
    ...BASICS_SCREENS,
    ACCOUNTS_SCREEN,
    {
      // Calculator-only: Auto follows the contribution answers, so the
      // profile does not ask it (Surface in lib/fields/types.ts).
      id: 'monthly-investing',
      title: 'Monthly investing',
      tier: 'details',
      surface: 'calculator',
      fields: [MONTHLY_SAVINGS.path],
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
      description: "Amounts are in today's dollars.",
      tier: 'details',
      optional: true,
      fields: [SOCIAL_SECURITY_BENEFIT.path, ANNUAL_HEALTHCARE_COST.path],
    },
    {
      // Calculator-only: when to claim compares one run with another, so
      // only this page asks it (Surface in lib/fields/types.ts).
      id: 'claiming',
      title: 'When to claim Social Security',
      description: "Amounts are in today's dollars.",
      tier: 'details',
      surface: 'calculator',
      fields: [SOCIAL_SECURITY_AGE.path],
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
  relations: [RETIREMENT_AFTER_AGE, LIFE_EXPECTANCY_AFTER_RETIREMENT],
  onSubmit: intakeDerivedWrites,
};
