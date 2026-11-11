/**
 * The rebalancer's entity actions as pure reducers over the profile's
 * portfolio lists (moved from the old store's actions with their
 * assertions): entity CRUD with security garbage collection, ticker
 * linking, target management with clamping, custom asset classes, and the
 * writes a change turns into.
 *
 * The seed is the default profile's worked example:
 *   Roth IRA:   10 VTI, 5 BND        (acc-roth, tax-free, no new cash)
 *   Brokerage:  20 VTI, 15 VXUS      (acc-brok, taxable, $1,000 new cash)
 *   Targets:    60% US, 20% intl, 20% bonds, 0% cash (the 80/20 preset)
 */

import { describe, expect, it } from 'vitest';
import {
  addAccount,
  addCustomAssetClass,
  addHolding,
  addSecurity,
  ensureAssetClassVisible,
  linkHoldingByTicker,
  linkHoldingToSecurity,
  portfolioWrites,
  pruneUnusedSecurities,
  readPortfolio,
  removeAccount,
  removeClassTarget,
  removeCustomAssetClass,
  removeHolding,
  setClassTarget,
  updateAccount,
  updateHolding,
  updateSecurity,
  type Portfolio,
} from '@/lib/calculators/portfolio/reducers';
import { makeGet } from '@/lib/fields/paths';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';

const seed = (): Portfolio => getDefaultFinancialProfile().portfolio;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('seed', () => {
  it('is the worked-example three-fund portfolio', () => {
    const p = seed();
    expect(p.securities.map((s) => s.ticker)).toEqual(['VTI', 'VXUS', 'BND']);
    expect(p.accounts.map((a) => a.name)).toEqual(['Roth IRA', 'Brokerage']);
    expect(p.holdings).toHaveLength(4);
    // 60/20/20 (plus a 0% cash row) sum to exactly 1.
    expect(p.classTargets.reduce((s, t) => s + t.target, 0)).toBeCloseTo(1, 10);
    expect(p.customAssetClasses).toEqual([]);
  });
});

describe('the reducers never mutate their input', () => {
  it('returns new lists from a frozen portfolio', () => {
    const p = deepFreeze(seed());
    expect(() => {
      addSecurity(p);
      updateSecurity(p, 'sec-vti', { price: 1 });
      addAccount(p);
      updateAccount(p, 'acc-roth', { deposit: 1 });
      removeAccount(p, 'acc-roth');
      addHolding(p);
      updateHolding(p, 'hld-roth-vti', { shares: 1 });
      removeHolding(p, 'hld-roth-bnd');
      linkHoldingToSecurity(p, 'hld-roth-bnd', 'sec-vxus');
      linkHoldingByTicker(p, 'hld-roth-vti', 'VOO');
      linkHoldingByTicker(p, 'hld-brok-vxus', 'SCHF');
      setClassTarget(p, 'us-stock', 0.5);
      setClassTarget(p, 'reits', 0.1);
      ensureAssetClassVisible(p, 'reits');
      removeClassTarget(p, 'cash');
      addCustomAssetClass(p, 'Crypto');
      removeCustomAssetClass(p, 'cac-1');
      pruneUnusedSecurities(p);
    }).not.toThrow();
  });
});

describe('security actions', () => {
  it('addSecurity appends a blank security and returns its id', () => {
    const [p, id] = addSecurity(seed());
    expect(p.securities).toHaveLength(4);
    expect(id).toBe('sec-4');
    expect(p.securities.find((s) => s.id === id)).toEqual({ id, ticker: '', price: 0, assetClass: 'other' });
  });

  it('updateSecurity patches fields in place', () => {
    const p = updateSecurity(seed(), 'sec-vti', { price: 260, name: 'Renamed' });
    const vti = p.securities.find((s) => s.id === 'sec-vti');
    expect(vti?.price).toBe(260);
    expect(vti?.name).toBe('Renamed');
    expect(vti?.ticker).toBe('VTI'); // untouched field preserved
  });

  it('pruneUnusedSecurities drops securities no holding refers to, and is a no-op otherwise', () => {
    const before = seed();
    expect(pruneUnusedSecurities(before)).toBe(before);
    const [withSpare] = addSecurity(before);
    expect(pruneUnusedSecurities(withSpare).securities.map((s) => s.id)).toEqual(['sec-vti', 'sec-vxus', 'sec-bnd']);
  });
});

