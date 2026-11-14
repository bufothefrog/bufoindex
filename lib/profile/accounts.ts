/**
 * The account model: portfolio.accounts is the single list of what the
 * visitor owns, and every balance asked elsewhere (the invested total, the
 * IRA balances, the emergency fund when an account holds it, the monthly
 * investing total, each account's normal new cash) is computed here from
 * that list and the existing contribution answers. Pure.
 *
 * Every function takes a Get. Callers pass a get over a withDerivedValues
 * profile (so cash.emergencyFundBalance and hsa.coverage read their typical
 * value while unanswered). The answered list is read from get('provided');
 * a value that is not an array reads as [].
 *
 * This module must not import lib/fields/shared.ts, lib/profile/defaults.ts
 * or anything under lib/calculators, because those import it. It uses
 * literal paths.
 *
 * Rules:
 * - An account's value is its holdings when they are worth more than 0,
 *   otherwise its typed balance.
 * - While the list is unanswered (the example list), a stored row shows only
 *   while its kind's answer says yes in effect (answered or typical).
 * - Only an answered yes suggests a row; a suggested row is never stored
 *   until edited and holds no money.
 * - A 'cash' account, or a 'brokerage' account with the tick, holds the
 *   emergency fund: it is left out of the invested total and of the
 *   rebalancer, and their sum replaces the typed emergency fund.
 * - Each normal contribution goes to the first account of its kind in list
 *   order (emergency-fund accounts excluded); a part with no such account
 *   goes to nobody but still counts in the monthly total.
 */

import { limit401k, limitHsa } from '@/lib/calculations/contributionLimits';
import type { AccountType } from '@/lib/calculations/portfolioRebalancing';
import { PAY_FREQUENCY_META, type PayFrequency } from '@/lib/constants/frequency';
import { EXAMPLE_FUND_PRICES } from '@/lib/constants/example-prices';
import { ACCOUNT_KIND_LABELS, ACCOUNT_KIND_OPTIONS } from '@/lib/constants/labels';
import { isRecord } from '@/lib/fields/paths';
import { isFiniteNumber, listRows } from '@/lib/fields/runtime';
import type { Get } from '@/lib/fields/types';
import { formatCurrency } from '@/lib/format';
import type { ContributionType, HoldingRow, HsaCoverage, SecurityRow } from '@/lib/profile/types';
import type { AccountKind, AccountRow, NewCashRow } from './accountTypes';

export type { AccountKind, AccountRow, NewCashRow } from './accountTypes';

/** The profile paths this module reads lists from. */
export const ACCOUNT_PATHS = {
  accounts: 'portfolio.accounts',
  holdings: 'portfolio.holdings',
  securities: 'portfolio.securities',
  newCash: 'portfolio.newCash',
  provided: 'provided',
} as const;

export interface AccountKindMeta {
  /** ACCOUNT_KIND_LABELS[kind]. */
  label: string;
  /** The rebalancer's tax treatment; null only for 'cash' (never sent to the rebalancer). */
  taxTreatment: AccountType | null;
  /** Id of a suggested row of this kind (with '-2', '-3', ... when a stored row has it). */
  suggestedId: string;
}

/**
 * Each kind with its label, tax treatment and suggested id. HSA is
 * tax-free, as the doc comment above AccountType in
 * lib/calculations/portfolioRebalancing.ts lists it.
 */
