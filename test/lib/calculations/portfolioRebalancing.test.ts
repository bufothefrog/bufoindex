import { describe, it, expect } from 'vitest';
import {
  rebalancePortfolio,
  validateRebalanceInputs,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  AccountType,
  AssetClass,
  RebalanceAsset,
  RebalanceInputs,
} from '@/lib/calculations/portfolioRebalancing';
import {
  encodeRebalancingToUrlHash,
  decodeRebalancingFromUrlHash,
} from '@/lib/utils/portfolioRebalancingState';

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

  it('URL hash v1 decodes to defaults for new fields', () => {
    // Hand-built v1 payload: no c/k/s/p fields.
    const v1Payload = {
      v: 1,
      d: 500,
      a: [
        { t: 'VTI', s: 10, p: 100, a: 0.6 },
        { t: 'BND', s: 20, p: 50, a: 0.4 },
      ],
    };
    const json = JSON.stringify(v1Payload);
    const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const decoded = decodeRebalancingFromUrlHash(b64);
    expect(decoded).not.toBeNull();
    expect(decoded!.allowTaxableSelling).toBe(false);
    expect(decoded!.showPlacementAdvice).toBe(false);
    expect(decoded!.deposit).toBe(500);
    decoded!.assets.forEach(a => {
      expect(a.accountType).toBe(DEFAULT_ACCOUNT_TYPE);
      expect(a.assetClass).toBe(DEFAULT_ASSET_CLASS);
    });
  });

  it('URL hash v2 roundtrip preserves all fields', () => {
    const inputs: RebalanceInputs = {
      assets: [
        asset('id-1', 'VTI', 10, 100, 0.6, 'tax-free', 'us-stock'),
        asset('id-2', 'VXUS', 5, 50, 0.2, 'taxable', 'intl-stock'),
        asset('id-3', 'BND', 20, 80, 0.2, 'tax-deferred', 'bonds'),
      ],
      deposit: 1234,
      mode: 'fractional',
      allowTaxableSelling: true,
      showPlacementAdvice: true,
    };

    const hash = encodeRebalancingToUrlHash(inputs);
    expect(hash.length).toBeGreaterThan(0);
    const decoded = decodeRebalancingFromUrlHash(hash);

    expect(decoded).not.toBeNull();
    expect(decoded!.deposit).toBe(1234);
    expect(decoded!.mode).toBe('fractional');
    expect(decoded!.allowTaxableSelling).toBe(true);
    expect(decoded!.showPlacementAdvice).toBe(true);
    expect(decoded!.assets).toHaveLength(3);

    // ids are regenerated by the decoder; match on ticker + structural fields.
    const byTicker = new Map(decoded!.assets.map(a => [a.ticker, a]));
    expect(byTicker.get('VTI')?.accountType).toBe('tax-free');
    expect(byTicker.get('VTI')?.assetClass).toBe('us-stock');
    expect(byTicker.get('VTI')?.currentShares).toBe(10);
    expect(byTicker.get('VTI')?.price).toBe(100);
    expect(byTicker.get('VTI')?.targetAllocation).toBeCloseTo(0.6, 10);

    expect(byTicker.get('VXUS')?.accountType).toBe('taxable');
    expect(byTicker.get('VXUS')?.assetClass).toBe('intl-stock');

    expect(byTicker.get('BND')?.accountType).toBe('tax-deferred');
    expect(byTicker.get('BND')?.assetClass).toBe('bonds');
  });
});
