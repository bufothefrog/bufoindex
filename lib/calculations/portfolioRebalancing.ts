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
 * Compute cash-flow rebalancing plan.
 * Throws if inputs are invalid — callers should validate first.
 */
export function rebalancePortfolio(inputs: RebalanceInputs): RebalanceResult {
  const errors = validateRebalanceInputs(inputs);
  if (errors.length > 0) {
    throw new Error(`Invalid inputs: ${errors.map(e => e.message).join('; ')}`);
  }

  const { assets, deposit, mode } = inputs;

  const currentValues = assets.map(a => a.currentShares * a.price);
  const totalValueBefore = currentValues.reduce((s, v) => s + v, 0);
  const newTotal = totalValueBefore + deposit;

  // Deficit = how much more value each asset needs to reach its target at the
  // post-deposit total. Capped at 0 for already-overweight assets.
  const targetValues = assets.map(a => a.targetAllocation * newTotal);
  const deficits = assets.map((_, i) => Math.max(0, targetValues[i] - currentValues[i]));
  const totalDeficit = deficits.reduce((s, v) => s + v, 0);

  // If some assets are post-dilution overweight, totalDeficit > deposit and we
  // scale the per-asset allocation proportionally. Otherwise deficits sum to
  // exactly the deposit and no scaling is needed.
  const scale = totalDeficit > deposit && totalDeficit > 0 ? deposit / totalDeficit : 1;
  const idealBuyDollars = deficits.map(d => d * scale);

  const sharesToBuy = assets.map((a, i) => roundShares(idealBuyDollars[i] / a.price, mode));
  const dollarsSpent = assets.map((a, i) => sharesToBuy[i] * a.price);
  let totalSpent = dollarsSpent.reduce((s, v) => s + v, 0);

  // Pass 2 (whole-share mode only): greedy — spend remaining cash on the
  // most-underweight asset we can afford. Repeat until no affordable buys.
  if (mode === 'whole') {
    let remaining = deposit - totalSpent;
    while (remaining > 1e-6) {
      // Signed post-purchase drift per asset. Negative = underweight.
      const postShares = assets.map((a, i) => a.currentShares + sharesToBuy[i]);
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

  const cashLeftover = Math.max(0, deposit - totalSpent);

  let totalDriftBefore = 0;
  let totalDriftAfter = 0;

  const plans: AssetRebalancePlan[] = assets.map((a, i) => {
    const currentAllocation = totalValueBefore > 0 ? currentValues[i] / totalValueBefore : 0;
    const newShares = a.currentShares + sharesToBuy[i];
    const newValue = newShares * a.price;
    const newAllocation = newTotal > 0 ? newValue / newTotal : 0;

    const driftBefore = currentAllocation - a.targetAllocation;
    const driftAfter = newAllocation - a.targetAllocation;

    totalDriftBefore += Math.abs(driftBefore);
    totalDriftAfter += Math.abs(driftAfter);

    const action: RebalanceAction = sharesToBuy[i] > 0 ? 'buy' : 'hold';

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
      sharesToSell: 0,
      dollarsReceived: 0,
      newShares,
      newValue,
      newAllocation,
      driftBefore,
      driftAfter,
    };
  });

  return {
    assets: plans,
    totalValueBefore,
    totalValueAfter: totalValueBefore + totalSpent,
    deposit,
    totalSpent,
    cashLeftover,
    taxEventDollars: 0,
    totalDriftBefore,
    totalDriftAfter,
    mode,
  };
}
