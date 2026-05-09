import { describe, it, expect } from 'vitest';
import {
  rebalancePortfolio,
  rebalancePortfolioV2,
  validateRebalanceInputs,
  validateRebalanceInputsV2,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  AccountType,
  AssetClass,
  Account,
  ClassTarget,
  Holding,
  RebalanceAsset,
  RebalanceInputs,
  RebalanceInputsV2,
  Security,
} from '@/lib/calculations/portfolioRebalancing';

function asset(
  id: string,
  ticker: string,
  currentShares: number,
  price: number,
  targetAllocation: number,
  accountType: AccountType = DEFAULT_ACCOUNT_TYPE,
  assetClass: AssetClass = DEFAULT_ASSET_CLASS,
): RebalanceAsset {
  return {
    id,
    ticker,
    currentShares,
    price,
    targetAllocation,
    accountType,
    assetClass,
  };
}

describe('validateRebalanceInputs', () => {
  it('requires at least one asset', () => {
    const errors = validateRebalanceInputs({ assets: [], deposit: 100, mode: 'whole', allowTaxableSelling: false, showPlacementAdvice: false });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('assets');
  });

  it('rejects negative deposits', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 10, 1)],
      deposit: -50,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field === 'deposit')).toBe(true);
  });

  it('rejects zero or negative prices', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 0, 1)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field.includes('price'))).toBe(true);
  });

  it('rejects negative shares', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', -1, 10, 1)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field.includes('shares'))).toBe(true);
  });

  it('rejects targets outside 0..100%', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 10, 1.5)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field.includes('target'))).toBe(true);
  });

  it('requires targets to sum to 100%', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 10, 0.5), asset('b', 'B', 1, 10, 0.4)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field === 'targetSum')).toBe(true);
  });

  it('accepts valid inputs', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 10, 0.5), asset('b', 'B', 1, 10, 0.5)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects non-finite deposit', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', 'A', 1, 10, 1)],
      deposit: Infinity,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.field === 'deposit')).toBe(true);
  });

  it('uses fallback label when ticker is blank', () => {
    const errors = validateRebalanceInputs({
      assets: [asset('a', '', 1, 0, 1)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });
    expect(errors.some(e => e.message.includes('Asset 1'))).toBe(true);
  });
});

describe('rebalancePortfolio — fractional mode', () => {
  it('spends entire deposit when no asset is post-dilution overweight', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 10, 10, 0.5), // value $100
        asset('b', 'B', 10, 10, 0.5), // value $100
      ],
      deposit: 100,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Targets: 50/50 of $300 = $150 each. A needs $50, B needs $50.
    expect(result.totalSpent).toBeCloseTo(100, 6);
    expect(result.cashLeftover).toBeCloseTo(0, 6);
    expect(result.assets[0].sharesToBuy).toBeCloseTo(5, 4);
    expect(result.assets[1].sharesToBuy).toBeCloseTo(5, 4);
  });

  it('directs full deposit to the underweight asset when overweight stays overweight', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 100, 10, 0.5), // value $1000 (overweight)
        asset('b', 'B', 0, 10, 0.5),   // value $0 (fully underweight)
      ],
      deposit: 100,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // N = $1100. Targets $550 each. A overweight → deficit 0. B deficit $550.
    // totalDeficit $550 > deposit $100 → scale = 100/550. B gets $100 = 10 shares.
    expect(result.assets[0].sharesToBuy).toBe(0);
    expect(result.assets[1].sharesToBuy).toBeCloseTo(10, 4);
    expect(result.totalSpent).toBeCloseTo(100, 4);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
  });

  it('gives all assets shares when deposit is large enough to flip overweight to underweight', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 100, 10, 0.5), // $1000
        asset('b', 'B', 0, 10, 0.5),   // $0
      ],
      deposit: 5000,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // New total = $6000. Target $3000 each. A deficit = $2000, B deficit = $3000.
    // Sum = $5000 = deposit. Perfect split.
    expect(result.assets[0].dollarsSpent).toBeCloseTo(2000, 4);
    expect(result.assets[1].dollarsSpent).toBeCloseTo(3000, 4);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
    expect(result.totalDriftAfter).toBeCloseTo(0, 6);
  });

  it('leaves cash when some asset stays overweight post-dilution (small deposit)', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 1000, 1, 0.5), // $1000
        asset('b', 'B', 500, 1, 0.5),  // $500
      ],
      deposit: 100,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // New total = $1600. Targets $800 each. A overweight by $200 → 0 buy.
    // B deficit = $300, buy 300 shares? But only $100 deposit.
    // B gets min($300, $100) / $1 = 100 shares, $100 spent, $0 leftover.
    expect(result.assets[0].sharesToBuy).toBe(0);
    expect(result.assets[1].sharesToBuy).toBeCloseTo(100, 4);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
  });
});

