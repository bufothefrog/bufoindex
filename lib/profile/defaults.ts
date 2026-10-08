/**
 * Default financial profile, field metadata, and persisted-data normalization.
 *
 * The defaults are illustrative placeholders, not recommendations: they let
 * every calculator render a worked example before the user answers anything.
 * Fields the user actually answered are tracked in `profile.provided`.
 */

import type {
  FinancialProfile,
  PayFrequency,
  ProfileFieldMeta,
  ProfileFilingStatus,
  ProfileSection,
  StrategyPreset,
  TargetMixPreset,
} from './types';

export function getDefaultFinancialProfile(): FinancialProfile {
  return {
    version: 1,
    updatedAt: 0,
    person: {
      age: 30,
      state: 'TX',
      filingStatus: 'single',
      retirementAge: 60,
    },
    income: {
      grossPerPaycheck: 3500,
      netPerPaycheck: 2600,
      frequency: 'bi-weekly',
    },
    spending: {
      necessaryMonthly: 3000,
      funMoneyMin: 300,
      funMoneyMax: 600,
      targetRetirementIncome: 80000,
    },
    cash: {
      emergencyFundBalance: 5000,
      emergencyFundApy: 0.04,
      targetMonths: 3,
    },
    workplace: {
      has401k: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      contributionPercent: 0.06,
    },
    investing: {
      investedBalance: 25000,
      monthlyContribution: 1500,
      taxableMonthlyContribution: 500,
      targetMix: '80-20',
      newCashThisMonth: 1000,
    },
    strategy: {
      preset: 'cashflow-investor',
      leverageRatio: 2,
    },
    provided: [],
  };
}

/** Section order and display labels. */
export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  'person',
  'income',
  'spending',
  'cash',
  'workplace',
  'investing',
  'strategy',
];

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  person: 'About you',
  income: 'Income',
  spending: 'Spending',
  cash: 'Cash and emergency fund',
  workplace: 'Workplace retirement plan',
  investing: 'Investing',
  strategy: 'Strategy',
};

/**
 * Every user-editable leaf field (excludes version, updatedAt, provided).
 * `section` is the FinancialProfile key; use PROFILE_SECTION_LABELS to
 * display it.
 */
export const PROFILE_FIELDS: ProfileFieldMeta[] = [
  { path: 'person.age', label: 'Age', section: 'person' },
  { path: 'person.state', label: 'State of residence', section: 'person' },
  { path: 'person.filingStatus', label: 'Tax filing status', section: 'person' },
  { path: 'person.retirementAge', label: 'Target retirement age', section: 'person' },
  { path: 'income.grossPerPaycheck', label: 'Gross pay per paycheck', section: 'income' },
  { path: 'income.netPerPaycheck', label: 'Take-home pay per paycheck', section: 'income' },
  { path: 'income.frequency', label: 'Pay frequency', section: 'income' },
  { path: 'spending.necessaryMonthly', label: 'Necessary monthly expenses', section: 'spending' },
  { path: 'spending.funMoneyMin', label: 'Fun money per month (minimum)', section: 'spending' },
  { path: 'spending.funMoneyMax', label: 'Fun money per month (maximum)', section: 'spending' },
  { path: 'spending.targetRetirementIncome', label: 'Target retirement income per year', section: 'spending' },
  { path: 'cash.emergencyFundBalance', label: 'Emergency fund balance', section: 'cash' },
  { path: 'cash.emergencyFundApy', label: 'Emergency fund APY', section: 'cash' },
  { path: 'cash.targetMonths', label: 'Emergency fund target (months of expenses)', section: 'cash' },
  { path: 'workplace.has401k', label: 'Workplace 401(k) available', section: 'workplace' },
  { path: 'workplace.matchPercent', label: 'Employer match rate', section: 'workplace' },
  { path: 'workplace.matchLimit', label: 'Employer match limit (share of salary)', section: 'workplace' },
  { path: 'workplace.contributionPercent', label: 'Your 401(k) contribution (share of salary)', section: 'workplace' },
  { path: 'investing.investedBalance', label: 'Invested balance (excluding emergency fund)', section: 'investing' },
  { path: 'investing.monthlyContribution', label: 'Total monthly investing contribution', section: 'investing' },
  { path: 'investing.taxableMonthlyContribution', label: 'Monthly taxable brokerage contribution', section: 'investing' },
  { path: 'investing.targetMix', label: 'Target stock/bond mix', section: 'investing' },
  { path: 'investing.newCashThisMonth', label: 'New cash to invest this month', section: 'investing' },
  { path: 'strategy.preset', label: 'Strategy preset', section: 'strategy' },
  { path: 'strategy.leverageRatio', label: 'Leverage ratio to compare', section: 'strategy' },
];

