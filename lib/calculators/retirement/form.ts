/**
 * Retirement calculator form (docs/rebuild-plan.md sections 2.12 and 2.14):
 * every field the retirement engine uses, in topic screens. The calculator
 * page shows them all; the retirement intake asks the four screens after
 * the core, the assumptions last (O3). The basics are the core facts the
 * engine reads, with the old calculator's help; take-home pay is not one.
 */

import {
  AGE,
  CORE_FIELDS,
  CORE_SCREENS,
  FILING_STATUS,
  INVESTED_BALANCE,
  MONTHLY_INVESTING,
  NECESSARY_MONTHLY,
  NET_PAY,
  RETIREMENT_AFTER_AGE,
  RETIREMENT_AGE,
  STATE,
  intakeDerivedWrites,
  withOverrides,
} from '@/lib/fields/shared';
import type { FieldSpec, FormSpec, ScreenNote, ScreenSpec } from '@/lib/fields/types';
import { formatCurrency } from '@/lib/format';
import { FILING_STATUS_META } from '@/lib/constants/labels';
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

// The basics as the retirement page asks them: the old calculator's help on
// the facts it asked. Core screens show on the calculator page only (the
// intake asks the shared core), so this copy never reaches the wizard.
const CURRENT_AGE = withOverrides(AGE, { help: 'Your current age' });
const HOME_STATE = withOverrides(STATE, { help: 'For state tax calculations', placeholder: 'Select your state...' });
const MUST_PAY = withOverrides(NECESSARY_MONTHLY, {
  help: 'Essential monthly expenses',
  hint: NECESSARY_MONTHLY.help,
  placeholder: '4,000',
});

/**
 * O10: the filing status says when the saved one runs as single, whatever
 * the results column shows (none yet, out of date, or a failed run): in full
 * as a note on the open card, and in the collapsed card's summary.
 */
const FILING = withOverrides(FILING_STATUS, {
  summary: (value) => {
    const status = value as FilingStatus;
    return retirementFilingStatus(status) === status ? null : `${FILING_STATUS_META[status].phrase}, run here as single`;
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
  (spec) => [CURRENT_AGE, HOME_STATE, FILING, MUST_PAY].find((own) => own.path === spec.path) ?? spec
);

const BASICS_SCREENS: readonly ScreenSpec[] = CORE_SCREENS.map((screen) => ({
  ...screen,
  fields: screen.fields.filter((path) => path !== NET_PAY.path),
  ...(screen.id === 'about' ? { notes: [FILING_STATUS_NOTE] } : {}),
}));

// Placeholders show only while a field is empty. The help on the savings,
// target and Social Security screens stays the intake's, word for word: the
// wizard asks these screens too.
const MONTHLY_SAVINGS = withOverrides(MONTHLY_INVESTING, {
  placeholder: '2,000',
  summary: (value) => `saving ${formatCurrency(value as number)}/mo`,
});
const STARTING_BALANCE = withOverrides(INVESTED_BALANCE, {
  placeholder: '10,000',
  summary: (value) => `${formatCurrency(value as number)} invested`,
});
const RETIRE_AT = withOverrides(RETIREMENT_AGE, { summary: (value) => `retire at ${value as number}` });

export const RETIREMENT_FORM: FormSpec = {
  id: 'retirement',
  fields: [
    ...BASICS,
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
    ...BASICS_SCREENS,
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
  relations: [RETIREMENT_AFTER_AGE, LIFE_EXPECTANCY_AFTER_RETIREMENT],
  onSubmit: intakeDerivedWrites,
};
