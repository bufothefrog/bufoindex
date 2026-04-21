/**
 * Portfolio Rebalancing — Cash-Flow Rebalancing Calculations
 *
 * Given a set of assets (ticker, current shares, price, target %) and a new
 * deposit, decide how many shares of each asset to buy so the post-deposit
 * portfolio moves toward its target allocation — without selling.
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
 * Broad asset class used for placement advice and (in Phase 2) portfolio-wide
 * target allocations.
 */
export type AssetClass =
  | 'us-stock'
  | 'intl-stock'
  | 'bonds'
  | 'reits'
  | 'cash'
  | 'other';

export const DEFAULT_ACCOUNT_TYPE: AccountType = 'taxable';
export const DEFAULT_ASSET_CLASS: AssetClass = 'other';

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

export interface RebalanceInputs {
  assets: RebalanceAsset[];
  deposit: number;
  mode: RebalanceMode;
  /** When true, overweight taxable assets may be sold (triggers a tax event). */
  allowTaxableSelling: boolean;
  /** When true, results include a tax-efficient placement advice panel. */
  showPlacementAdvice: boolean;
}

/** What the calculator decided to do with a given asset. */
export type RebalanceAction = 'buy' | 'sell' | 'hold';

export interface AssetRebalancePlan {
  id: string;
  ticker: string;
  price: number;
  accountType: AccountType;
  assetClass: AssetClass;

  // Before
  currentShares: number;
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;

  // Action
  action: RebalanceAction;
  sharesToBuy: number;
  dollarsSpent: number;
  /** Shares sold in a sellable account (tax-advantaged, or taxable when
   * `allowTaxableSelling` is enabled). Zero otherwise. */
  sharesToSell: number;
  /** Dollars realized from the sell leg (positive number). Zero when not selling. */
  dollarsReceived: number;

  // After
  newShares: number;
  newValue: number;
  newAllocation: number;

  /** Signed drift from target: positive = overweight, negative = underweight */
  driftBefore: number;
  driftAfter: number;
}

export interface RebalanceResult {
  assets: AssetRebalancePlan[];

  totalValueBefore: number;
  totalValueAfter: number;

  deposit: number;
  totalSpent: number;
  cashLeftover: number;

  /**
   * Total dollars sold in taxable accounts (0 when `allowTaxableSelling` is
   * false). Used by the UI to warn about realized-gain exposure.
   */
  taxEventDollars: number;

  /** Sum-of-absolute-drift metric; lower = better balanced */
  totalDriftBefore: number;
  totalDriftAfter: number;

  mode: RebalanceMode;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Target-sum tolerance for validation (0.01% of total) */
const TARGET_SUM_TOLERANCE = 0.0001;

/** Maximum fractional-share precision */
const FRACTIONAL_PRECISION = 4;

/**
 * Validate rebalancing inputs. Returns [] if valid.
 */
export function validateRebalanceInputs(inputs: RebalanceInputs): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!inputs.assets || inputs.assets.length === 0) {
    errors.push({ field: 'assets', message: 'At least one asset is required.' });
    return errors;
  }

  if (inputs.deposit < 0 || !isFinite(inputs.deposit)) {
    errors.push({ field: 'deposit', message: 'Deposit must be zero or positive.' });
  }

  let targetSum = 0;
  inputs.assets.forEach((asset, index) => {
    const label = asset.ticker || `Asset ${index + 1}`;

    if (asset.price <= 0 || !isFinite(asset.price)) {
      errors.push({ field: `asset-${asset.id}-price`, message: `${label}: price must be greater than zero.` });
    }
    if (asset.currentShares < 0 || !isFinite(asset.currentShares)) {
      errors.push({ field: `asset-${asset.id}-shares`, message: `${label}: shares cannot be negative.` });
    }
    if (asset.targetAllocation < 0 || asset.targetAllocation > 1 || !isFinite(asset.targetAllocation)) {
      errors.push({ field: `asset-${asset.id}-target`, message: `${label}: target must be between 0% and 100%.` });
    }
    targetSum += asset.targetAllocation;
  });

  if (Math.abs(targetSum - 1) > TARGET_SUM_TOLERANCE) {
    const percent = (targetSum * 100).toFixed(2);
    errors.push({
      field: 'targetSum',
      message: `Target allocations must sum to 100% (currently ${percent}%).`,
    });
  }

  return errors;
}

