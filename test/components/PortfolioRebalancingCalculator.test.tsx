/**
 * The portfolio rebalancer on the shared calculator page: default inputs on
 * the server and before hydration, with no results until the profile store
 * has hydrated (plan section 5); live results from the profile (an old
 * share-link hash is stripped and ignored); edits written through to the
 * profile through the account list, the holdings editor and the new-cash
 * card; the empty state while every account is a typed balance;
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
import { NO_REBALANCED_ACCOUNT_MESSAGE } from '@/lib/calculators/portfolio/definition';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { PROFILE_STORAGE_KEY, useProfileStore } from '@/lib/store/profileStore';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

const store = usePortfolioRebalancingStore;
const profile = () => useProfileStore.getState().profile;
const results = () => screen.getByRole('region', { name: 'Rebalancing results' });
const section = (name: string) => screen.getByRole('region', { name });
const ACCOUNTS_TITLE = 'What do you have saved and invested?';
const NEW_CASH_TITLE = 'New cash this month';
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
    expect(html).toContain('Brokerage (taxable)');
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
    // The default profile: the brokerage holds 20 x $375 + 15 x $85 = $8,775
    // and takes its normal $500 a month; the typed 401(k) is not rebalanced.
    expect(store.getState().results?.totalValueBefore).toBe(8775);
    expect(store.getState().results?.totalDeposit).toBe(500);
    expect(store.getState().inputs?.accounts.map((a) => a.id)).toEqual(['acc-brok']);
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
    expect(store.getState().results?.totalDeposit).toBe(500);
  });

  it('asks the five sections, the target mix first, with the settings folded into one line', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    const targets = section('Target allocation');
    expect(within(targets).getByRole('radio', { name: /80% stocks, 20% bonds/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(targets).getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
    const accounts = section(ACCOUNTS_TITLE);
    expect(within(accounts).getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('16,225');
    expect(within(accounts).getByText('$8,775 from 3 holdings')).toBeInTheDocument();
    expect(within(section('Holdings')).getByRole('region', { name: 'Brokerage (taxable) holdings' })).toBeInTheDocument();
    expect(within(section('Holdings')).getByRole('region', { name: '401(k) or similar holdings' })).toBeInTheDocument();
    expect(within(section(NEW_CASH_TITLE)).getByRole('group', { name: 'Brokerage (taxable)' })).toHaveTextContent(
      'Normal contributions: $500'
    );
    expect(section(NEW_CASH_TITLE)).toHaveTextContent('Not rebalanced: 401(k) or similar (no holdings entered).');
    expect(section('Settings')).toHaveTextContent('Whole shares, no selling in taxable, placement advice shown');
  });

  it('keeps the holding test ids', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    expect(inputIn('holding-price-0').value).toBe('375');
    expect(inputIn('holding-price-1').value).toBe('85');
    expect(inputIn('holding-shares-0').value).toBe('20');
  });

  it('names each holding input with its account', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    expect(screen.getByRole('textbox', { name: 'Price / share, Brokerage (taxable) holding 1' })).toBe(
      inputIn('holding-price-0')
    );
    expect(screen.getByRole('textbox', { name: 'Shares, Brokerage (taxable) holding 2' })).toBe(inputIn('holding-shares-1'));
  });

  it('writes a custom new cash figure to portfolio.newCash and rebalances it', async () => {
    const user = userEvent.setup();
    render(<PortfolioRebalancingCalculatorPage />);
    const brokerage = () => within(section(NEW_CASH_TITLE)).getByRole('group', { name: 'Brokerage (taxable)' });
    await user.click(within(brokerage()).getByRole('radio', { name: 'Custom' }));
    // Custom starts from the normal contributions.
    expect(profile().portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 500 }]);
    fireEvent.change(within(brokerage()).getByRole('textbox', { name: 'Brokerage (taxable)' }), {
      target: { value: '1500' },
    });

    expect(profile().portfolio.newCash).toEqual([{ id: 'acc-brok', amount: 1500 }]);
    expect(profile().provided).toContain('portfolio.newCash');
    expect(store.getState().results?.totalDeposit).toBe(1500);

    await user.click(within(brokerage()).getByRole('radio', { name: 'Auto' }));
    expect(profile().portfolio.newCash).toEqual([]);
    expect(store.getState().results?.totalDeposit).toBe(500);
  });

  it('names two unnamed brokerages 1 and 2 in every card, visible text included', async () => {
    const user = userEvent.setup();
    render(<PortfolioRebalancingCalculatorPage />);
    await user.click(within(section(ACCOUNTS_TITLE)).getByRole('button', { name: 'Add account' }));
    const [first, second] = profile().portfolio.accounts.filter((a) => a.kind === 'brokerage');

    // The account list: the visible line and the controls.
    expect(within(screen.getByTestId(`account-${first.id}`)).getByText('Brokerage (taxable) 1')).toBeInTheDocument();
    expect(within(screen.getByTestId(`account-${second.id}`)).getByText('Brokerage (taxable) 2')).toBeInTheDocument();
    expect(within(section(ACCOUNTS_TITLE)).getByRole('button', { name: 'Done editing Brokerage (taxable) 2' })).toBeInTheDocument();
    // The holdings card: the regions, their headings and the holding controls.
    const holdings = section('Holdings');
    const one = within(holdings).getByRole('region', { name: 'Brokerage (taxable) 1 holdings' });
    expect(within(one).getByText('Brokerage (taxable) 1')).toBeInTheDocument();
    expect(within(one).getByRole('textbox', { name: 'Shares, Brokerage (taxable) 1 holding 1' })).toBeInTheDocument();
    expect(within(holdings).getByRole('region', { name: 'Brokerage (taxable) 2 holdings' })).toHaveTextContent(
      'No holdings yet. Add one below.'
    );
    expect(within(holdings).queryByRole('region', { name: 'Brokerage (taxable) holdings' })).not.toBeInTheDocument();
    // The new cash card and its note.
    const newCash = section(NEW_CASH_TITLE);
    expect(within(newCash).getByRole('group', { name: 'Brokerage (taxable) 1' })).toBeInTheDocument();
    expect(within(newCash).getByRole('group', { name: 'Brokerage (taxable) 2' })).toBeInTheDocument();
    expect(newCash).toHaveTextContent(
      'Not rebalanced: 401(k) or similar (no holdings entered), Brokerage (taxable) 2 (no holdings or new cash).'
    );
  });

  it('edits a typed balance in the account list as one whole-list write', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    fireEvent.change(within(section(ACCOUNTS_TITLE)).getByRole('textbox', { name: '401(k) or similar balance' }), {
      target: { value: '30000' },
    });
    expect(profile().portfolio.accounts.map((a) => [a.id, a.balance])).toEqual([
      ['acc-401k', 30000],
      ['acc-brok', 0],
    ]);
    expect(profile().provided).toContain('portfolio.accounts');
    // A typed balance is not rebalanced.
    expect(store.getState().results?.totalValueBefore).toBe(8775);
  });

  it('edits a holding through the holdings editor', () => {
    render(<PortfolioRebalancingCalculatorPage />);
    // 10 more VTI shares at $375 add $3,750.
    fireEvent.change(inputIn('holding-shares-0'), { target: { value: '30' } });
    expect(profile().portfolio.holdings.find((h) => h.id === 'hld-brok-vti')?.shares).toBe(30);
    expect(profile().provided).toContain('portfolio.holdings');
    expect(store.getState().results?.totalValueBefore).toBe(8775 + 3750);
    expect(within(section(ACCOUNTS_TITLE)).getByText('$12,525 from 3 holdings')).toBeInTheDocument();
  });

  it('adds a holding to an account with its own blank security', async () => {
    const user = userEvent.setup();
    render(<PortfolioRebalancingCalculatorPage />);
    await user.click(screen.getByTestId('add-holding-1'));
    const { holdings, securities } = profile().portfolio;
    expect(holdings).toHaveLength(4);
    expect(holdings[3]).toMatchObject({ accountId: 'acc-brok', shares: 0 });
    const added = securities.find((s) => s.id === holdings[3].securityId);
    expect(added).toMatchObject({ ticker: '', price: 0, assetClass: 'other' });
    expect(profile().provided).toEqual(expect.arrayContaining(['portfolio.holdings', 'portfolio.securities']));
  });

  it('removes an account after confirming, with its holdings and the securities only it held', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PortfolioRebalancingCalculatorPage />);
    const accounts = section(ACCOUNTS_TITLE);
    await user.click(within(accounts).getByRole('button', { name: 'Edit Brokerage (taxable)' }));
    await user.click(within(accounts).getByRole('button', { name: 'Remove Brokerage (taxable)' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toMatch(/^Delete Brokerage \(taxable\)\? Its holdings will be removed too\./);
    const { accounts: rows, holdings, securities } = profile().portfolio;
    expect(rows.map((a) => a.id)).toEqual(['acc-401k']);
    expect(holdings).toEqual([]);
    expect(securities).toEqual([]);
  });

  it('shows the empty state while every account is a typed balance', () => {
    useProfileStore.getState().setValues([
      { path: 'portfolio.accounts', value: [{ id: 'acc-1', kind: '401k', name: '', balance: 20000, holdsEmergencyFund: false }] },
      { path: 'portfolio.holdings', value: [] },
      { path: 'portfolio.securities', value: [] },
    ]);
    render(<PortfolioRebalancingCalculatorPage />);
    expect(screen.getAllByText(NO_REBALANCED_ACCOUNT_MESSAGE).length).toBeGreaterThan(0);
    expect(screen.queryByText('Drift Reduction')).not.toBeInTheDocument();
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
    const user = userEvent.setup();
    const { unmount } = render(<PortfolioRebalancingCalculatorPage />);
    await user.click(screen.getByRole('button', { name: 'Edit Brokerage (taxable)' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Account name' }), { target: { value: NON_LATIN1_NAME } });
    expect(profile().portfolio.accounts[1].name).toBe(NON_LATIN1_NAME);
    unmount();

    render(<PortfolioRebalancingCalculatorPage />);
    expect(within(section(ACCOUNTS_TITLE)).getByText(NON_LATIN1_NAME)).toBeInTheDocument();
    cleanup();

    // A reload: the in-memory profile starts from the defaults, then the
    // persisted one is read back.
    const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    useProfileStore.setState({ profile: getDefaultFinancialProfile(), hasHydrated: false });
    store.getState().reset();
    window.localStorage.setItem(PROFILE_STORAGE_KEY, saved!);
    await act(() => useProfileStore.persist.rehydrate());

    render(<PortfolioRebalancingCalculatorPage />);
    expect(within(section(ACCOUNTS_TITLE)).getByText(NON_LATIN1_NAME)).toBeInTheDocument();
    expect(store.getState().inputs?.accounts[0].name).toBe(NON_LATIN1_NAME);
    expect(window.location.hash).toBe('');
  });
});
