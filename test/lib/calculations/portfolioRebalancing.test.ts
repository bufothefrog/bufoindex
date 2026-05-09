import { describe, it, expect } from 'vitest';
import {
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
  AccountType,
  AssetClass,
  Account,
  ClassTarget,
  Holding,
  RebalanceInputsV2,
  Security,
} from '@/lib/calculations/portfolioRebalancing';

// ----------------------------------------------------------------------------
// rebalancePortfolioV2 + validateRebalanceInputsV2
// ----------------------------------------------------------------------------

function security(
  id: string,
  ticker: string,
  price: number,
  assetClass: AssetClass,
): Security {
  return { id, ticker, price, assetClass };
}

function account(
  id: string,
  name: string,
  accountType: AccountType,
  deposit: number,
): Account {
  return { id, name, accountType, deposit };
}

function holding(
  id: string,
  accountId: string,
  securityId: string,
  shares: number,
): Holding {
  return { id, accountId, securityId, shares };
}

function classTarget(
  accountId: string | null,
  assetClass: AssetClass,
  target: number,
): ClassTarget {
  return { accountId, assetClass, target };
}

function inputsV2(overrides: Partial<RebalanceInputsV2> = {}): RebalanceInputsV2 {
  return {
    setupMode: 'single',
    securities: [],
    classTargets: [],
    accounts: [],
    holdings: [],
    allowTaxableSelling: false,
    showPlacementAdvice: false,
    mode: 'whole',
    ...overrides,
  };
}

describe('validateRebalanceInputsV2', () => {
  it('accepts a single account in multi-shared mode', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [account('a1', 'Solo', 'taxable', 0)],
        classTargets: [classTarget(null, 'us-stock', 1)],
      }),
    );
    expect(errors.some(e => e.field === 'setupMode')).toBe(false);
  });

  it('flags negative deposits', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        accounts: [account('a1', 'A', 'taxable', -10)],
        classTargets: [classTarget(null, 'us-stock', 1)],
      }),
    );
    expect(errors.some(e => e.field === 'accounts[0].deposit')).toBe(true);
  });

  it('flags negative security prices', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        accounts: [account('a1', 'A', 'taxable', 0)],
        securities: [security('s1', 'VTI', -5, 'us-stock')],
        classTargets: [classTarget(null, 'us-stock', 1)],
      }),
    );
    expect(errors.some(e => e.field === 'securities[0].price')).toBe(true);
  });

  it('flags holdings referencing unknown account/security', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        accounts: [account('a1', 'A', 'taxable', 0)],
        securities: [security('s1', 'VTI', 100, 'us-stock')],
        holdings: [
          holding('h1', 'unknown-acct', 's1', 1),
          holding('h2', 'a1', 'unknown-sec', 1),
          holding('h3', 'a1', 's1', -1),
        ],
        classTargets: [classTarget(null, 'us-stock', 1)],
      }),
    );
    expect(errors.some(e => e.field === 'holdings[0].accountId')).toBe(true);
    expect(errors.some(e => e.field === 'holdings[1].securityId')).toBe(true);
    expect(errors.some(e => e.field === 'holdings[2].shares')).toBe(true);
  });

  it('requires portfolio targets to sum to 100% in single mode', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        accounts: [account('a1', 'A', 'taxable', 0)],
        classTargets: [
          classTarget(null, 'us-stock', 0.5),
          classTarget(null, 'bonds', 0.3),
        ],
      }),
    );
    expect(errors.some(e => e.field === 'classTargets.sum')).toBe(true);
  });

  it('rejects per-account targets in multi-shared mode', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [
          account('a1', 'A', 'taxable', 0),
          account('a2', 'B', 'tax-free', 0),
        ],
        classTargets: [
          classTarget('a1', 'us-stock', 1),
        ],
      }),
    );
    expect(errors.some(e => e.field === 'classTargets')).toBe(true);
  });

  it('requires per-account targets summing to 100% in multi-unique', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-unique',
        accounts: [
          account('a1', 'A', 'taxable', 0),
          account('a2', 'B', 'tax-free', 0),
        ],
        classTargets: [
          classTarget('a1', 'us-stock', 1),
          classTarget('a2', 'us-stock', 0.6),
          classTarget('a2', 'bonds', 0.3),
        ],
      }),
    );
    expect(errors.some(e => e.field === 'classTargets[a2].sum')).toBe(true);
  });

  it('requires every account to have at least one target in multi-unique', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-unique',
        accounts: [
          account('a1', 'A', 'taxable', 0),
          account('a2', 'B', 'tax-free', 0),
        ],
        classTargets: [classTarget('a1', 'us-stock', 1)],
      }),
    );
    expect(errors.some(e => e.field === 'classTargets[a2]')).toBe(true);
  });

  it('rejects portfolio-wide targets in multi-unique', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-unique',
        accounts: [
          account('a1', 'A', 'taxable', 0),
          account('a2', 'B', 'tax-free', 0),
        ],
        classTargets: [
          classTarget('a1', 'us-stock', 1),
          classTarget('a2', 'us-stock', 1),
          classTarget(null, 'us-stock', 1),
        ],
      }),
    );
    expect(errors.some(e => e.field === 'classTargets')).toBe(true);
  });

  it('accepts a fully valid single-mode setup', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'single',
        accounts: [account('a1', 'A', 'taxable', 1000)],
        securities: [security('s1', 'VTI', 100, 'us-stock')],
        holdings: [holding('h1', 'a1', 's1', 5)],
        classTargets: [classTarget(null, 'us-stock', 1)],
      }),
    );
    expect(errors).toEqual([]);
  });

  it('accepts a fully valid multi-shared setup', () => {
    const errors = validateRebalanceInputsV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [
          account('a1', 'Taxable', 'taxable', 500),
          account('a2', 'Roth', 'tax-free', 500),
        ],
        securities: [
          security('s1', 'VTI', 100, 'us-stock'),
          security('s2', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 's1', 5),
          holding('h2', 'a2', 's2', 3),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.6),
          classTarget(null, 'bonds', 0.4),
        ],
      }),
    );
    expect(errors).toEqual([]);
  });
});

