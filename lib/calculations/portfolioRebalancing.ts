/**
 * Portfolio Rebalancing — Cash-Flow Rebalancing Calculations
 *
 * Given a set of assets (ticker, current shares, price, target %) and a new
 * deposit, decide how many shares of each asset to buy so the post-deposit
 * portfolio moves toward its target allocation — without taxable selling
 * unless the caller opts in. Overweight positions in tax-advantaged accounts
 * are trimmed freely (no tax event); taxable positions are only sold when
 * `allowTaxableSelling` is enabled.
 *
 * Two modes:
 *  - 'whole':      whole-share purchases only (greedy fill of leftover cents)
 *  - 'fractional': fractional shares permitted (exact-to-penny)
 *
 * Overweight rule: assets that remain overweight AFTER the deposit dilutes the
 * portfolio receive zero shares. If the deposit is large enough that a
 * currently-overweight asset becomes underweight post-dilution, it receives
 * shares through the deficit formula.
 *
 * When the deposit is too small to fully rebalance (the aggregate shortfall
 * of all underweight assets exceeds the deposit), the deposit is distributed
 * proportionally to each underweight asset's shortfall.
 */

import { LOCATION_PREFERENCE } from './assetLocation';

export type RebalanceMode = 'whole' | 'fractional';

/**
 * Account tax treatment. Determines whether selling is allowed and informs
 * asset-location preferences.
 *   taxable       — brokerage / checking. Selling = tax event.
 *   tax-deferred  — Traditional 401k/IRA. Sell freely.
 *   tax-free      — Roth 401k/IRA / HSA. Sell freely.
 */
export type AccountType = 'taxable' | 'tax-deferred' | 'tax-free';

/**
 * Broad asset class used for placement advice and portfolio-wide
 * target allocations. Built-in IDs (us-stock, intl-stock, bonds, reits, cash,
 * other) get default labels and placement preferences; custom IDs flow through
 * the calculator with no opinion on placement.
 */
export type AssetClass = string;

export const BUILTIN_ASSET_CLASSES = [
  'us-stock',
  'intl-stock',
  'bonds',
  'reits',
  'cash',
  'other',
] as const;

export type BuiltinAssetClass = (typeof BUILTIN_ASSET_CLASSES)[number];

export const DEFAULT_ACCOUNT_TYPE: AccountType = 'taxable';
export const DEFAULT_ASSET_CLASS: AssetClass = 'other';

/** A user-defined asset class, identified by a stable id and a display label. */
export interface CustomAssetClass {
  id: string;
  label: string;
}

/** Display labels for the built-in asset classes. */
export const BUILTIN_ASSET_CLASS_LABELS: Record<BuiltinAssetClass, string> = {
  'us-stock': 'US Stock',
  'intl-stock': 'Intl Stock',
  'bonds': 'Bonds',
  'reits': 'REITs',
  'cash': 'Cash',
  'other': 'Other',
};

export function isBuiltinAssetClass(cls: AssetClass): cls is BuiltinAssetClass {
  return (BUILTIN_ASSET_CLASSES as readonly string[]).includes(cls);
}

/**
 * Resolve the display label for any asset class id — built-in or custom.
 * Falls back to the id itself when neither matches (e.g. legacy hashes).
 */
export function getAssetClassLabel(
  cls: AssetClass,
  customs: CustomAssetClass[] = [],
): string {
  if (isBuiltinAssetClass(cls)) return BUILTIN_ASSET_CLASS_LABELS[cls];
  const custom = customs.find(c => c.id === cls);
  return custom?.label ?? cls;
}

export interface RebalanceAsset {
  /** Stable id (client-generated) for React keys */
  id: string;
  /** Ticker or label, e.g. "VTI" */
  ticker: string;
  /** Current shares held (supports fractional) */
  currentShares: number;
  /** Current price per share */
  price: number;
  /** Target allocation as a decimal (0..1). 0.6 = 60% */
  targetAllocation: number;
  /** Tax treatment of the account this asset sits in. */
  accountType: AccountType;
  /** Broad asset class (used for placement advice). */
  assetClass: AssetClass;
}

/** What the calculator decided to do with a given asset. */
export type RebalanceAction = 'buy' | 'sell' | 'hold';

