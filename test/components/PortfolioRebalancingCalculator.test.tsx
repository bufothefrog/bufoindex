/**
 * The portfolio rebalancer on the shared calculator page: default inputs on
 * the server and before hydration, with no results until the profile store
 * has hydrated (plan section 5); live results from the profile (an old
 * share-link hash is stripped and ignored); edits written through to the
 * profile through the generated sections and the two custom editors;
 * invalid targets keeping the last results, marked out of date; and bug 2:
 * an account name outside Latin-1 survives a remount and a reload, because
 * the profile, not the hash, is the record.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PortfolioRebalancingCalculatorPage, { metadata } from '@/app/tools/portfolio-rebalancing-calculator/page';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const store = usePortfolioRebalancingStore;
const profile = () => useProfileStore.getState().profile;
const results = () => screen.getByRole('region', { name: 'Rebalancing results' });
const section = (name: string) => screen.getByRole('region', { name });
const inputIn = (testId: string) => within(screen.getByTestId(testId)).getByRole('textbox') as HTMLInputElement;

/** A name btoa could not encode: the old share hash went stale on it (bug 2). */
const NON_LATIN1_NAME = '\u00c9pargne \u9000\u4f11 \u{1F4B0}';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearBrowserState();
  resetProfileStore();
  store.getState().reset();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  vi.restoreAllMocks();
});

