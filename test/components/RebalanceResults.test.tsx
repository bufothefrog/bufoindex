/**
 * The rebalancer results on the shared vocabulary (StatGrid, KeyValueList,
 * DataTable, StatusAlert). The expected texts below were captured by
 * rendering the pre-rebuild RebalanceResults and PlacementAdviceCard with
 * these same fixed result and input objects, so they pin that every figure a
 * visitor reads is unchanged, the total drift tiles included ('percent-1'
 * keeps their one fixed decimal: "3.0%", "0.0%").
 */

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlacementAdviceCard } from '@/app/tools/portfolio-rebalancing-calculator/components/PlacementAdviceCard';
import { RebalanceResults } from '@/app/tools/portfolio-rebalancing-calculator/components/RebalanceResults';
import type { RebalanceInputsV2, RebalanceResultV2 } from '@/lib/calculations/portfolioRebalancing';

afterEach(cleanup);

const CUSTOM = [{ id: 'crypto', label: 'Crypto' }];

/** Whole shares, a sale, a blank ticker, a custom class, an empty account and portfolio drift. */
const WHOLE: RebalanceResultV2 = {
  setupMode: 'multi-shared',
  mode: 'whole',
  accounts: [
    {
      accountId: 'acc-roth', accountName: 'Roth IRA', accountType: 'tax-free',
      deposit: 0, depositUsed: 0, depositLeftover: 0,
      holdings: [
        { holdingId: 'h1', accountId: 'acc-roth', securityId: 's1', ticker: 'VTI', accountType: 'tax-free', assetClass: 'us-stock', price: 250.5, currentShares: 40, currentValue: 10020, action: 'sell', sharesToSell: 3, sharesToBuy: 0, dollarsSpent: 0, dollarsReceived: 751.5, newShares: 37, newValue: 9268.5 },
        { holdingId: 'h2', accountId: 'acc-roth', securityId: 's2', ticker: 'BND', accountType: 'tax-free', assetClass: 'bonds', price: 72.25, currentShares: 40, currentValue: 2890, action: 'buy', sharesToSell: 0, sharesToBuy: 1234.6, dollarsSpent: 722.5, dollarsReceived: 0, newShares: 1274.6, newValue: 3612.5 },
      ],
    },
    {
      accountId: 'acc-brok', accountName: '', accountType: 'taxable',
      deposit: 1000, depositUsed: 987.65, depositLeftover: 12.35,
      holdings: [
        { holdingId: 'h3', accountId: 'acc-brok', securityId: 's3', ticker: '', accountType: 'taxable', assetClass: 'crypto', price: 1234.5678, currentShares: 2, currentValue: 2469.1356, action: 'hold', sharesToSell: 0, sharesToBuy: 0, dollarsSpent: 0, dollarsReceived: 0, newShares: 2, newValue: 2469.1356 },
      ],
    },
    {
      accountId: 'acc-401k', accountName: 'Old 401k', accountType: 'tax-deferred',
      deposit: 0, depositUsed: 0, depositLeftover: 0, holdings: [],
    },
  ],
  totalValueBefore: 15000,
  totalValueAfter: 16000.4,
  totalDeposit: 1000,
  totalSpent: 987.65,
  totalReceived: 751.5,
  cashLeftover: 12.35,
  taxEventDollars: 751.5,
  totalDriftBefore: 0.125,
  totalDriftAfter: 0.03,
  classDrift: [
    { accountId: null, assetClass: 'us-stock', target: 0.6, currentValue: 0, currentAllocation: 0.6004, newValue: 0, newAllocation: 0.62, driftBefore: 0.0004, driftAfter: 0.02 },
    { accountId: null, assetClass: 'bonds', target: 0.2, currentValue: 0, currentAllocation: 0.15, newValue: 0, newAllocation: 0.2, driftBefore: -0.05, driftAfter: 0 },
    { accountId: null, assetClass: 'crypto', target: 0.2, currentValue: 0, currentAllocation: 0.2496, newValue: 0, newAllocation: 0.18, driftBefore: 0.0496, driftAfter: -0.02 },
    // Per-account rows were never shown; they still are not.
    { accountId: 'acc-roth', assetClass: 'us-stock', target: 0.6, currentValue: 0, currentAllocation: 0.7, newValue: 0, newAllocation: 0.65, driftBefore: 0.1, driftAfter: 0.05 },
  ],
};