describe('rebalancePortfolio — whole-share mode', () => {
  it('floors deficit to whole shares and runs greedy pass', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 10, 100, 0.6),
        asset('b', 'B', 5, 60, 0.3),
        asset('c', 'C', 20, 70, 0.1),
      ],
      deposit: 1000,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // V=$2700, N=$3700. Targets A=$2220, B=$1110, C=$370.
    // Deficits A=$1220, B=$810, C=0. totalDeficit=$2030, scale≈0.4926.
    // ideal: A≈$601, B≈$399, C=0. Pass 1 floor: A=6 ($600), B=6 ($360), C=0. Spent $960.
    // Remaining $40 < $60 (B) < $100 (A). C overweight. Greedy makes no buys.
    expect(result.totalSpent).toBeLessThanOrEqual(1000 + 1e-6);
    expect(result.cashLeftover).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.assets[0].sharesToBuy)).toBe(true);
    expect(Number.isInteger(result.assets[1].sharesToBuy)).toBe(true);
    expect(Number.isInteger(result.assets[2].sharesToBuy)).toBe(true);
    expect(result.assets[2].sharesToBuy).toBe(0);
    expect(result.assets[0].sharesToBuy).toBe(6);
    expect(result.assets[1].sharesToBuy).toBe(6);
    expect(result.cashLeftover).toBeCloseTo(40, 4);
  });

  it('leaves some cash when deposit < cheapest underweight share price', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 0, 500, 1), // single asset, target 100%
      ],
      deposit: 300,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Deficit = $300 / $500 = 0 whole shares. $300 cash leftover.
    expect(result.assets[0].sharesToBuy).toBe(0);
    expect(result.cashLeftover).toBeCloseTo(300, 4);
  });

  it('improves drift after rebalancing', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 10, 10, 0.6),
        asset('b', 'B', 10, 10, 0.4),
      ],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.totalDriftAfter).toBeLessThanOrEqual(result.totalDriftBefore + 1e-9);
  });

  it('greedy pass fills most-underweight asset when deficit rounds to zero', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 0, 40, 0.5), // deficit $50 → 1 share (floor)
        asset('b', 'B', 0, 40, 0.5), // deficit $50 → 1 share (floor)
      ],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Pass 1: each gets 1 share ($40). Total = $80. Remaining = $20.
    // $20 < $40, no greedy buys possible. Leftover $20.
    expect(result.assets[0].sharesToBuy).toBe(1);
    expect(result.assets[1].sharesToBuy).toBe(1);
    expect(result.cashLeftover).toBeCloseTo(20, 4);
  });

  it('greedy pass breaks ties by lowest index', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 0, 30, 0.5),
        asset('b', 'B', 0, 30, 0.5),
      ],
      deposit: 90,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Pass 1: each gets 1 share ($30). Spent $60. Remaining $30.
    // Greedy iter 1: both equally underweight (-16.67%) → index 0 picked → A=2.
    // Remaining $0. Total spent $90.
    expect(result.assets[0].sharesToBuy).toBe(2);
    expect(result.assets[1].sharesToBuy).toBe(1);
    expect(result.totalSpent).toBeCloseTo(90, 4);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
  });

  it('greedy pass buys the most-underweight asset with remaining cash', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 0, 10, 0.5), // cheap
        asset('b', 'B', 0, 100, 0.5), // expensive
      ],
      deposit: 200,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // N = 200. Targets = $100 each.
    // Pass 1: A deficit $100 → 10 shares ($100). B deficit $100 → 1 share ($100).
    // Total = $200. Remaining = $0. Perfect.
    expect(result.assets[0].sharesToBuy).toBe(10);
    expect(result.assets[1].sharesToBuy).toBe(1);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
  });

  it('handles single asset correctly', () => {
    const result = rebalancePortfolio({
      assets: [asset('a', 'A', 5, 10, 1)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // All deposit goes to the single asset.
    expect(result.assets[0].sharesToBuy).toBe(10);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
    expect(result.totalDriftAfter).toBeCloseTo(0, 6);
  });

  it('handles zero deposit (no-op)', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 10, 10, 0.5),
        asset('b', 'B', 10, 10, 0.5),
      ],
      deposit: 0,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.totalSpent).toBe(0);
    expect(result.cashLeftover).toBe(0);
    result.assets.forEach(a => expect(a.sharesToBuy).toBe(0));
  });

  it('handles empty starting portfolio', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 0, 10, 0.6),
        asset('b', 'B', 0, 10, 0.4),
      ],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Should target 60/40: 6 shares of A, 4 of B.
    expect(result.assets[0].sharesToBuy).toBe(6);
    expect(result.assets[1].sharesToBuy).toBe(4);
    expect(result.cashLeftover).toBeCloseTo(0, 4);
  });
});

