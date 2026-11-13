/**
 * The v2 to v3 payload step (lib/profile/migrateV2.ts) on the payloads of
 * contract section 8, read back through the account model. Every expected
 * figure is hand-computed in the comments (VTI 375, VXUS 85, BND 70,
 * BOXX 115).
 */

import { describe, expect, it } from 'vitest';
import { setHoldsEmergencyFund } from '@/lib/calculators/portfolio/accountWrites';
import { getAt } from '@/lib/fields/paths';
import {
  accountsInEffect,
  emergencyFundBalance,
  exampleAccountLists,
  investedBalance,
  iraBalances,
  newCashFor,
  normalNewCash,
  rebalancedAccounts,
} from '@/lib/profile/accounts';
import { kindFromV2, migrateV2Payload } from '@/lib/profile/migrateV2';
import { applyWrites, getOf, type RawPayload } from '@/test/factories/accountsFixtures';
import { MIGRATION_EXAMPLES, defaultPayloadAt90ef4ed, v2With } from '@/test/factories/profile-90ef4ed-v2';

const V2 = defaultPayloadAt90ef4ed().portfolio as Record<string, unknown>;
const EXAMPLE = exampleAccountLists();

function migrated(example: string): { out: RawPayload; portfolio: Record<string, unknown> } {
  const out = migrateV2Payload(MIGRATION_EXAMPLES[example]());
  return { out, portfolio: out.portfolio as Record<string, unknown> };
}

const account = (id: string, kind: string, name: string, balance: number) => ({
  id,
  kind,
  name,
  balance,
  holdsEmergencyFund: false,
});

/** The common v3 shape: version 3, the three removed leaves gone from the payload and from provided. */
function expectV3Shape(out: RawPayload): void {
  expect(out.version).toBe(3);
  expect(getAt(out, 'investing')).not.toHaveProperty('investedBalance');
  expect(getAt(out, 'ira')).not.toHaveProperty('traditionalBalance');
  expect(getAt(out, 'ira')).not.toHaveProperty('rothBalance');
  for (const path of ['investing.investedBalance', 'ira.traditionalBalance', 'ira.rothBalance']) {
    expect(out.provided).not.toContain(path);
  }
  for (const row of (out.portfolio as { accounts: Record<string, unknown>[] }).accounts) {
    expect(row).not.toHaveProperty('accountType');
    expect(row).not.toHaveProperty('deposit');
  }
}

describe('kindFromV2', () => {
  it.each([
    ['Fidelity Roth IRA', 'tax-free', 'roth-ira'],
    ['Roth IRA', 'taxable', 'brokerage'],
    ['', 'tax-deferred', '401k'],
    ['My HSA', 'tax-free', 'hsa'],
    ['Roth 401(k)', 'tax-free', 'roth-401k'],
    ['Traditional IRA', 'tax-deferred', 'traditional-ira'],
    ['x', 'bogus', 'brokerage'],
    ['Work 403(b)', 'tax-deferred', '401k'],
    ['Fidelity', 'tax-free', 'roth-ira'],
    ['TSP', 'taxable', 'brokerage'],
  ])('%s (%s) -> %s', (name, type, kind) => {
    expect(kindFromV2(name, type)).toBe(kind);
  });
});

describe('example 1: the v2 default payload, nothing answered', () => {
  const { out, portfolio } = migrated('1');

  it('gives the v3 example lists, unanswered, with Auto monthly investing', () => {
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual(EXAMPLE.accounts);
    expect(portfolio.holdings).toEqual(EXAMPLE.holdings);
    expect(portfolio.securities).toEqual(EXAMPLE.securities);
    expect(portfolio.newCash).toEqual([]);
    expect(out.provided).toEqual([]);
    expect(getAt(out, 'investing.monthlyContribution')).toBeNull();
  });

  it('reads 16,225 + 8,775 = 25,000 invested and no IRA money', () => {
    expect(investedBalance(getOf(out))).toBe(25000);
    expect(iraBalances(getOf(out))).toEqual({ traditional: 0, roth: 0 });
    expect(emergencyFundBalance(getOf(out))).toBe(9000);
  });

  it('keeps the classTargets and every other section as stored', () => {
    expect(portfolio.classTargets).toEqual(V2.classTargets);
    expect(out.person).toEqual(defaultPayloadAt90ef4ed().person);
    expect(getAt(out, 'investing.taxableMonthlyContribution')).toBe(500);
  });
});

