/**
 * Regression tests for loading the Portfolio Rebalancer from a URL hash.
 *
 * Every guided-flow handoff (portfolioLink), the overview's "Open the
 * rebalancer" link, and the rebalancer's own share links arrive with a hash.
 * Two bugs used to break that path:
 *   1. The codec omitted an empty custom-class list, so the store held
 *      `customAssetClasses: undefined` and five selectors returned a fresh `[]`
 *      on every read. useSyncExternalStore never settled and React threw
 *      "Maximum update depth exceeded" (minified error #185).
 *   2. loadFromUrl cleared the result without calculating, so no results
 *      appeared until the user pressed Rebalance.
 */

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioRebalancingCalculator } from '@/app/tools/portfolio-rebalancing-calculator/components/PortfolioRebalancingCalculator';
import { TargetsCard } from '@/app/tools/portfolio-rebalancing-calculator/components/TargetsCard';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { encodeRebalancingToUrlHash } from '@/lib/utils/portfolioRebalancingState';
import { portfolioLink } from '@/lib/profile/links';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';

const store = usePortfolioRebalancingStore;

function hashOf(link: string): string {
  return link.slice(link.indexOf('#'));
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  store.getState().reset();
  window.location.hash = '';
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  consoleError.mockRestore();
});

function loggedSnapshotWarning(): boolean {
  return consoleError.mock.calls.some((args: unknown[]) =>
    args.some((a: unknown) => typeof a === 'string' && /getSnapshot should be cached/.test(a)),
  );
}

describe('PortfolioRebalancingCalculator loaded from a hash', () => {
  it('renders the guided-flow handoff from portfolioLink and runs the rebalance', () => {
    window.location.hash = hashOf(portfolioLink(getDefaultFinancialProfile()));

    expect(() => {
      render(<PortfolioRebalancingCalculator />);
    }).not.toThrow();

    const { inputs, result, hasCalculatedOnce, errors } = store.getState();
    // The default profile puts newCashThisMonth = $1,000 into the Brokerage
    // account and maps the 80/20 mix to 60/20/20 targets.
    expect(inputs.customAssetClasses).toEqual([]);
    expect(inputs.accounts.find((a) => a.name === 'Brokerage')?.deposit).toBe(1000);
    expect(errors).toEqual([]);
    expect(hasCalculatedOnce).toBe(true);
    // Holdings are the store's worked example: $8,775 before the deposit.
    expect(result?.totalValueBefore).toBe(8775);
    expect(result?.totalDeposit).toBe(1000);
    expect(screen.getAllByText('Drift Reduction').length).toBeGreaterThan(0);
    expect(loggedSnapshotWarning()).toBe(false);
  });

  it('reloads a share link the rebalancer writes for itself (no custom classes)', () => {
    window.location.hash = '#' + encodeRebalancingToUrlHash(store.getState().inputs);

    expect(() => {
      render(<PortfolioRebalancingCalculator />);
    }).not.toThrow();

    expect(store.getState().result?.totalValueBefore).toBe(8775);
    expect(store.getState().result?.totalDeposit).toBe(2000);
    expect(loggedSnapshotWarning()).toBe(false);
  });
});

describe('TargetsCard with an absent custom-class list', () => {
  it('renders without looping when customAssetClasses is undefined', () => {
    act(() => {
      store.setState((s) => ({ inputs: { ...s.inputs, customAssetClasses: undefined } }));
    });

    expect(() => {
      render(<TargetsCard />);
    }).not.toThrow();
    expect(loggedSnapshotWarning()).toBe(false);
  });
});