describe('account actions', () => {
  it('addAccount appends a numbered taxable account with zero deposit', () => {
    const { accounts } = addAccount(seed());
    expect(accounts).toHaveLength(3);
    expect(accounts[2]).toEqual({ id: 'acc-3', name: 'Account 3', accountType: 'taxable', deposit: 0 });
  });

  it('gives each new account an id no account has', () => {
    const twice = addAccount(addAccount(seed()));
    expect(twice.accounts.map((a) => a.id)).toEqual(['acc-roth', 'acc-brok', 'acc-3', 'acc-4']);
    const gap = addAccount({ ...seed(), accounts: [{ id: 'acc-2', name: 'A', accountType: 'taxable', deposit: 0 }] });
    expect(gap.accounts.map((a) => a.id)).toEqual(['acc-2', 'acc-3']);
  });

  it('updateAccount patches fields in place', () => {
    const roth = updateAccount(seed(), 'acc-roth', { deposit: 1000 }).accounts.find((a) => a.id === 'acc-roth');
    expect(roth?.deposit).toBe(1000);
    expect(roth?.accountType).toBe('tax-free');
  });

  it('removeAccount drops its holdings and garbage-collects orphaned securities', () => {
    const { accounts, holdings, securities } = removeAccount(seed(), 'acc-roth');
    expect(accounts.map((a) => a.id)).toEqual(['acc-brok']);
    expect(holdings.map((h) => h.id)).toEqual(['hld-brok-vti', 'hld-brok-vxus']);
    // BND was held only in the Roth, so its security is GC'd; VTI survives
    // because the brokerage still holds it.
    expect(securities.map((s) => s.id)).toEqual(['sec-vti', 'sec-vxus']);
  });
});

describe('holding actions', () => {
  it('addHolding defaults to the first account and creates a paired blank security', () => {
    const { holdings, securities } = addHolding(seed());
    expect(holdings).toHaveLength(5);
    expect(securities).toHaveLength(4);
    const added = holdings[4];
    expect(added).toEqual({ id: 'hld-5', accountId: 'acc-roth', securityId: 'sec-4', shares: 0 });
    const paired = securities.find((s) => s.id === added.securityId);
    expect(paired).toMatchObject({ ticker: '', price: 0, assetClass: 'other' });
  });

  it('addHolding targets an explicit account', () => {
    expect(addHolding(seed(), 'acc-brok').holdings[4].accountId).toBe('acc-brok');
  });

  it('updateHolding patches shares', () => {
    const h = updateHolding(seed(), 'hld-roth-vti', { shares: 42 }).holdings.find((x) => x.id === 'hld-roth-vti');
    expect(h?.shares).toBe(42);
  });

  it('removeHolding garbage-collects a security only when it becomes orphaned', () => {
    // BND is held only by the Roth holding -> security GC'd with it.
    const withoutBnd = removeHolding(seed(), 'hld-roth-bnd');
    expect(withoutBnd.securities.some((s) => s.id === 'sec-bnd')).toBe(false);

    // VTI is held by both accounts -> removing one keeps the security.
    const withoutRothVti = removeHolding(withoutBnd, 'hld-roth-vti');
    expect(withoutRothVti.securities.some((s) => s.id === 'sec-vti')).toBe(true);
    expect(withoutRothVti.holdings).toHaveLength(2);
  });

  it('linkHoldingToSecurity swaps the reference and GCs the orphaned security', () => {
    const { holdings, securities } = linkHoldingToSecurity(seed(), 'hld-roth-bnd', 'sec-vxus');
    expect(holdings.find((h) => h.id === 'hld-roth-bnd')?.securityId).toBe('sec-vxus');
    expect(securities.some((s) => s.id === 'sec-bnd')).toBe(false);
  });

  it('linkHoldingToSecurity changes nothing for the security it already holds or an unknown holding', () => {
    const p = seed();
    expect(linkHoldingToSecurity(p, 'hld-roth-bnd', 'sec-bnd')).toBe(p);
    expect(linkHoldingToSecurity(p, 'hld-nope', 'sec-bnd')).toBe(p);
  });
});

