/**
 * The account actions (lib/calculators/portfolio/accountWrites.ts) on raw
 * fixtures: each action's writes are applied with applyWrites and read back
 * through the account model with getOf.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSET_CLASS } from '@/lib/calculations/portfolioRebalancing';
import {
  acceptAccounts,
  addAccountRow,
  listHoldingsInstead,
  materializeRow,
  removeAccountRow,
  setAccountBalance,
  setAccountField,
  setHoldsEmergencyFund,
  setNewCash,
  useOneBalanceInstead,
  writeAccounts,
} from '@/lib/calculators/portfolio/accountWrites';
import type { Write } from '@/lib/fields/types';
import {
  accountsInEffect,
  emergencyFundBalance,
  investedBalance,
  newCashFor,
  type AccountRow,
} from '@/lib/profile/accounts';
import { applyWrites, beginnerRaw, getOf, rawWith, v3DefaultRaw, type RawPayload } from '@/test/factories/accountsFixtures';

const paths = (writes: readonly Write[]) => writes.map((w) => w.path);
const valueAt = (writes: readonly Write[], path: string) => writes.find((w) => w.path === path)?.value;
const ids = (value: unknown) => (value as { id: string }[]).map((r) => r.id);

/** Applies an action to `raw` and returns the result. */
function run(raw: RawPayload, action: (get: ReturnType<typeof getOf>) => Write[]): RawPayload {
  return applyWrites(raw, action(getOf(raw)));
}