describe('rebalancePortfolioV2 — single mode', () => {
  it('balances a single-account portfolio with cash-flow only', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'single',
        accounts: [account('a1', 'Brokerage', 'taxable', 1000)],
        securities: [
          security('s1', 'VTI', 100, 'us-stock'),
          security('s2', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 's1', 10), // $1000 US
          holding('h2', 'a1', 's2', 0),  // $0 bonds — but target calls for some
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.6),
          classTarget(null, 'bonds', 0.4),
        ],
      }),
    );

    expect(result.setupMode).toBe('single');
    expect(result.totalValueBefore).toBe(1000);
    expect(result.taxEventDollars).toBe(0); // no selling
    // $1000 existing US + $1000 deposit = $2000. Post-dilution, US is underweight
    // by $200 (needs $1200, has $1000) and bonds by $800 (needs $800, has $0).
    // Buy 2 VTI ($200) + 10 BND ($800) = $1000 deposited fully.
    const vti = result.accounts[0].holdings.find(h => h.ticker === 'VTI')!;
    const bnd = result.accounts[0].holdings.find(h => h.ticker === 'BND')!;
    expect(vti.sharesToBuy).toBe(2);
    expect(bnd.sharesToBuy).toBe(10);
    expect(bnd.dollarsSpent).toBe(800);
    expect(result.totalSpent).toBe(1000);
    expect(result.cashLeftover).toBe(0);
  });

  it('does not sell taxable by default even when overweight', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'single',
        accounts: [account('a1', 'Taxable', 'taxable', 0)],
        securities: [
          security('s1', 'VTI', 100, 'us-stock'),
          security('s2', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 's1', 10), // 1000 US
          holding('h2', 'a1', 's2', 0),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.6),
          classTarget(null, 'bonds', 0.4),
        ],
      }),
    );
    const vti = result.accounts[0].holdings.find(h => h.ticker === 'VTI')!;
    expect(vti.sharesToSell).toBe(0);
    expect(result.taxEventDollars).toBe(0);
  });

  it('sells taxable when allowTaxableSelling is true, marks tax-event dollars', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'single',
        allowTaxableSelling: true,
        accounts: [account('a1', 'Taxable', 'taxable', 0)],
        securities: [
          security('s1', 'VTI', 100, 'us-stock'),
          security('s2', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 's1', 10), // 1000 US
          holding('h2', 'a1', 's2', 5),  // 400 bonds
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.5),
          classTarget(null, 'bonds', 0.5),
        ],
      }),
    );
    const vti = result.accounts[0].holdings.find(h => h.ticker === 'VTI')!;
    expect(vti.sharesToSell).toBeGreaterThan(0);
    expect(result.taxEventDollars).toBeGreaterThan(0);
  });

  it('sells from tax-advantaged accounts without tax-event dollars', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'single',
        accounts: [account('a1', 'Roth', 'tax-free', 0)],
        securities: [
          security('s1', 'VTI', 100, 'us-stock'),
          security('s2', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 's1', 10),
          holding('h2', 'a1', 's2', 5),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.5),
          classTarget(null, 'bonds', 0.5),
        ],
      }),
    );
    const vti = result.accounts[0].holdings.find(h => h.ticker === 'VTI')!;
    expect(vti.sharesToSell).toBeGreaterThan(0);
    expect(result.taxEventDollars).toBe(0);
  });

  it('reports current allocation based on pre-deposit portfolio value', () => {
    // Regression: current allocation previously divided by (holdings + deposit),
    // which made a held asset's "current %" collapse onto its "after %".
    // Screenshot scenario: SSO 620 sh × $61 = $37,820; BOXX 40 sh × $116 = $4,640;
    // deposit $1,540 buys 25 SSO ($1,525), $15 leftover.
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'single',
        accounts: [account('a1', 'Brokerage', 'taxable', 1540)],
        securities: [
          security('sso', 'SSO', 61, 'us-stock'),
          security('boxx', 'BOXX', 116, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 'sso', 620),
          holding('h2', 'a1', 'boxx', 40),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.9),
          classTarget(null, 'bonds', 0.1),
        ],
      }),
    );

    const preDepositTotal = 620 * 61 + 40 * 116; // 42,460
    const postTotal = result.totalValueAfter + result.cashLeftover;

    const usStock = result.classDrift.find(d => d.assetClass === 'us-stock')!;
    const bonds = result.classDrift.find(d => d.assetClass === 'bonds')!;

    // Current % is measured against the pre-deposit portfolio, not post-deposit.
    expect(usStock.currentAllocation).toBeCloseTo((620 * 61) / preDepositTotal, 6);
    expect(bonds.currentAllocation).toBeCloseTo((40 * 116) / preDepositTotal, 6);

    // After % is measured against the post-trade portfolio (including leftover cash).
    expect(usStock.newAllocation).toBeCloseTo(usStock.newValue / postTotal, 6);
    expect(bonds.newAllocation).toBeCloseTo(bonds.newValue / postTotal, 6);

    // Held-only asset (BOXX, no action) must not report current === after, since
    // the denominator differs even when its dollar value is unchanged.
    expect(bonds.newValue).toBeCloseTo(bonds.currentValue, 6);
    expect(bonds.currentAllocation).not.toBeCloseTo(bonds.newAllocation, 4);
  });
});