/** Fractional shares, fully invested, no sale, no drift and no change in value. */
const FRACTIONAL: RebalanceResultV2 = {
  setupMode: 'single',
  mode: 'fractional',
  accounts: [
    {
      accountId: 'acc-1', accountName: 'Brokerage', accountType: 'taxable',
      deposit: 500, depositUsed: 500, depositLeftover: 0,
      holdings: [
        { holdingId: 'f1', accountId: 'acc-1', securityId: 's1', ticker: 'VTI', accountType: 'taxable', assetClass: 'us-stock', price: 250, currentShares: 1, currentValue: 250, action: 'buy', sharesToSell: 0, sharesToBuy: 1.234567, dollarsSpent: 308.64, dollarsReceived: 0, newShares: 2.234567, newValue: 558.64 },
        { holdingId: 'f2', accountId: 'acc-1', securityId: 's2', ticker: 'BND', accountType: 'taxable', assetClass: 'bonds', price: 70, currentShares: 0, currentValue: 0, action: 'buy', sharesToSell: 0, sharesToBuy: 2.7337142857, dollarsSpent: 191.36, dollarsReceived: 0, newShares: 2.7337142857, newValue: 191.36 },
      ],
    },
  ],
  totalValueBefore: 250,
  totalValueAfter: 250,
  totalDeposit: 500,
  totalSpent: 500,
  totalReceived: 0,
  cashLeftover: 0,
  taxEventDollars: 0,
  totalDriftBefore: 0,
  totalDriftAfter: 0,
  classDrift: [],
};

/** Bonds held twice in taxable accounts (one suggestion), a blank-ticker REIT, a Roth stock and a custom class. */
const INPUTS: RebalanceInputsV2 = {
  setupMode: 'multi-shared',
  securities: [
    { id: 's1', ticker: 'VTI', price: 250, assetClass: 'us-stock' },
    { id: 's2', ticker: 'BND', price: 70, assetClass: 'bonds' },
    { id: 's3', ticker: '', price: 10, assetClass: 'reits' },
    { id: 's4', ticker: 'BTC', price: 10, assetClass: 'crypto' },
  ],
  classTargets: [],
  accounts: [
    { id: 'a1', name: 'Brokerage', accountType: 'taxable', deposit: 0 },
    { id: 'a2', name: 'Roth', accountType: 'tax-free', deposit: 0 },
    { id: 'a3', name: 'Brokerage 2', accountType: 'taxable', deposit: 0 },
  ],
  holdings: [
    { id: 'x1', accountId: 'a1', securityId: 's2', shares: 1 },
    { id: 'x2', accountId: 'a3', securityId: 's2', shares: 1 },
    { id: 'x3', accountId: 'a1', securityId: 's3', shares: 1 },
    { id: 'x4', accountId: 'a2', securityId: 's1', shares: 1 },
    { id: 'x5', accountId: 'a1', securityId: 's4', shares: 1 },
  ],
  allowTaxableSelling: false,
  showPlacementAdvice: true,
  mode: 'whole',
  customAssetClasses: CUSTOM,
};

const tile = (name: string) => screen.getByRole('group', { name });

const headers = (table: HTMLElement) =>
  within(table).getAllByRole('columnheader').map((th) => [th.textContent, th.getAttribute('scope')]);

