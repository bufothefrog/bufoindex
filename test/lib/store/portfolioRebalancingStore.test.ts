/**
 * The portfolio rebalancer's run store on the shared factory
 * (createCalculatorStore): the profile in, the rebalance out, in-thread and
 * with no delay; invalid inputs keep the last results, marked stale (O17);
 * edits recalculate on the next submit; nothing is persisted here. The
 * entity actions are pure reducers now (test/lib/calculators/portfolio/
 * reducers.test.ts).
 *
 * Portfolio value of the default profile, hand-computed:
 *   Roth IRA:   10 VTI x $250 = $2,500 ; 5 BND x $75 = $375   -> $2,875
 *   Brokerage:  20 VTI x $250 = $5,000 ; 15 VXUS x $60 = $900 -> $5,900
 *   Total holdings value: $8,775 ; deposits: $0 + $1,000 = $1,000
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { rebalancePortfolioV2 } from '@/lib/calculations/portfolioRebalancing';
import {
  portfolioWrites,
  setClassTarget,
  updateHolding,
  type Portfolio,
} from '@/lib/calculators/portfolio/reducers';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
// Side-effect import: registers the toBeCloseToCurrency custom matcher.
import '@/test/utils/financial-test-helpers';

const store = usePortfolioRebalancingStore;
const profile = () => useProfileStore.getState().profile;

/** Applies a reducer to the profile's portfolio lists, as the editors do. */
function edit(reduce: (portfolio: Portfolio) => Portfolio) {
  const before = profile().portfolio;
  useProfileStore.getState().setValues(portfolioWrites(before, reduce(before)));
}

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  store.getState().reset();
});

describe('usePortfolioRebalancingStore', () => {
  it('starts with no inputs and no results, and persists nothing', () => {
    const { inputs, results, errors, hasCalculatedOnce } = store.getState();
    expect(inputs).toBeNull();
    expect(results).toBeNull();
    expect(errors).toEqual({});
    expect(hasCalculatedOnce).toBe(false);
    store.getState().submit(profile());
    expect(Object.keys(localStorage).filter((key) => key !== 'bufo-profile')).toEqual([]);
  });

  it('rebalances the profile in-thread as soon as it is submitted', () => {
    store.getState().submit(profile());
    const { inputs, results, errors, hasCalculatedOnce } = store.getState();
    expect(errors).toEqual({});
    expect(hasCalculatedOnce).toBe(true);
    expect(results).toEqual(rebalancePortfolioV2(inputs!));
    expect(results!.totalValueBefore).toBe(8775);
    expect(results!.totalDeposit).toBe(1000);
    expect(results!.accounts).toHaveLength(2);
    expect(results!.mode).toBe('whole');
    // Money conservation: after = before + deposit - uninvested cash.
    expect(results!.totalValueAfter).toBeCloseTo(8775 + 1000 - results!.cashLeftover, 6);
  });

  it('keeps the last results, marked stale, when custom targets do not sum to 100%', () => {
    store.getState().submit(profile());
    const before = store.getState().results;
    useProfileStore.getState().setValues([{ path: 'investing.targetMix', value: 'custom' }]);
    edit((p) => setClassTarget(p, 'us-stock', 0.9)); // sum now 1.30
    store.getState().submit(profile());
    const { results, errors, stale } = store.getState();
    expect(results).toBe(before);
    expect(stale).toBe(true);
    expect(errors).toEqual({ 'portfolio.classTargets': 'Target allocations must sum to 100% (currently 130.00%).' });
  });

  it('recalculates an edit on the next submit', () => {
    store.getState().submit(profile());
    // Doubling the Roth VTI position adds 10 x $250 = $2,500 -> $11,275.
    edit((p) => updateHolding(p, 'hld-roth-vti', { shares: 20 }));
    store.getState().submit(profile());
    expect(store.getState().results?.totalValueBefore).toBe(8775 + 2500);
    expect(store.getState().stale).toBe(false);
  });

  it('reuses the results for the same inputs', () => {
    store.getState().submit(profile());
    const first = store.getState().results;
    // The age does not feed the rebalance.
    useProfileStore.getState().setValues([{ path: 'person.age', value: 44 }]);
    store.getState().submit(profile());
    expect(store.getState().results).toBe(first);
  });

  it('reset clears the run state', () => {
    store.getState().submit(profile());
    store.getState().reset();
    expect(store.getState().results).toBeNull();
    expect(store.getState().hasCalculatedOnce).toBe(false);
  });
});
