/**
 * The version 2 to version 3 payload step: the raw stored v2 profile is
 * reshaped into a v3-shaped raw object before normalizeProfile runs on it.
 * Pure; never throws; the input is not mutated.
 *
 * Version 3 makes portfolio.accounts the single list of what the visitor
 * owns. Three typed balances (investing.investedBalance and the two IRA
 * balances) become rows of that list, so no money the visitor entered is
 * lost and none counts twice:
 *
 * 1. The answered set A is the string entries of raw.provided. A number
 *    that is not finite, or a flag that is not a boolean, counts as
 *    unanswered.
 * 2. Nothing owned (neither 'portfolio.accounts' nor 'portfolio.holdings'
 *    answered) and nothing typed: the v3 example lists, with the example
 *    fund prices the visitor edited (an answered securities list), and the
 *    account list stays unanswered.
 * 3. Owned: each v2 account keeps its id and name and gets a kind
 *    (kindFromV2) and balance 0; holdings and securities stay. Typed only:
 *    no accounts and no holdings.
 * 4. A typed IRA balance above the holdings of the rows of that kind adds a
 *    row with the rest.
 * 5. A typed invested balance B above the value P of the rows so far adds
 *    an 'Other investments' row with B - P, so the invested total is
 *    max(B, P).
 * 6. An answered account list turns each deposit above 0 into a newCash row.
 * 7. The account list is then answered.
 * 8. investing.monthlyContribution stays when answered and is otherwise null
 *    (Auto); the three removed leaves go; version 3.
 */

import { getAt, isRecord, makeGet } from '@/lib/fields/paths';
import { isFiniteNumber } from '@/lib/fields/runtime';
import { ACCOUNT_KINDS, accountValue, exampleAccountLists, holdingsValue } from './accounts';
import type { AccountKind, AccountRow } from './accountTypes';

const INVESTED_PATH = 'investing.investedBalance';
const TRADITIONAL_PATH = 'ira.traditionalBalance';
const ROTH_PATH = 'ira.rothBalance';
const MONTHLY_PATH = 'investing.monthlyContribution';
const ACCOUNTS_PATH = 'portfolio.accounts';
const HOLDINGS_PATH = 'portfolio.holdings';
const SECURITIES_PATH = 'portfolio.securities';
const REMOVED_PATHS: readonly string[] = [INVESTED_PATH, TRADITIONAL_PATH, ROTH_PATH];

/** The ids of the example securities whose price an answered securities list carries over. */
const EXAMPLE_SECURITY_IDS: ReadonlySet<string> = new Set(['sec-vti', 'sec-vxus', 'sec-bnd']);

/** The kind a v2 account's tax type alone gives. */
function kindFromType(accountType: unknown): AccountKind {
  switch (accountType) {
    case 'taxable':
      return 'brokerage';
    case 'tax-deferred':
      return '401k';
    case 'tax-free':
      return 'roth-ira';
    default:
      return 'brokerage';
  }
}

/** The kind a name hints at (case-insensitive, first match wins), or null. */
function kindFromName(name: string): AccountKind | null {
  const text = name.toLowerCase();
  const plan = /401|403|457|tsp/.test(text);
  if (/hsa/.test(text)) return 'hsa';
  if (/roth/.test(text) && plan) return 'roth-401k';
  if (plan) return '401k';
  if (/roth/.test(text)) return 'roth-ira';
  if (/ira/.test(text)) return 'traditional-ira';
  return null;
}

/**
 * The v3 kind of a v2 account: the name's hint when the hinted kind's tax
 * treatment equals the stored account type, otherwise the type decides
 * (taxable: brokerage, tax-deferred: 401k, tax-free: roth-ira, anything
 * else: brokerage).
 */
export function kindFromV2(name: string, accountType: unknown): AccountKind {
  const hint = typeof name === 'string' ? kindFromName(name) : null;
  if (hint && ACCOUNT_KINDS[hint].taxTreatment === accountType) return hint;
  return kindFromType(accountType);
}

/** A deep copy of plain data (records and lists); other values are kept as they are. */
function deepCopy(value: unknown, seen: WeakMap<object, unknown> = new WeakMap()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) out.push(deepCopy(item, seen));
    return out;
  }
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = deepCopy(value[key], seen);
  return out;
}

/** The record at `key` of `parent`, created (replacing a non-record) when missing. */
function recordAt(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = parent[key];
  if (isRecord(current)) return current;
  const created: Record<string, unknown> = {};
  parent[key] = created;
  return created;
}

