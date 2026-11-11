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
import { FILING_STATUS_META, FILING_STATUS_OPTIONS, STRATEGY_PRESET_OPTIONS } from '@/lib/constants/labels';
import { PAY_FREQUENCIES, PRESET_EMERGENCY_MONTHS, STRATEGY_PRESETS } from '@/lib/profile/defaults';
import type { StrategyPreset } from '@/lib/profile/types';
import type { CrossFieldRule, FieldOption, FieldSpec, Get, ScreenSpec, Write } from './types';

/** A shared spec with a form's own wording or tier; the path and kind stay. */
export function withOverrides(spec: FieldSpec, overrides: Partial<Omit<FieldSpec, 'path' | 'kind'>>): FieldSpec {
  return { ...spec, ...overrides };
}

/**
 * The options of a choice the intake offers only in part: `offered`, plus the
 * option for the saved value when the profile holds one of `all` that
 * `offered` leaves out. A value saved on a calculator then shows as chosen
 * and can be kept, instead of failing option membership until the visitor
 * picks a different (wrong) answer.
 */
export function offeredWithSaved(
  path: string,
  offered: readonly FieldOption[],
  all: readonly FieldOption[]
): (get: Get) => readonly FieldOption[] {
  return (get) => {
    const saved = get(path);
    if (offered.some((option) => option.value === saved)) return offered;
    const kept = all.find((option) => option.value === saved);
    return kept ? [...offered, kept] : offered;
  };
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

/** Standard first, as the intake has always listed them. */
const INTAKE_STRATEGY_ORDER: readonly StrategyPreset[] = ['standard', 'cashflow-investor'];

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
};

export const STATE: FieldSpec = {
  path: 'person.state',
  kind: 'state',
  label: 'State you live in',
  // The combobox can be emptied (a typed term that matches no state); an
  // empty answer is an error, never a skipped one saved as the old state.
  required: true,
  tier: 'core',
};

export const FILING_STATUS: FieldSpec = {
  path: 'person.filingStatus',
  kind: 'choice',
  label: 'Tax filing status',
  options: FILING_OPTIONS,
  tier: 'core',
};

export const GROSS_PAY: FieldSpec = {
  path: 'income.grossPerPaycheck',
  kind: 'money',
  label: 'Gross pay per paycheck',
  help: 'Before taxes and deductions.',
  min: 0,
  tier: 'core',
};

export const PAY_FREQUENCY: FieldSpec = {
  path: 'income.frequency',
  kind: 'select',
  label: 'How often you are paid',
  options: PAY_FREQUENCIES.map((value): FieldOption => ({ value, label: PAY_FREQUENCY_META[value].intakeOption })),
  tier: 'core',
};

export const NET_PAY: FieldSpec = {
  path: 'income.netPerPaycheck',
  kind: 'money',
  label: 'Take-home pay per paycheck',
  help: 'What lands in your bank account after taxes and deductions.',
  min: 0,
  tier: 'core',
};

export const NECESSARY_MONTHLY: FieldSpec = {
  path: 'spending.necessaryMonthly',
  kind: 'money',
  label: 'Must-pay costs per month',
  help: 'Rent or mortgage, utilities, insurance, groceries, minimum debt payments.',
  min: 0,
  tier: 'core',
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

export const INVESTED_BALANCE: FieldSpec = {
  path: 'investing.investedBalance',
  kind: 'money',
  label: 'Invested balance',
  help: 'A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund.',
  min: 0,
  tier: 'details',
};

export const MONTHLY_INVESTING: FieldSpec = {
  path: 'investing.monthlyContribution',
  kind: 'money',
  label: 'Monthly investing contribution',
  help: 'What you put toward investing each month across all accounts, including your own 401(k) contributions.',
  min: 0,
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

export const EMERGENCY_FUND_BALANCE: FieldSpec = {
  path: 'cash.emergencyFundBalance',
  kind: 'money',
  label: 'Cash set aside for emergencies',
  min: 0,
  tier: 'details',
};

export const EMERGENCY_FUND_APY: FieldSpec = {
  path: 'cash.emergencyFundApy',
  kind: 'percent',
  label: 'Interest rate (APY) on that cash',
  help: 'The rate your savings account pays. A guess is fine.',
  min: 0,
  max: 0.2,
  tier: 'details',
};

export const STRATEGY_PRESET: FieldSpec = {
  path: 'strategy.preset',
  kind: 'choice',
  label: 'Strategy preset',
  options: INTAKE_STRATEGY_ORDER.flatMap((value) => STRATEGY_PRESET_OPTIONS.filter((option) => option.value === value)),
  tier: 'details',
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
    description: 'Age sets the time horizon. State and filing status set the tax estimate.',
    tier: 'core',
    fields: [AGE.path, STATE.path, FILING_STATUS.path],
  },
  {
    id: 'pay',
    title: 'What does a typical paycheck look like?',
    description: 'A close guess is fine.',
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

/** Facts only the profile asks (no calculator form asks them yet). */
export const PROFILE_EXTRA_FIELDS: readonly FieldSpec[] = [EMERGENCY_FUND_BALANCE, EMERGENCY_FUND_APY, STRATEGY_PRESET];

/** The profile's own screens, asked after every calculator's screens. */
export const PROFILE_EXTRA_SCREENS: readonly ScreenSpec[] = [
  {
    id: 'cash-buffer',
    title: 'What does your emergency fund look like today?',
    tier: 'details',
    fields: [EMERGENCY_FUND_BALANCE.path, EMERGENCY_FUND_APY.path],
  },
  {
    id: 'strategy',
    title: 'Which starting point should the calculators use?',
    description:
      'This sets your starting emergency-fund target. Both presets run through the same math; your overview shows the other one next to it.',
    tier: 'details',
    fields: [STRATEGY_PRESET.path],
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

function isStrategyPreset(value: unknown): value is StrategyPreset {
  return (STRATEGY_PRESETS as readonly unknown[]).includes(value);
}

/**
 * The writes every intake derives on finish, from the values in effect
 * (answers over the saved profile). Neither is marked provided.
 *
 * - The emergency-fund target months follow the strategy preset in effect
 *   (PRESET_EMERGENCY_MONTHS) unless the visitor has entered target months
 *   (`provided` holds this intake's and the saved answers). This runs for
 *   every intake, so a target never drifts from the preset shown as active.
 * - A retirement age at or below the current age (for example, age answered
 *   and retirement age skipped) is raised to age + 1, so every calculator
 *   gets a positive horizon.
 */
export function intakeDerivedWrites(get: Get, provided: ReadonlySet<string>): Write[] {
  const writes: Write[] = [];
  const preset = get(STRATEGY_PRESET.path);
  if (isStrategyPreset(preset) && !provided.has('cash.targetMonths')) {
    writes.push({ path: 'cash.targetMonths', value: PRESET_EMERGENCY_MONTHS[preset] });
  }
  const age = get(AGE.path);
  const retirementAge = get(RETIREMENT_AGE.path);
  if (typeof age === 'number' && typeof retirementAge === 'number' && retirementAge <= age) {
    writes.push({ path: RETIREMENT_AGE.path, value: age + 1 });
  }
  return writes;
}