export interface ValidationError {
  field: string;
  message: string;
}

/** Target-sum tolerance for validation (0.01% of total) */
const TARGET_SUM_TOLERANCE = 0.0001;

/** Maximum fractional-share precision */
const FRACTIONAL_PRECISION = 4;

/**
 * Round a share count to the appropriate precision for the mode.
 */
function roundShares(shares: number, mode: RebalanceMode): number {
  if (mode === 'whole') return Math.floor(shares);
  const factor = Math.pow(10, FRACTIONAL_PRECISION);
  return Math.floor(shares * factor) / factor;
}

// ============================================================================
// Multi-account, securities-registry contract (v2)
// ----------------------------------------------------------------------------
// The shipped calculator uses the v2 shape below, where:
//   • Ticker/price/asset-class lives in a top-level `Security` registry
//   • Holdings reference accounts + securities (no re-entry across accounts)
//   • Targets are declared by asset class, either portfolio-wide or per-account
//   • Each account carries its own deposit and tax treatment
//
// The caller chooses a `SetupMode` up-front so the UI and algorithm agree on
// how class targets and asset-location preferences apply.
// ============================================================================

/**
 * Tool configuration chosen in the setup wizard.
 *   single        — one account; no cross-account routing. `accounts.length === 1`.
 *   multi-shared  — multiple accounts; one portfolio-wide target set.
 *                   Calculator routes new cash using LOCATION_PREFERENCE.
 *   multi-unique  — multiple accounts; each declares its own class targets.
 *                   No cross-account rebalancing; no placement advice.
 */
export type SetupMode = 'single' | 'multi-shared' | 'multi-unique';

/** One entry in the top-level securities registry. Ticker/price/class live here. */
export interface Security {
  id: string;
  ticker: string;
  /** Optional long name, e.g. "Vanguard Total US Stock Market". */
  name?: string;
  price: number;
  assetClass: AssetClass;
}

/**
 * Target allocation for a single asset class.
 *   • `accountId === null` → portfolio-wide (used in single + multi-shared).
 *   • `accountId === <id>` → per-account (used in multi-unique only).
 *
 * Within a group (same accountId), `target` values must sum to ~1.
 */
export interface ClassTarget {
  accountId: string | null;
  assetClass: AssetClass;
  /** Decimal in [0, 1]. */
  target: number;
}

/** One brokerage / retirement account. */
export interface Account {
  id: string;
  /** User-facing name, e.g. "Fidelity Roth IRA". */
  name: string;
  accountType: AccountType;
  /** New cash flowing INTO this account (not spread across accounts). */
  deposit: number;
}

/** Shares of one security held inside one account. */
export interface Holding {
  id: string;
  accountId: string;
  securityId: string;
  shares: number;
}

export interface RebalanceInputsV2 {
  setupMode: SetupMode;
  securities: Security[];
  classTargets: ClassTarget[];
  accounts: Account[];
  holdings: Holding[];
  allowTaxableSelling: boolean;
  /** Ignored in multi-unique mode. */
  showPlacementAdvice: boolean;
  mode: RebalanceMode;
  /** User-defined asset classes shown alongside the built-ins. */
  customAssetClasses?: CustomAssetClass[];
}

/** Per-holding plan inside a v2 result. */
export interface HoldingRebalancePlan {
  holdingId: string;
  accountId: string;
  securityId: string;
  ticker: string;
  accountType: AccountType;
  assetClass: AssetClass;
  price: number;

  currentShares: number;
  currentValue: number;

  action: RebalanceAction;
  sharesToBuy: number;
  sharesToSell: number;
  dollarsSpent: number;
  dollarsReceived: number;

  newShares: number;
  newValue: number;
}

/** Per-account summary inside a v2 result. */
export interface AccountRebalanceSummary {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  deposit: number;
  depositUsed: number;
  depositLeftover: number;
  holdings: HoldingRebalancePlan[];
}

/**
 * Class-level drift row. `accountId === null` rows are portfolio-wide;
 * `accountId === <id>` rows are per-account (multi-unique).
 */