describe('rebalancePortfolio — validation & performance', () => {
  it('throws on invalid inputs', () => {
    expect(() => rebalancePortfolio({
      assets: [asset('a', 'A', 1, 10, 0.5)],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    })).toThrow(/Invalid inputs/);
  });

  it('completes 20-asset calculation in under 50ms', () => {
    const assets: RebalanceAsset[] = [];
    for (let i = 0; i < 20; i++) {
      assets.push(asset(`id-${i}`, `T${i}`, 10 + i, 50 + i, 1 / 20));
    }
    const inputs: RebalanceInputs = { assets, deposit: 10_000, mode: 'whole', allowTaxableSelling: false, showPlacementAdvice: false };

    const start = performance.now();
    const result = rebalancePortfolio(inputs);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    expect(result.assets).toHaveLength(20);
  });

  it('reports allocation before/after correctly', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 100, 1, 0.5), // $100 (100% of $100)
        asset('b', 'B', 0, 1, 0.5),   // $0 (0%)
      ],
      deposit: 100,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.assets[0].currentAllocation).toBeCloseTo(1, 6);
    expect(result.assets[1].currentAllocation).toBeCloseTo(0, 6);
    expect(result.totalValueBefore).toBeCloseTo(100, 6);
    expect(result.totalValueAfter).toBeCloseTo(200, 6);
  });

  it('fractional mode respects 4-decimal precision', () => {
    const result = rebalancePortfolio({
      assets: [asset('a', 'A', 0, 3, 1)],
      deposit: 10,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // 10/3 = 3.333... → 3.3333 at 4-decimal precision.
    expect(result.assets[0].sharesToBuy).toBeCloseTo(3.3333, 4);
  });
});

