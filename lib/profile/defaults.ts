/**
 * Default financial profile (v2), path metadata, and persisted-data
 * normalization.
 *
 * The defaults are illustrative placeholders, not recommendations: they let
 * every calculator render a worked example before the user answers anything.
 * Each default equals the value the calculator engines used before profile
 * v2, so an untouched profile reproduces today's numbers. Fields the user
 * actually answered are tracked in `profile.provided`.
 */

import { ACCOUNT_TYPES, BONUS_FREQUENCIES, CONTRIBUTION_TYPES, FILING_STATUSES, HSA_COVERAGES, OPTIMIZATION_GOALS, RISK_TOLERANCES, STRATEGY_PRESETS as STRATEGY_PRESET_VALUES, TARGET_MIXES } from '@/lib/constants/labels';
import { PAY_FREQUENCIES as FREQUENCY_VALUES } from '@/lib/constants/frequency';
import {
  DEFAULT_FINANCING_RATE,
  INDEX_FUND_EXPENSE_RATIO,
  PROSHARES_SSO_EXPENSE_RATIO,
  SP500_LONG_RUN_NOMINAL_RETURN,
  SP500_LONG_RUN_VOLATILITY,
} from '@/lib/constants/leverage';
import { RetirementConstants } from '@/lib/constants/retirement';
import { getAt, setAt, splitPath } from '@/lib/fields/paths';
import type {
  FilingStatus,
  FinancialProfile,
  PayFrequency,
  ProfileClassTarget,
  ProfileFieldMeta,
  ProfileFilingStatus,
  ProfileSection,
  StrategyPreset,
  TargetMixPreset,
} from './types';

/** The current persisted schema version. */
export const PROFILE_VERSION = 2;

/** Portfolio-wide class weights for each stock/bond mix preset. */
export const TARGET_MIX_WEIGHTS: Record<
  Exclude<TargetMixPreset, 'custom'>,
  { 'us-stock': number; 'intl-stock': number; bonds: number; cash: number }
> = {
  '100-0': { 'us-stock': 0.75, 'intl-stock': 0.25, bonds: 0, cash: 0 },
  '80-20': { 'us-stock': 0.6, 'intl-stock': 0.2, bonds: 0.2, cash: 0 },
  '60-40': { 'us-stock': 0.45, 'intl-stock': 0.15, bonds: 0.4, cash: 0 },
};

/** Portfolio-wide class targets (accountId null) for a mix preset. */
export function classTargetsForMix(mix: Exclude<TargetMixPreset, 'custom'>): ProfileClassTarget[] {
  const weights = TARGET_MIX_WEIGHTS[mix];
  return [
    { accountId: null, assetClass: 'us-stock', target: weights['us-stock'] },
    { accountId: null, assetClass: 'intl-stock', target: weights['intl-stock'] },
    { accountId: null, assetClass: 'bonds', target: weights.bonds },
    { accountId: null, assetClass: 'cash', target: weights.cash },
  ];
}