/** `base`, or '<base>-2', '-3', ... : the first one not in `taken`. */
function freeId(base: string, taken: ReadonlySet<unknown>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** The record entries of a raw list (null, numbers and other non-records dropped); [] when it is not a list. */
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** The example securities with the prices of an answered v2 securities list. */
function registryFrom(rawSecurities: unknown, securitiesAnswered: boolean): Record<string, unknown>[] {
  const example = exampleAccountLists().securities as unknown as Record<string, unknown>[];
  if (!securitiesAnswered) return example;
  const raw = records(rawSecurities);
  return example.map((security) => {
    if (!EXAMPLE_SECURITY_IDS.has(security.id as string)) return security;
    const stored = raw.find((row) => row.id === security.id);
    const price = stored?.price;
    return isFiniteNumber(price) && price >= 0 ? { ...security, price } : security;
  });
}

/** The v2 account rows with a usable id (first of each id), reshaped as v3 rows. */
function migratedAccounts(rawAccounts: unknown): { rows: AccountRow[]; deposits: Map<string, unknown> } {
  const rows: AccountRow[] = [];
  const deposits = new Map<string, unknown>();
  for (const raw of records(rawAccounts)) {
    const id = raw.id;
    if (typeof id !== 'string' || id.trim() === '' || deposits.has(id)) continue;
    const name = typeof raw.name === 'string' ? raw.name : '';
    rows.push({ id, name, kind: kindFromV2(name, raw.accountType), balance: 0, holdsEmergencyFund: false });
    deposits.set(id, raw.deposit);
  }
  return { rows, deposits };
}

/**
 * Reshapes a raw v2 (or older) payload into a v3-shaped raw object
 * (version 3); normalizeProfile runs after it. Never throws; the input is
 * not mutated.
 */
export function migrateV2Payload(raw: unknown): Record<string, unknown> {
  const out = (isRecord(raw) ? deepCopy(raw) : {}) as Record<string, unknown>;
  const providedList = Array.isArray(out.provided) ? out.provided : null;
  const answered = new Set<string>((providedList ?? []).filter((p): p is string => typeof p === 'string'));

  // 1. Read the values before normalization drops them.
  const typedAt = (path: string): number | null => {
    const value = getAt(out, path);
    return answered.has(path) && isFiniteNumber(value) ? value : null;
  };
  const invested = typedAt(INVESTED_PATH);
  const traditional = typedAt(TRADITIONAL_PATH);
  const roth = typedAt(ROTH_PATH);
  const monthly = getAt(out, MONTHLY_PATH);
  const monthlyAnswered = answered.has(MONTHLY_PATH) && isFiniteNumber(monthly);
  const owned = answered.has(ACCOUNTS_PATH) || answered.has(HOLDINGS_PATH);
  const typed = invested !== null || traditional !== null || roth !== null;
  const portfolio = recordAt(out, 'portfolio');
  const registry = registryFrom(portfolio.securities, answered.has(SECURITIES_PATH));
  const has401k = getAt(out, 'workplace.has401k');

  let addAccountsAnswered = false;
  let newCash: Record<string, unknown>[] = [];

  if (!owned && !typed) {
    // 2. Nothing owned or typed: the example lists, unanswered.
    const example = exampleAccountLists();
    portfolio.accounts = example.accounts;
    portfolio.holdings = example.holdings;
    portfolio.securities = registry;
  } else {
    // 3. The visitor's own accounts, or none.
    let rows: AccountRow[] = [];
    let deposits = new Map<string, unknown>();
    if (owned) {
      ({ rows, deposits } = migratedAccounts(portfolio.accounts));
      // Non-record entries (a stored null) are dropped here, as normalization drops them.
      portfolio.holdings = records(portfolio.holdings);
      portfolio.securities = records(portfolio.securities);
    } else {
      portfolio.holdings = [];
      portfolio.securities = registry;
    }
    const holdings = portfolio.holdings as Record<string, unknown>[];
    const lists = () => makeGet({ portfolio: { accounts: rows, holdings, securities: portfolio.securities } });
    const taken = () => new Set<unknown>([...rows.map((r) => r.id), ...holdings.map((h) => h.accountId)]);

    // 4. A typed IRA balance above the holdings of the rows of its kind adds the rest.
    const addIraRest = (typedBalance: number | null, kind: AccountKind, restName: string) => {
      if (typedBalance === null || typedBalance <= 0) return;
      const get = lists();
      const held = rows.filter((r) => r.kind === kind).reduce((total, r) => total + holdingsValue(get, r.id), 0);
      if (typedBalance <= held) return;
      rows.push({
        id: freeId(ACCOUNT_KINDS[kind].suggestedId, taken()),
        kind,
        name: held > 0 ? restName : '',
        balance: typedBalance - held,
        holdsEmergencyFund: false,
      });
    };
    addIraRest(traditional, 'traditional-ira', 'Traditional IRA (rest)');
    addIraRest(roth, 'roth-ira', 'Roth IRA (rest)');

    // 5. A typed invested balance above the rows so far adds the rest.
    if (invested !== null) {
      const get = lists();
      const value = rows.reduce((total, r) => total + accountValue(get, r), 0);
      if (invested > value) {
        rows.push({
          id: freeId('acc-other', taken()),
          kind: has401k === true || typeof has401k !== 'boolean' ? '401k' : 'brokerage',
          name: 'Other investments',
          balance: invested - value,
          holdsEmergencyFund: false,
        });
      }
    }

    // 6. Answered deposits above 0 become newCash overrides.
    if (answered.has(ACCOUNTS_PATH)) {
      newCash = rows.flatMap((r) => {
        const deposit = deposits.get(r.id);
        return isFiniteNumber(deposit) && deposit > 0 ? [{ id: r.id, amount: deposit }] : [];
      });
    }
    portfolio.accounts = rows;
    // 7. The list is the visitor's own now.
    addAccountsAnswered = true;
  }
  portfolio.newCash = newCash;

  // 8. Finish.
  recordAt(out, 'investing').monthlyContribution = monthlyAnswered ? monthly : null;
  const investing = out.investing as Record<string, unknown>;
  delete investing.investedBalance;
  if (isRecord(out.ira)) {
    delete out.ira.traditionalBalance;
    delete out.ira.rothBalance;
  }
  if (providedList) {
    const kept = providedList.filter((p): p is string => typeof p === 'string' && !REMOVED_PATHS.includes(p));
    if (addAccountsAnswered && !kept.includes(ACCOUNTS_PATH)) kept.push(ACCOUNTS_PATH);
    out.provided = kept;
  }
  out.version = 3;
  return out;
}
