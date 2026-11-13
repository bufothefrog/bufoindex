/**
 * The account model (lib/profile/accounts.ts) on raw fixtures: the v3
 * default, the owner fixture of contract section 7, the contribution caps,
 * a 401(k) split, the example filter, the suggestions and the summaries.
 * Expected numbers are hand-computed in the comments.
 */

import { describe, expect, it } from 'vitest';
import { setNewCash } from '@/lib/calculators/portfolio/accountWrites';
import { engineAccounts } from '@/lib/calculators/portfolio/bindings';
import { emergencyFundHeldText } from '@/lib/fields/shared';
import { ACCOUNT_KIND_LABELS, ACCOUNT_KIND_OPTIONS } from '@/lib/constants/labels';
import { normalizeProfile } from '@/lib/profile/defaults';
import {
  ACCOUNT_KINDS,
  ACCOUNT_PATHS,
  accountDisplayName,
  accountLabel,
  accountLabels,
  distinctAccountNames,
  accountLines,
  accountValue,
  accountsInEffect,
  accountsSummary,
  answeredPaths,
  contributionParts,
  emergencyFundAccounts,
  emergencyFundBalance,
  exampleAccountLists,
  hasHoldings,
  holdingsOf,
  holdingsValue,
  investedBalance,
  iraBalances,
  isAnswered,
  isEmergencyFundAccount,
  monthlyInvesting,
  monthlyInvestingAuto,
  newCashFor,
  normalNewCash,
  notRebalanced,
  notRebalancedNote,
  rebalanceCandidates,
  rebalancedAccounts,
  split401k,
  yearStartInvesting,
  yearlyRegularPay,
  type AccountRow,
} from '@/lib/profile/accounts';
import {
  applyWrites,
  beginnerRaw,
  capsRaw,
  getOf,
  ownerRaw,
  ownerYearStartRaw,
  rawWith,
  v3DefaultRaw,
} from '@/test/factories/accountsFixtures';