export function getDefaultFinancialProfile(): FinancialProfile {
  return {
    version: 2,
    updatedAt: 0,
    person: {
      age: 30,
      state: 'TX',
      filingStatus: 'single',
      retirementAge: 60,
      lifeExpectancy: RetirementConstants.DEFAULT_LIFE_EXPECTANCY,
    },
    income: {
      grossPerPaycheck: 3500,
      netPerPaycheck: 2600,
      frequency: 'bi-weekly',
      hasBonus: false,
      bonusAmount: 0,
      bonusFrequency: 'annual',
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
      contributionType: 'traditional',
      contributionPercent: 0.06,
      rothContributionPercent: 0,
      afterTaxAvailable: false,
    },
    hsa: {
      eligible: false,
      coverage: 'individual',
      monthlyContribution: 0,
      employerAnnualContribution: 0,
      investing: false,
    },
    ira: {
      traditional: false,
      roth: false,
      traditionalMonthly: 0,
      rothMonthly: 0,
      traditionalBalance: 0,
      rothBalance: 0,
    },
    investing: {
      investedBalance: 25000,
      monthlyContribution: 1500,
      taxableMonthlyContribution: 500,
      targetMix: '80-20',
      newCashThisMonth: 1000,
    },
    retirementIncome: {
      socialSecurityBenefit: 30000,
      socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
      annualHealthcareCost: null,
    },
    debts: [],
    portfolio: {
      accounts: [
        { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
        { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1000 },
      ],
      securities: [
        { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
        { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 60, assetClass: 'intl-stock' },
        { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 75, assetClass: 'bonds' },
      ],
      holdings: [
        { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
        { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
        { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
        { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
      ],
      classTargets: classTargetsForMix('80-20'),
      customAssetClasses: [],
    },
    strategy: {
      preset: 'cashflow-investor',
      leverageRatio: 2,
    },
    leverage: {
      monthlyContribution: null,
      years: null,
      startingBalance: null,
    },
    assumptions: {
      retirement: {
        riskProfile: 'tdf',
        accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
        retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
        inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
        volatility: RetirementConstants.DEFAULT_VOLATILITY,
        effectiveTaxRate: null,
        healthcareCostMultiplier: 1,
      },
      paycheck: {
        riskTolerance: 'moderate',
        optimizationGoal: 'balanced',
        expectedRetirementBracket: 0.12,
      },
      portfolio: {
        mode: 'whole',
        allowTaxableSelling: false,
        showPlacementAdvice: true,
      },
      leverage: {
        indexMeanReturn: SP500_LONG_RUN_NOMINAL_RETURN,
        indexVolatility: SP500_LONG_RUN_VOLATILITY,
        financingRate: DEFAULT_FINANCING_RATE,
        expenseRatio: PROSHARES_SSO_EXPENSE_RATIO,
        indexExpenseRatio: INDEX_FUND_EXPENSE_RATIO,
      },
    },
    provided: [],
  };
}

/** Top-level section order. */
export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  'person',
  'income',
  'spending',
  'cash',
  'workplace',
  'hsa',
  'ira',
  'investing',
  'retirementIncome',
  'debts',
  'portfolio',
  'strategy',
  'leverage',
  'assumptions',
];

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  person: 'About you',
  income: 'Income',
  spending: 'Spending',
  cash: 'Cash and emergency fund',
  workplace: 'Workplace retirement plan',
  hsa: 'Health savings account',
  ira: 'IRAs',
  investing: 'Investing',
  retirementIncome: 'Retirement income and costs',
  debts: 'Debts',
  portfolio: 'Portfolio',
  strategy: 'Strategy',
  leverage: 'Leverage comparison',
  assumptions: 'Assumptions',
};

/**
 * The 25 v1 leaf fields.
 *
 * @deprecated Completeness is counted by topic screen from lib/calculators
 * (O14); use PROFILE_LEAF_PATHS for the full v2 path list. Removed in x1.
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

export const PAY_FREQUENCIES: readonly PayFrequency[] = FREQUENCY_VALUES;
export const FILING_STATUS_VALUES: readonly FilingStatus[] = FILING_STATUSES;
/** @deprecated Use FILING_STATUS_VALUES (4 values since v2). Removed in x1. */
export const PROFILE_FILING_STATUSES: readonly ProfileFilingStatus[] = FILING_STATUSES;
export const STRATEGY_PRESETS: readonly StrategyPreset[] = STRATEGY_PRESET_VALUES;
export const TARGET_MIX_PRESETS: readonly TargetMixPreset[] = [...TARGET_MIXES, 'custom'];

/** Allowed values for the enum-typed leaf fields, keyed by dot path. */
export const PROFILE_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = {
  'person.filingStatus': FILING_STATUSES,
  'income.frequency': PAY_FREQUENCIES,
  'income.bonusFrequency': BONUS_FREQUENCIES,
  'workplace.contributionType': CONTRIBUTION_TYPES,
  'hsa.coverage': HSA_COVERAGES,
  'investing.targetMix': TARGET_MIX_PRESETS,
  'strategy.preset': STRATEGY_PRESETS,
  'assumptions.retirement.riskProfile': ['tdf', 'custom'],
  'assumptions.paycheck.riskTolerance': RISK_TOLERANCES,
  'assumptions.paycheck.optimizationGoal': OPTIMIZATION_GOALS,
  'assumptions.portfolio.mode': ['whole', 'fractional'],
};

/** Number leaves where null means "derive from the profile". */
export const PROFILE_NULLABLE_PATHS: ReadonlySet<string> = new Set([
  'retirementIncome.annualHealthcareCost',
  'leverage.monthlyContribution',
  'leverage.years',
  'leverage.startingBalance',
  'assumptions.retirement.effectiveTaxRate',
]);

// ---------------------------------------------------------------------------
// List rows
// ---------------------------------------------------------------------------

/** How one list's rows are validated and normalized. */
export interface ListRowSchema {
  /** Every row key with its fallback value (also the expected primitive type). */
  defaults: Readonly<Record<string, string | number | boolean | null>>;
  /** String keys that must be non-empty, or the row is dropped. */
  required: readonly string[];
  /** String keys that may be absent. */
  optional?: readonly string[];
  /** Keys that accept a string or null. */
  nullableStrings?: readonly string[];
  /** Enum-typed keys. */
  enums?: Readonly<Record<string, readonly string[]>>;
  /** Key used to dedupe rows and to find the previous row on a merge. */
  idKey?: string;
}

export const PROFILE_LIST_ROWS: Readonly<Record<string, ListRowSchema>> = {
  debts: {
    defaults: { id: '', name: '', balance: 0, interestRate: 0, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
    required: ['id'],
    idKey: 'id',
  },
  'portfolio.accounts': {
    defaults: { id: '', name: '', accountType: 'taxable', deposit: 0 },
    required: ['id'],
    enums: { accountType: ACCOUNT_TYPES },
    idKey: 'id',
  },
  'portfolio.securities': {
    defaults: { id: '', ticker: '', price: 0, assetClass: 'other' },
    required: ['id'],
    optional: ['name'],
    idKey: 'id',
  },
  'portfolio.holdings': {
    defaults: { id: '', accountId: '', securityId: '', shares: 0 },
    required: ['id', 'accountId', 'securityId'],
    idKey: 'id',
  },
  'portfolio.classTargets': {
    defaults: { accountId: null, assetClass: '', target: 0 },
    required: ['assetClass'],
    nullableStrings: ['accountId'],
  },
  'portfolio.customAssetClasses': {
    defaults: { id: '', label: '' },
    required: ['id'],
    idKey: 'id',
  },
};

const META_KEYS = new Set(['version', 'updatedAt', 'provided']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectPaths(value: unknown, prefix: string, leaves: string[], lists: string[]): void {
  if (Array.isArray(value)) {
    lists.push(prefix);
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (prefix === '' && META_KEYS.has(key)) continue;
      collectPaths(value[key], prefix === '' ? key : `${prefix}.${key}`, leaves, lists);
    }
    return;
  }
  leaves.push(prefix);
}

const DEFAULT_REFERENCE = getDefaultFinancialProfile();
const leafPaths: string[] = [];
const listPaths: string[] = [];
collectPaths(DEFAULT_REFERENCE, '', leafPaths, listPaths);

/** Every scalar leaf of the v2 profile (nullable leaves included), in schema order. */
export const PROFILE_LEAF_PATHS: readonly string[] = leafPaths;
/** Every list of the v2 profile ('debts', 'portfolio.accounts', ...). */
export const PROFILE_LIST_PATHS: readonly string[] = listPaths;

const LEAF_SET = new Set(PROFILE_LEAF_PATHS);
const LIST_SET = new Set(PROFILE_LIST_PATHS);
const INDEX = /^\d+$/;

/** The list a row path belongs to: 'debts.2.balance' and 'debts.2' -> 'debts'; null otherwise. */
export function listPathOf(path: string): string | null {
  const segments = splitPath(path);
  const at = segments.findIndex((segment) => INDEX.test(segment));
  if (at <= 0 || segments.length > at + 2) return null;
  const list = segments.slice(0, at).join('.');
  if (!LIST_SET.has(list)) return null;
  if (segments.length === at + 2) {
    const schema = PROFILE_LIST_ROWS[list];
    const key = segments[at + 1];
    const known = key in schema.defaults || (schema.optional ?? []).includes(key);
    if (!known) return null;
  }
  return list;
}

/** True for a scalar leaf of the v2 profile. */
export function isProfileLeafPath(path: string): boolean {
  return LEAF_SET.has(path);
}

/** True for a list path ('debts', 'portfolio.holdings'). */
export function isProfileListPath(path: string): boolean {
  return LIST_SET.has(path);
}

/** True for a leaf, a list, a list row ('debts.0') or a list row field ('debts.0.balance'). */
export function isProfilePath(path: string): boolean {
  return LEAF_SET.has(path) || LIST_SET.has(path) || listPathOf(path) !== null;
}

/**
 * The path recorded in `provided` for a written path: a list row or row
 * field records its list; leaves and lists record themselves; unknown paths
 * give null.
 */
export function providedPathFor(path: string): string | null {
  if (LEAF_SET.has(path) || LIST_SET.has(path)) return path;
  return listPathOf(path);
}

/**
 * True when `path` names a scalar leaf.
 *
 * @deprecated Use isProfileLeafPath / isProfilePath. Removed in x1.
 */
export function isProfileFieldPath(path: string): boolean {
  return LEAF_SET.has(path);
}

/**
 * Splits a two-segment leaf path into its section and key; null for any
 * other path.
 *
 * @deprecated Write by path with profileStore.setValues. Removed in x1.
 */
export function splitProfilePath(path: string): { section: ProfileSection; key: string } | null {
  if (!LEAF_SET.has(path)) return null;
  const segments = splitPath(path);
  if (segments.length !== 2) return null;
  return { section: segments[0] as ProfileSection, key: segments[1] };
}

/** Reads a known profile path; undefined for unknown paths. */
export function getProfileValue(profile: FinancialProfile, path: string): unknown {
  return isProfilePath(path) ? getAt(profile, path) : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLeaf(path: string, value: unknown): boolean {
  if (PROFILE_NULLABLE_PATHS.has(path)) return value === null || isFiniteNumber(value);
  const expected = getAt(DEFAULT_REFERENCE, path);
  if (typeof expected === 'number') return isFiniteNumber(value);
  if (typeof expected === 'boolean') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  const allowed = PROFILE_ENUM_VALUES[path];
  return allowed ? allowed.includes(value) : value.trim().length > 0;
}

function isValidRowValue(schema: ListRowSchema, key: string, value: unknown): boolean {
  if ((schema.optional ?? []).includes(key)) return value === undefined || typeof value === 'string';
  if (!(key in schema.defaults)) return false;
  if ((schema.nullableStrings ?? []).includes(key)) return value === null || typeof value === 'string';
  const expected = schema.defaults[key];
  if (typeof expected === 'number') return isFiniteNumber(value);
  if (typeof expected === 'boolean') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  const allowed = schema.enums?.[key];
  if (allowed) return allowed.includes(value);
  return schema.required.includes(key) ? value.trim().length > 0 : true;
}

/**
 * Whether `value` is acceptable at `path`:
 * - leaf: same primitive type as the default, finite for numbers, a listed
 *   member for enum fields, non-empty for free-text strings, and null or a
 *   finite number for nullable leaves;
 * - list: an array (rows are normalized separately);
 * - list row: an object; list row field: valid for that row key.
 */
export function isValidProfileValue(path: string, value: unknown): boolean {
  if (LEAF_SET.has(path)) return isValidLeaf(path, value);
  if (LIST_SET.has(path)) return Array.isArray(value);
  const list = listPathOf(path);
  if (list === null) return false;
  const segments = splitPath(path);
  const schema = PROFILE_LIST_ROWS[list];
  if (segments.length === splitPath(list).length + 1) return isRecord(value);
  return isValidRowValue(schema, segments[segments.length - 1], value);
}

function normalizeRow(
  schema: ListRowSchema,
  input: unknown,
  previous: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!isRecord(input)) return null;
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(schema.defaults)) {
    const value = input[key];
    if (isValidRowValue(schema, key, value)) row[key] = value;
    else if (previous && isValidRowValue(schema, key, previous[key])) row[key] = previous[key];
    else row[key] = schema.defaults[key];
  }
  for (const key of schema.optional ?? []) {
    if (typeof input[key] === 'string') row[key] = input[key];
  }
  for (const key of schema.required) {
    const value = row[key];
    if (typeof value !== 'string' || value.trim().length === 0) return null;
  }
  return row;
}

/**
 * Normalizes one list: non-object rows and rows missing a required key are
 * dropped, rows with a duplicate id keep the first, and each invalid key
 * falls back to the previous row with the same id, then to the row default.
 */
export function normalizeList(listPath: string, input: unknown, previous: readonly unknown[] = []): unknown[] {
  const schema = PROFILE_LIST_ROWS[listPath];
  if (!schema || !Array.isArray(input)) return [...previous];
  const idKey = schema.idKey;
  const previousById = new Map<unknown, Record<string, unknown>>();
  if (idKey) {
    for (const row of previous) if (isRecord(row)) previousById.set(row[idKey], row);
  }
  const seen = new Set<unknown>();
  const out: Record<string, unknown>[] = [];
  for (const candidate of input) {
    const prior = idKey && isRecord(candidate) ? previousById.get(candidate[idKey]) : undefined;
    const row = normalizeRow(schema, candidate, prior);
    if (!row) continue;
    if (idKey) {
      if (seen.has(row[idKey])) continue;
      seen.add(row[idKey]);
    }
    out.push(row);
  }
  return out;
}

/** Known provided paths, deduped, in first-seen order (row paths become their list). */
export function normalizeProvided(paths: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const path of paths) {
    if (typeof path !== 'string') continue;
    const recorded = providedPathFor(path);
    if (recorded !== null) out.add(recorded);
  }
  return Array.from(out);
}

/** Drops holdings that point at an account or security that no longer exists. */
function dropOrphanHoldings(profile: FinancialProfile): FinancialProfile {
  const accounts = new Set(profile.portfolio.accounts.map((a) => a.id));
  const securities = new Set(profile.portfolio.securities.map((s) => s.id));
  const holdings = profile.portfolio.holdings.filter(
    (h) => accounts.has(h.accountId) && securities.has(h.securityId)
  );
  if (holdings.length === profile.portfolio.holdings.length) return profile;
  return { ...profile, portfolio: { ...profile.portfolio, holdings } };
}

/**
 * Coerces untrusted data (persisted localStorage, a merged update) into a
 * complete v2 FinancialProfile. Every leaf that is missing or invalid falls
 * back to the same leaf in `base` (the defaults unless given); every list is
 * normalized row by row against its row schema (see normalizeList), with an
 * invalid list keeping the base list; holdings that point at a missing
 * account or security are dropped. Unknown keys are dropped, so a schema
 * change or a hand-edited payload can never leave a section undefined.
 * `provided` keeps each known path once (a row path is recorded as its
 * list); unknown paths and non-strings are dropped.
 */
export function normalizeProfile(
  input: unknown,
  base: FinancialProfile = getDefaultFinancialProfile()
): FinancialProfile {
  const source = isRecord(input) ? input : {};
  let out = structuredClone(base) as FinancialProfile;
  out.version = 2;

  for (const path of PROFILE_LEAF_PATHS) {
    const value = getAt(source, path);
    if (value !== undefined && isValidLeaf(path, value)) out = setAt(out, path, value);
  }
  for (const path of PROFILE_LIST_PATHS) {
    const value = getAt(source, path);
    if (Array.isArray(value)) {
      out = setAt(out, path, normalizeList(path, value, getAt(base, path) as unknown[]));
    }
  }
  out = dropOrphanHoldings(out);

  if (isFiniteNumber(source.updatedAt)) out.updatedAt = source.updatedAt;
  if (Array.isArray(source.provided)) {
    out.provided = normalizeProvided(source.provided);
  }
  return out;
}
