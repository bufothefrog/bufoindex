/**
 * The account list's actions as pure functions returning profile writes
 * (the account model is in lib/profile/accounts.ts). Each action reads the
 * list through accountsInEffect, so the first edit of the unanswered example
 * list stores exactly the rows in effect: hidden example rows are dropped,
 * with their holdings, their newCash rows and the securities only they used.
 *
 * Lists are always written whole; a list that does not change gets no
 * write. No action writes 'provided': the store and the wizard mark the
 * written list paths answered.
 *
 * The emergency fund copy rule (so the visitor does not type the fund twice
 * and no dollar counts twice): ticking an empty brokerage, adding a 'cash'
 * account, or changing an empty row's kind to 'cash' copies
 * cash.emergencyFundBalance (as the derived get of the accounts renderer
 * reads it) into its balance, but only when no account held the emergency
 * fund before the change. Unticking an account with no holdings whose
 * balance still equals that leaf sets its balance back to 0.
 *
 * Holdings and securities go through readPortfolio and addHolding of
 * ./reducers; the accounts and newCash lists are read only through
 * lib/profile/accounts.ts and get('portfolio.newCash').
 */

import { listRows } from '@/lib/fields/runtime';
import type { Get, Write } from '@/lib/fields/types';
import {
  ACCOUNT_PATHS,
  accountsInEffect,
  emergencyFundAccounts,
  hasHoldings,
  isAnswered,
  type AccountKind,
  type AccountRow,
} from '@/lib/profile/accounts';
import type { HoldingRow, SecurityRow } from '@/lib/profile/types';
import { addHolding, readPortfolio } from './reducers';

/** The lists one action produces; undefined means unchanged (no write). */
interface ListsAfter {
  accounts: AccountRow[];
  holdings?: HoldingRow[];
  securities?: SecurityRow[];
  newCash?: Record<string, unknown>[];
}

function toWrites(after: ListsAfter): Write[] {
  const writes: Write[] = [{ path: ACCOUNT_PATHS.accounts, value: after.accounts }];
  if (after.holdings) writes.push({ path: ACCOUNT_PATHS.holdings, value: after.holdings });
  if (after.securities) writes.push({ path: ACCOUNT_PATHS.securities, value: after.securities });
  if (after.newCash) writes.push({ path: ACCOUNT_PATHS.newCash, value: after.newCash });
  return writes;
}

/** `securities` without those referenced by `removed` and by no holding in `kept`. */
function withoutSecuritiesOnlyHeldBy(
  securities: readonly SecurityRow[],
  removed: readonly HoldingRow[],
  kept: readonly HoldingRow[]
): SecurityRow[] {
  const stillHeld = new Set(kept.map((h) => h.securityId));
  const dropped = new Set(removed.map((h) => h.securityId).filter((id) => !stillHeld.has(id)));
  return securities.filter((s) => !dropped.has(s.id));
}

/** The lists after storing `rows` as the account list (see writeAccounts). */
function listsFor(get: Get, rows: readonly AccountRow[]): ListsAfter {
  const ids = new Set(rows.map((row) => row.id));
  const { holdings, securities } = readPortfolio(get);
  const after: ListsAfter = { accounts: rows.map((row) => ({ ...row })) };
  const kept = holdings.filter((h) => ids.has(h.accountId));
  if (kept.length !== holdings.length) {
    after.holdings = kept;
    const removed = holdings.filter((h) => !ids.has(h.accountId));
    const nextSecurities = withoutSecuritiesOnlyHeldBy(securities, removed, kept);
    if (nextSecurities.length !== securities.length) after.securities = nextSecurities;
  }
  const newCash = listRows(get(ACCOUNT_PATHS.newCash));
  const keptCash = newCash.filter((row) => typeof row.id === 'string' && ids.has(row.id));
  if (keptCash.length !== newCash.length) after.newCash = keptCash.map((row) => ({ ...row }));
  return after;
}

/**
 * Stores `rows` as the account list. Holdings of accounts not in `rows` are
 * dropped, with the securities only those holdings referenced (a security
 * no holding referenced before stays), and so are newCash rows of accounts
 * not in `rows`. Always writes 'portfolio.accounts'; the other lists only
 * when they change.
 */