describe('rebalancePortfolio — selling & account types', () => {
  it('all-taxable with allowTaxableSelling=false matches legacy cash-flow behavior', () => {
    // Regression: this is the same scenario as the whole-share greedy test.
    // With no sells, taxEventDollars must be zero and no asset action is 'sell'.
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 10, 100, 0.6, 'taxable'),
        asset('b', 'B', 5, 60, 0.3, 'taxable'),
        asset('c', 'C', 20, 70, 0.1, 'taxable'),
      ],
      deposit: 1000,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.taxEventDollars).toBe(0);
    expect(result.assets.every(a => a.sharesToSell === 0)).toBe(true);
    expect(result.assets.every(a => a.dollarsReceived === 0)).toBe(true);
    expect(result.assets.every(a => a.action !== 'sell')).toBe(true);
    // Unchanged from legacy: A=6, B=6, C=0, leftover $40.
    expect(result.assets[0].sharesToBuy).toBe(6);
    expect(result.assets[1].sharesToBuy).toBe(6);
    expect(result.assets[2].sharesToBuy).toBe(0);
    expect(result.cashLeftover).toBeCloseTo(40, 4);
  });

  it('sells Roth overweight to fund another asset with zero deposit', () => {
    const result = rebalancePortfolio({
      assets: [
        // Roth overweight: $1500 current vs $1000 target at same total.
        asset('a', 'A', 150, 10, 0.5, 'tax-free', 'us-stock'),
        asset('b', 'B', 50, 10, 0.5, 'tax-free', 'bonds'),
      ],
      deposit: 0,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Total = $2000, targets $1000 each. A overweight by $500 → sell 50 shares.
    // Proceeds $500 → buy 50 shares of B.
    expect(result.taxEventDollars).toBe(0);
    expect(result.assets[0].action).toBe('sell');
    expect(result.assets[0].sharesToSell).toBeCloseTo(50, 4);
    expect(result.assets[0].dollarsReceived).toBeCloseTo(500, 4);
    expect(result.assets[1].action).toBe('buy');
    expect(result.assets[1].sharesToBuy).toBeCloseTo(50, 4);
    expect(result.totalDriftAfter).toBeCloseTo(0, 6);
  });

  it('mixed: Roth stock overweight + taxable bond underweight + small deposit', () => {
    const result = rebalancePortfolio({
      assets: [
        // Roth stocks at $1200, target 50% ⇒ $800 at $1600 new total. Overweight $400.
        asset('a', 'A', 120, 10, 0.5, 'tax-free', 'us-stock'),
        // Taxable bonds at $300, target 50% ⇒ $800. Underweight $500.
        asset('b', 'B', 30, 10, 0.5, 'taxable', 'bonds'),
      ],
      deposit: 100,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    // Roth sells 40 shares ($400). Taxable buys from $400 + $100 = $500 → 50 shares.
    expect(result.assets[0].action).toBe('sell');
    expect(result.assets[0].sharesToSell).toBeCloseTo(40, 4);
    expect(result.assets[0].dollarsReceived).toBeCloseTo(400, 4);
    expect(result.assets[1].action).toBe('buy');
    expect(result.assets[1].sharesToBuy).toBeCloseTo(50, 4);
    expect(result.taxEventDollars).toBe(0); // sale was in Roth
  });

  it('taxable overweight with allowTaxableSelling=false does not sell', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 150, 10, 0.5, 'taxable'),
        asset('b', 'B', 50, 10, 0.5, 'taxable'),
      ],
      deposit: 0,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.taxEventDollars).toBe(0);
    expect(result.assets.every(a => a.sharesToSell === 0)).toBe(true);
    expect(result.assets.every(a => a.action !== 'sell')).toBe(true);
  });

  it('taxable overweight with allowTaxableSelling=true sells and reports taxEventDollars', () => {
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 150, 10, 0.5, 'taxable', 'us-stock'),
        asset('b', 'B', 50, 10, 0.5, 'taxable', 'bonds'),
      ],
      deposit: 0,
      mode: 'fractional',
      allowTaxableSelling: true,
      showPlacementAdvice: false,
    });

    // Sell 50 A shares ($500 realized in taxable).
    expect(result.assets[0].action).toBe('sell');
    expect(result.assets[0].sharesToSell).toBeCloseTo(50, 4);
    expect(result.taxEventDollars).toBeCloseTo(500, 4);
    expect(result.assets[1].action).toBe('buy');
    expect(result.assets[1].sharesToBuy).toBeCloseTo(50, 4);
  });

  it('whole-share mode sell produces integer sharesToSell', () => {
    const result = rebalancePortfolio({
      assets: [
        // Overweight by $505: excess / price = 50.5 shares → floored to 50.
        asset('a', 'A', 200, 10, 0.5, 'tax-free'),
        asset('b', 'B', 99, 10, 0.5, 'tax-free'),
      ],
      deposit: 0,
      mode: 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(Number.isInteger(result.assets[0].sharesToSell)).toBe(true);
    expect(result.assets[0].sharesToSell).toBeGreaterThan(0);
    expect(Number.isInteger(result.assets[1].sharesToBuy)).toBe(true);
  });

  it('fractional mode sell can be non-integer', () => {
    // Total = 100*3 + 11*3 = $333. Targets $166.50 each.
    // A overweight by $133.50 ⇒ 44.5 shares — not an integer.
    const result = rebalancePortfolio({
      assets: [
        asset('a', 'A', 100, 3, 0.5, 'tax-free'),
        asset('b', 'B', 11, 3, 0.5, 'tax-free'),
      ],
      deposit: 0,
      mode: 'fractional',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    });

    expect(result.assets[0].sharesToSell).toBeCloseTo(44.5, 4);
    expect(Number.isInteger(result.assets[0].sharesToSell)).toBe(false);
  });

  // URL hash v1/v2/v3 codec tests live in test/lib/utils/portfolioRebalancingState.test.ts.
});

// ----------------------------------------------------------------------------
// Phase 2 — rebalancePortfolioV2 + validateRebalanceInputsV2
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