/**
 * Emergency-fund months each strategy preset starts from. The intake shows
 * both; a user-entered cash.targetMonths always wins over the preset.
 */
export const PRESET_EMERGENCY_MONTHS: Record<StrategyPreset, number> = {
  standard: 3,
  'cashflow-investor': 1,
};

export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'];
export const PROFILE_FILING_STATUSES: readonly ProfileFilingStatus[] = ['single', 'marriedJoint'];
export const STRATEGY_PRESETS: readonly StrategyPreset[] = ['standard', 'cashflow-investor'];
export const TARGET_MIX_PRESETS: readonly TargetMixPreset[] = ['100-0', '80-20', '60-40'];

/** Allowed values for the enum-typed leaf fields, keyed by dot path. */
export const PROFILE_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = {
  'person.filingStatus': PROFILE_FILING_STATUSES,
  'income.frequency': PAY_FREQUENCIES,
  'investing.targetMix': TARGET_MIX_PRESETS,
  'strategy.preset': STRATEGY_PRESETS,
};

const FIELD_PATHS = new Set(PROFILE_FIELDS.map((f) => f.path));

/** Reference copy used only to look up each leaf's expected primitive type. */
const TYPE_REFERENCE = getDefaultFinancialProfile();

/** True when `path` names one of the user-editable leaf fields. */
export function isProfileFieldPath(path: string): boolean {
  return FIELD_PATHS.has(path);
}

/** Splits a known leaf path into its section and key; null for unknown paths. */
export function splitProfilePath(path: string): { section: ProfileSection; key: string } | null {
  if (!isProfileFieldPath(path)) return null;
  const [section, key] = path.split('.');
  return { section: section as ProfileSection, key };
}

/** Reads a leaf by dot path; undefined for unknown paths. */
export function getProfileValue(profile: FinancialProfile, path: string): unknown {
  const parts = splitProfilePath(path);
  if (!parts) return undefined;
  return (profile[parts.section] as Record<string, unknown>)[parts.key];
}

/**
 * Whether `value` is acceptable for the leaf at `path`: same primitive type
 * as the default, finite for numbers, a listed member for enum fields, and
 * non-empty for free-text strings.
 */
export function isValidProfileValue(path: string, value: unknown): boolean {
  const parts = splitProfilePath(path);
  if (!parts) return false;
  const expected = (TYPE_REFERENCE[parts.section] as Record<string, unknown>)[parts.key];

  if (typeof expected === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }
  if (typeof expected === 'boolean') {
    return typeof value === 'boolean';
  }
  if (typeof value !== 'string') return false;
  const allowed = PROFILE_ENUM_VALUES[path];
  return allowed ? allowed.includes(value) : value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerces untrusted data (persisted localStorage, a merged patch) into a
 * complete FinancialProfile. Every leaf that is missing or invalid falls back
 * to the same leaf in `base` (the defaults unless given), so a schema change
 * or a hand-edited payload can never leave a section undefined.
 */
export function normalizeProfile(
  input: unknown,
  base: FinancialProfile = getDefaultFinancialProfile()
): FinancialProfile {
  const source = isRecord(input) ? input : {};
  const out: FinancialProfile = {
    ...base,
    person: { ...base.person },
    income: { ...base.income },
    spending: { ...base.spending },
    cash: { ...base.cash },
    workplace: { ...base.workplace },
    investing: { ...base.investing },
    strategy: { ...base.strategy },
    provided: [...base.provided],
    version: 1,
  };

  for (const section of PROFILE_SECTIONS) {
    const incoming = source[section];
    if (!isRecord(incoming)) continue;
    const target = out[section] as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      const value = incoming[key];
      if (isValidProfileValue(`${section}.${key}`, value)) target[key] = value;
    }
  }

  if (typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)) {
    out.updatedAt = source.updatedAt;
  }
  if (Array.isArray(source.provided)) {
    out.provided = Array.from(
      new Set(source.provided.filter((p): p is string => typeof p === 'string'))
    );
  }
  return out;
}