describe('linkHoldingByTicker', () => {
  it('normalizes the ticker and swaps to an existing security, GCing the orphan', () => {
    const { holdings, securities } = linkHoldingByTicker(seed(), 'hld-roth-bnd', '  vti ');
    expect(holdings.find((h) => h.id === 'hld-roth-bnd')?.securityId).toBe('sec-vti');
    expect(securities.some((s) => s.id === 'sec-bnd')).toBe(false);
    expect(securities).toHaveLength(2);
  });

  it('renames the security in place when this holding is its only user', () => {
    const { holdings, securities } = linkHoldingByTicker(seed(), 'hld-brok-vxus', 'schf');
    // Same security id, new ticker - no new security created.
    expect(holdings.find((h) => h.id === 'hld-brok-vxus')?.securityId).toBe('sec-vxus');
    expect(securities.find((s) => s.id === 'sec-vxus')?.ticker).toBe('SCHF');
    expect(securities).toHaveLength(3);
  });

  it('creates a new security when the current one is shared with another holding', () => {
    const { holdings, securities } = linkHoldingByTicker(seed(), 'hld-roth-vti', 'VOO');
    const rothVti = holdings.find((h) => h.id === 'hld-roth-vti');
    expect(rothVti?.securityId).toBe('sec-4');
    // The brokerage's VTI is untouched.
    expect(holdings.find((h) => h.id === 'hld-brok-vti')?.securityId).toBe('sec-vti');
    expect(securities).toHaveLength(4);
    expect(securities.find((s) => s.id === rothVti?.securityId)).toEqual({
      id: 'sec-4',
      ticker: 'VOO',
      price: 0,
      assetClass: 'other',
    });
  });

  it('ignores blank tickers and unknown holdings', () => {
    const before = seed();
    expect(linkHoldingByTicker(before, 'hld-roth-bnd', '   ')).toBe(before);
    expect(linkHoldingByTicker(before, 'hld-nope', 'VOO')).toBe(before);
  });
});