export interface ClassDrift {
  accountId: string | null;
  assetClass: AssetClass;
  target: number;
  currentValue: number;
  currentAllocation: number;
  newValue: number;
  newAllocation: number;
  driftBefore: number;
  driftAfter: number;
}

export interface RebalanceResultV2 {
  setupMode: SetupMode;
  accounts: AccountRebalanceSummary[];

  totalValueBefore: number;
  totalValueAfter: number;
  totalDeposit: number;
  totalSpent: number;
  totalReceived: number;
  cashLeftover: number;

  taxEventDollars: number;
  totalDriftBefore: number;
  totalDriftAfter: number;

  classDrift: ClassDrift[];
  mode: RebalanceMode;
}

// ----------------------------------------------------------------------------
// v2 algorithm — rebalancePortfolioV2
// ----------------------------------------------------------------------------


interface WorkingHolding {
  id: string;
  accountId: string;
  securityId: string;
  ticker: string;
  price: number;
  assetClass: AssetClass;
  accountType: AccountType;
  startShares: number;
  shares: number; // mutated as we sell/buy
}

function buildWorkingHoldings(inputs: RebalanceInputsV2): WorkingHolding[] {
  const securityById = new Map<string, Security>(inputs.securities.map(s => [s.id, s]));
  const accountById = new Map<string, Account>(inputs.accounts.map(a => [a.id, a]));
  const out: WorkingHolding[] = [];
  for (const h of inputs.holdings) {
    const sec = securityById.get(h.securityId);
    const acct = accountById.get(h.accountId);
    if (!sec || !acct) continue;
    out.push({
      id: h.id,
      accountId: h.accountId,
      securityId: h.securityId,
      ticker: sec.ticker,
      price: sec.price,
      assetClass: sec.assetClass,
      accountType: acct.accountType,
      startShares: h.shares,
      shares: h.shares,
    });
  }
  return out;
}

function sumBy<T>(arr: T[], f: (t: T) => number): number {
  return arr.reduce((s, t) => s + f(t), 0);
}

/**
 * Core rebalancing pass against a fixed slate of holdings, targets, and cash pools.
 * Used by all three setup modes.
 *
 * Cash pool semantics:
 *  - single / multi-unique: `cashByAccount` has one entry per covered account.
 *    Proceeds from sells add back into that account's pool.
 *  - multi-shared: same — cash does NOT cross accounts.
 *
 * Placement rules:
 *  - `accountOrderByClass(assetClass)` chooses which account to sell from first
 *    (reverse-preference for multi-shared; fixed for single/multi-unique) and which
 *    to buy into first (preferred-first for multi-shared; fixed for single/multi-unique).
 */
