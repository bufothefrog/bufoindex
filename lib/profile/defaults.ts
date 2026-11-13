/**
 * Default financial profile, path registry, and the rules that keep
 * untrusted data (persisted localStorage, a write from a form) valid.
 *
 * The defaults are illustrative placeholders, not recommendations: they let
 * every calculator render a worked example before the user answers anything.
 * Fields the user actually answered are tracked in `profile.provided`.
 *
 * Paths:
 * - A leaf path names one value: 'person.age', 'assumptions.retirement.volatility'.
 * - A list path names a whole list: 'debts', 'portfolio.accounts'.
 * - A row path adds an index ('debts.0'); a row field path adds a row key
 *   ('debts.0.balance').
 * - `provided` records leaves by their own path and lists by the list path.
 */

import {
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  type ClassTarget,
} from '@/lib/calculations/portfolioRebalancing';
import { DEFAULT_DCA_COMPARISON_INPUTS } from '@/lib/calculations/leverageComparison';
import { PAY_FREQUENCY_OPTIONS } from '@/lib/constants/frequency';
import {
  ACCOUNT_TYPE_OPTIONS,
  BONUS_FREQUENCY_OPTIONS,
  CONTRIBUTION_TYPE_OPTIONS,
  FILING_STATUS_OPTIONS,
  HSA_COVERAGE_OPTIONS,
  OPTIMIZATION_GOAL_OPTIONS,
  RISK_TOLERANCE_OPTIONS,
  TARGET_MIX_OPTIONS,
} from '@/lib/constants/labels';
import { RetirementConstants } from '@/lib/constants/retirement';
import { derivedEmergencyFundBalance, derivedHsaCoverage, derivedTargetRetirementIncome } from './derived';
import { getAt, isRecord, setAt } from '@/lib/fields/paths';
import { isFiniteNumber } from '@/lib/fields/runtime';
import type { Write } from '@/lib/fields/types';
import type {
  AccountRow,
  ClassTargetRow,
  CustomAssetClassRow,
  DebtRow,
  FilingStatus,
  FinancialProfile,
  HoldingRow,
  PayFrequency,
  ProfileListPath,
  ProfilePatch,
  ProfileSection,
  RiskProfile,
  SecurityRow,
  TargetMixPreset,
} from './types';

// ---------------------------------------------------------------------------
// Target mix
// ---------------------------------------------------------------------------

/** The target mixes that come with fixed class weights (every one but 'custom'). */
export type PresetTargetMix = Exclude<TargetMixPreset, 'custom'>;

/** Portfolio-wide class weights for each stock/bond mix preset. */
export const TARGET_MIX_WEIGHTS: Record<
  PresetTargetMix,
  { 'us-stock': number; 'intl-stock': number; bonds: number; cash: number }
> = {
  '100-0': { 'us-stock': 0.75, 'intl-stock': 0.25, bonds: 0, cash: 0 },
  '80-20': { 'us-stock': 0.6, 'intl-stock': 0.2, bonds: 0.2, cash: 0 },
  '60-40': { 'us-stock': 0.45, 'intl-stock': 0.15, bonds: 0.4, cash: 0 },
};