describe('asset-class targets', () => {
  const target = (p: Portfolio, cls: string) => p.classTargets.find((t) => t.assetClass === cls)?.target;

  it('setClassTarget updates an existing portfolio-wide row', () => {
    const p = setClassTarget(seed(), 'us-stock', 0.5);
    expect(p.classTargets.find((t) => t.assetClass === 'us-stock')).toEqual({
      accountId: null,
      assetClass: 'us-stock',
      target: 0.5,
    });
    // No duplicate row was appended.
    expect(p.classTargets.filter((t) => t.assetClass === 'us-stock')).toHaveLength(1);
  });

  it('setClassTarget clamps to [0, 1] and zeroes non-finite input', () => {
    expect(target(setClassTarget(seed(), 'us-stock', 1.5), 'us-stock')).toBe(1);
    expect(target(setClassTarget(seed(), 'us-stock', -0.25), 'us-stock')).toBe(0);
    expect(target(setClassTarget(seed(), 'us-stock', NaN), 'us-stock')).toBe(0);
  });

  it('setClassTarget appends a row for a class with no existing target', () => {
    expect(setClassTarget(seed(), 'reit', 0.1).classTargets.find((t) => t.assetClass === 'reit')).toEqual({
      accountId: null,
      assetClass: 'reit',
      target: 0.1,
    });
  });

  it('ensureAssetClassVisible adds a 0% row exactly once', () => {
    const once = ensureAssetClassVisible(seed(), 'reit');
    const twice = ensureAssetClassVisible(once, 'reit');
    expect(twice).toBe(once);
    expect(twice.classTargets.filter((t) => t.assetClass === 'reit')).toEqual([
      { accountId: null, assetClass: 'reit', target: 0 },
    ]);
  });

  it('removeClassTarget drops the target row', () => {
    expect(removeClassTarget(seed(), 'cash').classTargets.some((t) => t.assetClass === 'cash')).toBe(false);
  });

  it('addCustomAssetClass registers the class with a 0% target and returns its id', () => {
    const [p, id] = addCustomAssetClass(seed(), '  Crypto  ');
    expect(id).toBe('cac-1');
    expect(p.customAssetClasses).toEqual([{ id, label: 'Crypto' }]);
    expect(p.classTargets.find((t) => t.assetClass === id)).toEqual({ accountId: null, assetClass: id, target: 0 });
  });

  it('addCustomAssetClass reuses an existing class on a case-insensitive label match', () => {
    const [first, firstId] = addCustomAssetClass(seed(), 'Crypto');
    const [second, secondId] = addCustomAssetClass(first, 'crypto');
    expect(secondId).toBe(firstId);
    expect(second.customAssetClasses).toHaveLength(1);
    expect(second.classTargets.filter((t) => t.assetClass === firstId)).toHaveLength(1);
  });

  it('addCustomAssetClass rejects blank labels', () => {
    const before = seed();
    const [p, id] = addCustomAssetClass(before, '   ');
    expect(id).toBe('');
    expect(p).toBe(before);
    expect(p.customAssetClasses).toEqual([]);
  });

  it('removeClassTarget on a custom class also unregisters it', () => {
    const [withCrypto, id] = addCustomAssetClass(seed(), 'Crypto');
    const p = removeClassTarget(withCrypto, id);
    expect(p.customAssetClasses).toEqual([]);
    expect(p.classTargets.some((t) => t.assetClass === id)).toBe(false);
  });

  it('removeCustomAssetClass unregisters the class and drops its target', () => {
    const [withCrypto, id] = addCustomAssetClass(setClassTarget(seed(), 'reits', 0.1), 'Crypto');
    const p = removeCustomAssetClass(setClassTarget(withCrypto, id, 0.05), id);
    expect(p.customAssetClasses).toEqual([]);
    expect(p.classTargets.map((t) => t.assetClass)).toEqual(['us-stock', 'intl-stock', 'bonds', 'cash', 'reits']);
  });
});

describe('reading and writing the profile lists', () => {
  it('reads the five lists through a Get, and a missing list as empty', () => {
    const profile = getDefaultFinancialProfile();
    expect(readPortfolio(makeGet(profile))).toEqual(profile.portfolio);
    expect(readPortfolio(makeGet({}))).toEqual({
      accounts: [],
      securities: [],
      holdings: [],
      classTargets: [],
      customAssetClasses: [],
    });
  });

  it('writes each list an action changed, whole, and nothing else', () => {
    const before = seed();
    expect(portfolioWrites(before, before)).toEqual([]);
    const after = removeAccount(before, 'acc-roth');
    expect(portfolioWrites(before, after)).toEqual([
      { path: 'portfolio.accounts', value: [before.accounts[1]] },
      { path: 'portfolio.securities', value: [before.securities[0], before.securities[1]] },
      { path: 'portfolio.holdings', value: [before.holdings[2], before.holdings[3]] },
    ]);
    const [withCrypto] = addCustomAssetClass(before, 'Crypto');
    expect(portfolioWrites(before, withCrypto).map((w) => w.path)).toEqual([
      'portfolio.classTargets',
      'portfolio.customAssetClasses',
    ]);
  });
});