export function writeAccounts(get: Get, rows: readonly AccountRow[]): Write[] {
  return toWrites(listsFor(get, rows));
}

/** Stores the rows in effect while the list is unanswered (Next on the accounts screen); [] once it is answered. */
export function acceptAccounts(get: Get): Write[] {
  if (isAnswered(get, ACCOUNT_PATHS.accounts)) return [];
  return writeAccounts(get, accountsInEffect(get).rows);
}

/** The rows in effect with `row` replacing the row of its id, or appended when none has it. */
function rowsWith(get: Get, row: AccountRow): AccountRow[] {
  const { rows } = accountsInEffect(get);
  const index = rows.findIndex((r) => r.id === row.id);
  return index >= 0 ? rows.map((r, i) => (i === index ? row : r)) : [...rows, row];
}

/** Stores the list in effect with `row` in it (replacing the row of the same id, or appended). */
export function materializeRow(get: Get, row: AccountRow): Write[] {
  return writeAccounts(get, rowsWith(get, row));
}

/** The stored, example or suggested row with this id, as in effect. */
function findRow(get: Get, accountId: string): AccountRow | undefined {
  const { rows, suggested } = accountsInEffect(get);
  return rows.find((r) => r.id === accountId) ?? suggested.find((r) => r.id === accountId);
}

