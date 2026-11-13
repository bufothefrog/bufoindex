/**
 * The rebalancer's entity actions as pure functions over the profile's
 * portfolio lists (docs/rebuild-plan.md section 2.13). Each takes the lists
 * and returns new ones, or [lists, new id] when it creates an entity; the
 * lists passed in are never mutated, and a no-op returns them unchanged (the
 * same reference). The custom renderers turn a result into profile writes
 * with portfolioWrites.
 *
 * Integrity is kept here: removing an account removes its holdings, and a
 * security no holding refers to any more is dropped (pruneUnusedSecurities).
 * Adding, editing and removing account rows goes through ./accountWrites.ts,
 * which reads the account list as it is in effect (lib/profile/accounts.ts).
 *
 * New ids are '<prefix>-<n>' with the smallest n from the list's length + 1
 * up that no row of that list uses and no row of any list refers to, so the
 * same edits always give the same ids (server and client agree, and tests
 * can name them), and a new row never takes over a reference left behind by
 * a removed one.
 */

import {
  DEFAULT_ASSET_CLASS,
  type AssetClass,
  type ClassTarget,
  type Holding,
  type Security,
} from '@/lib/calculations/portfolioRebalancing';
import { listRows } from '@/lib/fields/runtime';
import type { Get, Write } from '@/lib/fields/types';
import type { AccountRow, FinancialProfile, NewCashRow } from '@/lib/profile/types';

/** The profile's portfolio lists, which every action reads and returns. */
export type Portfolio = FinancialProfile['portfolio'];

/** Applies one action to the lists on display; the renderers hand this to their components. */
export type PortfolioUpdate = (reduce: (portfolio: Portfolio) => Portfolio) => void;

const LIST_KEYS = ['accounts', 'securities', 'holdings', 'newCash', 'classTargets', 'customAssetClasses'] as const;

/** Profile path of each portfolio list. */
export const PORTFOLIO_LIST_PATHS: Readonly<Record<keyof Portfolio, string>> = {
  accounts: 'portfolio.accounts',
  securities: 'portfolio.securities',
  holdings: 'portfolio.holdings',
  newCash: 'portfolio.newCash',
  classTargets: 'portfolio.classTargets',
  customAssetClasses: 'portfolio.customAssetClasses',
};

/** The portfolio lists as `get` sees them (a missing list reads as empty). */
export function readPortfolio(get: Get): Portfolio {
  const list = <T>(key: keyof Portfolio) => listRows(get(PORTFOLIO_LIST_PATHS[key])) as unknown as T[];
  return {
    accounts: list<AccountRow>('accounts'),
    securities: list<Security>('securities'),
    holdings: list<Holding>('holdings'),
    newCash: list<NewCashRow>('newCash'),
    classTargets: list<ClassTarget>('classTargets'),
    customAssetClasses: list<Portfolio['customAssetClasses'][number]>('customAssetClasses'),
  };
}

/** One whole-list write for each list `after` changed (by reference), in list order. */
export function portfolioWrites(before: Portfolio, after: Portfolio): Write[] {
  return LIST_KEYS.filter((key) => after[key] !== before[key]).map((key) => ({
    path: PORTFOLIO_LIST_PATHS[key],
    value: after[key],
  }));
}

/** Every id a row refers to (an account, a security or an asset class), dangling or not. */
function referencedIds(portfolio: Portfolio): Set<string> {
  const ids = new Set<string>();
  for (const holding of portfolio.holdings) {
    ids.add(holding.accountId);
    ids.add(holding.securityId);
  }
  for (const security of portfolio.securities) ids.add(security.assetClass);
  for (const target of portfolio.classTargets) {
    if (target.accountId !== null) ids.add(target.accountId);
    ids.add(target.assetClass);
  }
  return ids;
}