/**
 * Round a share count to the appropriate precision for the mode.
 */
function roundShares(shares: number, mode: RebalanceMode): number {
  if (mode === 'whole') return Math.floor(shares);
  const factor = Math.pow(10, FRACTIONAL_PRECISION);
  return Math.floor(shares * factor) / factor;
}

/**
 * Returns true when the asset's account allows selling:
 *  - Tax-advantaged accounts are always sellable.
 *  - Taxable accounts are only sellable when `allowTaxableSelling` is true.
 */
function isSellable(asset: RebalanceAsset, allowTaxableSelling: boolean): boolean {
  return asset.accountType !== 'taxable' || allowTaxableSelling;
}

/**
 * Compute cash-flow rebalancing plan.
 * Throws if inputs are invalid — callers should validate first.
 *
 * Selling rules:
 *   - If an asset is overweight and its account is sellable (tax-advantaged, or
 *     taxable with `allowTaxableSelling`), we sell enough shares to reach the
 *     asset's target value at the new total. The proceeds are added to the
 *     cash pool available for buying underweight assets.
 *   - Taxable sells populate `taxEventDollars` to warn about realized-gain
 *     exposure.
 */
export function rebalancePortfolio(inputs: RebalanceInputs): RebalanceResult {
  const errors = validateRebalanceInputs(inputs);
  if (errors.length > 0) {
    throw new Error(`Invalid inputs: ${errors.map(e => e.message).join('; ')}`);
  }

  const { assets, deposit, mode, allowTaxableSelling } = inputs;

  const currentValues = assets.map(a => a.currentShares * a.price);
  const totalValueBefore = currentValues.reduce((s, v) => s + v, 0);
  const newTotal = totalValueBefore + deposit;

  // --- Sell pass ------------------------------------------------------------
  // For each sellable overweight asset, compute how many shares to sell so that
  // the post-sell value moves toward the target. Proceeds are pooled with the
  // deposit and spent on underweight assets below.
  const targetValues = assets.map(a => a.targetAllocation * newTotal);
  const sharesToSell = assets.map(() => 0);
  const dollarsReceived = assets.map(() => 0);
  let sellProceeds = 0;
  let taxEventDollars = 0;

  assets.forEach((a, i) => {
    if (!isSellable(a, allowTaxableSelling)) return;
    const excessValue = currentValues[i] - targetValues[i];
    if (excessValue <= 0) return;

    const rawShares = excessValue / a.price;
    // Whole-share mode floors; fractional mode truncates to 4 decimals. Never
    // sell more shares than the asset actually holds.
    const sharesToSellRaw = Math.min(a.currentShares, roundShares(rawShares, mode));
    if (sharesToSellRaw <= 0) return;

    sharesToSell[i] = sharesToSellRaw;
    dollarsReceived[i] = sharesToSellRaw * a.price;
    sellProceeds += dollarsReceived[i];
    if (a.accountType === 'taxable') {
      taxEventDollars += dollarsReceived[i];
    }
  });

  // --- Buy pass -------------------------------------------------------------
  // Available cash is the deposit plus whatever the sell pass raised. Deficits
  // are computed against POST-SELL values so assets that were just trimmed
  // don't show up as underweight.
  const postSellValues = assets.map((_, i) => currentValues[i] - dollarsReceived[i]);
  const availableCash = deposit + sellProceeds;

  const deficits = assets.map((_, i) => Math.max(0, targetValues[i] - postSellValues[i]));
  const totalDeficit = deficits.reduce((s, v) => s + v, 0);

  const scale = totalDeficit > availableCash && totalDeficit > 0 ? availableCash / totalDeficit : 1;
  const idealBuyDollars = deficits.map(d => d * scale);

  const sharesToBuy = assets.map((a, i) => roundShares(idealBuyDollars[i] / a.price, mode));
  const dollarsSpent = assets.map((a, i) => sharesToBuy[i] * a.price);
  let totalSpent = dollarsSpent.reduce((s, v) => s + v, 0);

  // Pass 2 (whole-share mode only): greedy — spend remaining cash on the
  // most-underweight asset we can afford. Repeat until no affordable buys.
  if (mode === 'whole') {
    let remaining = availableCash - totalSpent;
    while (remaining > 1e-6) {
      // Signed post-purchase drift per asset. Negative = underweight.
      const postShares = assets.map((a, i) => a.currentShares - sharesToSell[i] + sharesToBuy[i]);
      const postValues = assets.map((a, i) => postShares[i] * a.price);
      const postDrifts = newTotal > 0
        ? assets.map((a, i) => postValues[i] / newTotal - a.targetAllocation)
        : assets.map(() => 0);

      let bestIdx = -1;
      let bestDrift = 0;
      for (let i = 0; i < assets.length; i++) {
        if (assets[i].price > remaining + 1e-9) continue;
        if (postDrifts[i] < bestDrift - 1e-12) {
          bestDrift = postDrifts[i];
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;

      sharesToBuy[bestIdx] += 1;
      dollarsSpent[bestIdx] += assets[bestIdx].price;
      remaining -= assets[bestIdx].price;
    }
    totalSpent = dollarsSpent.reduce((s, v) => s + v, 0);
  }

  // Leftover cash is available cash (deposit + sell proceeds) minus buys.
  const cashLeftover = Math.max(0, availableCash - totalSpent);

  let totalDriftBefore = 0;
  let totalDriftAfter = 0;

  const plans: AssetRebalancePlan[] = assets.map((a, i) => {
    const currentAllocation = totalValueBefore > 0 ? currentValues[i] / totalValueBefore : 0;
    const newShares = a.currentShares - sharesToSell[i] + sharesToBuy[i];
    const newValue = newShares * a.price;
    const newAllocation = newTotal > 0 ? newValue / newTotal : 0;

    const driftBefore = currentAllocation - a.targetAllocation;
    const driftAfter = newAllocation - a.targetAllocation;

    totalDriftBefore += Math.abs(driftBefore);
    totalDriftAfter += Math.abs(driftAfter);

    let action: RebalanceAction;
    if (sharesToSell[i] > 0) {
      action = 'sell';
    } else if (sharesToBuy[i] > 0) {
      action = 'buy';
    } else {
      action = 'hold';
    }

    return {
      id: a.id,
      ticker: a.ticker,
      price: a.price,
      accountType: a.accountType,
      assetClass: a.assetClass,
      currentShares: a.currentShares,
      currentValue: currentValues[i],
      currentAllocation,
      targetAllocation: a.targetAllocation,
      action,
      sharesToBuy: sharesToBuy[i],
      dollarsSpent: dollarsSpent[i],
      sharesToSell: sharesToSell[i],
      dollarsReceived: dollarsReceived[i],
      newShares,
      newValue,
      newAllocation,
      driftBefore,
      driftAfter,
    };
  });

  // totalSpent is gross spend on buys; net cash outflow = totalSpent - sellProceeds.
  // totalValueAfter = pre-existing value + net cash in (deposit - cashLeftover).
  return {
    assets: plans,
    totalValueBefore,
    totalValueAfter: totalValueBefore + (deposit - cashLeftover),
    deposit,
    totalSpent,
    cashLeftover,
    taxEventDollars,
    totalDriftBefore,
    totalDriftAfter,
    mode,
  };
}

// ============================================================================
// Phase 2 — Multi-account, securities-registry contract (v2)
// ----------------------------------------------------------------------------
// The Phase 1 API above (RebalanceAsset / RebalanceInputs / rebalancePortfolio)
// stays exported for back-compat. Phase 2 introduces a new shape where:
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
 *   single        — one account; Phase 1 behavior. `accounts.length === 1`.
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
// Phase 2 algorithm — rebalancePortfolioV2
// ----------------------------------------------------------------------------

const ASSET_CLASSES: AssetClass[] = [
  'us-stock',
  'intl-stock',
  'bonds',
  'reits',
  'cash',
  'other',
];

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
    // Cash available in this group = sum of cashByAccount for accounts in group
    const groupValue = () =>
      sumBy(holdings, h => h.shares * h.price) +
      sumBy(Array.from(accountsInGroup), a => cashByAccount.get(a) ?? 0);

    // Sell phase: handle overweight classes
    for (const cls of ASSET_CLASSES) {
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
    for (const cls of ASSET_CLASSES) {
      const target = targets.get(cls) ?? 0;
      if (target <= 0) continue;
      const classHoldings = holdings.filter(h => h.assetClass === cls);
      if (classHoldings.length === 0) continue; // can't buy class with no existing holding

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
        const buyable = classHoldings
          .filter(h => h.accountId === acctId && h.price > 0)
          .sort((a, b) => a.price - b.price); // lowest price first
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
      // accounts whose type matches preferred types, in order
      return pref.flatMap(t => inputs.accounts.filter(a => a.accountType === t).map(a => a.id));
    }
    // single / multi-unique: natural order
    return inputs.accounts.map(a => a.id);
  };
  const accountOrderForSell = (cls: AssetClass): string[] => {
    if (inputs.setupMode === 'multi-shared') {
      const pref = [...LOCATION_PREFERENCE[cls]].reverse();
      return pref.flatMap(t => inputs.accounts.filter(a => a.accountType === t).map(a => a.id));
    }
    return inputs.accounts.map(a => a.id);
  };
  const groupKey = (accountId: string): string | null => {
    if (inputs.setupMode === 'multi-unique') return accountId;
    return null;
  };

  const { taxEventDollars, spent, received } = runRebalancePass(
    working,
    classTargetsByGroup,
    cashByAccount,
    inputs.allowTaxableSelling,
    inputs.mode,
    accountOrderForBuy,
    accountOrderForSell,
    groupKey,
  );

  // Build per-holding plans. Include untouched holdings too.
  const holdingMap = new Map<string, WorkingHolding>(working.map(w => [w.id, w]));
  const planByAccount = new Map<string, HoldingRebalancePlan[]>();
  for (const h of inputs.holdings) {
    const w = holdingMap.get(h.id);
    if (!w) continue;
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
    const groupAccountIds = gk === null
      ? new Set(inputs.accounts.map(a => a.id))
      : new Set([gk]);
    const groupCurrentValue = sumBy(groupHoldings, h => h.startShares * h.price);
    const groupNewValue = sumBy(groupHoldings, h => h.shares * h.price);
    // "Before" reflects the portfolio as it stands pre-deposit: holdings only,
    // no deposit cash. Including the deposit diluted every asset's current %
    // toward its post-deposit %, which made holdings with no action (e.g. a
    // held bond position) display identical current and after allocations.
    const combinedBefore = groupCurrentValue;
    const combinedAfter = groupNewValue +
      sumBy(Array.from(groupAccountIds), id => cashByAccount.get(id) ?? 0);
    const targets = classTargetsByGroup.get(gk) ?? new Map();
    for (const cls of ASSET_CLASSES) {
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
// Phase 2 validator — validateRebalanceInputsV2
// ----------------------------------------------------------------------------

export function validateRebalanceInputsV2(inputs: RebalanceInputsV2): ValidationError[] {
  const errors: ValidationError[] = [];

  // Setup mode / accounts count
  if (inputs.setupMode === 'single' && inputs.accounts.length !== 1) {
    errors.push({
      field: 'setupMode',
      message: 'Single mode requires exactly one account.',
    });
  }
  if (
    (inputs.setupMode === 'multi-shared' || inputs.setupMode === 'multi-unique') &&
    inputs.accounts.length < 2
  ) {
    errors.push({
      field: 'setupMode',
      message: 'Multi-account modes require at least two accounts.',
    });
  }

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