function rowOf(raw: RawPayload, id: string): AccountRow {
  const found = accountsInEffect(getOf(raw)).rows.find((r) => r.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
}

describe('materializing', () => {
  it('stores the suggested HSA with its balance and the rows in effect, with no provided write', () => {
    const raw = rawWith({ 'hsa.eligible': true });
    const get = getOf(raw);
    const hsa = accountsInEffect(get).suggested[0];
    const writes = materializeRow(get, { ...hsa, balance: 12000 });
    expect(paths(writes)).toEqual(['portfolio.accounts']);
    expect(valueAt(writes, 'portfolio.accounts')).toEqual([
      { id: 'acc-401k', kind: '401k', name: '', balance: 16225, holdsEmergencyFund: false },
      { id: 'acc-brok', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-hsa', kind: 'hsa', name: '', balance: 12000, holdsEmergencyFund: false },
    ]);
    expect(writes.some((w) => w.path === 'provided')).toBe(false);
  });

  it('setAccountBalance stores a suggested row too, clamps at 0 and ignores a non-finite balance', () => {
    const raw = rawWith({ 'hsa.eligible': true });
    const get = getOf(raw);
    expect(valueAt(setAccountBalance(get, 'acc-hsa', 500), 'portfolio.accounts')).toHaveLength(3);
    expect(rowOf(run(raw, (g) => setAccountBalance(g, 'acc-401k', -10)), 'acc-401k').balance).toBe(0);
    expect(rowOf(run(raw, (g) => setAccountBalance(g, 'acc-401k', 30000)), 'acc-401k').balance).toBe(30000);
    expect(setAccountBalance(get, 'acc-401k', Number.NaN)).toEqual([]);
    expect(setAccountBalance(get, 'acc-missing', 5)).toEqual([]);
  });

  it('acceptAccounts stores only the rows in effect, dropping the hidden example and what only it used', () => {
    const raw = rawWith({ 'investing.taxableMonthlyContribution': 0 });
    const writes = acceptAccounts(getOf(raw));
    expect(paths(writes)).toEqual(['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities']);
    expect(ids(valueAt(writes, 'portfolio.accounts'))).toEqual(['acc-401k']);
    expect(valueAt(writes, 'portfolio.holdings')).toEqual([]);
    expect(valueAt(writes, 'portfolio.securities')).toEqual([]);
    const answered = rawWith({ 'investing.taxableMonthlyContribution': 0 }, ['portfolio.accounts']);
    expect(acceptAccounts(getOf(answered))).toEqual([]);
  });

  it('acceptAccounts on the beginner stores [acc-401k] with no holdings', () => {
    const after = run(beginnerRaw(), acceptAccounts);
    expect(ids((after.portfolio as Record<string, unknown>).accounts)).toEqual(['acc-401k']);
    expect((after.portfolio as Record<string, unknown>).holdings).toEqual([]);
  });

  it('writeAccounts keeps a security that no holding referenced before', () => {
    const raw = rawWith(
      {
        'portfolio.securities': [
          ...((v3DefaultRaw().portfolio as Record<string, unknown>).securities as unknown[]),
          { id: 'sec-loose', ticker: 'LOOSE', price: 1, assetClass: 'other' },
        ],
      },
      []
    );
    const get = getOf(raw);
    const writes = writeAccounts(get, accountsInEffect(get).rows.filter((r) => r.id !== 'acc-brok'));
    expect(ids(valueAt(writes, 'portfolio.securities'))).toEqual(['sec-loose']);
    // A list that does not change gets no write.
    expect(paths(writeAccounts(get, accountsInEffect(get).rows))).toEqual(['portfolio.accounts']);
  });
});

describe('the emergency fund copy rule', () => {
  it('ticking a new empty brokerage copies the typed 9,000; nothing counts twice', () => {
    const base = v3DefaultRaw();
    const added = addAccountRow(getOf(base), 'brokerage');
    expect(added.id).toBe('acc-3');
    const withRow = applyWrites(base, added.writes);
    const ticked = run(withRow, (get) => setHoldsEmergencyFund(get, 'acc-3', true));
    expect(rowOf(ticked, 'acc-3')).toMatchObject({ balance: 9000, holdsEmergencyFund: true });
    expect(emergencyFundBalance(getOf(ticked))).toBe(9000);
    expect(investedBalance(getOf(ticked))).toBe(25000);

    // A second ticked empty brokerage gets nothing copied.
    const second = addAccountRow(getOf(ticked), 'brokerage');
    expect(second.id).toBe('acc-4');
    const both = run(applyWrites(ticked, second.writes), (get) => setHoldsEmergencyFund(get, 'acc-4', true));
    expect(rowOf(both, 'acc-4')).toMatchObject({ balance: 0, holdsEmergencyFund: true });
    expect(emergencyFundBalance(getOf(both))).toBe(9000);
  });

  it('unticking right after the copy sets the balance back to 0', () => {
    const withRow = applyWrites(v3DefaultRaw(), addAccountRow(getOf(v3DefaultRaw()), 'brokerage').writes);
    const ticked = run(withRow, (get) => setHoldsEmergencyFund(get, 'acc-3', true));
    const unticked = run(ticked, (get) => setHoldsEmergencyFund(get, 'acc-3', false));
    expect(rowOf(unticked, 'acc-3')).toMatchObject({ balance: 0, holdsEmergencyFund: false });
    expect(investedBalance(getOf(unticked))).toBe(25000);
    expect(emergencyFundBalance(getOf(unticked))).toBe(9000);
  });

  it('unticking keeps a balance the visitor changed', () => {
    const withRow = applyWrites(v3DefaultRaw(), addAccountRow(getOf(v3DefaultRaw()), 'brokerage').writes);
    const ticked = run(withRow, (get) => setHoldsEmergencyFund(get, 'acc-3', true));
    const changed = run(ticked, (get) => setAccountBalance(get, 'acc-3', 9500));
    expect(emergencyFundBalance(getOf(changed))).toBe(9500);
    const unticked = run(changed, (get) => setHoldsEmergencyFund(get, 'acc-3', false));
    expect(rowOf(unticked, 'acc-3').balance).toBe(9500);
    // 25,000 + 9,500 = 34,500 invested; the typed 9,000 is the fund again.
    expect(investedBalance(getOf(unticked))).toBe(34500);
    expect(emergencyFundBalance(getOf(unticked))).toBe(9000);
  });

  it('ticks only brokerage rows, and a repeated tick changes nothing', () => {
    const get = getOf(v3DefaultRaw());
    expect(setHoldsEmergencyFund(get, 'acc-401k', true)).toEqual([]);
    expect(setHoldsEmergencyFund(get, 'acc-brok', false)).toEqual([]);
    // A brokerage with holdings: only the tick changes.
    const ticked = run(v3DefaultRaw(), (g) => setHoldsEmergencyFund(g, 'acc-brok', true));
    expect(rowOf(ticked, 'acc-brok')).toMatchObject({ balance: 0, holdsEmergencyFund: true });
    expect(emergencyFundBalance(getOf(ticked))).toBe(8775);
    expect(investedBalance(getOf(ticked))).toBe(16225);
  });

  it('adding a cash account copies the typed 9,000 once; a second cash account gets 0', () => {
    const first = addAccountRow(getOf(v3DefaultRaw()), 'cash');
    const withCash = applyWrites(v3DefaultRaw(), first.writes);
    expect(rowOf(withCash, first.id).balance).toBe(9000);
    expect(emergencyFundBalance(getOf(withCash))).toBe(9000);
    const second = addAccountRow(getOf(withCash), 'cash');
    const withTwo = applyWrites(withCash, second.writes);
    expect(rowOf(withTwo, second.id).balance).toBe(0);
    expect(emergencyFundBalance(getOf(withTwo))).toBe(9000);
  });

  it('changing an empty row to cash copies the typed fund when no account held it', () => {
    const withRow = applyWrites(v3DefaultRaw(), addAccountRow(getOf(v3DefaultRaw()), 'brokerage').writes);
    const cash = run(withRow, (get) => setAccountField(get, 'acc-3', { kind: 'cash' }));
    expect(rowOf(cash, 'acc-3')).toMatchObject({ kind: 'cash', balance: 9000 });
  });

  it('refuses cash on an account with holdings, and clears the tick on a change away from brokerage', () => {
    const get = getOf(v3DefaultRaw());
    expect(setAccountField(get, 'acc-brok', { kind: 'cash' })).toEqual([]);
    const ticked = run(v3DefaultRaw(), (g) => setHoldsEmergencyFund(g, 'acc-brok', true));
    // The store marks the written list answered, so the Roth IRA row shows although ira.roth is no.
    const moved = rawWith(
      {},
      ['portfolio.accounts'],
      run(ticked, (g) => setAccountField(g, 'acc-brok', { kind: 'roth-ira', name: 'Roth' }))
    );
    expect(rowOf(moved, 'acc-brok')).toMatchObject({ kind: 'roth-ira', name: 'Roth', holdsEmergencyFund: false });
    // A kind change never touches holdings.
    expect(((moved.portfolio as Record<string, unknown>).holdings as unknown[]).length).toBe(3);
  });
});

describe('adding and removing', () => {
  it('numbers a new row past stored, suggested, holding and newCash ids', () => {
    const raw = rawWith(
      {
        'hsa.eligible': true,
        'portfolio.accounts': [{ id: 'acc-2', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false }],
        'portfolio.holdings': [{ id: 'hld-x', accountId: 'acc-3', securityId: 'sec-vti', shares: 1 }],
        'portfolio.newCash': [{ id: 'acc-4', amount: 1 }],
      },
      ['hsa.eligible', 'portfolio.accounts']
    );
    const { id, writes } = addAccountRow(getOf(raw), 'roth-ira');
    expect(id).toBe('acc-5');
    expect(valueAt(writes, 'portfolio.accounts')).toEqual([
      { id: 'acc-2', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-5', kind: 'roth-ira', name: '', balance: 0, holdsEmergencyFund: false },
    ]);
    // The dangling holding and newCash rows go with the whole-list write.
    expect(valueAt(writes, 'portfolio.holdings')).toEqual([]);
    expect(valueAt(writes, 'portfolio.newCash')).toEqual([]);
  });

  it('removes an account with its holdings, the securities only they held and its newCash row', () => {
    const custom = run(v3DefaultRaw(), (get) => setNewCash(get, 'acc-brok', 700));
    const removed = run(custom, (get) => removeAccountRow(get, 'acc-brok'));
    const portfolio = removed.portfolio as Record<string, unknown>;
    expect(ids(portfolio.accounts)).toEqual(['acc-401k']);
    expect(portfolio.holdings).toEqual([]);
    expect(portfolio.securities).toEqual([]);
    expect(portfolio.newCash).toEqual([]);
  });

  it('does not remove a suggested row', () => {
    expect(removeAccountRow(getOf(rawWith({ 'hsa.eligible': true })), 'acc-hsa')).toEqual([]);
  });
});

describe('holdings or one balance', () => {
  const typed = (balance: number, holdings: unknown[], securities: unknown[]) =>
    rawWith({
      'portfolio.accounts': [{ id: 'acc-1', kind: 'brokerage', name: '', balance, holdsEmergencyFund: false }],
      'portfolio.holdings': holdings,
      'portfolio.securities': securities,
    });

  it('a typed 5,000 with holdings worth 1,200 counts 1,200, and 5,000 again after "Use one balance instead"', () => {
    const raw = typed(
      5000,
      [{ id: 'hld-1', accountId: 'acc-1', securityId: 'sec-1', shares: 12 }],
      [
        { id: 'sec-1', ticker: 'X', price: 100, assetClass: 'us-stock' },
        { id: 'sec-loose', ticker: 'Y', price: 1, assetClass: 'other' },
      ]
    );
    expect(investedBalance(getOf(raw))).toBe(1200);
    const after = run(raw, (get) => useOneBalanceInstead(get, 'acc-1'));
    expect(investedBalance(getOf(after))).toBe(5000);
    const portfolio = after.portfolio as Record<string, unknown>;
    expect(portfolio.holdings).toEqual([]);
    expect(ids(portfolio.securities)).toEqual(['sec-loose']);
  });

  it('"List holdings instead" adds one blank holding with its own blank security; the typed 80,000 still counts', () => {
    const raw = typed(80000, [], []);
    const writes = listHoldingsInstead(getOf(raw), 'acc-1');
    expect(paths(writes)).toEqual(['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities']);
    expect(valueAt(writes, 'portfolio.holdings')).toEqual([{ id: 'hld-1', accountId: 'acc-1', securityId: 'sec-1', shares: 0 }]);
    expect(valueAt(writes, 'portfolio.securities')).toEqual([
      { id: 'sec-1', ticker: '', price: 0, assetClass: DEFAULT_ASSET_CLASS },
    ]);
    expect(investedBalance(getOf(applyWrites(raw, writes)))).toBe(80000);
  });

  it('"List holdings instead" stores a suggested row first, and refuses a cash account', () => {
    const raw = rawWith({ 'ira.roth': true });
    const writes = listHoldingsInstead(getOf(raw), 'acc-roth-ira');
    expect(ids(valueAt(writes, 'portfolio.accounts'))).toEqual(['acc-401k', 'acc-brok', 'acc-roth-ira']);
    const holdings = valueAt(writes, 'portfolio.holdings') as { accountId: string }[];
    expect(holdings.map((h) => h.accountId)).toEqual(['acc-brok', 'acc-brok', 'acc-brok', 'acc-roth-ira']);
    const cash = rawWith({ 'portfolio.accounts': [{ id: 'acc-c', kind: 'cash', name: '', balance: 1, holdsEmergencyFund: false }] });
    expect(listHoldingsInstead(getOf(cash), 'acc-c')).toEqual([]);
  });
});

describe('new cash', () => {
  it('upserts a row clamped at 0, and null removes it (back to Auto)', () => {
    const custom = run(v3DefaultRaw(), (get) => setNewCash(get, 'acc-brok', 700));
    expect(paths(setNewCash(getOf(v3DefaultRaw()), 'acc-brok', 700))).toEqual(['portfolio.newCash']);
    expect((custom.portfolio as Record<string, unknown>).newCash).toEqual([{ id: 'acc-brok', amount: 700 }]);
    const replaced = run(custom, (get) => setNewCash(get, 'acc-brok', -3));
    expect((replaced.portfolio as Record<string, unknown>).newCash).toEqual([{ id: 'acc-brok', amount: 0 }]);
    const auto = run(custom, (get) => setNewCash(get, 'acc-brok', null));
    expect((auto.portfolio as Record<string, unknown>).newCash).toEqual([]);
    expect(newCashFor(getOf(auto), 'acc-brok')).toBe(500);
    expect(setNewCash(getOf(auto), 'acc-brok', null)).toEqual([]);
    expect(setNewCash(getOf(auto), 'acc-brok', Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