describe('RebalanceResults', () => {
  it('names every table with a caption and scopes its headers', () => {
    render(<RebalanceResults result={WHOLE} customAssetClasses={CUSTOM} />);

    expect(screen.getAllByRole('table').map((table) => table.querySelector('caption')?.textContent)).toEqual([
      'Trades in Roth IRA \u2014 Tax-Free',
      'Trades in Account \u2014 Taxable',
      'Trades in Old 401k \u2014 Tax-Deferred',
      'Portfolio allocation by asset class: target, current and after this plan',
    ]);

    const plan = screen.getByRole('table', { name: 'Trades in Roth IRA \u2014 Tax-Free' });
    expect(headers(plan)).toEqual([
      ['Holding', 'col'],
      ['Action', 'col'],
      ['Dollars', 'col'],
      ['Value After', 'col'],
    ]);
    expect(within(plan).getAllByRole('rowheader').map((th) => th.getAttribute('scope'))).toEqual(['row', 'row']);

    const drift = screen.getByRole('table', { name: /^Portfolio allocation by asset class/ });
    expect(headers(drift)).toEqual([
      ['Class', 'col'],
      ['Target', 'col'],
      ['Current', 'col'],
      ['After', 'col'],
    ]);
    expect(within(drift).getAllByRole('rowheader').map((th) => [th.textContent, th.getAttribute('scope')])).toEqual([
      ['US Stock', 'row'],
      ['Bonds', 'row'],
      ['Crypto', 'row'],
    ]);
  });

  it('shows the same plan figures as before for whole shares', () => {
    render(<RebalanceResults result={WHOLE} customAssetClasses={CUSTOM} />);

    expect(screen.getByRole('alert')).toBe(screen.getByTestId('tax-event-warning'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This plan sells $752 in taxable accounts. Review your cost basis to estimate the tax impact.'
    );

    expect(tile('Invested')).toHaveTextContent('Invested$988of $1,000 deposit');
    expect(tile('Cash leftover')).toHaveTextContent('Cash leftover$12Carry to next deposit');

    const roth = screen.getByTestId('account-plan-acc-roth');
    expect(within(roth).getByRole('heading', { name: 'Roth IRA \u2014 Tax-Free' })).toBeInTheDocument();
    expect(within(roth).getAllByRole('term').map((dt) => dt.textContent)).toEqual(['Deposit used', 'Leftover']);
    expect(within(roth).getAllByRole('definition').map((dd) => dd.textContent)).toEqual(['$0', '$0']);
    expect(screen.getByTestId('plan-row-h1').textContent).toBe('VTI$251/share \u00b7 US StockSell 3-$752$9,269');
    expect(screen.getByTestId('plan-row-h2').textContent).toBe('BND$72/share \u00b7 BondsBuy 1,235$723$3,613');
    expect(within(roth).getByRole('table').querySelector('tfoot')?.textContent).toBe('Deposit$0');

    const brokerage = screen.getByTestId('account-plan-acc-brok');
    expect(within(brokerage).getByRole('heading', { name: 'Account \u2014 Taxable' })).toBeInTheDocument();
    expect(within(brokerage).getAllByRole('definition').map((dd) => dd.textContent)).toEqual(['$988', '$12']);
    expect(screen.getByTestId('plan-row-h3').textContent).toBe('\u2014$1,235/share \u00b7 Crypto\u2014\u2014$2,469');
    expect(within(brokerage).getByRole('table').querySelector('tfoot')?.textContent).toBe('Deposit$1,000');

    const empty = screen.getByTestId('account-plan-acc-401k');
    expect(within(empty).getByRole('heading', { name: 'Old 401k \u2014 Tax-Deferred' })).toBeInTheDocument();
    expect(within(empty).getByRole('cell', { name: 'No holdings in this account.' })).toBeInTheDocument();
    expect(within(empty).getByRole('table').querySelector('tfoot')).toBeNull();
  });

  it('shows the same drift figures as before', () => {
    render(<RebalanceResults result={WHOLE} customAssetClasses={CUSTOM} />);

    expect(screen.getByRole('heading', { name: 'Portfolio Drift by Class' })).toBeInTheDocument();
    expect(screen.getByTestId('class-drift-table')).toContainElement(screen.getByTestId('drift-row-portfolio-bonds'));
    expect(screen.getByTestId('drift-row-portfolio-us-stock').textContent).toBe('US Stock60.0%60.0%on target62.0%+2.0%');
    expect(screen.getByTestId('drift-row-portfolio-bonds').textContent).toBe('Bonds20.0%15.0%-5.0%20.0%on target');
    expect(screen.getByTestId('drift-row-portfolio-crypto').textContent).toBe('Crypto20.0%25.0%+5.0%18.0%-2.0%');
    expect(within(screen.getByTestId('class-drift-table')).getAllByRole('row')).toHaveLength(4);

    expect(screen.getByRole('heading', { name: 'Drift Reduction' })).toBeInTheDocument();
    expect(tile('Total drift before')).toHaveTextContent('Total drift before12.5%');
    expect(tile('Total drift after')).toHaveTextContent('Total drift after3.0%');
    expect(screen.getByText(/^This deposit closes/).textContent).toBe(
      'This deposit closes 76% of the gap between your portfolio and its target allocation.'
    );

    expect(screen.getByText(/^Starting portfolio value:/).textContent).toBe(
      'Starting portfolio value: $15,000 \u2192 After: $16,000'
    );
  });

  it('shows the same figures as before for fractional shares, a full deposit and no drift', () => {
    render(<RebalanceResults result={FRACTIONAL} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(tile('Invested')).toHaveTextContent('Invested$500of $500 deposit');
    expect(tile('Cash leftover')).toHaveTextContent('Cash leftover$0Fully invested');
    expect(screen.getByRole('heading', { name: 'Brokerage \u2014 Taxable' })).toBeInTheDocument();
    expect(screen.getByTestId('plan-row-f1').textContent).toBe('VTI$250/share \u00b7 US StockBuy 1.2346$309$559');
    expect(screen.getByTestId('plan-row-f2').textContent).toBe('BND$70/share \u00b7 BondsBuy 2.7337$191$191');

    expect(screen.queryByRole('heading', { name: 'Portfolio Drift by Class' })).not.toBeInTheDocument();
    expect(tile('Total drift before')).toHaveTextContent('Total drift before0.0%');
    expect(tile('Total drift after')).toHaveTextContent('Total drift after0.0%');
    expect(screen.queryByText(/This deposit closes/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Starting portfolio value:/).textContent).toBe('Starting portfolio value: $250');
  });
});

describe('PlacementAdviceCard', () => {
  it('shows the same suggestions as before, one per security and account type', () => {
    render(<PlacementAdviceCard inputs={INPUTS} />);

    expect(screen.getByRole('heading', { name: 'Tax-Efficient Placement' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'BND (Bonds, in taxable) \u2192 consider moving to tax-deferred.Bonds generate ordinary-income distributions \u2014 shelter them in a tax-deferred account.',
      '\u2014 (REITs, in taxable) \u2192 consider moving to tax-deferred.REIT dividends are taxed as ordinary income \u2014 shelter them in a tax-deferred account.',
    ]);
  });

  it('says so when every holding is already well placed', () => {
    render(<PlacementAdviceCard inputs={{ ...INPUTS, holdings: [INPUTS.holdings[3]] }} />);

    expect(screen.getByTestId('placement-advice-card')).toHaveTextContent(
      'Tax-Efficient PlacementYour holdings are already in tax-efficient accounts.'
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
