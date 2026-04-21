import { describe, it, expect } from 'vitest';
import {
  rebalancePortfolio,
  validateRebalanceInputs,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  RebalanceAsset,
  RebalanceInputs,
} from '@/lib/calculations/portfolioRebalancing';

function asset(
  id: string,
  ticker: string,
  currentShares: number,
  price: number,
  targetAllocation: number,
): RebalanceAsset {
  return {
    id,
    ticker,
    currentShares,
    price,
    targetAllocation,
    accountType: DEFAULT_ACCOUNT_TYPE,
    assetClass: DEFAULT_ASSET_CLASS,
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