describe('PortfolioRebalancingCalculator page', () => {
  it('takes its title and description from the registry', () => {
    expect(metadata).toEqual({
      title: 'Portfolio Rebalancer',
      description:
        'Compute the trades needed to bring a multi-account portfolio back to its target allocation, with custom asset classes and account-placement guidance.',
    });
  });

  it('renders the default inputs on the server, with no results', () => {
    resetProfileStore({ hydrated: false });
    const html = renderToString(<PortfolioRebalancingCalculatorPage />);
    expect(html).toContain('Portfolio Rebalancing Calculator');
    expect(html).toContain('Target allocation');
    expect(html).toContain('Roth IRA');
    expect(html).toContain('Loading results');
    expect(html).not.toContain('Drift Reduction');
  });

  it('shows no results before hydration, then the rebalance of the profile', () => {
    resetProfileStore({ hydrated: false });
    render(<PortfolioRebalancingCalculatorPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Portfolio Rebalancing Calculator' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading results' })).toBeInTheDocument();
    expect(screen.queryByText('Drift Reduction')).not.toBeInTheDocument();
    expect(store.getState().results).toBeNull();

    act(() => useProfileStore.setState({ hasHydrated: true }));
    expect(screen.queryByRole('status', { name: 'Loading results' })).not.toBeInTheDocument();
    // The default profile: $8,775 held, $1,000 of new cash in the Brokerage.
    expect(store.getState().results?.totalValueBefore).toBe(8775);
    expect(store.getState().results?.totalDeposit).toBe(1000);
    expect(results()).toHaveTextContent('Drift Reduction');
    expect(screen.getByTestId('placement-advice-card')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('has live results and no Rebalance button', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    expect(screen.queryByRole('button', { name: /^Rebalance$|Calculate/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /See results/ })).toBeInTheDocument();
  });

  it('ignores an old share-link hash and shows the profile', () => {
    window.history.replaceState(null, '', '/tools/portfolio-rebalancing-calculator#eyJ2IjozfQ');
    render(<PortfolioRebalancingCalculatorPage />);
    expect(window.location.hash).toBe('');
    expect(store.getState().results?.totalDeposit).toBe(1000);
  });

  it('asks the four sections, the target mix first, with the settings folded into one line', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    const targets = section('Target allocation');
    expect(within(targets).getByRole('radio', { name: /80% stocks, 20% bonds/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(targets).getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
    expect(within(section('Accounts')).getByRole('group', { name: 'Roth IRA' })).toBeInTheDocument();
    expect(within(section('Holdings')).getByRole('region', { name: 'Brokerage holdings' })).toBeInTheDocument();
    expect(section('Settings')).toHaveTextContent('Whole shares, no selling in taxable, placement advice shown');
  });

  it('keeps the account and holding test ids', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    expect(inputIn('account-name-0').value).toBe('Roth IRA');
    expect(inputIn('account-name-1').value).toBe('Brokerage');
    expect(inputIn('holding-price-0').value).toBe('250');
    expect(inputIn('holding-price-3').value).toBe('60');
  });

  it('writes new cash through to the profile and rebalances it', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    const roth = within(section('Accounts')).getByRole('group', { name: 'Roth IRA' });
    fireEvent.change(within(roth).getByRole('textbox', { name: 'New cash' }), { target: { value: '500' } });

    expect(profile().portfolio.accounts[0].deposit).toBe(500);
    expect(profile().provided).toContain('portfolio.accounts');
    expect(store.getState().results?.totalDeposit).toBe(1500);
  });

  it('edits a holding through the holdings editor', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    // Doubling the Roth VTI position adds 10 x $250 = $2,500.
    fireEvent.change(inputIn('holding-shares-0'), { target: { value: '20' } });
    expect(profile().portfolio.holdings[0].shares).toBe(20);
    expect(profile().provided).toContain('portfolio.holdings');
    expect(store.getState().results?.totalValueBefore).toBe(8775 + 2500);
  });

  it('adds a holding to an account with its own blank security', async () => {
    const user = userEvent.setup();
    render(<PortfolioRebalancingCalculatorPage />);
    await user.click(screen.getByTestId('add-holding-1'));
    const { holdings, securities } = profile().portfolio;
    expect(holdings[4]).toEqual({ id: 'hld-5', accountId: 'acc-brok', securityId: 'sec-4', shares: 0 });
    expect(securities[3]).toEqual({ id: 'sec-4', ticker: '', price: 0, assetClass: 'other' });
    expect(profile().provided).toEqual(expect.arrayContaining(['portfolio.holdings', 'portfolio.securities']));
  });

  it('removes an account after confirming, with its holdings and the securities only it held', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PortfolioRebalancingCalculatorPage />);
    await user.click(within(section('Accounts')).getByRole('button', { name: 'Remove Roth IRA' }));

    expect(confirm).toHaveBeenCalledWith('Delete Roth IRA? Its holdings will be removed too.');
    const { accounts, holdings, securities } = profile().portfolio;
    expect(accounts.map((a) => a.id)).toEqual(['acc-brok']);
    expect(holdings.map((h) => h.id)).toEqual(['hld-brok-vti', 'hld-brok-vxus']);
    expect(securities.map((s) => s.id)).toEqual(['sec-vti', 'sec-vxus']);
    // The last account cannot be removed.
    expect(within(section('Accounts')).getByRole('button', { name: 'Remove Brokerage' })).toBeDisabled();
    expect(store.getState().results?.totalValueBefore).toBe(5900);
  });

  it('shows the class targets for the custom mix and keeps the last results while they miss 100%', async () => {
    const user = userEvent.setup();
    render(<PortfolioRebalancingCalculatorPage />);
    expect(screen.queryByRole('group', { name: 'Target allocation' })).not.toBeInTheDocument();
    await user.click(within(section('Target allocation')).getByRole('radio', { name: /Custom/ }));

    expect(profile().investing.targetMix).toBe('custom');
    const editor = screen.getByRole('group', { name: 'Target allocation' });
    expect(within(editor).getByTestId('target-sum-portfolio')).toHaveTextContent('Targets total: 100.0%');
    fireEvent.change(within(editor).getByRole('textbox', { name: 'US Stock target' }), { target: { value: '90' } });

    expect(profile().portfolio.classTargets[0].target).toBeCloseTo(0.9, 10);
    expect(within(editor).getByTestId('target-sum-portfolio')).toHaveTextContent('Targets total: 130.0%');
    expect(editor).toHaveAccessibleDescription('Target allocations must sum to 100% (currently 130.00%).');
    const status = screen.getAllByRole('status').find((node) => node.textContent?.includes('Results out of date'));
    expect(status).toBeDefined();
    expect(results()).toHaveTextContent('Drift Reduction');
  });

  it('starts the custom targets from the preset in use (60/40 shown as 45/15/40)', async () => {
    const user = userEvent.setup();
    useProfileStore.getState().setValues([{ path: 'investing.targetMix', value: '60-40' }]);
    render(<PortfolioRebalancingCalculatorPage />);
    const before = store.getState().inputs?.classTargets;
    await user.click(within(section('Target allocation')).getByRole('radio', { name: /Custom/ }));

    const editor = screen.getByRole('group', { name: 'Target allocation' });
    expect(within(editor).getByRole('textbox', { name: 'US Stock target' })).toHaveValue('45.0');
    expect(within(editor).getByRole('textbox', { name: 'Bonds target' })).toHaveValue('40.0');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    // The rebalance aims at the same targets as before the switch.
    expect(store.getState().inputs?.classTargets).toEqual(before);
  });

  it('adds a custom asset class from the targets editor', async () => {
    const user = userEvent.setup();
    useProfileStore.getState().setValues([{ path: 'investing.targetMix', value: 'custom' }]);
    render(<PortfolioRebalancingCalculatorPage />);
    await user.type(screen.getByRole('combobox', { name: 'Add asset class' }), 'Crypto{Enter}');

    expect(profile().portfolio.customAssetClasses).toEqual([{ id: 'cac-1', label: 'Crypto' }]);
    const { classTargets } = profile().portfolio;
    expect(classTargets[classTargets.length - 1]).toEqual({ accountId: null, assetClass: 'cac-1', target: 0 });
    expect(screen.getByTestId('target-row-portfolio-cac-1')).toHaveTextContent('Crypto');
  });

  it('hides the placement advice when the setting is off', () => {
    useProfileStore.getState().setValues([{ path: 'assumptions.portfolio.showPlacementAdvice', value: false }]);
    render(<PortfolioRebalancingCalculatorPage />);
    expect(results()).toHaveTextContent('Drift Reduction');
    expect(screen.queryByTestId('placement-advice-card')).not.toBeInTheDocument();
  });
});

describe('bug 2: a non-Latin-1 account name persists', () => {
  it('survives a remount and a reload, read back from the saved profile', async () => {
    const { unmount } = render(<PortfolioRebalancingCalculatorPage />);
    fireEvent.change(inputIn('account-name-0'), { target: { value: NON_LATIN1_NAME } });
    expect(profile().portfolio.accounts[0].name).toBe(NON_LATIN1_NAME);
    unmount();

    render(<PortfolioRebalancingCalculatorPage />);
    expect(inputIn('account-name-0').value).toBe(NON_LATIN1_NAME);
    cleanup();

    // A reload: the in-memory profile starts from the defaults, then the
    // persisted one is read back.
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    useProfileStore.setState({ profile: getDefaultFinancialProfile(), hasHydrated: false });
    store.getState().reset();
    window.localStorage.setItem(PROFILE_STORAGE_KEY, saved!);
    await act(() => useProfileStore.persist.rehydrate());

    render(<PortfolioRebalancingCalculatorPage />);
    expect(inputIn('account-name-0').value).toBe(NON_LATIN1_NAME);
    expect(store.getState().inputs?.accounts[0].name).toBe(NON_LATIN1_NAME);
    expect(window.location.hash).toBe('');
  });
});
