/**
 * Field specs shared by more than one form or flow (docs/rebuild-plan.md
 * section 2.4): one spec per profile fact, imported by every form that asks
 * it, plus the core screens every calculator intent starts from and the
 * profile-only screens. Specs that only one calculator asks live with that
 * calculator (lib/calculators/<id>/).
 *
 * Wording is the intake's; option labels come from lib/constants/labels.ts.
 * A form that needs its own label, help or tier for a shared fact uses
 * withOverrides instead of copying the spec.
 *
 * The cross-field rules and the derived writes the intake has always
 * applied live here too, because every form that asks the facts they
 * involve needs the same ones.
 */

import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { ACCOUNT_KIND_OPTIONS, FILING_STATUS_META, FILING_STATUS_OPTIONS } from '@/lib/constants/labels';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNT_PATHS,
  accountLabel,
  accountValue,
  accountsSummary,
  emergencyFundAccounts,
  monthlyInvestingAuto,
} from '@/lib/profile/accounts';
import { PAY_FREQUENCIES } from '@/lib/profile/defaults';
import type { FilingStatus, PayFrequency } from '@/lib/profile/types';
import { isFiniteNumber } from './runtime';
import type { CrossFieldRule, FieldOption, FieldSpec, Get, ScreenNote, ScreenSpec, Write } from './types';