function nextId(prefix: 'acc' | 'sec' | 'hld' | 'cac', rows: readonly { id: string }[], portfolio: Portfolio): string {
  const taken = referencedIds(portfolio);
  for (const row of rows) taken.add(row.id);
  let n = rows.length + 1;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

function blankSecurity(id: string, ticker = ''): Security {
  return { id, ticker, price: 0, assetClass: DEFAULT_ASSET_CLASS };
}

function clamp01(value: number): number {
  if (!isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** True for the portfolio-wide target row of `assetClass`. */
function isPortfolioTarget(target: ClassTarget, assetClass: AssetClass): boolean {
  return target.accountId === null && target.assetClass === assetClass;
}

/** Drops every security no holding refers to. */
export function pruneUnusedSecurities(portfolio: Portfolio): Portfolio {
  const referenced = new Set(portfolio.holdings.map((h) => h.securityId));
  if (portfolio.securities.every((s) => referenced.has(s.id))) return portfolio;
  return { ...portfolio, securities: portfolio.securities.filter((s) => referenced.has(s.id)) };
}

// ---------------------------------------------------------------------------
// Securities
// ---------------------------------------------------------------------------

/** Appends a blank security; returns the lists and its id. */
export function addSecurity(portfolio: Portfolio): [Portfolio, string] {
  const id = nextId('sec', portfolio.securities, portfolio);
  return [{ ...portfolio, securities: [...portfolio.securities, blankSecurity(id)] }, id];
}

export function updateSecurity(portfolio: Portfolio, id: string, patch: Partial<Omit<Security, 'id'>>): Portfolio {
  return {
    ...portfolio,
    securities: portfolio.securities.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/** Removes the account and its holdings, then the securities only they held. */
export function removeAccount(portfolio: Portfolio, id: string): Portfolio {
  return pruneUnusedSecurities({
    ...portfolio,
    accounts: portfolio.accounts.filter((a) => a.id !== id),
    holdings: portfolio.holdings.filter((h) => h.accountId !== id),
  });
}

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

/** Appends an empty holding with its own blank security, in `accountId` (default: the first account). */
export function addHolding(portfolio: Portfolio, accountId?: string): Portfolio {
  const [withSecurity, securityId] = addSecurity(portfolio);
  const holding: Holding = {
    id: nextId('hld', portfolio.holdings, portfolio),
    accountId: accountId ?? portfolio.accounts[0]?.id ?? '',
    securityId,
    shares: 0,
  };
  return { ...withSecurity, holdings: [...portfolio.holdings, holding] };
}

export function updateHolding(portfolio: Portfolio, id: string, patch: Partial<Omit<Holding, 'id'>>): Portfolio {
  return {
    ...portfolio,
    holdings: portfolio.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
  };
}

/** Removes the holding, and its security when no other holding refers to it. */
export function removeHolding(portfolio: Portfolio, id: string): Portfolio {
  return pruneUnusedSecurities({ ...portfolio, holdings: portfolio.holdings.filter((h) => h.id !== id) });
}

/** Points the holding at another existing security; drops the old one if nothing else holds it. */
export function linkHoldingToSecurity(portfolio: Portfolio, holdingId: string, securityId: string): Portfolio {
  const holding = portfolio.holdings.find((h) => h.id === holdingId);
  if (!holding || holding.securityId === securityId) return portfolio;
  return pruneUnusedSecurities(updateHolding(portfolio, holdingId, { securityId }));
}

/**
 * The visitor typed a ticker for a holding. If another security already has
 * it, the holding switches to that one. Otherwise the holding's own security
 * is renamed in place when no other holding refers to it, or the holding
 * gets a new security of its own (renaming a shared one would change the
 * other holdings too). Blank tickers change nothing.
 */
export function linkHoldingByTicker(portfolio: Portfolio, holdingId: string, ticker: string): Portfolio {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return portfolio;
  const holding = portfolio.holdings.find((h) => h.id === holdingId);
  if (!holding) return portfolio;
  const currentSecurityId = holding.securityId;
  const existing = portfolio.securities.find(
    (s) => s.id !== currentSecurityId && s.ticker.toUpperCase() === normalized
  );
  if (existing) return linkHoldingToSecurity(portfolio, holdingId, existing.id);

  const currentIsShared = portfolio.holdings.some((h) => h.id !== holdingId && h.securityId === currentSecurityId);
  if (currentIsShared) {
    const newId = nextId('sec', portfolio.securities, portfolio);
    return updateHolding(
      { ...portfolio, securities: [...portfolio.securities, blankSecurity(newId, normalized)] },
      holdingId,
      { securityId: newId }
    );
  }
  return updateSecurity(portfolio, currentSecurityId, { ticker: normalized });
}

// ---------------------------------------------------------------------------
// Class targets and custom asset classes
// ---------------------------------------------------------------------------

/** Sets the portfolio-wide target of `assetClass`, clamped to [0, 1] (non-finite input is 0). */
export function setClassTarget(portfolio: Portfolio, assetClass: AssetClass, target: number): Portfolio {
  const row: ClassTarget = { accountId: null, assetClass, target: clamp01(target) };
  const index = portfolio.classTargets.findIndex((t) => isPortfolioTarget(t, assetClass));
  const classTargets = [...portfolio.classTargets];
  if (index >= 0) classTargets[index] = row;
  else classTargets.push(row);
  return { ...portfolio, classTargets };
}

/** Lists `assetClass` among the targets at 0% when it has no portfolio-wide row yet. */
export function ensureAssetClassVisible(portfolio: Portfolio, assetClass: AssetClass): Portfolio {
  if (portfolio.classTargets.some((t) => isPortfolioTarget(t, assetClass))) return portfolio;
  return {
    ...portfolio,
    classTargets: [...portfolio.classTargets, { accountId: null, assetClass, target: 0 }],
  };
}

/** Drops the portfolio-wide target of `assetClass`; a custom class is unregistered too. */
export function removeClassTarget(portfolio: Portfolio, assetClass: AssetClass): Portfolio {
  if (portfolio.customAssetClasses.some((c) => c.id === assetClass)) {
    return removeCustomAssetClass(portfolio, assetClass);
  }
  return { ...portfolio, classTargets: portfolio.classTargets.filter((t) => !isPortfolioTarget(t, assetClass)) };
}

/**
 * Registers a custom asset class labelled `label` (trimmed) with a 0% target
 * and returns its id. A label that matches a registered class, ignoring
 * case, reuses that class; a blank label changes nothing and returns ''.
 */
export function addCustomAssetClass(portfolio: Portfolio, label: string): [Portfolio, string] {
  const trimmed = label.trim();
  if (!trimmed) return [portfolio, ''];
  const existing = portfolio.customAssetClasses.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
  if (existing) return [ensureAssetClassVisible(portfolio, existing.id), existing.id];
  const id = nextId('cac', portfolio.customAssetClasses, portfolio);
  return [
    ensureAssetClassVisible({ ...portfolio, customAssetClasses: [...portfolio.customAssetClasses, { id, label: trimmed }] }, id),
    id,
  ];
}

/** Unregisters a custom asset class and drops its portfolio-wide target. */
export function removeCustomAssetClass(portfolio: Portfolio, id: string): Portfolio {
  return {
    ...portfolio,
    customAssetClasses: portfolio.customAssetClasses.filter((c) => c.id !== id),
    classTargets: portfolio.classTargets.filter((t) => !isPortfolioTarget(t, id)),
  };
}