const ids = (rows: readonly AccountRow[]) => rows.map((row) => row.id);
const row = (get: ReturnType<typeof getOf>, id: string): AccountRow => {
  const found = accountsInEffect(get).rows.find((r) => r.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe('kinds', () => {
  it('takes each label from ACCOUNT_KIND_LABELS and gives each kind its tax treatment and suggested id', () => {
    expect(Object.keys(ACCOUNT_KINDS)).toEqual(ACCOUNT_KIND_OPTIONS.map((o) => o.value));
    for (const option of ACCOUNT_KIND_OPTIONS) {
      expect(ACCOUNT_KINDS[option.value].label).toBe(ACCOUNT_KIND_LABELS[option.value]);
    }
    expect(Object.fromEntries(Object.entries(ACCOUNT_KINDS).map(([k, m]) => [k, [m.taxTreatment, m.suggestedId]]))).toEqual({
      '401k': ['tax-deferred', 'acc-401k'],
      'roth-401k': ['tax-free', 'acc-roth-401k'],
      'traditional-ira': ['tax-deferred', 'acc-trad-ira'],
      'roth-ira': ['tax-free', 'acc-roth-ira'],
      hsa: ['tax-free', 'acc-hsa'],
      brokerage: ['taxable', 'acc-brok'],
      cash: [null, 'acc-cash'],
    });
    expect(ACCOUNT_PATHS).toEqual({
      accounts: 'portfolio.accounts',
      holdings: 'portfolio.holdings',
      securities: 'portfolio.securities',
      newCash: 'portfolio.newCash',
      provided: 'provided',
    });
  });

  it('displays the name, or the kind label when the name is blank', () => {
    const base: AccountRow = { id: 'a', kind: 'hsa', name: '  ', balance: 0, holdsEmergencyFund: false };
    expect(accountDisplayName(base)).toBe('HSA');
    expect(accountDisplayName({ ...base, name: ' Fidelity HSA ' })).toBe('Fidelity HSA');
  });

  it('numbers the rows that share a display name, in list order, and keeps the others', () => {
    const row = (id: string, kind: AccountRow['kind'], name = ''): AccountRow => ({
      id,
      kind,
      name,
      balance: 0,
      holdsEmergencyFund: false,
    });
    const names = distinctAccountNames([
      row('a', 'brokerage'),
      row('b', 'hsa'),
      row('c', 'brokerage'),
      row('d', 'roth-ira', 'Brokerage (taxable)'),
      row('e', 'roth-ira', 'Fidelity'),
    ]);
    expect([...names.entries()]).toEqual([
      ['a', 'Brokerage (taxable) 1'],
      ['b', 'HSA'],
      ['c', 'Brokerage (taxable) 2'],
      ['d', 'Brokerage (taxable) 3'],
      ['e', 'Fidelity'],
    ]);
  });

  it('names rows that share a display name with their accountLabels number in every summary and note', () => {
    // The default plus a second, empty brokerage and a ticked cash-holding third one: three unnamed brokerages.
    const get = getOf(
      rawWith({
        'portfolio.accounts': [
          { id: 'acc-401k', kind: '401k', name: '', balance: 16225, holdsEmergencyFund: false },
          { id: 'acc-brok', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
          { id: 'acc-b2', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
          { id: 'acc-b3', kind: 'brokerage', name: '', balance: 9000, holdsEmergencyFund: true },
        ],
      })
    );
    expect([...accountLabels(get).values()]).toEqual([
      '401(k) or similar',
      'Brokerage (taxable) 1',
      'Brokerage (taxable) 2',
      'Brokerage (taxable) 3',
    ]);
    expect(accountLabel(get, row(get, 'acc-b2'))).toBe('Brokerage (taxable) 2');
    expect(notRebalancedNote(get)).toBe(
      'Not rebalanced: 401(k) or similar (no holdings entered), Brokerage (taxable) 2 (no holdings or new cash), Brokerage (taxable) 3 (emergency fund).'
    );
    expect(accountLines(get)).toEqual([
      '401(k) or similar $16,225',
      'Brokerage (taxable) 1 $8,775 (3 holdings)',
      'Brokerage (taxable) 2 $0',
      'Brokerage (taxable) 3 $9,000 (emergency fund)',
    ]);
  });

  it('gives the emergency fund note and the rebalancer the same numbered names', () => {
    const brokerage = (id: string, balance: number, holdsEmergencyFund: boolean) => ({
      id,
      kind: 'brokerage',
      name: '',
      balance,
      holdsEmergencyFund,
    });
    const get = getOf(
      rawWith({
        'workplace.has401k': false,
        'portfolio.accounts': [brokerage('acc-brok', 0, false), brokerage('acc-b2', 0, false), brokerage('acc-f1', 4000, true), brokerage('acc-f2', 5000, true)],
      })
    );
    expect(emergencyFundHeldText(get)).toBe('Held in your accounts: Brokerage (taxable) 3 $4,000, Brokerage (taxable) 4 $5,000.');
    // acc-brok holds the example holdings; acc-b2 takes the taxable 500 only when it is the first brokerage, so it is not sent.
    expect(engineAccounts(get).map((a) => [a.id, a.name])).toEqual([['acc-brok', 'Brokerage (taxable) 1']]);
  });

  it('counts cash, and a ticked brokerage only, as an emergency-fund account', () => {
    const base: AccountRow = { id: 'a', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false };
    expect(isEmergencyFundAccount(base)).toBe(false);
    expect(isEmergencyFundAccount({ ...base, holdsEmergencyFund: true })).toBe(true);
    expect(isEmergencyFundAccount({ ...base, kind: 'cash' })).toBe(true);
    expect(isEmergencyFundAccount({ ...base, kind: 'hsa', holdsEmergencyFund: true })).toBe(false);
  });
});

describe('the v3 default', () => {
  const get = getOf(v3DefaultRaw());

  it('values the brokerage by its holdings (20 x 375 + 15 x 85 + 0 x 70 = 8,775) and the 401(k) by its typed 16,225', () => {
    expect(holdingsValue(get, 'acc-brok')).toBe(8775);
    expect(accountValue(get, row(get, 'acc-brok'))).toBe(8775);
    expect(accountValue(get, row(get, 'acc-401k'))).toBe(16225);
    expect(holdingsOf(get, 'acc-brok').map((h) => h.id)).toEqual(['hld-brok-vti', 'hld-brok-vxus', 'hld-brok-bnd']);
    expect(hasHoldings(get, 'acc-401k')).toBe(false);
  });

  it('sums 16,225 + 8,775 = 25,000 invested, no IRA, and the typical 3 x 3,000 = 9,000 emergency fund', () => {
    expect(investedBalance(get)).toBe(25000);
    expect(iraBalances(get)).toEqual({ traditional: 0, roth: 0 });
    expect(emergencyFundAccounts(get)).toEqual([]);
    expect(emergencyFundBalance(get)).toBe(9000);
  });

  it('computes the contribution parts: 104,000 x 8% / 12 = 693.33 traditional, 4,160 / 12 = 346.67 match, 500 taxable', () => {
    expect(yearlyRegularPay(get)).toBe(104000);
    const parts = contributionParts(get);
    expect(parts.trad401k).toBeCloseTo(693.33, 2);
    expect(parts.match).toBeCloseTo(346.67, 2);
    expect(parts.taxable).toBe(500);
    expect({ ...parts, trad401k: 0, match: 0, taxable: 0 }).toEqual({
      trad401k: 0,
      roth401k: 0,
      match: 0,
      hsaOwn: 0,
      hsaEmployer: 0,
      iraTraditional: 0,
      iraRoth: 0,
      taxable: 0,
    });
    // round2(693.33... + 346.66... + 500) = 1,540.
    expect(monthlyInvestingAuto(get)).toBe(1540);
    expect(monthlyInvesting(get)).toBe(1540);
    expect(monthlyInvesting(getOf(rawWith({ 'investing.monthlyContribution': 2000 })))).toBe(2000);
  });

  it('routes the 401(k) parts to acc-401k (1,040) and the taxable 500 to acc-brok', () => {
    expect(normalNewCash(get, 'acc-401k')).toBe(1040);
    expect(normalNewCash(get, 'acc-brok')).toBe(500);
    expect(normalNewCash(get, 'acc-missing')).toBe(0);
    expect(newCashFor(get, 'acc-brok')).toBe(500);
    const custom = getOf(applyWrites(v3DefaultRaw(), setNewCash(get, 'acc-brok', 700)));
    expect(newCashFor(custom, 'acc-brok')).toBe(700);
  });

  it('rebalances only the brokerage and names the 401(k) as not rebalanced', () => {
    expect(ids(rebalanceCandidates(get))).toEqual(['acc-brok']);
    expect(ids(rebalancedAccounts(get))).toEqual(['acc-brok']);
    expect(notRebalanced(get).map(({ account, reason }) => [account.id, reason])).toEqual([['acc-401k', 'no-holdings']]);
    expect(notRebalancedNote(get)).toBe('Not rebalanced: 401(k) or similar (no holdings entered).');
  });

  it('summarizes the list', () => {
    expect(accountLines(get)).toEqual(['401(k) or similar $16,225', 'Brokerage (taxable) $8,775 (3 holdings)']);
    expect(accountsSummary(get)).toBe('401(k) or similar $16,225; Brokerage (taxable) $8,775 (3 holdings)');
  });

  it('builds fresh example lists on every call', () => {
    const first = exampleAccountLists();
    first.accounts[0].balance = 1;
    first.holdings.pop();
    first.securities[0].price = 1;
    const second = exampleAccountLists();
    expect(second.accounts[0].balance).toBe(16225);
    expect(second.holdings).toHaveLength(3);
    expect(second.securities[0].price).toBe(375);
  });
});

describe('the owner fixture (contract section 7)', () => {
  const get = getOf(ownerRaw());

  it('reads the ticked Robinhood as the emergency fund (90 x 115 = 10,350) and keeps the typed 10,000 stored', () => {
    expect(ids(emergencyFundAccounts(get))).toEqual(['acc-rh']);
    expect(emergencyFundBalance(get)).toBe(10350);
    expect(get('cash.emergencyFundBalance')).toBe(10000);
  });

  it('invests 80,000 + 12,000 + 10,050 + 3,750 = 105,800 and holds 10,050 in the Roth IRA', () => {
    expect(investedBalance(get)).toBe(105800);
    expect(iraBalances(get)).toEqual({ traditional: 0, roth: 10050 });
  });

  it('computes the parts and the 3,195 monthly total', () => {
    // 156,000 a year: 15,600 / 12 = 1,300; match min(15,600, 6,240) / 12 = 520;
    // HSA min(3,000, 4,400 - 1,200) / 12 = 250, employer 1,200 / 12 = 100.
    const parts = contributionParts(get);
    expect(yearlyRegularPay(get)).toBe(156000);
    expect(parts.trad401k).toBeCloseTo(1300, 6);
    expect(parts.roth401k).toBe(0);
    expect(parts.match).toBeCloseTo(520, 6);
    expect(parts.hsaOwn).toBeCloseTo(250, 6);
    expect(parts.hsaEmployer).toBeCloseTo(100, 6);
    expect(parts.iraTraditional).toBe(0);
    expect(parts.iraRoth).toBe(625);
    expect(parts.taxable).toBe(400);
    expect(monthlyInvestingAuto(get)).toBe(3195);
  });

  it('routes the new cash to the first account of each kind, none to the emergency fund', () => {
    expect(['acc-401k', 'acc-hsa', 'acc-roth', 'acc-brok', 'acc-rh'].map((id) => normalNewCash(get, id))).toEqual([
      1820, 350, 625, 400, 0,
    ]);
  });

  it('rebalances the Roth IRA and the brokerage and says why the others are not', () => {
    expect(ids(rebalancedAccounts(get))).toEqual(['acc-roth', 'acc-brok']);
    expect(notRebalanced(get).map(({ account, reason }) => [account.id, reason])).toEqual([
      ['acc-401k', 'no-holdings'],
      ['acc-hsa', 'no-holdings'],
      ['acc-rh', 'emergency-fund'],
    ]);
    expect(notRebalancedNote(get)).toBe(
      'Not rebalanced: 401(k) or similar (no holdings entered), HSA (no holdings entered), Robinhood (emergency fund).'
    );
  });

  it('summarizes the list, with no suggestion since every yes has its account', () => {
    expect(accountsInEffect(get).suggested).toEqual([]);
    expect(accountsSummary(get)).toBe(
      '401(k) or similar $80,000; HSA $12,000; Roth IRA $10,050 (2 holdings); Brokerage $3,750 (1 holding); Robinhood $10,350 (1 holding) (emergency fund)'
    );
  });
});

describe('caps and splits', () => {
  it('caps the 401(k) deferral at 24,500 and the HSA at the limit less the employer money', () => {
    const get = getOf(capsRaw());
    // 9,500 x 26 = 247,000; 15% = 37,050 -> min(37,050, 24,500) = 24,500.
    expect(yearlyRegularPay(get)).toBe(247000);
    const parts = contributionParts(get);
    expect(parts.trad401k).toBeCloseTo(2041.67, 2);
    // min(24,500, 247,000 x 4% = 9,880) / 12 = 823.33.
    expect(parts.match).toBeCloseTo(823.33, 2);
    // min(4,800, 4,400 - 600 = 3,800) / 12 = 316.67; 600 / 12 = 50.
    expect(parts.hsaOwn).toBeCloseTo(316.67, 2);
    expect(parts.hsaEmployer).toBeCloseTo(50, 6);
  });

  it('splits 10% with a Roth part of 4% into 6% traditional and 4% Roth', () => {
    const election = split401k('split', 0.1, 0.04);
    expect(election.traditional).toBeCloseTo(0.06, 10);
    expect(election.roth).toBeCloseTo(0.04, 10);
    expect(split401k('roth', 0.1, 0)).toEqual({ traditional: 0, roth: 0.1 });
    expect(split401k('traditional', 0.1, 0.04)).toEqual({ traditional: 0.1, roth: 0 });
    expect(split401k('split', 0.03, 0.04)).toEqual({ traditional: 0, roth: 0.03 });
  });

  const splitValues = {
    'workplace.contributionType': 'split',
    'workplace.contributionPercent': 0.1,
    'workplace.rothContributionPercent': 0.04,
  };

  it('routes the Roth part to the 401(k) row when there is no Roth 401(k) row', () => {
    const get = getOf(rawWith(splitValues));
    const parts = contributionParts(get);
    // 104,000: 6,240 / 12 = 520 traditional, 4,160 / 12 = 346.67 Roth, match min(10,400, 4,160) / 12 = 346.67.
    expect(parts.trad401k).toBeCloseTo(520, 6);
    expect(parts.roth401k).toBeCloseTo(346.67, 2);
    expect(parts.match).toBeCloseTo(346.67, 2);
    expect(normalNewCash(get, 'acc-401k')).toBeCloseTo(1213.33, 2);
  });

  it('routes the Roth part to a Roth 401(k) row when there is one', () => {
    const get = getOf(
      rawWith({
        ...splitValues,
        'portfolio.accounts': [
          { id: 'acc-401k', kind: '401k', name: '', balance: 0, holdsEmergencyFund: false },
          { id: 'acc-r401k', kind: 'roth-401k', name: '', balance: 0, holdsEmergencyFund: false },
        ],
      })
    );
    // 520 + 346.67 to the 401(k), 346.67 to the Roth 401(k).
    expect(normalNewCash(get, 'acc-401k')).toBeCloseTo(866.67, 2);
    expect(normalNewCash(get, 'acc-r401k')).toBeCloseTo(346.67, 2);
  });

  it('counts a part with no matching row in the monthly total only', () => {
    // A Roth IRA of 300 a month, no Roth IRA row: 1,540 + 300 = 1,840, routed to nobody.
    const get = getOf(rawWith({ 'ira.roth': true, 'ira.rothMonthly': 300, 'portfolio.accounts': [] }, ['ira.rothMonthly', 'portfolio.accounts']));
    expect(monthlyInvestingAuto(get)).toBe(1840);
    expect(accountsInEffect(get).rows).toEqual([]);
  });

  it('reads an unknown pay frequency or non-finite pay as no pay', () => {
    expect(yearlyRegularPay(getOf(rawWith({ 'income.frequency': 'daily' })))).toBe(0);
    expect(yearlyRegularPay(getOf(rawWith({ 'income.grossPerPaycheck': Number.NaN })))).toBe(0);
  });
});

describe('holdings win over a typed balance', () => {
  it('uses the holdings once they are worth more than 0, and the typed balance otherwise', () => {
    const accounts = [{ id: 'acc-1', kind: 'brokerage', name: '', balance: 5000, holdsEmergencyFund: false }];
    const withHolding = getOf(
      rawWith({
        'portfolio.accounts': accounts,
        'portfolio.securities': [{ id: 'sec-1', ticker: 'X', price: 100, assetClass: 'us-stock' }],
        'portfolio.holdings': [{ id: 'hld-1', accountId: 'acc-1', securityId: 'sec-1', shares: 12 }],
      })
    );
    expect(investedBalance(withHolding)).toBe(1200);
    const zeroShares = getOf(
      rawWith({
        'portfolio.accounts': [{ ...accounts[0], balance: 80000 }],
        'portfolio.securities': [{ id: 'sec-1', ticker: 'X', price: 100, assetClass: 'us-stock' }],
        'portfolio.holdings': [{ id: 'hld-1', accountId: 'acc-1', securityId: 'sec-1', shares: 0 }],
      })
    );
    expect(hasHoldings(zeroShares, 'acc-1')).toBe(true);
    expect(investedBalance(zeroShares)).toBe(80000);
  });

  it('counts a holding of a missing security as 0', () => {
    const get = getOf(
      rawWith({
        'portfolio.accounts': [{ id: 'acc-1', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false }],
        'portfolio.securities': [],
        'portfolio.holdings': [{ id: 'hld-1', accountId: 'acc-1', securityId: 'sec-gone', shares: 5 }],
      })
    );
    expect(holdingsValue(get, 'acc-1')).toBe(0);
  });
});

describe('the example filter (list unanswered)', () => {
  it('hides the example 401(k) when has401k is answered no', () => {
    const get = getOf(rawWith({ 'workplace.has401k': false }));
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-brok']);
    expect(investedBalance(get)).toBe(8775);
  });

  it('hides the example brokerage when the taxable contribution is answered 0', () => {
    const get = getOf(rawWith({ 'investing.taxableMonthlyContribution': 0 }));
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-401k']);
    expect(investedBalance(get)).toBe(16225);
  });

  it('shows every stored row once the list is answered, whatever the answers', () => {
    const get = getOf(rawWith({ 'workplace.has401k': false }, ['workplace.has401k', 'portfolio.accounts']));
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-401k', 'acc-brok']);
  });

  it('reads a provided value that is not a list as nothing answered', () => {
    const raw = { ...v3DefaultRaw(), provided: undefined };
    const get = getOf(raw);
    expect(answeredPaths(get)).toEqual([]);
    expect(isAnswered(get, 'portfolio.accounts')).toBe(false);
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-401k', 'acc-brok']);
    expect(investedBalance(get)).toBe(25000);
    expect(answeredPaths(getOf({ provided: 'portfolio.accounts' }))).toEqual([]);
  });

  it('counts a row path under a list as the list answered', () => {
    const get = getOf({ provided: ['portfolio.accounts.0.balance'] });
    expect(isAnswered(get, 'portfolio.accounts')).toBe(true);
    expect(isAnswered(get, 'portfolio.account')).toBe(false);
  });

  it('reads an invalid stored kind as brokerage and drops the tick on other kinds', () => {
    const get = getOf(
      rawWith({
        'portfolio.accounts': [
          { id: 'acc-1', kind: 'savings-bond', name: '', balance: 10, holdsEmergencyFund: true },
          { id: 'acc-2', kind: 'hsa', name: '', balance: 20, holdsEmergencyFund: true },
          { id: '', kind: 'hsa', name: '', balance: 30, holdsEmergencyFund: false },
        ],
      })
    );
    expect(accountsInEffect(get).rows.map((r) => [r.id, r.kind, r.holdsEmergencyFund])).toEqual([
      ['acc-1', 'brokerage', true],
      ['acc-2', 'hsa', false],
    ]);
  });
});

describe('suggestions', () => {
  it('suggests an HSA row only for an answered yes', () => {
    const answered = getOf(rawWith({ 'hsa.eligible': true }));
    expect(accountsInEffect(answered).suggested).toEqual([
      { id: 'acc-hsa', kind: 'hsa', name: '', balance: 0, holdsEmergencyFund: false },
    ]);
    const typical = getOf(rawWith({ 'hsa.eligible': true }, []));
    expect(accountsInEffect(typical).suggested).toEqual([]);
    // A suggested row holds no money.
    expect(investedBalance(answered)).toBe(25000);
    expect(accountLines(answered)).toEqual([
      '401(k) or similar $16,225',
      'Brokerage (taxable) $8,775 (3 holdings)',
      'HSA: no balance yet',
    ]);
  });

  it('keeps a stored HSA row after a later no, still counted', () => {
    const get = getOf(
      rawWith(
        {
          'hsa.eligible': false,
          'portfolio.accounts': [{ id: 'acc-hsa', kind: 'hsa', name: '', balance: 1, holdsEmergencyFund: false }],
          'portfolio.holdings': [],
        },
        ['hsa.eligible', 'portfolio.accounts']
      )
    );
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-hsa']);
    expect(investedBalance(get)).toBe(1);
  });

  it('moves the suggested id on when a stored row has it', () => {
    const get = getOf(
      rawWith(
        {
          'hsa.eligible': true,
          'portfolio.accounts': [{ id: 'acc-hsa', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false }],
          'portfolio.holdings': [],
        },
        ['hsa.eligible', 'portfolio.accounts']
      )
    );
    expect(ids(accountsInEffect(get).suggested)).toEqual(['acc-hsa-2']);
  });

  it('suggests a Roth 401(k) for a Roth election with no 401(k) row', () => {
    const get = getOf(
      rawWith(
        { 'workplace.has401k': true, 'workplace.contributionType': 'roth', 'portfolio.accounts': [] },
        ['workplace.has401k', 'portfolio.accounts']
      )
    );
    expect(accountsInEffect(get).suggested.map((r) => [r.id, r.kind])).toEqual([['acc-roth-401k', 'roth-401k']]);
  });

  it('suggests in table order and never a brokerage while an unticked brokerage exists', () => {
    const get = getOf(
      rawWith(
        {
          'workplace.has401k': true,
          'ira.traditional': true,
          'ira.roth': true,
          'hsa.eligible': true,
          'investing.taxableMonthlyContribution': 400,
          'portfolio.accounts': [{ id: 'acc-rh', kind: 'brokerage', name: 'Robinhood', balance: 0, holdsEmergencyFund: true }],
          'portfolio.holdings': [],
        },
        undefined
      )
    );
    expect(ids(accountsInEffect(get).suggested)).toEqual(['acc-401k', 'acc-trad-ira', 'acc-roth-ira', 'acc-hsa', 'acc-brok']);
    // The example brokerage of the advanced flow stops the brokerage suggestion.
    const example = getOf(rawWith({ 'investing.taxableMonthlyContribution': 400, 'ira.roth': true, 'hsa.eligible': true }));
    expect(ids(accountsInEffect(example).suggested)).toEqual(['acc-roth-ira', 'acc-hsa']);
  });

  it('hides a suggested row again when its answer turns no', () => {
    const get = getOf(rawWith({ 'hsa.eligible': false }));
    expect(accountsInEffect(get).suggested).toEqual([]);
  });
});

describe('the beginner fixture', () => {
  it('shows one 401(k) row, suggests nothing and rebalances nothing', () => {
    const get = getOf(beginnerRaw());
    expect(ids(accountsInEffect(get).rows)).toEqual(['acc-401k']);
    expect(accountsInEffect(get).suggested).toEqual([]);
    expect(rebalancedAccounts(get)).toEqual([]);
    expect(accountsSummary(get)).toBe('401(k) or similar $16,225');
    // Auto: round2(693.33... + 346.66...) = 1,040.
    expect(monthlyInvestingAuto(get)).toBe(1040);
  });

  it('reads "No accounts" for an empty answered list', () => {
    expect(accountsSummary(getOf(rawWith({ 'portfolio.accounts': [] })))).toBe('No accounts');
    expect(notRebalancedNote(getOf(rawWith({ 'portfolio.accounts': [] })))).toBeNull();
  });
});

describe('not rebalanced reasons', () => {
  it('gives cash, then emergency fund, then no holdings, then no new cash', () => {
    const get = getOf(
      rawWith({
        'investing.taxableMonthlyContribution': 0,
        'workplace.has401k': false,
        'portfolio.accounts': [
          { id: 'acc-c', kind: 'cash', name: 'Savings', balance: 5000, holdsEmergencyFund: false },
          { id: 'acc-e', kind: 'brokerage', name: 'Robinhood', balance: 100, holdsEmergencyFund: true },
          { id: 'acc-t', kind: 'traditional-ira', name: '', balance: 2000, holdsEmergencyFund: false },
          { id: 'acc-z', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false },
        ],
        'portfolio.holdings': [],
      })
    );
    expect(notRebalanced(get).map(({ account, reason }) => [account.id, reason])).toEqual([
      ['acc-c', 'cash'],
      ['acc-e', 'emergency-fund'],
      ['acc-t', 'no-holdings'],
      ['acc-z', 'no-new-cash'],
    ]);
    expect(notRebalancedNote(get)).toBe(
      'Not rebalanced: Savings (cash), Robinhood (emergency fund), Traditional IRA (no holdings entered), Brokerage (taxable) (no holdings or new cash).'
    );
    // 5,000 + 100 hold the emergency fund; only the IRA is invested.
    expect(emergencyFundBalance(get)).toBe(5100);
    expect(investedBalance(get)).toBe(2000);
    expect(accountLines(get)).toEqual([
      'Savings $5,000 (emergency fund)',
      'Robinhood $100 (emergency fund)',
      'Traditional IRA $2,000',
      'Brokerage (taxable) $0',
    ]);
  });

  it('rebalances an empty account that gets new cash, and uses a valid override', () => {
    const raw = rawWith({
      'portfolio.accounts': [{ id: 'acc-z', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false }],
      'portfolio.holdings': [],
      'portfolio.newCash': [{ id: 'acc-z', amount: -5 }],
    });
    // A negative override is ignored: Auto routes the taxable 500.
    expect(newCashFor(getOf(raw), 'acc-z')).toBe(500);
    expect(ids(rebalancedAccounts(getOf(raw)))).toEqual(['acc-z']);
    const zero = rawWith({ 'portfolio.newCash': [{ id: 'acc-z', amount: 0 }] }, [], raw);
    expect(newCashFor(getOf(zero), 'acc-z')).toBe(0);
    expect(rebalancedAccounts(getOf(zero))).toEqual([]);
  });
});

describe('yearStartInvesting: the parts paid once a year at the start', () => {
  it('is 0 for the default (every part monthly; the ec300fd payload has no timing leaves)', () => {
    expect(yearStartInvesting(getOf(v3DefaultRaw()))).toBe(0);
    expect(yearStartInvesting(getOf(normalizeProfile(v3DefaultRaw())))).toBe(0);
  });

  it('is 12 x 625 = 7,500 for the owner with the Roth IRA once a year; the monthly total stays 3,195', () => {
    const get = getOf(ownerYearStartRaw());
    expect(yearStartInvesting(get)).toBe(7500);
    expect(monthlyInvestingAuto(get)).toBe(3195);
    expect(monthlyInvestingAuto(getOf(v3DefaultRaw()))).toBe(1540);
  });

  it('is 12 x 500 = 6,000 for the default with taxable once a year', () => {
    expect(yearStartInvesting(getOf(rawWith({ 'investing.taxableTiming': 'yearStart' })))).toBe(6000);
  });

  it('sums the yearly parts: traditional 100 and Roth 625 and taxable 400 once a year gives 12 x 1,125 = 13,500', () => {
    const raw = rawWith(
      {
        'ira.traditional': true,
        'ira.traditionalMonthly': 100,
        'ira.traditionalTiming': 'yearStart',
        'investing.taxableTiming': 'yearStart',
      },
      undefined,
      ownerYearStartRaw()
    );
    expect(yearStartInvesting(getOf(raw))).toBe(13500);
  });

  it('is 0 under a Custom monthly investing figure (all monthly)', () => {
    const raw = rawWith({ 'investing.monthlyContribution': 300 }, undefined, ownerYearStartRaw());
    expect(yearStartInvesting(getOf(raw))).toBe(0);
  });

  it('is 0 for a part that is off, and counts any other leaf value as monthly', () => {
    expect(yearStartInvesting(getOf(rawWith({ 'ira.roth': false }, undefined, ownerYearStartRaw())))).toBe(0);
    expect(yearStartInvesting(getOf(rawWith({ 'ira.rothTiming': 'weekly' }, undefined, ownerRaw())))).toBe(0);
  });

  it('reads all three timing leaves under the default profile, where both IRAs are off', () => {
    const read: string[] = [];
    const base = getOf(v3DefaultRaw());
    yearStartInvesting((path) => {
      read.push(path);
      return base(path);
    });
    expect(read[0]).toBe('investing.monthlyContribution');
    expect(read).toEqual(expect.arrayContaining(['ira.traditionalTiming', 'ira.rothTiming', 'investing.taxableTiming']));
  });
});