function runRebalancePass(
  workingHoldings: WorkingHolding[],
  classTargetsByGroup: Map<string | null, Map<AssetClass, number>>,
  cashByAccount: Map<string, number>,
  allowTaxableSelling: boolean,
  mode: RebalanceMode,
  accountOrderForBuy: (cls: AssetClass) => string[],
  accountOrderForSell: (cls: AssetClass) => string[],
  groupKey: (accountId: string) => string | null,
  // When set (multi-shared), returns a zero-share holding to open so an
  // account with cash but no holding of an underweight class can still buy.
  openPosition?: (accountId: string, cls: AssetClass) => WorkingHolding | null,
): {
  taxEventDollars: number;
  spent: number;
  received: number;
} {
  let taxEventDollars = 0;
  let spent = 0;
  let received = 0;

  // For each account group (null = portfolio-wide), compute class deficits and act.
  const groups = new Set<string | null>();
  for (const h of workingHoldings) groups.add(groupKey(h.accountId));
  for (const gk of classTargetsByGroup.keys()) groups.add(gk);

  for (const gk of groups) {
    const targets = classTargetsByGroup.get(gk) ?? new Map();
    const holdings = gk === null
      ? workingHoldings
      : workingHoldings.filter(h => groupKey(h.accountId) === gk);
    const accountsInGroup = new Set(holdings.map(h => h.accountId));
    // Deposit-bearing accounts belong to the group even with zero holdings —
    // otherwise a fresh account's cash is invisible to the group value and
    // can never be spent (it would strand as depositLeftover).
    for (const acctId of cashByAccount.keys()) {
      if (groupKey(acctId) === gk && (cashByAccount.get(acctId) ?? 0) > 0) {
        accountsInGroup.add(acctId);
      }
    }
    // Cash available in this group = sum of cashByAccount for accounts in group
    const groupValue = () =>
      sumBy(holdings, h => h.shares * h.price) +
      sumBy(Array.from(accountsInGroup), a => cashByAccount.get(a) ?? 0);

    const classesInGroup = new Set<AssetClass>([
      ...holdings.map(h => h.assetClass),
      ...targets.keys(),
    ]);

    // Sell phase: handle overweight classes
    for (const cls of classesInGroup) {
      const target = targets.get(cls) ?? 0;
      if (target <= 0) continue;
      const classHoldings = holdings.filter(h => h.assetClass === cls);
      if (classHoldings.length === 0) continue;

      const currentValue = () => sumBy(classHoldings, h => h.shares * h.price);
      const combinedNow = groupValue();
      const targetValue = target * combinedNow;
      let deficit = targetValue - currentValue(); // negative = overweight

      if (deficit >= -0.005) continue; // not meaningfully overweight

      const order = accountOrderForSell(cls);
      for (const acctId of order) {
        if (!accountsInGroup.has(acctId)) continue;
        const sellableHoldings = classHoldings
          .filter(h => h.accountId === acctId)
          .filter(h => {
            const isTaxable = isTaxableAccount(h.accountType);
            return !isTaxable || allowTaxableSelling;
          })
          .filter(h => h.price > 0 && h.shares > 0)
          // prefer selling highest-priced first (fewer share count changes)
          .sort((a, b) => b.price - a.price);

        for (const h of sellableHoldings) {
          if (deficit >= -0.005) break;
          const overweightDollars = -deficit; // positive
          const rawShares = overweightDollars / h.price;
          const maxShares = h.shares;
          let sell = Math.min(rawShares, maxShares);
          sell = roundShares(sell, mode);
          if (sell <= 0) continue;
          const proceeds = sell * h.price;
          h.shares -= sell;
          cashByAccount.set(acctId, (cashByAccount.get(acctId) ?? 0) + proceeds);
          received += proceeds;
          if (h.accountType === 'taxable' && allowTaxableSelling) {
            taxEventDollars += proceeds;
          }
          // recompute deficit: combined value stays ~the same
          // (we sold shares but added cash — no net group value change)
          deficit = target * groupValue() - currentValue();
        }
        if (deficit >= -0.005) break;
      }
    }

    // Buy phase: handle underweight classes
    for (const cls of classesInGroup) {
      const target = targets.get(cls) ?? 0;
      if (target <= 0) continue;
      const classHoldings = holdings.filter(h => h.assetClass === cls);
      // Without openPosition (single / multi-unique) a class held nowhere in
      // the group cannot be bought.
      if (classHoldings.length === 0 && !openPosition) continue;

      const currentValue = () => sumBy(classHoldings, h => h.shares * h.price);
      const combinedNow = groupValue();
      const targetValue = target * combinedNow;
      let deficit = targetValue - currentValue(); // positive = underweight

      if (deficit <= 0.005) continue;

      const order = accountOrderForBuy(cls);
      for (const acctId of order) {
        if (!accountsInGroup.has(acctId)) continue;
        const cash = cashByAccount.get(acctId) ?? 0;
        if (cash <= 0.005) continue;
        let buyable = classHoldings
          .filter(h => h.accountId === acctId && h.price > 0)
          .sort((a, b) => a.price - b.price); // lowest price first
        if (buyable.length === 0 && openPosition) {
          // Account has cash but no holding of this class (e.g. a fresh Roth
          // with only a deposit) — open a zero-share position so its cash
          // isn't stranded.
          const opened = openPosition(acctId, cls);
          if (opened && opened.price > 0) {
            workingHoldings.push(opened);
            if (holdings !== workingHoldings) holdings.push(opened);
            classHoldings.push(opened);
            buyable = [opened];
          }
        }
        if (buyable.length === 0) continue;
        const target0 = buyable[0];

        const maxSharesByCash = cash / target0.price;
        const maxSharesByDeficit = deficit / target0.price;
        let buy = Math.min(maxSharesByCash, maxSharesByDeficit);
        buy = roundShares(buy, mode);
        if (buy <= 0) continue;
        const cost = buy * target0.price;
        target0.shares += buy;
        cashByAccount.set(acctId, cash - cost);
        spent += cost;
        deficit = target * groupValue() - currentValue();
        if (deficit <= 0.005) break;
      }
    }
  }

  return { taxEventDollars, spent, received };
}