describe('example 2: investedBalance answered, no holdings', () => {
  const { out, portfolio } = migrated('2');

  it('turns the typed 60,000 into one "Other investments" 401(k) row and keeps the Custom 2,000', () => {
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([account('acc-other', '401k', 'Other investments', 60000)]);
    expect(portfolio.holdings).toEqual([]);
    expect(portfolio.securities).toEqual(EXAMPLE.securities);
    expect(portfolio.newCash).toEqual([]);
    expect(out.provided).toEqual(['investing.monthlyContribution', 'portfolio.accounts']);
    expect(getAt(out, 'investing.monthlyContribution')).toBe(2000);
  });

  it('invests max(60,000, 0) = 60,000 and suggests nothing', () => {
    const get = getOf(out);
    expect(investedBalance(get)).toBe(60000);
    expect(accountsInEffect(get).suggested).toEqual([]);
    expect(rebalancedAccounts(get)).toEqual([]);
  });
});

describe('example 3: holdings disagree with investedBalance', () => {
  it('keeps both accounts by their holdings and adds 30,000 - 12,875 = 17,125 as "Other investments"', () => {
    const { out, portfolio } = migrated('3');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-roth', 'roth-ira', 'Roth IRA', 0),
      account('acc-brok', 'brokerage', 'Brokerage', 0),
      account('acc-other', '401k', 'Other investments', 17125),
    ]);
    expect(portfolio.holdings).toEqual(V2.holdings);
    expect(portfolio.securities).toEqual(V2.securities);
    expect(portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    expect(out.provided).toEqual(['portfolio.accounts', 'portfolio.holdings']);
    expect(getAt(out, 'investing.monthlyContribution')).toBeNull();
    const get = getOf(out);
    // P = (10 x 375 + 5 x 70) + (20 x 375 + 15 x 85) = 4,100 + 8,775 = 12,875.
    expect(investedBalance(get)).toBe(30000);
    expect(iraBalances(get)).toEqual({ traditional: 0, roth: 4100 });
    // The rebalancer keeps both accounts: the Roth IRA on Auto (ira.roth false: 0), the brokerage on its 1,000.
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-roth', 'acc-brok']);
    expect(newCashFor(get, 'acc-roth')).toBe(0);
    expect(newCashFor(get, 'acc-brok')).toBe(1000);
  });

  it('3b: B = 10,000 below the holdings adds no row; the holdings win at 12,875', () => {
    const { out, portfolio } = migrated('3b');
    expect((portfolio.accounts as { id: string }[]).map((a) => a.id)).toEqual(['acc-roth', 'acc-brok']);
    expect(investedBalance(getOf(out))).toBe(12875);
  });
});

describe('example 4: IRA balances answered', () => {
  it('4a: lists unanswered, the typed IRA balances become the only rows', () => {
    const { out, portfolio } = migrated('4a');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-trad-ira', 'traditional-ira', '', 20000),
      account('acc-roth-ira', 'roth-ira', '', 6000),
    ]);
    expect(portfolio.holdings).toEqual([]);
    expect(portfolio.securities).toEqual(EXAMPLE.securities);
    expect(portfolio.newCash).toEqual([]);
    expect(out.provided).toEqual(['ira.traditional', 'ira.roth', 'portfolio.accounts']);
    const get = getOf(out);
    expect(iraBalances(get)).toEqual({ traditional: 20000, roth: 6000 });
    expect(investedBalance(get)).toBe(26000);
    expect(accountsInEffect(get).suggested).toEqual([]);
  });

  it('4b: lists answered, the Roth IRA holdings count and the rest 6,000 - 4,100 = 1,900 is added', () => {
    const { out, portfolio } = migrated('4b');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-roth', 'roth-ira', 'Roth IRA', 0),
      account('acc-brok', 'brokerage', 'Brokerage', 0),
      account('acc-trad-ira', 'traditional-ira', '', 20000),
      account('acc-roth-ira', 'roth-ira', 'Roth IRA (rest)', 1900),
    ]);
    expect(portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    const get = getOf(out);
    expect(iraBalances(get)).toEqual({ traditional: 20000, roth: 6000 });
    // 4,100 + 8,775 + 20,000 + 1,900 = 34,775.
    expect(investedBalance(get)).toBe(34775);
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-roth', 'acc-brok']);
  });
});