/** The leaf the copy rule reads: a finite number of 0 or more, else 0. */
function typedFund(get: Get): number {
  const value = get('cash.emergencyFundBalance');
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** True when no row in effect holds the emergency fund (the copy rule's condition). */
function noFundAccountYet(get: Get): boolean {
  return emergencyFundAccounts(get).length === 0;
}

/** Sets an account's typed balance (at least 0); a suggested row is stored. A non-finite balance changes nothing. */
export function setAccountBalance(get: Get, accountId: string, balance: number): Write[] {
  if (!Number.isFinite(balance)) return [];
  const row = findRow(get, accountId);
  if (!row) return [];
  return materializeRow(get, { ...row, balance: Math.max(0, balance) });
}

/**
 * Renames an account or changes its kind. A change to 'cash' is refused
 * when the account has holdings; a kind change never touches holdings and,
 * away from 'brokerage', clears the tick. A change to 'cash' on a row with
 * balance 0 and no holdings copies the typed emergency fund when no account
 * held it before.
 */
export function setAccountField(
  get: Get,
  accountId: string,
  patch: Partial<Pick<AccountRow, 'kind' | 'name'>>
): Write[] {
  const row = findRow(get, accountId);
  if (!row) return [];
  const next: AccountRow = { ...row };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.kind !== undefined && patch.kind !== row.kind) {
    const held = hasHoldings(get, accountId);
    if (patch.kind === 'cash' && held) return [];
    next.kind = patch.kind;
    if (patch.kind !== 'brokerage') next.holdsEmergencyFund = false;
    if (patch.kind === 'cash' && row.balance === 0 && !held && noFundAccountYet(get)) next.balance = typedFund(get);
  }
  return materializeRow(get, next);
}

/**
 * Ticks or unticks "Holds my emergency fund" on a brokerage row ([] on any
 * other kind, or when the tick already has that value).
 * - On: a row with balance 0 and no holdings gets the typed emergency fund
 *   when no account held it before; otherwise only the tick changes.
 * - Off: a row with no holdings whose balance equals the typed emergency
 *   fund gets balance 0; any other balance is kept.
 */
export function setHoldsEmergencyFund(get: Get, accountId: string, on: boolean): Write[] {
  const row = findRow(get, accountId);
  if (!row || row.kind !== 'brokerage' || row.holdsEmergencyFund === on) return [];
  const held = hasHoldings(get, accountId);
  const next: AccountRow = { ...row, holdsEmergencyFund: on };
  if (on && row.balance === 0 && !held && noFundAccountYet(get)) next.balance = typedFund(get);
  if (!on && !held && row.balance === typedFund(get)) next.balance = 0;
  return materializeRow(get, next);
}

/**
 * Appends a new empty row of `kind` to the rows in effect. Its id is
 * 'acc-<n>' with the smallest n from (stored rows + 1) up that is not a
 * stored or suggested row's id, a holding's accountId or a newCash id. A
 * 'cash' row gets the typed emergency fund when no account held it before.
 */
export function addAccountRow(get: Get, kind: AccountKind): { writes: Write[]; id: string } {
  const stored = listRows(get(ACCOUNT_PATHS.accounts));
  const { suggested } = accountsInEffect(get);
  const taken = new Set<unknown>([
    ...stored.map((r) => r.id),
    ...suggested.map((r) => r.id),
    ...listRows(get(ACCOUNT_PATHS.holdings)).map((h) => h.accountId),
    ...listRows(get(ACCOUNT_PATHS.newCash)).map((r) => r.id),
  ]);
  let n = stored.length + 1;
  while (taken.has(`acc-${n}`)) n += 1;
  const id = `acc-${n}`;
  const balance = kind === 'cash' && noFundAccountYet(get) ? typedFund(get) : 0;
  const row: AccountRow = { id, kind, name: '', balance, holdsEmergencyFund: false };
  return { writes: materializeRow(get, row), id };
}

/** Removes a row in effect with its holdings, the securities only they held and its newCash row; [] for a suggested id. */
export function removeAccountRow(get: Get, accountId: string): Write[] {
  const { rows } = accountsInEffect(get);
  if (!rows.some((r) => r.id === accountId)) return [];
  return writeAccounts(
    get,
    rows.filter((r) => r.id !== accountId)
  );
}

/** The materialized lists with the row stored, as plain holdings and securities. */
function materialized(get: Get, row: AccountRow): { after: ListsAfter; holdings: HoldingRow[]; securities: SecurityRow[] } {
  const after = listsFor(get, rowsWith(get, row));
  const current = readPortfolio(get);
  return {
    after,
    holdings: after.holdings ?? current.holdings,
    securities: after.securities ?? current.securities,
  };
}

/**
 * Stores the lists with the account in them and adds one blank holding in
 * it with its own blank security (addHolding of ./reducers, ids by its
 * nextId rule). [] for an unknown id and for a 'cash' account, which never
 * holds securities.
 */
export function listHoldingsInstead(get: Get, accountId: string): Write[] {
  const row = findRow(get, accountId);
  if (!row || row.kind === 'cash') return [];
  const { after, holdings, securities } = materialized(get, row);
  const added = addHolding({ ...readPortfolio(get), holdings, securities }, accountId);
  return toWrites({ ...after, holdings: added.holdings, securities: added.securities });
}

/**
 * Stores the lists with the account in them and removes its holdings and
 * the securities only they referenced: the typed balance is the value again.
 */
export function useOneBalanceInstead(get: Get, accountId: string): Write[] {
  const row = findRow(get, accountId);
  if (!row) return [];
  const { after, holdings, securities } = materialized(get, row);
  const removed = holdings.filter((h) => h.accountId === accountId);
  if (removed.length === 0) return toWrites(after);
  const kept = holdings.filter((h) => h.accountId !== accountId);
  return toWrites({
    ...after,
    holdings: kept,
    securities: withoutSecuritiesOnlyHeldBy(securities, removed, kept),
  });
}

/**
 * Sets one account's new cash for this run: null removes its row (back to
 * Auto), a number upserts {id, amount: max(0, amount)}. Writes only
 * 'portfolio.newCash'; a non-finite amount or a removal of a missing row
 * changes nothing.
 */
export function setNewCash(get: Get, accountId: string, amount: number | null): Write[] {
  const rows = listRows(get(ACCOUNT_PATHS.newCash)).map((row) => ({ ...row }));
  const index = rows.findIndex((row) => row.id === accountId);
  if (amount === null) {
    if (index < 0) return [];
    return [{ path: ACCOUNT_PATHS.newCash, value: rows.filter((_, i) => i !== index) }];
  }
  if (!Number.isFinite(amount)) return [];
  const row = { id: accountId, amount: Math.max(0, amount) };
  const value = index >= 0 ? rows.map((r, i) => (i === index ? row : r)) : [...rows, row];
  return [{ path: ACCOUNT_PATHS.newCash, value }];
}