/** A shared spec with a form's own wording or tier; the path and kind stay. */
export function withOverrides(spec: FieldSpec, overrides: Partial<Omit<FieldSpec, 'path' | 'kind'>>): FieldSpec {
  return { ...spec, ...overrides };
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * All four statuses (O10): the paycheck allocator models each of them, and
 * retirement runs the two it lacks as single, with a note on its page.
 */
const FILING_OPTIONS: readonly FieldOption[] = FILING_STATUS_OPTIONS.map(({ value }) => ({
  value,
  label: sentenceCase(FILING_STATUS_META[value].phrase),
}));

// ---------------------------------------------------------------------------
// Summary pieces of the core facts
// ---------------------------------------------------------------------------
//
// The wording of the core facts in one line, written once: the collapsed
// core cards on the calculator pages (each core spec's summary) and the
// guided flow's recap (coreSummary in lib/constants/intake.ts) both build
// from these. Each piece is null for a value it cannot word.

const GROSS_PAY_PATH = 'income.grossPerPaycheck';
const PAY_FREQUENCY_PATH = 'income.frequency';

/** 25 -> "25". */
export function ageSummary(age: unknown): string | null {
  return isFiniteNumber(age) ? String(age) : null;
}

/** "CA" -> "CA". */
export function stateSummary(state: unknown): string | null {
  return typeof state === 'string' && state.trim() !== '' ? state : null;
}

/** 'marriedJoint' -> "married filing jointly". */
export function filingStatusSummary(status: unknown): string | null {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(FILING_STATUS_META, status)
    ? FILING_STATUS_META[status as FilingStatus].phrase
    : null;
}

function cadence(frequency: unknown): string | null {
  return typeof frequency === 'string' && Object.prototype.hasOwnProperty.call(PAY_FREQUENCY_META, frequency)
    ? PAY_FREQUENCY_META[frequency as PayFrequency].cadence
    : null;
}

/** 4000, 'bi-weekly' -> "$4,000 gross every 2 weeks"; without a frequency, "$4,000 gross per paycheck". */
export function grossPaySummary(gross: unknown, frequency: unknown): string | null {
  if (!isFiniteNumber(gross)) return null;
  return `${formatCurrency(gross)} gross ${cadence(frequency) ?? 'per paycheck'}`;
}

/** 'semi-monthly' -> "paid twice a month"; used when no gross amount carries the cadence. */
export function payFrequencySummary(frequency: unknown): string | null {
  const text = cadence(frequency);
  return text ? `paid ${text}` : null;
}

/** 2550 -> "$2,550 take-home". */
export function takeHomeSummary(net: unknown): string | null {
  return isFiniteNumber(net) ? `${formatCurrency(net)} take-home` : null;
}

/** 3000 -> "$3,000 a month". */
export function monthlyCostSummary(amount: unknown): string | null {
  return isFiniteNumber(amount) ? `${formatCurrency(amount)} a month` : null;
}

// ---------------------------------------------------------------------------
// Core facts (every calculator intent asks them first)
// ---------------------------------------------------------------------------

export const AGE: FieldSpec = {
  path: 'person.age',
  kind: 'number',
  label: 'Your age',
  min: 16,
  max: 100,
  step: 1,
  tier: 'core',
  summary: (value) => ageSummary(value),
};

export const STATE: FieldSpec = {
  path: 'person.state',
  kind: 'state',
  label: 'State you live in',
  // The combobox can be emptied (a typed term that matches no state); an
  // empty answer is an error, never a skipped one saved as the old state.
  required: true,
  tier: 'core',
  summary: (value) => stateSummary(value),
};

export const FILING_STATUS: FieldSpec = {
  path: 'person.filingStatus',
  kind: 'choice',
  label: 'Tax filing status',
  options: FILING_OPTIONS,
  tier: 'core',
  summary: (value) => filingStatusSummary(value),
};

export const GROSS_PAY: FieldSpec = {
  path: GROSS_PAY_PATH,
  kind: 'money',
  label: 'Gross pay per paycheck',
  help: 'Before taxes and deductions.',
  min: 0,
  tier: 'core',
  // The gross amount carries the pay cadence: "$4,000 gross every 2 weeks".
  summary: (value, get) => grossPaySummary(value, get(PAY_FREQUENCY_PATH)),
};

export const PAY_FREQUENCY: FieldSpec = {
  path: PAY_FREQUENCY_PATH,
  kind: 'select',
  label: 'How often you are paid',
  options: PAY_FREQUENCIES.map((value): FieldOption => ({ value, label: PAY_FREQUENCY_META[value].intakeOption })),
  tier: 'core',
  // Worded on its own only when no gross amount already carries it.
  summary: (value, get) => (isFiniteNumber(get(GROSS_PAY_PATH)) ? null : payFrequencySummary(value)),
};

export const NET_PAY: FieldSpec = {
  path: 'income.netPerPaycheck',
  kind: 'money',
  label: 'Take-home pay per paycheck',
  help: 'What lands in your bank account after taxes and deductions.',
  min: 0,
  tier: 'core',
  summary: (value) => takeHomeSummary(value),
};

export const NECESSARY_MONTHLY: FieldSpec = {
  path: 'spending.necessaryMonthly',
  kind: 'money',
  label: 'Must-pay costs per month',
  help: 'Rent or mortgage, utilities, insurance, groceries, minimum debt payments.',
  min: 0,
  tier: 'core',
  summary: (value) => monthlyCostSummary(value),
};

// ---------------------------------------------------------------------------
// Facts more than one calculator asks
// ---------------------------------------------------------------------------

export const RETIREMENT_AGE: FieldSpec = {
  path: 'person.retirementAge',
  kind: 'number',
  label: 'Target retirement age',
  min: 30,
  max: 85,
  step: 1,
  tier: 'details',
};

/**
 * The monthly investing total: Auto (null) is the sum of the normal
 * contributions the other answers give (monthlyInvestingAuto: 401(k) with
 * the match, HSA with the employer's part, IRAs and taxable); Custom is the
 * visitor's own figure for one run. Asked only on the retirement page.
 */
export const MONTHLY_INVESTING: FieldSpec = {
  path: 'investing.monthlyContribution',
  kind: 'money',
  label: 'Monthly investing',
  min: 0,
  nullable: {
    // NullableField appends ": <amount>" to the Auto label, so the label does not carry it.
    autoLabel: 'From your answers',
    overrideDefault: (get) => monthlyInvestingAuto(get),
  },
  tier: 'details',
};

export const TAXABLE_MONTHLY: FieldSpec = {
  path: 'investing.taxableMonthlyContribution',
  kind: 'money',
  label: 'Monthly taxable contribution',
  help: 'Money you invest each month outside 401(k) and IRA accounts.',
  min: 0,
  tier: 'details',
};

/** True while no account holds the emergency fund, so the typed balance is the one in use. */
export function usesTypedEmergencyFund(get: Get): boolean {
  return emergencyFundAccounts(get).length === 0;
}

/**
 * The typed emergency fund. Hidden while an account holds the fund (a cash
 * account, or a brokerage with the tick): their value is the fund then, and
 * the stored answer is kept for when none does.
 */
export const EMERGENCY_FUND_BALANCE: FieldSpec = {
  path: 'cash.emergencyFundBalance',
  kind: 'money',
  label: 'Cash set aside for emergencies',
  min: 0,
  tier: 'details',
  visibleWhen: usesTypedEmergencyFund,
};

/** "Held in your accounts: Robinhood $10,350." while accounts hold the emergency fund; undefined otherwise. */
export function emergencyFundHeldText(get: Get): string | undefined {
  const accounts = emergencyFundAccounts(get);
  if (accounts.length === 0) return undefined;
  const items = accounts.map((a) => `${accountLabel(get, a)} ${formatCurrency(accountValue(get, a))}`);
  return `Held in your accounts: ${items.join(', ')}.`;
}

/** The note an emergency fund screen shows in place of the balance input while accounts hold the fund. */
export const EMERGENCY_FUND_HELD_NOTE: ScreenNote = {
  text: emergencyFundHeldText,
  visibleWhen: (get) => !usesTypedEmergencyFund(get),
};

export const EMERGENCY_FUND_APY: FieldSpec = {
  path: 'cash.emergencyFundApy',
  kind: 'percent',
  label: 'Interest rate (APY) on that cash',
  min: 0,
  max: 0.2,
  tier: 'details',
};

/**
 * How many months of must-pay costs the emergency fund should hold: a lasting
 * preference, asked on the emergency fund screen. The paycheck allocator and
 * the overview's cash buffer card read it. Whole months from 0 to 60; the
 * typical value is the profile default.
 */
export const EMERGENCY_FUND_MONTHS: FieldSpec = {
  path: 'cash.targetMonths',
  kind: 'number',
  label: 'Emergency fund target',
  help: '3 to 6 months is common.',
  min: 0,
  max: 60,
  step: 1,
  precision: 0,
  unit: { suffix: ' months' },
  tier: 'details',
  summary: (value) => `${value as number}-month emergency fund`,
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/** Renderer id of the compact account list (components/calculators/renderers/accounts.tsx). */
export const ACCOUNTS_RENDERER = 'accounts';

const isBrokerageRow = (row: Get): boolean => row('kind') === 'brokerage';

/**
 * The single list of what the visitor owns (lib/profile/accounts.ts): kind,
 * name and one balance per account, with optional holdings. The accounts
 * renderer edits the holdings and securities with it, so it covers them;
 * this run's new cash is the rebalancer's own (calculator-only) question.
 */
export const ACCOUNTS: FieldSpec = {
  path: ACCOUNT_PATHS.accounts,
  kind: 'list',
  label: 'Accounts',
  renderer: ACCOUNTS_RENDERER,
  covers: [ACCOUNT_PATHS.holdings, ACCOUNT_PATHS.securities],
  row: [
    { path: 'kind', kind: 'select', label: 'Kind', options: ACCOUNT_KIND_OPTIONS, tier: 'details' },
    {
      path: 'name',
      kind: 'text',
      label: 'Account name',
      maxLength: 40,
      tier: 'details',
      testId: 'account-name-{i}',
    },
    { path: 'balance', kind: 'money', label: 'Balance', min: 0, tier: 'details' },
    {
      path: 'holdsEmergencyFund',
      kind: 'boolean',
      label: 'Holds my emergency fund',
      visibleWhen: isBrokerageRow,
      tier: 'details',
    },
  ],
  addLabel: 'Add account',
  minRows: 0,
  tier: 'details',
  summary: (_value, get) => accountsSummary(get),
};

/** The one screen that asks the account list; the retirement, portfolio and leverage forms share it. */
export const ACCOUNTS_SCREEN: ScreenSpec = {
  id: 'accounts',
  title: 'What do you have saved and invested?',
  tier: 'details',
  surface: 'both',
  fields: [ACCOUNTS.path],
};

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/** The core facts, in the order the core screens ask them. */
export const CORE_FIELDS: readonly FieldSpec[] = [
  AGE,
  STATE,
  FILING_STATUS,
  GROSS_PAY,
  PAY_FREQUENCY,
  NET_PAY,
  NECESSARY_MONTHLY,
];

/** The shared basics: asked once at /start, first in every calculator form that uses them. */
export const CORE_SCREENS: readonly ScreenSpec[] = [
  {
    id: 'about',
    title: 'A little about you',
    tier: 'core',
    fields: [AGE.path, STATE.path, FILING_STATUS.path],
  },
  {
    id: 'pay',
    title: 'What does a typical paycheck look like?',
    tier: 'core',
    fields: [GROSS_PAY.path, PAY_FREQUENCY.path, NET_PAY.path],
  },
  {
    id: 'must-pay',
    title: 'What do you have to pay each month?',
    tier: 'core',
    fields: [NECESSARY_MONTHLY.path],
  },
];

/**
 * The profile's own facts: the emergency fund. The paycheck form asks the
 * same three first, so the profile form asks them on that form's emergency
 * fund screen; this screen comes into play only if no calculator form asks
 * them.
 */
export const PROFILE_EXTRA_FIELDS: readonly FieldSpec[] = [
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_MONTHS,
];

/** The profile's own screens, asked after every calculator's screens. */
export const PROFILE_EXTRA_SCREENS: readonly ScreenSpec[] = [
  {
    id: 'cash-buffer',
    title: 'What does your emergency fund look like today?',
    tier: 'details',
    fields: [EMERGENCY_FUND_BALANCE.path, EMERGENCY_FUND_APY.path, EMERGENCY_FUND_MONTHS.path],
    notes: [EMERGENCY_FUND_HELD_NOTE],
  },
];

// ---------------------------------------------------------------------------
// Cross-field rules and derived writes
// ---------------------------------------------------------------------------

export const NET_PAY_AT_MOST_GROSS: CrossFieldRule = {
  lower: NET_PAY.path,
  upper: GROSS_PAY.path,
  strict: false,
  checkOn: NET_PAY.path,
  message:
    'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
};

/** Checked on the screen that asks the retirement age; age is always asked before it. */
export const RETIREMENT_AFTER_AGE: CrossFieldRule = {
  lower: AGE.path,
  upper: RETIREMENT_AGE.path,
  strict: true,
  checkOn: RETIREMENT_AGE.path,
  message: 'The retirement age needs to be above your current age.',
};

/**
 * The writes every intake derives on finish, from the values in effect
 * (answers over the saved profile). None is marked provided.
 *
 * - A retirement age at or below the current age (for example, age answered
 *   and retirement age skipped) is raised to age + 1, so every calculator
 *   gets a positive horizon.
 *
 * The emergency-fund months are never derived: they are the visitor's own
 * answer or the stored value.
 */
export function intakeDerivedWrites(get: Get): Write[] {
  const writes: Write[] = [];
  const age = get(AGE.path);
  const retirementAge = get(RETIREMENT_AGE.path);
  if (typeof age === 'number' && typeof retirementAge === 'number' && retirementAge <= age) {
    writes.push({ path: RETIREMENT_AGE.path, value: age + 1 });
  }
  return writes;
}