describe('a typed IRA balance at or below the holdings of its kind', () => {
  it('adds no rest row: a Roth IRA typed 3,000 next to Roth IRA holdings worth 4,100 keeps 4,100', () => {
    const out = migrateV2Payload(
      v2With({ 'ira.roth': true, 'ira.rothBalance': 3000 }, [
        'ira.roth',
        'ira.rothBalance',
        'portfolio.accounts',
        'portfolio.holdings',
      ])
    );
    expect((out.portfolio as Record<string, unknown>).accounts).toEqual([
      account('acc-roth', 'roth-ira', 'Roth IRA', 0),
      account('acc-brok', 'brokerage', 'Brokerage', 0),
    ]);
    expect(iraBalances(getOf(out))).toEqual({ traditional: 0, roth: 4100 });
  });

  it('adds no rest row when the typed balance equals the holdings (4,100)', () => {
    const out = migrateV2Payload(
      v2With({ 'ira.roth': true, 'ira.rothBalance': 4100 }, [
        'ira.roth',
        'ira.rothBalance',
        'portfolio.accounts',
        'portfolio.holdings',
      ])
    );
    expect((out.portfolio as { accounts: { id: string }[] }).accounts.map((a) => a.id)).toEqual(['acc-roth', 'acc-brok']);
  });
});

describe('example 5: has401k and hsa.eligible answered yes', () => {
  it('keeps the unanswered v3 example and suggests an HSA', () => {
    const { out, portfolio } = migrated('5');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual(EXAMPLE.accounts);
    expect(portfolio.holdings).toEqual(EXAMPLE.holdings);
    expect(out.provided).toEqual(['workplace.has401k', 'hsa.eligible']);
    const get = getOf(out);
    expect(accountsInEffect(get).rows.map((a) => a.id)).toEqual(['acc-401k', 'acc-brok']);
    expect(accountsInEffect(get).suggested.map((a) => [a.id, a.kind, a.balance])).toEqual([['acc-hsa', 'hsa', 0]]);
    expect(investedBalance(get)).toBe(25000);
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-brok']);
  });
});

describe('example 6: the BOXX account counted twice in v2', () => {
  const { out, portfolio } = migrated('6');

  it('keeps both accounts, unticked, and adds 40,000 - 20,400 = 19,600', () => {
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-fid', 'roth-ira', 'Fidelity Roth IRA', 0),
      account('acc-rh', 'brokerage', 'Robinhood', 0),
      account('acc-other', '401k', 'Other investments', 19600),
    ]);
    expect(portfolio.newCash).toEqual([]);
    expect((portfolio.securities as { id: string }[]).map((s) => s.id)).toEqual(['sec-vti', 'sec-vxus', 'sec-bnd', 'sec-boxx']);
    const get = getOf(out);
    // Fidelity 20 x 375 + 30 x 85 = 10,050; Robinhood 90 x 115 = 10,350.
    expect(investedBalance(get)).toBe(40000);
    expect(iraBalances(get)).toEqual({ traditional: 0, roth: 10050 });
    expect(emergencyFundBalance(get)).toBe(10000);
    // Both accounts are still rebalanced, BOXX included; the typical taxable 500 goes to Robinhood.
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-fid', 'acc-rh']);
    expect(newCashFor(get, 'acc-rh')).toBe(500);
  });

  it('after the visitor ticks Robinhood: emergency fund 10,350, invested 29,650, BOXX not rebalanced', () => {
    const ticked = applyWrites(out, setHoldsEmergencyFund(getOf(out), 'acc-rh', true));
    const get = getOf(ticked);
    expect(emergencyFundBalance(get)).toBe(10350);
    // 10,050 + 19,600 = 29,650, which is 40,000 - 10,350.
    expect(investedBalance(get)).toBe(29650);
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-fid']);
    expect(normalNewCash(get, 'acc-rh')).toBe(0);
  });
});