/** Portfolio-wide class targets (us, intl, bonds, cash) for a mix preset. */
export function presetClassTargets(mix: PresetTargetMix): ClassTarget[] {
  const weights = TARGET_MIX_WEIGHTS[mix];
  return (['us-stock', 'intl-stock', 'bonds', 'cash'] as const).map((assetClass) => ({
    accountId: null,
    assetClass,
    target: weights[assetClass],
  }));
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Id of the worked example's taxable account, which receives the one-off new cash. */
export const BROKERAGE_ACCOUNT_ID = 'acc-brok';

const DEFAULT_NEW_CASH = 1000;

/**
 * Take-home pay of the worked example (single, CA, $4,000 gross every two
 * weeks, 8% traditional 401(k)), computed with the tax model the paycheck
 * allocator itself uses and rounded to the nearest 50. Working (2026 tax
 * year, test/lib/profile/defaults.test.ts recomputes it):
 * - Gross per year: 4,000 x 26 = 104,000. 401(k): 8% = 8,320.
 * - Federal: calculateAnnualFederalTax(104,000 - 8,320 = 95,680, single)
 *   (lib/calculations/projections.ts): 95,680 - 16,100 standard deduction =
 *   79,580 taxable; 1,240 + 4,560 + 6,419.60 = 12,219.60.
 * - State: STATE_TAX_RATES_2026.CA.rate 9.3% of 95,680 = 8,898.24.
 * - FICA: getFICARate(104,000, single) 7.65% of 104,000 = 7,956.
 * - Take-home per year: 104,000 - 8,320 - 12,219.60 - 8,898.24 - 7,956 =
 *   66,606.16; per paycheck 66,606.16 / 26 = 2,561.78, rounded to 2,550.
 */
const DEFAULT_NET_PER_PAYCHECK = 2550;

/** Must-pay costs per month and the fun money range of the worked example. */
const DEFAULT_NECESSARY_MONTHLY = 3000;
const DEFAULT_FUN_MONEY_MIN = 300;
const DEFAULT_FUN_MONEY_MAX = 600;

export function getDefaultFinancialProfile(): FinancialProfile {
  const leverage = DEFAULT_DCA_COMPARISON_INPUTS;
  return {
    version: 2,
    updatedAt: 0,
    person: {
      age: 25,
      state: 'CA',
      filingStatus: 'single',
      retirementAge: 65,
      lifeExpectancy: RetirementConstants.DEFAULT_LIFE_EXPECTANCY,
    },
    income: {
      grossPerPaycheck: 4000,
      netPerPaycheck: DEFAULT_NET_PER_PAYCHECK,
      frequency: 'bi-weekly',
      hasBonus: false,
      bonusAmount: 0,
      bonusFrequency: 'annual',
    },
    spending: {
      necessaryMonthly: DEFAULT_NECESSARY_MONTHLY,
      funMoneyMin: DEFAULT_FUN_MONEY_MIN,
      funMoneyMax: DEFAULT_FUN_MONEY_MAX,
      // Derived while unanswered (lib/profile/derived.ts); stored as the
      // value the rule gives for the defaults, 41,000.
      targetRetirementIncome: derivedTargetRetirementIncome(
        DEFAULT_NECESSARY_MONTHLY,
        DEFAULT_FUN_MONEY_MIN,
        DEFAULT_FUN_MONEY_MAX
      ),
    },
    cash: {
      // Derived while unanswered: three months of must-pay costs, 9,000.
      emergencyFundBalance: derivedEmergencyFundBalance(DEFAULT_NECESSARY_MONTHLY),
      emergencyFundApy: 0.04,
      targetMonths: 3,
    },
    workplace: {
      has401k: true,
      matchPercent: 1,
      matchLimit: 0.04,
      contributionType: 'traditional',
      contributionPercent: 0.08,
      rothContributionPercent: 0,
      afterTaxAvailable: false,
    },
    hsa: {
      eligible: false,
      // Derived while unanswered (family when filing jointly).
      coverage: derivedHsaCoverage('single'),
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
    },
    retirementIncome: {
      socialSecurityBenefit: 30000,
      socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
      annualHealthcareCost: null,
    },
    debts: [],
    // The rebalancer's three-fund worked example (Roth IRA plus a taxable
    // brokerage). The ids are stable so server and client render the same.
    // Prices: the closing price on 2026-11-12, read on 2026-11-13 from two
    // market data pages that agreed to the cent or within 0.02%: Yahoo
    // Finance chart data (query1.finance.yahoo.com/v8/finance/chart/<ticker>:
    // VTI 372.62, VXUS 82.66, BND 70.65) and the Nasdaq quote page
    // (api.nasdaq.com/api/quote/<ticker>/info: VTI 372.57, VXUS 82.66, BND
    // 70.65), each rounded to the nearest 5 dollars.
    portfolio: {
      accounts: [
        { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
        { id: BROKERAGE_ACCOUNT_ID, name: 'Brokerage', accountType: 'taxable', deposit: DEFAULT_NEW_CASH },
      ],
      securities: [
        { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 375, assetClass: 'us-stock' },
        { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 85, assetClass: 'intl-stock' },
        { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 70, assetClass: 'bonds' },
      ],
      holdings: [
        { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
        { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
        { id: 'hld-brok-vti', accountId: BROKERAGE_ACCOUNT_ID, securityId: 'sec-vti', shares: 20 },
        { id: 'hld-brok-vxus', accountId: BROKERAGE_ACCOUNT_ID, securityId: 'sec-vxus', shares: 15 },
      ],
      classTargets: presetClassTargets('80-20'),
      customAssetClasses: [],
    },
    strategy: {
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
        indexMeanReturn: leverage.indexMeanReturn,
        indexVolatility: leverage.indexVolatility,
        financingRate: leverage.financingRate,
        expenseRatio: leverage.expenseRatio,
        indexExpenseRatio: leverage.indexExpenseRatio,
      },
    },
    provided: [],
  };
}

/** Empty rows, the fallback for each field of a list row. */
export interface ProfileListRows {
  debts: DebtRow;
  'portfolio.accounts': AccountRow;
  'portfolio.securities': SecurityRow;
  'portfolio.holdings': HoldingRow;
  'portfolio.classTargets': ClassTargetRow;
  'portfolio.customAssetClasses': CustomAssetClassRow;
}

export const PROFILE_LIST_ROW_DEFAULTS: { readonly [P in ProfileListPath]: Readonly<ProfileListRows[P]> } = {
  debts: { id: '', name: '', balance: 0, interestRate: 0, minimumPayment: 0, extraPayment: 0, taxDeductible: false },
  'portfolio.accounts': { id: '', name: '', accountType: DEFAULT_ACCOUNT_TYPE, deposit: 0 },
  'portfolio.securities': { id: '', ticker: '', price: 0, assetClass: DEFAULT_ASSET_CLASS },
  'portfolio.holdings': { id: '', accountId: '', securityId: '', shares: 0 },
  'portfolio.classTargets': { accountId: null, assetClass: '', target: 0 },
  'portfolio.customAssetClasses': { id: '', label: '' },
};

// ---------------------------------------------------------------------------
// Sections, labels, enums
// ---------------------------------------------------------------------------

/** Section order. */
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

const optionValues = <V extends string | number>(options: readonly { value: V }[]): readonly V[] =>
  options.map((option) => option.value);

// Vocabularies with a label table take their values from it (one table per vocabulary).
export const PAY_FREQUENCIES: readonly PayFrequency[] = optionValues(PAY_FREQUENCY_OPTIONS);
export const PROFILE_FILING_STATUSES: readonly FilingStatus[] = optionValues(FILING_STATUS_OPTIONS);
export const TARGET_MIX_PRESETS: readonly TargetMixPreset[] = optionValues(TARGET_MIX_OPTIONS);
const RISK_PROFILES: readonly RiskProfile[] = ['tdf', 'custom'];

/**
 * Allowed values for the enum-typed fields, keyed by leaf path, or by list
 * path plus row key for a row field ('portfolio.accounts.accountType').
 */
export const PROFILE_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = {
  'person.filingStatus': PROFILE_FILING_STATUSES,
  'income.frequency': PAY_FREQUENCIES,
  'income.bonusFrequency': optionValues(BONUS_FREQUENCY_OPTIONS),
  'workplace.contributionType': optionValues(CONTRIBUTION_TYPE_OPTIONS),
  'hsa.coverage': optionValues(HSA_COVERAGE_OPTIONS),
  'investing.targetMix': TARGET_MIX_PRESETS,
  'assumptions.retirement.riskProfile': RISK_PROFILES,
  'assumptions.paycheck.riskTolerance': optionValues(RISK_TOLERANCE_OPTIONS),
  'assumptions.paycheck.optimizationGoal': optionValues(OPTIMIZATION_GOAL_OPTIONS),
  'assumptions.portfolio.mode': ['whole', 'fractional'],
  'portfolio.accounts.accountType': optionValues(ACCOUNT_TYPE_OPTIONS),
};

// ---------------------------------------------------------------------------
// Path registry and value rules
// ---------------------------------------------------------------------------

type ValueType = 'number' | 'boolean' | 'string';

interface ValueRule {
  type: ValueType;
  /** null is a valid value (an override left on "derive"). */
  nullable: boolean;
  /** May be absent from a row (Security.name). */
  optional: boolean;
  options?: readonly string[];
  /** Free text that must not be blank. */
  nonEmpty: boolean;
}

/** The type of each leaf or row field whose default is null. */
const NULLABLE_TYPES: Readonly<Record<string, ValueType>> = {
  'retirementIncome.annualHealthcareCost': 'number',
  'leverage.monthlyContribution': 'number',
  'leverage.years': 'number',
  'leverage.startingBalance': 'number',
  'assumptions.retirement.effectiveTaxRate': 'number',
  'portfolio.classTargets.accountId': 'string',
};

/** Row fields a row cannot do without; a row that lacks one is dropped. */
const REQUIRED_ROW_FIELDS: { readonly [P in ProfileListPath]: readonly string[] } = {
  debts: ['id'],
  'portfolio.accounts': ['id'],
  'portfolio.securities': ['id'],
  'portfolio.holdings': ['id', 'accountId', 'securityId'],
  'portfolio.classTargets': ['assetClass'],
  'portfolio.customAssetClasses': ['id'],
};

/** Row text that must not be blank; a blank value takes the row default instead of dropping the row. */
const NON_BLANK_ROW_FIELDS: ReadonlySet<string> = new Set(['portfolio.securities.assetClass']);

/** Row fields that may be absent (they have no row default). */
const OPTIONAL_ROW_FIELDS: Readonly<Record<string, ValueType>> = {
  'portfolio.securities.name': 'string',
};

export const PROFILE_LIST_PATHS: readonly ProfileListPath[] = [
  'debts',
  'portfolio.accounts',
  'portfolio.securities',
  'portfolio.holdings',
  'portfolio.classTargets',
  'portfolio.customAssetClasses',
];

const LIST_PATH_SET: ReadonlySet<string> = new Set(PROFILE_LIST_PATHS);

function ruleFor(key: string, example: unknown, topLevel: boolean, required = false): ValueRule {
  const nullType = NULLABLE_TYPES[key];
  const type: ValueType = nullType ?? (typeof example as ValueType);
  const options = PROFILE_ENUM_VALUES[key];
  return {
    type,
    nullable: nullType !== undefined,
    optional: false,
    options,
    // Free-text leaves (state), required row keys (ids) and asset classes must
    // not be blank; other row text (a name being typed) may be.
    nonEmpty: type === 'string' && !options && (topLevel || required || NON_BLANK_ROW_FIELDS.has(key)),
  };
}

/** Collects every leaf path of the default profile, depth first, in order. */
function collectLeaves(node: Record<string, unknown>, prefix: string, out: string[]): string[] {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (LIST_PATH_SET.has(path)) continue;
    if (isRecord(value)) collectLeaves(value, path, out);
    else out.push(path);
  }
  return out;
}

/** Shape reference only; never handed out. */
const TEMPLATE = getDefaultFinancialProfile();

const SECTION_TEMPLATE: Record<string, unknown> = Object.fromEntries(
  PROFILE_SECTIONS.map((section) => [section, TEMPLATE[section]])
);

/**
 * Every leaf path of the v2 profile, in section order. It excludes lists,
 * version, updatedAt and provided.
 */
export const PROFILE_LEAF_PATHS: readonly string[] = collectLeaves(SECTION_TEMPLATE, '', []);

const LEAF_RULES: ReadonlyMap<string, ValueRule> = new Map(
  PROFILE_LEAF_PATHS.map((path) => [path, ruleFor(path, getAt(TEMPLATE, path), true)])
);

/** Rule per row field, keyed by list path plus row key. */
const ROW_RULES: ReadonlyMap<string, ValueRule> = new Map(
  PROFILE_LIST_PATHS.flatMap((list) => {
    const required = REQUIRED_ROW_FIELDS[list];
    const entries = Object.entries(PROFILE_LIST_ROW_DEFAULTS[list]).map(([key, example]): [string, ValueRule] => {
      const ruleKey = `${list}.${key}`;
      return [ruleKey, ruleFor(ruleKey, example, false, required.includes(key))];
    });
    const optional = Object.entries(OPTIONAL_ROW_FIELDS)
      .filter(([ruleKey]) => ruleKey.startsWith(`${list}.`))
      .map(([ruleKey, type]): [string, ValueRule] => [
        ruleKey,
        { type, nullable: false, optional: true, nonEmpty: false },
      ]);
    return [...entries, ...optional];
  })
);

function rowFields(list: ProfileListPath): string[] {
  const prefix = `${list}.`;
  return [...ROW_RULES.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
}

const INDEX = /^(0|[1-9]\d*)$/;

type PathInfo =
  | { kind: 'leaf'; rule: ValueRule }
  | { kind: 'list'; list: ProfileListPath }
  | { kind: 'row'; list: ProfileListPath; index: number }
  | { kind: 'rowField'; list: ProfileListPath; index: number; key: string; rule: ValueRule };

function classifyPath(path: string): PathInfo | null {
  const leafRule = LEAF_RULES.get(path);
  if (leafRule) return { kind: 'leaf', rule: leafRule };
  for (const list of PROFILE_LIST_PATHS) {
    if (path === list) return { kind: 'list', list };
    if (!path.startsWith(`${list}.`)) continue;
    const [index, field, ...rest] = path.slice(list.length + 1).split('.');
    if (!INDEX.test(index) || rest.length > 0) return null;
    if (field === undefined) return { kind: 'row', list, index: Number(index) };
    const rule = ROW_RULES.get(`${list}.${field}`);
    return rule ? { kind: 'rowField', list, index: Number(index), key: field, rule } : null;
  }
  return null;
}

/**
 * True for a leaf path, a list path, a row path ('debts.0') or a row field
 * path ('debts.0.balance').
 */
export function isProfilePath(path: string): boolean {
  return classifyPath(path) !== null;
}

/**
 * Flattens a patch into writes in section order: objects recurse until a
 * profile path is reached, so a list is written whole and a leaf at any
 * depth ('assumptions.retirement.volatility') gets its own write.
 */
export function patchWrites(patch: ProfilePatch): Write[] {
  const out: Write[] = [];
  const visit = (value: unknown, path: string): void => {
    if (isRecord(value) && !isProfilePath(path)) {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    } else {
      out.push({ path, value });
    }
  };
  for (const section of PROFILE_SECTIONS) {
    if (patch[section] !== undefined) visit(patch[section], section);
  }
  return out;
}

/**
 * The path `provided` records for a profile path: the path itself for a
 * leaf or a list, the list path for a row or a row field, and null for
 * anything that is not a profile path.
 */
export function providedPathFor(path: string): string | null {
  const info = classifyPath(path);
  if (!info) return null;
  return info.kind === 'leaf' ? path : info.kind === 'list' ? path : info.list;
}

function matchesRule(rule: ValueRule, value: unknown): boolean {
  if (value === null) return rule.nullable;
  if (rule.type === 'number') return isFiniteNumber(value);
  if (rule.type === 'boolean') return typeof value === 'boolean';
  if (typeof value !== 'string') return false;
  if (rule.options) return rule.options.includes(value);
  return !rule.nonEmpty || value.trim().length > 0;
}

/**
 * Whether `value` is acceptable for the leaf or row field at `path`: same
 * primitive type as the default (null where the leaf is nullable), finite
 * for numbers, a listed member for enum fields, and non-blank for free-text
 * leaves and row ids. False for lists, rows and unknown paths.
 */
export function isValidProfileValue(path: string, value: unknown): boolean {
  const info = classifyPath(path);
  if (!info || (info.kind !== 'leaf' && info.kind !== 'rowField')) return false;
  return matchesRule(info.rule, value);
}

/** Reads a profile path (leaf, list, row or row field); undefined for anything else. */
export function getProfileValue(profile: FinancialProfile, path: string): unknown {
  return isProfilePath(path) ? getAt(profile, path) : undefined;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Coerces one untrusted row against the list's row defaults: each field that
 * is missing or invalid takes its row default. Returns null (drop the row)
 * when it is not an object or a required field is invalid.
 */
function normalizeRow(list: ProfileListPath, value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  const defaults = PROFILE_LIST_ROW_DEFAULTS[list] as Readonly<Record<string, unknown>>;
  for (const key of rowFields(list)) {
    const rule = ROW_RULES.get(`${list}.${key}`) as ValueRule;
    const valid = matchesRule(rule, value[key]);
    if (REQUIRED_ROW_FIELDS[list].includes(key) && !valid) return null;
    if (valid) out[key] = value[key];
    else if (!rule.optional) out[key] = defaults[key];
  }
  return out;
}

/** Normalizes each row, dropping invalid rows and any row that repeats an earlier id. */
function normalizeRows(list: ProfileListPath, rows: readonly unknown[]): Record<string, unknown>[] {
  const ids = new Set<unknown>();
  const out: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = normalizeRow(list, raw);
    if (!row) continue;
    if ('id' in row) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
    }
    out.push(row);
  }
  return out;
}

function normalizeNode(template: unknown, input: unknown, base: unknown, path: string): unknown {
  if (LIST_PATH_SET.has(path)) {
    return Array.isArray(input)
      ? normalizeRows(path as ProfileListPath, input)
      : (base as readonly Record<string, unknown>[]).map((row) => ({ ...row }));
  }
  if (isRecord(template)) {
    const source = isRecord(input) ? input : {};
    const baseNode = base as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(template)) {
      out[key] = normalizeNode(template[key], source[key], baseNode[key], `${path}.${key}`);
    }
    return out;
  }
  return isValidProfileValue(path, input) ? input : base;
}

/**
 * Canonical `provided` list: profile paths only, rows recorded by their list
 * path, first occurrence kept. With `profile`, a row or row field path whose
 * row does not exist in it is dropped, so a list nobody answered is never
 * marked provided through a phantom row.
 */
export function normalizeProvided(paths: readonly unknown[], profile?: FinancialProfile): string[] {
  const out = new Set<string>();
  for (const path of paths) {
    if (typeof path !== 'string') continue;
    const info = classifyPath(path);
    if (!info) continue;
    if (info.kind === 'leaf' || info.kind === 'list') {
      out.add(path);
      continue;
    }
    const rows = profile ? (getAt(profile, info.list) as readonly unknown[]) : undefined;
    if (rows && info.index >= rows.length) continue;
    out.add(info.list);
  }
  return [...out];
}

/**
 * Coerces untrusted data (persisted localStorage, a hand-edited payload)
 * into a complete v2 FinancialProfile.
 *
 * - Leaves: each one that is missing or invalid falls back to the same leaf
 *   in `base` (the defaults unless given). Nullable leaves accept null.
 * - Lists: a list given as an array replaces the base list; each row is
 *   normalized against the row defaults, and invalid rows are dropped. A
 *   list that is missing or not an array keeps the base list.
 * - Unknown keys are dropped, so a later leaf deletion needs no version bump.
 * - `provided` keeps profile paths only, and row paths only for rows that
 *   exist in the result (see normalizeProvided).
 *
 * The result shares no objects with `input` or `base`.
 */
export function normalizeProfile(
  input: unknown,
  base: FinancialProfile = getDefaultFinancialProfile()
): FinancialProfile {
  const source = isRecord(input) ? input : {};
  const out: Record<string, unknown> = { version: 2 };
  out.updatedAt =
    typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt) ? source.updatedAt : base.updatedAt;
  for (const section of PROFILE_SECTIONS) {
    out[section] = normalizeNode(SECTION_TEMPLATE[section], source[section], base[section], section);
  }
  const profile = out as unknown as FinancialProfile;
  out.provided = Array.isArray(source.provided) ? normalizeProvided(source.provided, profile) : [...base.provided];
  return profile;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** True when a row other than the one at `index` already has this id. */
function takenId(rows: readonly unknown[], index: number, id: unknown): boolean {
  return rows.some((row, i) => i !== index && isRecord(row) && row.id === id);
}

/** The value to store for a write, or null when the write is refused. */
function admitWrite(profile: FinancialProfile, path: string, value: unknown): { value: unknown } | null {
  const info = classifyPath(path);
  if (!info) return null;
  switch (info.kind) {
    case 'leaf':
      return matchesRule(info.rule, value) ? { value } : null;
    case 'list':
      return Array.isArray(value) ? { value: normalizeRows(info.list, value) } : null;
    case 'row': {
      // A row write replaces a row or appends one (index === length).
      const rows = getAt(profile, info.list) as readonly unknown[];
      if (info.index > rows.length) return null;
      const row = normalizeRow(info.list, value);
      if (!row || ('id' in row && takenId(rows, info.index, row.id))) return null;
      return { value: row };
    }
    case 'rowField': {
      const rows = getAt(profile, info.list) as readonly unknown[];
      if (info.index >= rows.length || !matchesRule(info.rule, value)) return null;
      if (info.key === 'id' && takenId(rows, info.index, value)) return null;
      return { value };
    }
  }
}

/**
 * Applies writes in order, refusing each one whose path is not a profile
 * path, whose value is invalid, or that would give two rows of a list the
 * same id (the previous value stays). List writes are
 * normalized like normalizeProfile does. Returns the new profile and the
 * accepted paths;
 * `provided` and `updatedAt` are left to the caller.
 */
export function applyProfileWrites(
  profile: FinancialProfile,
  writes: readonly Write[]
): { profile: FinancialProfile; accepted: string[] } {
  let next = profile;
  const accepted: string[] = [];
  for (const write of writes) {
    const admitted = admitWrite(next, write.path, write.value);
    if (!admitted) continue;
    next = setAt(next, write.path, admitted.value);
    accepted.push(write.path);
  }
  return { profile: next, accepted };
}
