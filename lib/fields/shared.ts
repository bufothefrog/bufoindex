/**
 * Field specs that more than one form or flow references
 * (docs/rebuild-plan.md section 2.4): the shared core (about, pay, must-pay),
 * the profile extras (cash buffer, strategy), and the handful of investing
 * and retirement fields several calculators read. Everything else lives in
 * lib/calculators/<id>/form.ts (and later fields.ts).
 *
 * A form that needs its own label, help or tier for a shared field uses
 * withOverrides(spec, partial) instead of copying the spec.
 *
 * Pure: no React, no DOM, no storage.
 */

import { PAY_FREQUENCY_OPTIONS } from '@/lib/constants/frequency';
import { FILING_STATUS_OPTIONS, STRATEGY_PRESET_OPTIONS } from '@/lib/constants/labels';
import { PRESET_EMERGENCY_MONTHS, STRATEGY_PRESETS } from '@/lib/profile/defaults';
import type { StrategyPreset } from '@/lib/profile/types';
import type { CrossFieldRule, FieldSpec, Get, ScreenSpec, Write } from './types';

/** The per-screen skip affordance on fact screens. */
export const INTAKE_SKIP_LABEL = 'Skip, use a typical value';

/** The skip affordance on assumption screens (O3). */
export const KEEP_ASSUMPTIONS_LABEL = 'Keep the default assumptions';

/** A copy of `spec` with some properties replaced (label, help, tier, bounds). */
export function withOverrides(spec: FieldSpec, partial: Partial<Omit<FieldSpec, 'path' | 'kind'>>): FieldSpec {
  return { ...spec, ...partial };
}

// ---------------------------------------------------------------------------
// Core: about you, pay, must-pay
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
  tier: 'core',
};

export const FILING_STATUS: FieldSpec = {
  path: 'person.filingStatus',
  kind: 'choice',
  label: 'Tax filing status',
  options: FILING_STATUS_OPTIONS,
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
  options: PAY_FREQUENCY_OPTIONS,
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

export const CORE_FIELDS: readonly FieldSpec[] = [
  AGE,
  STATE,
  FILING_STATUS,
  GROSS_PAY,
  PAY_FREQUENCY,
  NET_PAY,
  NECESSARY_MONTHLY,
];

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

/** Take-home above gross cannot be right; checked where take-home is asked. */
export const NET_BELOW_GROSS: CrossFieldRule = {
  lower: NET_PAY.path,
  upper: GROSS_PAY.path,
  strict: false,
  checkOn: NET_PAY.path,
  message:
    'Take-home pay is above gross pay. Take-home is what is left after taxes and deductions, so it is usually lower.',
};

export const CORE_RELATIONS: readonly CrossFieldRule[] = [NET_BELOW_GROSS];

// ---------------------------------------------------------------------------
// Fields several calculators read
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

/** The retirement age must be above the current age; checked where the retirement age is asked. */
export const AGE_BELOW_RETIREMENT: CrossFieldRule = {
  lower: AGE.path,
  upper: RETIREMENT_AGE.path,
  strict: true,
  checkOn: RETIREMENT_AGE.path,
  message: 'The retirement age needs to be above your current age.',
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

// ---------------------------------------------------------------------------
// Profile extras: cash buffer and strategy
// ---------------------------------------------------------------------------

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
  options: STRATEGY_PRESET_OPTIONS,
  tier: 'details',
};

export const PROFILE_EXTRA_FIELDS: readonly FieldSpec[] = [
  EMERGENCY_FUND_BALANCE,
  EMERGENCY_FUND_APY,
  STRATEGY_PRESET,
];

export const PROFILE_EXTRA_SCREENS: readonly ScreenSpec[] = [
  {
    id: 'cash-buffer',
    title: 'What does your emergency fund look like today?',
    tier: 'details',
    surface: 'intake',
    fields: [EMERGENCY_FUND_BALANCE.path, EMERGENCY_FUND_APY.path],
  },
  {
    id: 'strategy',
    title: 'Which starting point should the calculators use?',
    description:
      'This sets your starting emergency-fund target. Both presets run through the same math; your overview shows the other one next to it.',
    tier: 'details',
    surface: 'intake',
    fields: [STRATEGY_PRESET.path],
  },
];

// ---------------------------------------------------------------------------
// Derived writes on finish
// ---------------------------------------------------------------------------

function isStrategyPreset(value: unknown): value is StrategyPreset {
  return (STRATEGY_PRESETS as readonly unknown[]).includes(value);
}

/**
 * The derived writes every intake applies on finish (FormSpec.onSubmit):
 *
 * - The emergency-fund target months follow the strategy preset in effect,
 *   via PRESET_EMERGENCY_MONTHS, unless the user has entered target months
 *   themselves (`provided` holds 'cash.targetMonths'). A target the user never
 *   entered so cannot drift from the preset shown as active.
 * - A retirement age at or below the current age (age answered, retirement
 *   age skipped) is raised to age + 1, so every calculator gets a positive
 *   horizon.
 *
 * Derived values are written but never marked as provided.
 */
export function intakeOnSubmit(get: Get, provided: ReadonlySet<string>): Write[] {
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