export const ACCOUNT_KINDS: Readonly<Record<AccountKind, AccountKindMeta>> = {
  '401k': { label: ACCOUNT_KIND_LABELS['401k'], taxTreatment: 'tax-deferred', suggestedId: 'acc-401k' },
  'roth-401k': { label: ACCOUNT_KIND_LABELS['roth-401k'], taxTreatment: 'tax-free', suggestedId: 'acc-roth-401k' },
  'traditional-ira': {
    label: ACCOUNT_KIND_LABELS['traditional-ira'],
    taxTreatment: 'tax-deferred',
    suggestedId: 'acc-trad-ira',
  },
  'roth-ira': { label: ACCOUNT_KIND_LABELS['roth-ira'], taxTreatment: 'tax-free', suggestedId: 'acc-roth-ira' },
  hsa: { label: ACCOUNT_KIND_LABELS.hsa, taxTreatment: 'tax-free', suggestedId: 'acc-hsa' },
  brokerage: { label: ACCOUNT_KIND_LABELS.brokerage, taxTreatment: 'taxable', suggestedId: 'acc-brok' },
  cash: { label: ACCOUNT_KIND_LABELS.cash, taxTreatment: null, suggestedId: 'acc-cash' },
};

const KIND_VALUES: ReadonlySet<string> = new Set(ACCOUNT_KIND_OPTIONS.map((option) => option.value));

function isAccountKind(value: unknown): value is AccountKind {
  return typeof value === 'string' && KIND_VALUES.has(value);
}