describe('example 7: an IRA without a name hint plus a typed IRA balance', () => {
  it('reads the tax-free account as a Roth IRA and adds the rest 6,000 - 4,100 = 1,900', () => {
    const { out, portfolio } = migrated('7');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-1', 'roth-ira', 'Fidelity', 0),
      account('acc-roth-ira', 'roth-ira', 'Roth IRA (rest)', 1900),
    ]);
    expect(portfolio.newCash).toEqual([]);
    expect(portfolio.securities).toEqual(V2.securities);
    expect(out.provided).toEqual(['portfolio.accounts', 'portfolio.holdings']);
    const get = getOf(out);
    expect(iraBalances(get).roth).toBe(6000);
    expect(investedBalance(get)).toBe(6000);
    expect(rebalancedAccounts(get).map((a) => a.id)).toEqual(['acc-1']);
  });
});

describe('example 8: a v2 completer who accepted the typical 25,000 and the example lists', () => {
  it('keeps the example accounts and adds 25,000 - 12,875 = 12,125', () => {
    const { out, portfolio } = migrated('8');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual([
      account('acc-roth', 'roth-ira', 'Roth IRA', 0),
      account('acc-brok', 'brokerage', 'Brokerage', 0),
      account('acc-other', '401k', 'Other investments', 12125),
    ]);
    expect(portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1000 }]);
    expect(out.provided).toEqual(['portfolio.accounts', 'portfolio.holdings', 'ira.roth', 'workplace.has401k']);
    const get = getOf(out);
    expect(investedBalance(get)).toBe(25000);
    // The stored Roth IRA row is the visitor's list, although ira.roth was answered no.
    expect(iraBalances(get).roth).toBe(4100);
  });
});

describe('example 9: a securities-only answer (a price edit)', () => {
  it('keeps the example unanswered with the edited VTI price 400', () => {
    const { out, portfolio } = migrated('9');
    expectV3Shape(out);
    expect(portfolio.accounts).toEqual(EXAMPLE.accounts);
    expect(portfolio.holdings).toEqual(EXAMPLE.holdings);
    expect((portfolio.securities as { price: number }[]).map((s) => s.price)).toEqual([400, 85, 70]);
    expect(out.provided).toEqual(['portfolio.securities']);
    // acc-brok 20 x 400 + 15 x 85 + 0 = 9,275; invested 16,225 + 9,275 = 25,500.
    expect(investedBalance(getOf(out))).toBe(25500);
  });
});

describe('the invariants', () => {
  // [example, typed invested B, value of the rows before the remainder P]
  it.each([
    ['2', 60000, 0],
    ['3', 30000, 12875],
    ['3b', 10000, 12875],
    ['6', 40000, 20400],
    ['8', 25000, 12875],
  ])('example %s: invested = max(B, P)', (example, typed, held) => {
    const { out } = migrated(example);
    expect(investedBalance(getOf(out))).toBe(Math.max(typed, held));
  });

  // [example, kind, typed, holdings of the rows of that kind]
  it.each([
    ['4a', 'traditional', 20000, 0],
    ['4a', 'roth', 6000, 0],
    ['4b', 'traditional', 20000, 0],
    ['4b', 'roth', 6000, 4100],
    ['7', 'roth', 6000, 4100],
  ] as const)('example %s: %s IRA total = max(typed, holdings)', (example, kind, typed, held) => {
    const { out } = migrated(example);
    expect(iraBalances(getOf(out))[kind]).toBe(Math.max(typed, held));
  });

  it('loses no typed amount: each is a row balance or covered by the visitor holdings', () => {
    // Example 2: 60,000 is a balance. Example 4a: 20,000 and 6,000 are balances.
    const balances = (example: string) =>
      ((migrated(example).portfolio.accounts as { balance: number }[]) ?? []).map((a) => a.balance);
    expect(balances('2')).toContain(60000);
    expect(balances('4a')).toEqual([20000, 6000]);
    // Example 3b: 10,000 is covered by 12,875 of holdings.
    expect(investedBalance(getOf(migrated('3b').out))).toBeGreaterThanOrEqual(10000);
  });

  it('turns only answered deposits above 0 into newCash rows', () => {
    // The deposits are not answered: Auto, no row.
    const unanswered = migrateV2Payload(
      v2With({ 'ira.rothBalance': 1 }, ['ira.rothBalance', 'portfolio.holdings'])
    );
    expect((unanswered.portfolio as Record<string, unknown>).newCash).toEqual([]);
  });
});