function isTaxableAccount(t: AccountType): boolean {
  return t === 'taxable';
}

export function rebalancePortfolioV2(inputs: RebalanceInputsV2): RebalanceResultV2 {
  const working = buildWorkingHoldings(inputs);
  const cashByAccount = new Map<string, number>(
    inputs.accounts.map(a => [a.id, a.deposit]),
  );
  const totalValueBefore = sumBy(working, h => h.startShares * h.price);
  const totalDeposit = sumBy(inputs.accounts, a => a.deposit);

  // Build classTargets grouped by accountId (null = portfolio-wide).
  const classTargetsByGroup = new Map<string | null, Map<AssetClass, number>>();
  for (const t of inputs.classTargets) {
    let m = classTargetsByGroup.get(t.accountId);
    if (!m) {
      m = new Map();
      classTargetsByGroup.set(t.accountId, m);
    }
    m.set(t.assetClass, t.target);
  }

  // Account ordering rules per setup mode.
  const accountOrderForBuy = (cls: AssetClass): string[] => {
    if (inputs.setupMode === 'multi-shared') {
      const pref = LOCATION_PREFERENCE[cls];
      if (!pref) return inputs.accounts.map(a => a.id);
      // accounts whose type matches preferred types, in order
      return pref.flatMap(t => inputs.accounts.filter(a => a.accountType === t).map(a => a.id));
    }
    // single / multi-unique: natural order
    return inputs.accounts.map(a => a.id);
  };
  const accountOrderForSell = (cls: AssetClass): string[] => {
    if (inputs.setupMode === 'multi-shared') {
      const pref = LOCATION_PREFERENCE[cls];
      if (!pref) return inputs.accounts.map(a => a.id);
      // Sell order is decoupled from buy-side location preference: taxable is
      // always LAST (selling there realizes gains), and the two tax-advantaged
      // types are ordered by reverse location preference so the class's
      // least-preferred shelter is trimmed first.
      const taxAdvantaged = pref.filter(t => t !== 'taxable').reverse();
      const order: AccountType[] = [...taxAdvantaged, 'taxable'];
      return order.flatMap(t => inputs.accounts.filter(a => a.accountType === t).map(a => a.id));
    }
    return inputs.accounts.map(a => a.id);
  };
  const groupKey = (accountId: string): string | null => {
    if (inputs.setupMode === 'multi-unique') return accountId;
    return null;
  };

  // Multi-shared only: when an account holds cash but no security of an
  // underweight class, open a zero-share position in a registry security of
  // that class. Prefer a security already held elsewhere in the portfolio;
  // lowest price breaks ties (matches the buy loop's ordering).
  const accountById = new Map<string, Account>(inputs.accounts.map(a => [a.id, a]));
  const openPosition =
    inputs.setupMode === 'multi-shared'
      ? (accountId: string, cls: AssetClass): WorkingHolding | null => {
          const acct = accountById.get(accountId);
          if (!acct) return null;
          const candidates = inputs.securities.filter(
            s => s.assetClass === cls && s.price > 0,
          );
          if (candidates.length === 0) return null;
          const heldIds = new Set(inputs.holdings.map(h => h.securityId));
          const held = candidates.filter(s => heldIds.has(s.id));
          const pool = held.length > 0 ? held : candidates;
          const sec = pool.reduce((best, s) => (s.price < best.price ? s : best));
          return {
            id: `opened:${accountId}:${sec.id}`,
            accountId,
            securityId: sec.id,
            ticker: sec.ticker,
            price: sec.price,
            assetClass: sec.assetClass,
            accountType: acct.accountType,
            startShares: 0,
            shares: 0,
          };
        }
      : undefined;

  const { taxEventDollars, spent, received } = runRebalancePass(
    working,
    classTargetsByGroup,
    cashByAccount,
    inputs.allowTaxableSelling,
    inputs.mode,
    accountOrderForBuy,
    accountOrderForSell,
    groupKey,
    openPosition,
  );

  // Build per-holding plans. Include untouched holdings and any zero-share
  // positions the pass opened (they live in `working` but not inputs.holdings).
  const planByAccount = new Map<string, HoldingRebalancePlan[]>();
  for (const w of working) {
    const sharesDelta = w.shares - w.startShares;
    const sharesToBuy = sharesDelta > 0 ? sharesDelta : 0;
    const sharesToSell = sharesDelta < 0 ? -sharesDelta : 0;
    const dollarsSpent = sharesToBuy * w.price;
    const dollarsReceived = sharesToSell * w.price;
    const action: RebalanceAction =
      sharesToBuy > 0 ? 'buy' : sharesToSell > 0 ? 'sell' : 'hold';
    const plan: HoldingRebalancePlan = {
      holdingId: w.id,
      accountId: w.accountId,
      securityId: w.securityId,
      ticker: w.ticker,
      accountType: w.accountType,
      assetClass: w.assetClass,
      price: w.price,
      currentShares: w.startShares,
      currentValue: w.startShares * w.price,
      action,
      sharesToBuy,
      sharesToSell,
      dollarsSpent,
      dollarsReceived,
      newShares: w.shares,
      newValue: w.shares * w.price,
    };
    const arr = planByAccount.get(w.accountId) ?? [];
    arr.push(plan);
    planByAccount.set(w.accountId, arr);
  }

  // Per-account summaries.
  const accounts: AccountRebalanceSummary[] = inputs.accounts.map(a => {
    const planHoldings = planByAccount.get(a.id) ?? [];
    const depositLeftover = Math.max(0, cashByAccount.get(a.id) ?? 0);
    const depositUsed = Math.max(0, a.deposit - depositLeftover);
    return {
      accountId: a.id,
      accountName: a.name,
      accountType: a.accountType,
      deposit: a.deposit,
      depositUsed,
      depositLeftover,
      holdings: planHoldings,
    };
  });

  const totalValueAfter = sumBy(working, h => h.shares * h.price);
  const cashLeftover = Math.max(0, totalDeposit + received - spent);

  // classDrift rows.
  const classDrift: ClassDrift[] = [];
  const groups: Array<string | null> =
    inputs.setupMode === 'multi-unique'
      ? inputs.accounts.map(a => a.id)
      : [null];

  for (const gk of groups) {
    const groupHoldings = gk === null ? working : working.filter(h => h.accountId === gk);
    const groupCurrentValue = sumBy(groupHoldings, h => h.startShares * h.price);
    const groupNewValue = sumBy(groupHoldings, h => h.shares * h.price);
    // Drift convention: both sides are measured over INVESTED (securities)
    // value only — uninvested cash (the deposit before, leftover after) is
    // excluded from both denominators. This keeps before/after comparable:
    // including the deposit in "before" diluted every asset's current %
    // toward its post-deposit %, and including leftover cash in "after"
    // could make totalDriftAfter exceed totalDriftBefore even when every
    // trade moved toward target.
    const combinedBefore = groupCurrentValue;
    const combinedAfter = groupNewValue;
    const targets = classTargetsByGroup.get(gk) ?? new Map();
    const driftClasses = new Set<AssetClass>([
      ...groupHoldings.map(h => h.assetClass),
      ...targets.keys(),
    ]);
    for (const cls of driftClasses) {
      const target = targets.get(cls) ?? 0;
      if (target <= 0) {
        // skip classes with no target AND no holdings
        const hasHolding = groupHoldings.some(h => h.assetClass === cls);
        if (!hasHolding) continue;
      }
      const currentValue = sumBy(
        groupHoldings.filter(h => h.assetClass === cls),
        h => h.startShares * h.price,
      );
      const newValue = sumBy(
        groupHoldings.filter(h => h.assetClass === cls),
        h => h.shares * h.price,
      );
      const currentAllocation = combinedBefore > 0 ? currentValue / combinedBefore : 0;
      const newAllocation = combinedAfter > 0 ? newValue / combinedAfter : 0;
      classDrift.push({
        accountId: gk,
        assetClass: cls,
        target,
        currentValue,
        currentAllocation,
        newValue,
        newAllocation,
        driftBefore: Math.abs(currentAllocation - target),
        driftAfter: Math.abs(newAllocation - target),
      });
    }
  }

  const totalDriftBefore = sumBy(classDrift, d => d.driftBefore);
  const totalDriftAfter = sumBy(classDrift, d => d.driftAfter);

  return {
    setupMode: inputs.setupMode,
    accounts,
    totalValueBefore,
    totalValueAfter,
    totalDeposit,
    totalSpent: spent,
    totalReceived: received,
    cashLeftover,
    taxEventDollars,
    totalDriftBefore,
    totalDriftAfter,
    classDrift,
    mode: inputs.mode,
  };
}