/** round2(x) = Math.round(x * 100) / 100. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A finite number, else 0. */
function num(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

/** A finite number of 0 or more, else 0 (negative inputs count as 0). */
function nonNegative(value: unknown): number {
  return Math.max(0, num(value));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// ---------------------------------------------------------------------------
// The example lists
// ---------------------------------------------------------------------------

/**
 * The v3 example lists: the default profile's portfolio accounts,
 * securities and holdings. A 401(k) with a typed 16,225 and a brokerage
 * worth 20 x 375 + 15 x 85 + 0 x 70 = 8,775, so the example invested total
 * is 25,000. Prices and their source: lib/constants/example-prices.ts.
 * Fresh objects each call.
 */
export function exampleAccountLists(): { accounts: AccountRow[]; securities: SecurityRow[]; holdings: HoldingRow[] } {
  return {
    accounts: [
      { id: 'acc-401k', kind: '401k', name: '', balance: 16225, holdsEmergencyFund: false },
      { id: 'acc-brok', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
    ],
    securities: [
      { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: EXAMPLE_FUND_PRICES.VTI, assetClass: 'us-stock' },
      { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: EXAMPLE_FUND_PRICES.VXUS, assetClass: 'intl-stock' },
      { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: EXAMPLE_FUND_PRICES.BND, assetClass: 'bonds' },
    ],
    holdings: [
      { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
      { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
      { id: 'hld-brok-bnd', accountId: 'acc-brok', securityId: 'sec-bnd', shares: 0 },
    ],
  };
}

/**
 * True when `row` is one of the example accounts: its id and kind are an
 * example row's. A row the visitor adds gets an 'acc-<n>' id
 * (addAccountRow), never an example id, so it never counts.
 */
export function isExampleAccount(row: AccountRow): boolean {
  return exampleAccountLists().accounts.some((example) => example.id === row.id && example.kind === row.kind);
}

// ---------------------------------------------------------------------------
// Answered paths
// ---------------------------------------------------------------------------

/** The answered paths: the string entries of get('provided'), or [] when it is not a list. */
export function answeredPaths(get: Get): readonly string[] {
  const value = get(ACCOUNT_PATHS.provided);
  return Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string') : [];
}

/** True when an answered path equals `path` or lies under it. */
export function isAnswered(get: Get, path: string): boolean {
  const prefix = `${path}.`;
  return answeredPaths(get).some((answered) => answered === path || answered.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// The rows in effect
// ---------------------------------------------------------------------------

/** One stored row read as an AccountRow, or null when it has no usable id. */
function toAccountRow(value: unknown): AccountRow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim() === '') return null;
  const kind = isAccountKind(value.kind) ? value.kind : 'brokerage';
  return {
    id: value.id,
    kind,
    name: typeof value.name === 'string' ? value.name : '',
    balance: nonNegative(value.balance),
    holdsEmergencyFund: kind === 'brokerage' && value.holdsEmergencyFund === true,
  };
}

/** The stored rows, first occurrence of each id kept. */
function storedAccounts(get: Get): AccountRow[] {
  const seen = new Set<string>();
  const out: AccountRow[] = [];
  for (const raw of listRows(get(ACCOUNT_PATHS.accounts))) {
    const row = toAccountRow(raw);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** The example filter: whether a stored row of `kind` shows while the list is unanswered. */
function shownInExample(get: Get, kind: AccountKind): boolean {
  switch (kind) {
    case '401k':
    case 'roth-401k':
      return get('workplace.has401k') === true;
    case 'hsa':
      return get('hsa.eligible') === true;
    case 'traditional-ira':
      return get('ira.traditional') === true;
    case 'roth-ira':
      return get('ira.roth') === true;
    case 'brokerage':
      return num(get('investing.taxableMonthlyContribution')) > 0;
    case 'cash':
      return true;
  }
}

/** An answered leaf whose value is true. */
function answeredYes(get: Get, path: string): boolean {
  return isAnswered(get, path) && get(path) === true;
}

/** The suggestion seeds of section 3, in table order. */
const SEEDS: readonly { kind: AccountKind; applies: (get: Get, rows: readonly AccountRow[]) => boolean }[] = [
  {
    kind: '401k',
    applies: (get, rows) =>
      answeredYes(get, 'workplace.has401k') && get('workplace.contributionType') !== 'roth' && !hasPlanRow(rows),
  },
  {
    kind: 'roth-401k',
    applies: (get, rows) =>
      answeredYes(get, 'workplace.has401k') && get('workplace.contributionType') === 'roth' && !hasPlanRow(rows),
  },
  {
    kind: 'traditional-ira',
    applies: (get, rows) => answeredYes(get, 'ira.traditional') && !rows.some((r) => r.kind === 'traditional-ira'),
  },
  {
    kind: 'roth-ira',
    applies: (get, rows) => answeredYes(get, 'ira.roth') && !rows.some((r) => r.kind === 'roth-ira'),
  },
  {
    kind: 'hsa',
    applies: (get, rows) => answeredYes(get, 'hsa.eligible') && !rows.some((r) => r.kind === 'hsa'),
  },
  {
    kind: 'brokerage',
    applies: (get, rows) =>
      isAnswered(get, 'investing.taxableMonthlyContribution') &&
      num(get('investing.taxableMonthlyContribution')) > 0 &&
      !rows.some((r) => r.kind === 'brokerage' && !r.holdsEmergencyFund),
  },
];

function hasPlanRow(rows: readonly AccountRow[]): boolean {
  return rows.some((r) => r.kind === '401k' || r.kind === 'roth-401k');
}

/** `base`, or '<base>-2', '-3', ... : the first one not in `taken`. */
function freeId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * The rows in effect and the suggested rows.
 *
 * - rows: while the list is unanswered, the stored rows whose kind's answer
 *   says yes in effect (401(k) kinds: has401k; hsa: eligible; IRAs: their
 *   flag; brokerage: a taxable contribution above 0; cash: always). Once the
 *   list is answered, every stored row, whatever the answers.
 * - suggested: one empty row per answered yes whose kind group has no row in
 *   rows, in section 3 table order. The 401(k) group is 401k and roth-401k;
 *   the brokerage group counts only brokerage rows without the tick.
 */
export function accountsInEffect(get: Get): { rows: AccountRow[]; suggested: AccountRow[] } {
  const stored = storedAccounts(get);
  const rows = isAnswered(get, ACCOUNT_PATHS.accounts)
    ? stored
    : stored.filter((row) => shownInExample(get, row.kind));
  const taken = new Set(stored.map((row) => row.id));
  const suggested = SEEDS.filter((seed) => seed.applies(get, rows)).map((seed): AccountRow => {
    const id = freeId(ACCOUNT_KINDS[seed.kind].suggestedId, taken);
    taken.add(id);
    return { id, kind: seed.kind, name: '', balance: 0, holdsEmergencyFund: false };
  });
  return { rows, suggested };
}

/** The name, or the kind label when the name is blank. */
export function accountDisplayName(a: AccountRow): string {
  return a.name.trim() || ACCOUNT_KINDS[a.kind].label;
}

/**
 * Each row's display name, made distinct for the controls' accessible names:
 * rows that share a display name get ' 1', ' 2', ... in list order; every
 * other row keeps its display name. Keyed by account id.
 */
export function distinctAccountNames(rows: readonly AccountRow[]): Map<string, string> {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(accountDisplayName(row), (totals.get(accountDisplayName(row)) ?? 0) + 1);
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  for (const row of rows) {
    const name = accountDisplayName(row);
    if ((totals.get(name) ?? 0) < 2) {
      out.set(row.id, name);
      continue;
    }
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    out.set(row.id, `${name} ${n}`);
  }
  return out;
}

/**
 * distinctAccountNames over the rows in effect and the suggested rows, in the
 * order the account list shows them: the name every card shows a visitor for
 * a row, so the same account reads the same in each.
 */
export function accountLabels(get: Get): Map<string, string> {
  const { rows, suggested } = accountsInEffect(get);
  return distinctAccountNames([...rows, ...suggested]);
}

/** One row's accountLabels name (its display name when it is not in effect). */
export function accountLabel(get: Get, a: AccountRow): string {
  return accountLabels(get).get(a.id) ?? accountDisplayName(a);
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** The holding rows of one account. */
export function holdingsOf(get: Get, accountId: string): HoldingRow[] {
  return listRows(get(ACCOUNT_PATHS.holdings)).filter(
    (holding) => holding.accountId === accountId
  ) as unknown as HoldingRow[];
}

/** True when the account has any holding row, a 0-share one included. */
export function hasHoldings(get: Get, accountId: string): boolean {
  return holdingsOf(get, accountId).length > 0;
}

/** Sum of shares x price over the account's holdings (a missing security counts 0). */
export function holdingsValue(get: Get, accountId: string): number {
  const prices = new Map<unknown, number>();
  for (const security of listRows(get(ACCOUNT_PATHS.securities))) {
    if (!prices.has(security.id)) prices.set(security.id, num(security.price));
  }
  return sum(holdingsOf(get, accountId).map((h) => num(h.shares) * (prices.get(h.securityId) ?? 0)));
}

/** The holdings when they are worth more than 0, otherwise the typed balance (at least 0). */
export function accountValue(get: Get, a: AccountRow): number {
  const held = holdingsValue(get, a.id);
  return held > 0 ? held : nonNegative(a.balance);
}

/** A 'cash' account, or a 'brokerage' account with the tick. */
export function isEmergencyFundAccount(a: AccountRow): boolean {
  return a.kind === 'cash' || (a.kind === 'brokerage' && a.holdsEmergencyFund === true);
}

/** The rows in effect that hold the emergency fund. */
export function emergencyFundAccounts(get: Get): AccountRow[] {
  return accountsInEffect(get).rows.filter(isEmergencyFundAccount);
}

/**
 * The sum of the emergency-fund accounts' values while there is one;
 * otherwise cash.emergencyFundBalance as the derived get reads it (the
 * answered value, or the typical value while unanswered).
 */
export function emergencyFundBalance(get: Get): number {
  const accounts = emergencyFundAccounts(get);
  if (accounts.length > 0) return sum(accounts.map((a) => accountValue(get, a)));
  return num(get('cash.emergencyFundBalance'));
}

/** The sum of the values of the rows in effect that do not hold the emergency fund. */
export function investedBalance(get: Get): number {
  return sum(
    accountsInEffect(get)
      .rows.filter((a) => !isEmergencyFundAccount(a))
      .map((a) => accountValue(get, a))
  );
}

/** The values of the traditional-ira rows and of the roth-ira rows. */
export function iraBalances(get: Get): { traditional: number; roth: number } {
  const { rows } = accountsInEffect(get);
  const of = (kind: AccountKind) => sum(rows.filter((a) => a.kind === kind).map((a) => accountValue(get, a)));
  return { traditional: of('traditional-ira'), roth: of('roth-ira') };
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

/** The traditional and Roth shares of a 401(k) election. */
export interface Election401k {
  traditional: number;
  roth: number;
}

/**
 * The 401(k) election split by contribution type: the whole contribution is
 * traditional or Roth, or for 'split' the Roth part (capped at the total)
 * and the rest traditional.
 */
export function split401k(type: ContributionType, total: number, rothPart: number): Election401k {
  if (type === 'roth') return { traditional: 0, roth: total };
  if (type === 'split') {
    const roth = Math.min(rothPart, total);
    return { traditional: total - roth, roth };
  }
  return { traditional: total, roth: 0 };
}

/** Regular pay per year: pay per paycheck x paychecks per year; 0 for an unknown frequency or non-finite pay. */
export function yearlyRegularPay(get: Get): number {
  const frequency = get('income.frequency');
  if (typeof frequency !== 'string' || !Object.prototype.hasOwnProperty.call(PAY_FREQUENCY_META, frequency)) return 0;
  return nonNegative(get('income.grossPerPaycheck')) * PAY_FREQUENCY_META[frequency as PayFrequency].perYear;
}

/** The normal contributions, in monthly dollars, unrounded. */
export interface ContributionParts {
  trad401k: number;
  roth401k: number;
  match: number;
  hsaOwn: number;
  hsaEmployer: number;
  iraTraditional: number;
  iraRoth: number;
  taxable: number;
}

/**
 * The normal monthly contributions from the existing answers.
 *
 * - 401(k), while has401k is true: deferral = min(yearly pay x the election,
 *   the 2026 limit for the age), split between traditional and Roth by the
 *   election; match = matchPercent x min(deferral, yearly pay x matchLimit),
 *   the formula of employerMatchOn in lib/calculations/projections.ts.
 * - HSA, while eligible: the own contribution capped at the coverage limit
 *   less the employer's yearly amount, plus the employer's amount.
 * - IRAs, while each flag is true: the monthly amount.
 * - Taxable: the monthly taxable contribution.
 * Negative inputs count as 0.
 */
export function contributionParts(get: Get): ContributionParts {
  const parts: ContributionParts = {
    trad401k: 0,
    roth401k: 0,
    match: 0,
    hsaOwn: 0,
    hsaEmployer: 0,
    iraTraditional: 0,
    iraRoth: 0,
    taxable: nonNegative(get('investing.taxableMonthlyContribution')),
  };
  const yearlyPay = yearlyRegularPay(get);
  const age = num(get('person.age'));
  if (get('workplace.has401k') === true) {
    const election = split401k(
      get('workplace.contributionType') as ContributionType,
      nonNegative(get('workplace.contributionPercent')),
      nonNegative(get('workplace.rothContributionPercent'))
    );
    const share = election.traditional + election.roth;
    const deferral = Math.min(yearlyPay * share, limit401k(age));
    if (share > 0) {
      parts.trad401k = (deferral * election.traditional) / share / 12;
      parts.roth401k = (deferral * election.roth) / share / 12;
    }
    const matchPercent = nonNegative(get('workplace.matchPercent'));
    const matchLimit = nonNegative(get('workplace.matchLimit'));
    parts.match = (matchPercent * Math.min(deferral, yearlyPay * matchLimit)) / 12;
  }
  if (get('hsa.eligible') === true) {
    const employer = nonNegative(get('hsa.employerAnnualContribution'));
    const coverage: HsaCoverage = get('hsa.coverage') === 'family' ? 'family' : 'individual';
    const room = Math.max(0, limitHsa(coverage, age) - employer);
    parts.hsaOwn = Math.min(12 * nonNegative(get('hsa.monthlyContribution')), room) / 12;
    parts.hsaEmployer = employer / 12;
  }
  if (get('ira.traditional') === true) parts.iraTraditional = nonNegative(get('ira.traditionalMonthly'));
  if (get('ira.roth') === true) parts.iraRoth = nonNegative(get('ira.rothMonthly'));
  return parts;
}

/** round2 of the sum of the eight parts (1,540 for the default: 693.33... + 346.66... + 500). */
export function monthlyInvestingAuto(get: Get): number {
  return round2(sum(Object.values(contributionParts(get))));
}

/** The Custom number when investing.monthlyContribution is a finite number, else monthlyInvestingAuto. */
export function monthlyInvesting(get: Get): number {
  const leaf = get('investing.monthlyContribution');
  return isFiniteNumber(leaf) ? leaf : monthlyInvestingAuto(get);
}

/** The timing leaves of the parts that may be paid once a year, and the contributionParts part each one times. */
const TIMING_PARTS: readonly { path: string; part: keyof ContributionParts }[] = [
  { path: 'ira.traditionalTiming', part: 'iraTraditional' },
  { path: 'ira.rothTiming', part: 'iraRoth' },
  { path: 'investing.taxableTiming', part: 'taxable' },
];

/**
 * Dollars per YEAR landing at the start of each simulated year:
 * round2(12 x the sum of the contributionParts parts iraTraditional, iraRoth
 * and taxable whose timing leaf is 'yearStart'). 401(k), match and HSA are
 * payroll money and always monthly. Returns 0 while
 * investing.monthlyContribution is a finite number (Custom: all monthly).
 *
 * Read order (load-bearing for test/lib/calculators/formBindings.test.ts,
 * which records reads under the default profile, where both IRAs are off):
 * 'investing.monthlyContribution' first; on Auto, all three timing leaves
 * unconditionally, then contributionParts. A leaf value other than
 * 'yearStart' counts as monthly.
 */
export function yearStartInvesting(get: Get): number {
  if (isFiniteNumber(get('investing.monthlyContribution'))) return 0;
  const yearly = TIMING_PARTS.map(({ path }) => get(path) === 'yearStart');
  const parts = contributionParts(get);
  return round2(12 * sum(TIMING_PARTS.map(({ part }, i) => (yearly[i] ? parts[part] : 0))));
}

/**
 * The normal new cash of one account: round2 of the parts routed to it.
 * Each part goes to the first row in list order of its kind, emergency-fund
 * accounts excluded (401(k) traditional and match: first 401k, else first
 * roth-401k; 401(k) Roth: first roth-401k, else first 401k; HSA own and
 * employer: first hsa; each IRA: first of its kind; taxable: first
 * brokerage). 0 for an id that is not a row and for emergency-fund rows.
 */
export function normalNewCash(get: Get, accountId: string): number {
  const rows = accountsInEffect(get).rows.filter((a) => !isEmergencyFundAccount(a));
  if (!rows.some((a) => a.id === accountId)) return 0;
  const first = (...kinds: AccountKind[]): string | undefined => {
    for (const kind of kinds) {
      const row = rows.find((a) => a.kind === kind);
      if (row) return row.id;
    }
    return undefined;
  };
  const parts = contributionParts(get);
  const routes: readonly [string | undefined, number][] = [
    [first('401k', 'roth-401k'), parts.trad401k + parts.match],
    [first('roth-401k', '401k'), parts.roth401k],
    [first('hsa'), parts.hsaOwn + parts.hsaEmployer],
    [first('traditional-ira'), parts.iraTraditional],
    [first('roth-ira'), parts.iraRoth],
    [first('brokerage'), parts.taxable],
  ];
  return round2(sum(routes.filter(([id]) => id === accountId).map(([, amount]) => amount)));
}

/** The portfolio.newCash rows (calculator-only overrides). */
function newCashRows(get: Get): NewCashRow[] {
  return listRows(get(ACCOUNT_PATHS.newCash)).flatMap((row) =>
    typeof row.id === 'string' ? [{ id: row.id, amount: row.amount as number }] : []
  );
}

/** The override for this account when it is a finite number of 0 or more, else normalNewCash. */
export function newCashFor(get: Get, accountId: string): number {
  const row = newCashRows(get).find((r) => r.id === accountId);
  if (row && isFiniteNumber(row.amount) && row.amount >= 0) return row.amount;
  return normalNewCash(get, accountId);
}

// ---------------------------------------------------------------------------
// The rebalancer's accounts
// ---------------------------------------------------------------------------

/** Rows that could be rebalanced: not the emergency fund, not cash, with holdings or no typed balance. */
export function rebalanceCandidates(get: Get): AccountRow[] {
  return accountsInEffect(get).rows.filter(
    (a) => !isEmergencyFundAccount(a) && a.kind !== 'cash' && (hasHoldings(get, a.id) || a.balance === 0)
  );
}

/** Candidates with holdings or new cash: the accounts the rebalancer receives. */
export function rebalancedAccounts(get: Get): AccountRow[] {
  return rebalanceCandidates(get).filter((a) => hasHoldings(get, a.id) || newCashFor(get, a.id) > 0);
}

export type NotRebalancedReason = 'emergency-fund' | 'cash' | 'no-holdings' | 'no-new-cash';

/** Every row in effect that is not rebalanced, in list order, with the first reason that applies. */
export function notRebalanced(get: Get): { account: AccountRow; reason: NotRebalancedReason }[] {
  const rebalanced = new Set(rebalancedAccounts(get).map((a) => a.id));
  return accountsInEffect(get)
    .rows.filter((a) => !rebalanced.has(a.id))
    .map((account) => {
      const reason: NotRebalancedReason =
        account.kind === 'cash'
          ? 'cash'
          : isEmergencyFundAccount(account)
            ? 'emergency-fund'
            : !hasHoldings(get, account.id) && account.balance > 0
              ? 'no-holdings'
              : 'no-new-cash';
      return { account, reason };
    });
}

const REASON_TEXT: Readonly<Record<NotRebalancedReason, string>> = {
  cash: 'cash',
  'emergency-fund': 'emergency fund',
  'no-holdings': 'no holdings entered',
  'no-new-cash': 'no holdings or new cash',
};

/** "Not rebalanced: <name> (<reason>), ...." or null when every row is rebalanced. */
export function notRebalancedNote(get: Get): string | null {
  const items = notRebalanced(get);
  if (items.length === 0) return null;
  const labels = accountLabels(get);
  const named = items.map(({ account, reason }) => `${labels.get(account.id) ?? accountDisplayName(account)} (${REASON_TEXT[reason]})`);
  return `Not rebalanced: ${named.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/**
 * One line per row in effect, then one per suggested row: "<name> $X",
 * plus " (N holdings)" when it has holdings and " (emergency fund)" when it
 * holds the emergency fund; a suggested row reads "<kind label>: no balance yet".
 */
export function accountLines(get: Get): string[] {
  const { rows, suggested } = accountsInEffect(get);
  const labels = accountLabels(get);
  const lines = rows.map((a) => {
    const count = holdingsOf(get, a.id).length;
    const holdings = count === 0 ? '' : count === 1 ? ' (1 holding)' : ` (${count} holdings)`;
    const fund = isEmergencyFundAccount(a) ? ' (emergency fund)' : '';
    return `${labels.get(a.id) ?? accountDisplayName(a)} ${formatCurrency(accountValue(get, a))}${holdings}${fund}`;
  });
  return [...lines, ...suggested.map((a) => `${ACCOUNT_KINDS[a.kind].label}: no balance yet`)];
}

/** accountLines joined by "; ", or "No accounts". */
export function accountsSummary(get: Get): string {
  const lines = accountLines(get);
  return lines.length === 0 ? 'No accounts' : lines.join('; ');
}