describe('robustness', () => {
  it.each([null, 42, 'profile', [], undefined, true])('does not throw on %s and gives a v3-shaped object', (raw) => {
    const out = migrateV2Payload(raw);
    expect(out.version).toBe(3);
    expect((out.portfolio as Record<string, unknown>).accounts).toEqual(EXAMPLE.accounts);
    expect(getAt(out, 'investing.monthlyContribution')).toBeNull();
  });

  it('migrates a v1-shaped payload without an error', () => {
    const v1 = {
      version: 1,
      investing: { investedBalance: 5000, monthlyContribution: 'lots' },
      ira: 'none',
      portfolio: { accounts: [{ id: 7 }, { id: 'acc-a', name: 'Old', accountType: 'tax-deferred' }], holdings: 'x' },
      provided: ['investing.investedBalance', 'investing.monthlyContribution', 'portfolio.accounts', 3],
    };
    const out = migrateV2Payload(v1);
    expect(out.version).toBe(3);
    expect((out.portfolio as Record<string, unknown>).accounts).toEqual([
      account('acc-a', '401k', 'Old', 0),
      account('acc-other', '401k', 'Other investments', 5000),
    ]);
    expect(getAt(out, 'investing.monthlyContribution')).toBeNull();
    expect(out.provided).toEqual(['investing.monthlyContribution', 'portfolio.accounts']);
  });

  it('survives a cyclic payload and a non-finite typed balance', () => {
    const cyclic: Record<string, unknown> = { provided: ['investing.investedBalance'], investing: { investedBalance: Infinity } };
    cyclic.self = cyclic;
    const out = migrateV2Payload(cyclic);
    // A non-finite balance is unanswered: the example lists stay.
    expect((out.portfolio as Record<string, unknown>).accounts).toEqual(EXAMPLE.accounts);
    expect(out.provided).toEqual([]);
  });

  it('drops a null entry in the accounts, holdings and an answered securities list instead of throwing', () => {
    const base = defaultPayloadAt90ef4ed().portfolio as { accounts: unknown[]; holdings: unknown[]; securities: unknown[] };
    const payload = v2With(
      {
        'person.age': 41,
        'investing.investedBalance': 30000,
        'portfolio.accounts': [null, ...base.accounts, 7],
        'portfolio.holdings': [null, ...base.holdings, 'x'],
        'portfolio.securities': [null, ...base.securities],
      },
      ['person.age', 'investing.investedBalance', 'portfolio.accounts', 'portfolio.holdings', 'portfolio.securities']
    );
    const out = migrateV2Payload(payload);
    const portfolio = out.portfolio as Record<string, unknown>;
    expect(getAt(out, 'person.age')).toBe(41);
    expect((portfolio.accounts as { id: string }[]).map((a) => a.id)).toEqual(['acc-roth', 'acc-brok', 'acc-other']);
    expect(portfolio.holdings).toEqual(base.holdings);
    expect(portfolio.securities).toEqual(base.securities);
    // 4,100 + 8,775 + the rest 17,125 = 30,000.
    expect(investedBalance(getOf(out))).toBe(30000);
  });

  it('drops a null entry of an answered securities list when the lists are unanswered', () => {
    const base = defaultPayloadAt90ef4ed().portfolio as { securities: unknown[] };
    const out = migrateV2Payload(
      v2With({ 'portfolio.securities': [null, ...base.securities] }, ['portfolio.securities'])
    );
    expect((out.portfolio as Record<string, unknown>).securities).toEqual(EXAMPLE.securities);
  });

  it('does not mutate its input', () => {
    const input = MIGRATION_EXAMPLES['6']();
    const before = JSON.stringify(input);
    migrateV2Payload(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('migrates a payload whose has401k is answered no to a brokerage remainder', () => {
    const out = migrateV2Payload(
      v2With({ 'workplace.has401k': false, 'investing.investedBalance': 7000 }, ['workplace.has401k', 'investing.investedBalance'])
    );
    expect((out.portfolio as Record<string, unknown>).accounts).toEqual([
      account('acc-other', 'brokerage', 'Other investments', 7000),
    ]);
  });
});