// ----------------------------------------------------------------------------
// v2 validator — validateRebalanceInputsV2
// ----------------------------------------------------------------------------

export function validateRebalanceInputsV2(inputs: RebalanceInputsV2): ValidationError[] {
  const errors: ValidationError[] = [];

  // Account fields
  inputs.accounts.forEach((a, i) => {
    if (a.deposit < 0) {
      errors.push({
        field: `accounts[${i}].deposit`,
        message: 'Deposit cannot be negative.',
      });
    }
  });

  // Security fields
  inputs.securities.forEach((s, i) => {
    if (s.price < 0) {
      errors.push({
        field: `securities[${i}].price`,
        message: 'Price cannot be negative.',
      });
    }
  });

  // Holding references + shares
  const accountIds = new Set(inputs.accounts.map(a => a.id));
  const securityIds = new Set(inputs.securities.map(s => s.id));
  inputs.holdings.forEach((h, i) => {
    if (!accountIds.has(h.accountId)) {
      errors.push({
        field: `holdings[${i}].accountId`,
        message: 'Holding references an unknown account.',
      });
    }
    if (!securityIds.has(h.securityId)) {
      errors.push({
        field: `holdings[${i}].securityId`,
        message: 'Holding references an unknown security.',
      });
    }
    if (h.shares < 0) {
      errors.push({
        field: `holdings[${i}].shares`,
        message: 'Shares cannot be negative.',
      });
    }
  });

  // Class targets: scope + sum rules
  if (inputs.setupMode === 'single' || inputs.setupMode === 'multi-shared') {
    const bad = inputs.classTargets.filter(t => t.accountId !== null);
    if (bad.length > 0) {
      errors.push({
        field: 'classTargets',
        message: 'Portfolio-wide targets must have accountId === null.',
      });
    }
    const portfolioTargets = inputs.classTargets.filter(t => t.accountId === null);
    const sum = sumBy(portfolioTargets, t => t.target);
    if (portfolioTargets.length > 0 && Math.abs(sum - 1) > TARGET_SUM_TOLERANCE) {
      errors.push({
        field: 'classTargets.sum',
        message: `Target allocations must sum to 100% (currently ${(sum * 100).toFixed(2)}%).`,
      });
    }
  } else if (inputs.setupMode === 'multi-unique') {
    // Each account must have its own target group summing to 1.
    for (const acct of inputs.accounts) {
      const group = inputs.classTargets.filter(t => t.accountId === acct.id);
      if (group.length === 0) {
        errors.push({
          field: `classTargets[${acct.id}]`,
          message: `Account "${acct.name}" needs at least one target.`,
        });
        continue;
      }
      const sum = sumBy(group, t => t.target);
      if (Math.abs(sum - 1) > TARGET_SUM_TOLERANCE) {
        errors.push({
          field: `classTargets[${acct.id}].sum`,
          message: `Account "${acct.name}" targets must sum to 100% (currently ${(sum * 100).toFixed(2)}%).`,
        });
      }
    }
    // Portfolio-wide targets are not allowed in multi-unique
    const stray = inputs.classTargets.filter(t => t.accountId === null);
    if (stray.length > 0) {
      errors.push({
        field: 'classTargets',
        message: 'Per-account targets cannot be portfolio-wide (accountId must reference an account).',
      });
    }
  }

  return errors;
}