describe('rebalancePortfolioV2 — multi-shared mode', () => {
  it('routes deposit to preferred-location accounts for underweight classes', () => {
    // Location preference: bonds → tax-deferred > tax-free > taxable.
    // Trad IRA receives the entire bond deposit available in its pool before
    // Taxable's cash is tapped.
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [
          account('taxable', 'Taxable', 'taxable', 200),
          account('trad', 'Trad IRA', 'tax-deferred', 800),
        ],
        securities: [
          security('vti', 'VTI', 100, 'us-stock'),
          security('bnd', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'taxable', 'vti', 10), // 1000 US
          holding('h2', 'trad', 'bnd', 0),     // bond seed in Trad
          holding('h3', 'taxable', 'bnd', 0),  // bond seed in Taxable
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.6),
          classTarget(null, 'bonds', 0.4),
        ],
      }),
    );
    // Bond deficit = $800 (target 40% of $2000 total, held $0).
    // Trad IRA has $800 available and is the preferred bonds location →
    // all bond buys land in Trad, none in Taxable.
    const tradBnd = result.accounts.find(a => a.accountId === 'trad')!
      .holdings.find(h => h.ticker === 'BND')!;
    const taxableBnd = result.accounts.find(a => a.accountId === 'taxable')!
      .holdings.find(h => h.ticker === 'BND')!;
    expect(tradBnd.sharesToBuy).toBe(10);
    expect(taxableBnd.sharesToBuy).toBe(0);
  });

  it('does not move cash across accounts', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [
          account('a1', 'Brokerage', 'taxable', 1000),
          account('a2', 'Roth', 'tax-free', 0),
        ],
        securities: [
          security('vti', 'VTI', 100, 'us-stock'),
          security('bnd', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 'vti', 5),
          holding('h2', 'a2', 'bnd', 5),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.6),
          classTarget(null, 'bonds', 0.4),
        ],
      }),
    );
    // Roth has $0 deposit — every Roth holding should have 0 dollarsSpent.
    const roth = result.accounts.find(a => a.accountId === 'a2')!;
    for (const h of roth.holdings) {
      expect(h.dollarsSpent).toBe(0);
    }
  });

  it('sells overweight tax-advantaged holdings without tax-event dollars', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'multi-shared',
        accounts: [
          account('taxable', 'Taxable', 'taxable', 0),
          account('roth', 'Roth', 'tax-free', 0),
        ],
        securities: [
          security('vti', 'VTI', 100, 'us-stock'),
          security('bnd', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'taxable', 'vti', 0), // bond buyable on Taxable
          holding('h2', 'taxable', 'bnd', 0),
          holding('h3', 'roth', 'vti', 15),   // 1500 US in Roth — big overweight
          holding('h4', 'roth', 'bnd', 0),
        ],
        classTargets: [
          classTarget(null, 'us-stock', 0.5),
          classTarget(null, 'bonds', 0.5),
        ],
      }),
    );
    const rothVti = result.accounts.find(a => a.accountId === 'roth')!
      .holdings.find(h => h.ticker === 'VTI')!;
    expect(rothVti.sharesToSell).toBeGreaterThan(0);
    expect(result.taxEventDollars).toBe(0);
    const rothBnd = result.accounts.find(a => a.accountId === 'roth')!
      .holdings.find(h => h.ticker === 'BND')!;
    // Sell proceeds land in Roth; Roth should use them to buy bonds.
    expect(rothBnd.sharesToBuy).toBeGreaterThan(0);
  });
});

