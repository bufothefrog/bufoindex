/**
 * The portfolio intent in the wizard (slice c5): three of the four screens
 * of the grown PORTFOLIO_FORM (targets, accounts, holdings; the settings are
 * an assumption screen on the rebalancer page only), with no core
 * gate (O5), the custom editors working on the wizard's copy of the
 * profile, and the finish landing on the rebalancer with only the handoff
 * marker. The wizard mechanics are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer } from '@/test/utils/wizard';
import { skipToEnd } from './wizardSteps';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;
const DESTINATION = '/tools/portfolio-rebalancing-calculator?from=profile';
const profile = () => useProfileStore.getState().profile;
const next = () => screen.getByRole('button', { name: /Next/ });

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Wizard, portfolio intent', () => {
  it('asks the three portfolio screens in order and lands on the rebalancer with no hash', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    expect(screen.getByRole('heading', { name: 'Which stock and bond mix are you aiming for?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    // Nothing chosen yet; the typical mix carries the tag.
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'false']);
    expect(radios.map((radio) => radio.getAttribute('aria-describedby') !== null)).toEqual([false, true, false, false]);
    expect(radios[1]).toHaveAccessibleDescription('Typical');
    expect(screen.queryByText('This is an example. Change it to match yours, or skip.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /60% stocks, 40% bonds/ }));
    await user.click(next());

    // The shared accounts screen; the new cash is asked on the rebalancer page.
    expect(screen.getByRole('heading', { name: 'What do you have saved and invested?' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.queryByText('New cash this month')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '401(k) or similar balance' }), { target: { value: '20000' } });
    await user.click(next());

    expect(screen.getByRole('heading', { name: 'What does each account hold today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    // Only the account with holdings has a holdings section; the 401(k) has a typed balance.
    expect(screen.getByRole('region', { name: 'Brokerage (taxable) holdings' })).toBeInTheDocument();
    fireEvent.change(within(screen.getByTestId('holding-shares-0')).getByRole('textbox'), { target: { value: '12' } });
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // The trade settings are not asked: they stay on the rebalancer page.
    expect(screen.queryByRole('heading', { name: 'How should the rebalance trade?' })).not.toBeInTheDocument();

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    const saved = profile();
    expect(saved.investing.targetMix).toBe('60-40');
    expect(saved.portfolio.accounts.map((a) => [a.id, a.balance])).toEqual([
      ['acc-401k', 20000],
      ['acc-brok', 0],
    ]);
    expect(saved.portfolio.newCash).toEqual([]);
    expect(saved.portfolio.holdings[0]).toMatchObject({ id: 'hld-brok-vti', shares: 12 });
    expect(saved.provided).toEqual(
      expect.arrayContaining([
        'investing.targetMix',
        'portfolio.accounts',
        'portfolio.holdings',
        'portfolio.securities',
      ])
    );
    expect(saved.provided).not.toContain('assumptions.portfolio.mode');
  });

  it('does not send a visitor without the basics to the core first', () => {
    render(<Wizard flow="portfolio" />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Which stock and bond mix are you aiming for?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('starts the custom targets from the preset chosen before', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /60% stocks/ }));
    await user.click(screen.getByRole('radio', { name: /Custom/ }));

    const editor = screen.getByRole('group', { name: 'Target allocation' });
    expect(within(editor).getByRole('textbox', { name: 'US Stock target' })).toHaveValue('45.0');
    expect(within(editor).getByRole('textbox', { name: 'Intl Stock target' })).toHaveValue('15.0');
    expect(within(editor).getByRole('textbox', { name: 'Bonds target' })).toHaveValue('40.0');
  });

  it('shows the class-targets editor for the custom mix and saves the targets with it', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /Custom/ }));

    const editor = screen.getByRole('group', { name: 'Target allocation' });
    expect(within(editor).getByTestId('target-sum-portfolio')).toHaveTextContent('Targets total: 100.0%');
    fireEvent.change(within(editor).getByRole('textbox', { name: 'US Stock target' }), { target: { value: '50' } });
    fireEvent.change(within(editor).getByRole('textbox', { name: 'Bonds target' }), { target: { value: '30' } });
    await user.click(next());

    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(await skipToEnd(user)).toBe(2);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    const saved = profile();
    expect(saved.investing.targetMix).toBe('custom');
    expect(saved.portfolio.classTargets.map((t) => [t.assetClass, t.target])).toEqual([
      ['us-stock', 0.5],
      ['intl-stock', 0.2],
      ['bonds', 0.3],
      ['cash', 0],
    ]);
    expect(saved.provided).toEqual(
      expect.arrayContaining(['investing.targetMix', 'portfolio.classTargets', 'portfolio.customAssetClasses'])
    );
    expect(saved.provided).not.toContain('portfolio.accounts');
  });

  it('keeps custom targets that do not total 100% on their screen, with the calculator page message', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /Custom/ }));

    const editor = screen.getByRole('group', { name: 'Target allocation' });
    fireEvent.change(within(editor).getByRole('textbox', { name: 'US Stock target' }), { target: { value: '90' } });
    expect(within(editor).getByTestId('target-sum-portfolio')).toHaveTextContent('Targets total: 130.0%');
    await user.click(next());

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Target allocations must sum to 100% (currently 130.00%).')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByRole('textbox', { name: 'US Stock target' }), { target: { value: '60' } });
    await user.click(next());
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  });

  it('replaces itself with the rebalancer after skipping every screen, leaving them unanswered', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    expect(await skipToEnd(user)).toBe(3);

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    expect(profile().provided).toEqual([...CORE_PATHS]);
  });

  it('goes straight to the rebalancer once every profile screen is answered, the settings unanswered', () => {
    answer(['investing.targetMix', 'portfolio.accounts', 'portfolio.holdings']);
    render(<Wizard flow="portfolio" />);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
  });

  it('removes a holding with Remove holding and stays on the holdings screen', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /60% stocks, 40% bonds/ }));
    await user.click(next());
    await user.click(next());
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Brokerage (taxable) holdings' });
    const before = within(region).getAllByRole('button', { name: /^Remove holding/ }).length;

    await user.click(within(region).getByRole('button', { name: 'Remove holding 1' }));

    // The button does not submit the screen's form: no step forward, no Finish.
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(within(region).getAllByRole('button', { name: /^Remove holding/ })).toHaveLength(before - 1);
  });

  it('does not advance when a class target Remove button is pressed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /Custom/ }));
    const editor = screen.getByRole('group', { name: 'Target allocation' });
    expect(within(editor).getByRole('textbox', { name: 'Cash target' })).toBeInTheDocument();

    await user.click(within(editor).getByRole('button', { name: 'Remove Cash' }));

    // The button does not submit the screen's form.
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith('Remove Cash from your target allocation?');
  });
});