describe('rebalancePortfolioV2 — multi-unique mode', () => {
  it('rebalances each account independently', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'multi-unique',
        accounts: [
          account('a1', 'Account A', 'taxable', 500),
          account('a2', 'Account B', 'tax-free', 500),
        ],
        securities: [
          security('vti', 'VTI', 100, 'us-stock'),
          security('bnd', 'BND', 80, 'bonds'),
        ],
        holdings: [
          holding('h1', 'a1', 'vti', 5),
          holding('h2', 'a1', 'bnd', 5),
          holding('h3', 'a2', 'vti', 5),
          holding('h4', 'a2', 'bnd', 5),
        ],
        classTargets: [
          // A: 100% US
          classTarget('a1', 'us-stock', 1),
          // B: 100% Bonds
          classTarget('a2', 'bonds', 1),
        ],
      }),
    );
    const aPlan = result.accounts.find(a => a.accountId === 'a1')!;
    const bPlan = result.accounts.find(a => a.accountId === 'a2')!;
    // Account A buys VTI with its deposit, doesn't touch B's holdings.
    const aVti = aPlan.holdings.find(h => h.ticker === 'VTI')!;
    expect(aVti.sharesToBuy).toBeGreaterThan(0);
    // Account B buys BND, not VTI.
    const bBnd = bPlan.holdings.find(h => h.ticker === 'BND')!;
    expect(bBnd.sharesToBuy).toBeGreaterThan(0);
    // Account B's VTI holding is untouched (no cross-account moves).
    const bVti = bPlan.holdings.find(h => h.ticker === 'VTI')!;
    expect(bVti.sharesToBuy).toBe(0);
  });

  it('produces per-account class drift rows (not portfolio-wide)', () => {
    const result = rebalancePortfolioV2(
      inputsV2({
        setupMode: 'multi-unique',
        accounts: [
          account('a1', 'A', 'taxable', 0),
          account('a2', 'B', 'tax-free', 0),
        ],
        securities: [security('vti', 'VTI', 100, 'us-stock')],
        holdings: [
          holding('h1', 'a1', 'vti', 5),
          holding('h2', 'a2', 'vti', 5),
        ],
        classTargets: [
          classTarget('a1', 'us-stock', 1),
          classTarget('a2', 'us-stock', 1),
        ],
      }),
    );
    const accountIds = new Set(result.classDrift.map(d => d.accountId));
    expect(accountIds.has('a1')).toBe(true);
    expect(accountIds.has('a2')).toBe(true);
    expect(accountIds.has(null)).toBe(false);
  });
});

describe('rebalancePortfolioV2 — performance', () => {
  it('completes 5 accts × 6 classes × 15 holdings in < 50ms', () => {
    const accounts: Account[] = [
      account('t', 'Taxable', 'taxable', 1000),
      account('r', 'Roth', 'tax-free', 1000),
      account('d1', 'Trad 1', 'tax-deferred', 1000),
      account('d2', 'Trad 2', 'tax-deferred', 1000),
      account('r2', 'Roth 2', 'tax-free', 1000),
    ];
    const classes: AssetClass[] = ['us-stock', 'intl-stock', 'bonds', 'reits', 'cash', 'other'];
    const securities: Security[] = classes.map((c, i) =>
      security(`s${i}`, `T${i}`, 50 + i * 10, c),
    );
    const holdings: Holding[] = [];
    let hid = 0;
    // 3 holdings per account: 3 × 5 = 15 total, spread across classes
    for (const a of accounts) {
      for (let k = 0; k < 3; k++) {
        const sec = securities[(hid + k) % securities.length];
        holdings.push(holding(`h${hid++}`, a.id, sec.id, 5 + k));
      }
    }
    const classTargets: ClassTarget[] = classes.map((c, i) => ({
      accountId: null,
      assetClass: c,
      target: i === 0 ? 1 - 0.15 * 5 : 0.15, // first class takes slack so sum = 1
    }));
    const input = inputsV2({
      setupMode: 'multi-shared',
      accounts,
      securities,
      holdings,
      classTargets,
    });
    const start = performance.now();
    const result = rebalancePortfolioV2(input);
    const elapsed = performance.now() - start;
    expect(result.accounts).toHaveLength(5);
    expect(elapsed).toBeLessThan(50);
  });
});
