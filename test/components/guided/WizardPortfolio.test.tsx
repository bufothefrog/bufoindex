/**
 * The portfolio intent in the wizard (slice c5): the four screens of the
 * grown PORTFOLIO_FORM (targets, accounts, holdings, settings), with no core
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
  it('asks the four portfolio screens in order and lands on the rebalancer with no hash', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    expect(screen.getByRole('heading', { name: 'Which stock and bond mix are you aiming for?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    // Nothing chosen yet; the typical mix carries the tag.
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'false']);
    expect(radios.map((radio) => radio.getAttribute('aria-describedby') !== null)).toEqual([false, true, false, false]);
    expect(radios[1]).toHaveAccessibleDescription('Typical');
    expect(screen.queryByText('This is an example. Change it to match yours, or skip.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /60% stocks, 40% bonds/ }));
    await user.click(next());

    expect(screen.getByRole('heading', { name: 'How much new cash are you investing this month?' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByText('This is an example. Change it to match yours, or skip.')).toBeInTheDocument();
    const brokerage = screen.getByRole('group', { name: 'Brokerage' });
    fireEvent.change(within(brokerage).getByRole('textbox', { name: 'New cash' }), { target: { value: '2400' } });
    await user.click(next());

    expect(screen.getByRole('heading', { name: 'What does each account hold today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    expect(screen.getByText('This is an example. Change it to match yours, or skip.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Roth IRA holdings' })).toBeInTheDocument();
    fireEvent.change(within(screen.getByTestId('holding-shares-0')).getByRole('textbox'), { target: { value: '12' } });
    await user.click(next());

    expect(screen.getByRole('heading', { name: 'How should the rebalance trade?' })).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByText('This is an example. Change it to match yours, or skip.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    const saved = profile();
    expect(saved.investing.targetMix).toBe('60-40');
    expect(saved.portfolio.accounts[1].deposit).toBe(2400);
    expect(saved.portfolio.holdings[0].shares).toBe(12);
    expect(saved.provided).toEqual(
      expect.arrayContaining([
        'investing.targetMix',
        'portfolio.accounts',
        'portfolio.holdings',
        'portfolio.securities',
        'assumptions.portfolio.mode',
      ])
    );
  });

  it('does not send a visitor without the basics to the core first', () => {
    render(<Wizard flow="portfolio" />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Which stock and bond mix are you aiming for?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
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

    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(await skipToEnd(user)).toBe(3);
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

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Target allocations must sum to 100% (currently 130.00%).')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByRole('textbox', { name: 'US Stock target' }), { target: { value: '60' } });
    await user.click(next());
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
  });

  it('replaces itself with the rebalancer after skipping every screen, leaving them unanswered', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    expect(await skipToEnd(user)).toBe(4);

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    expect(profile().provided).toEqual([...CORE_PATHS]);
  });

  it('goes straight to the rebalancer once every screen is answered', () => {
    answer([
      'investing.targetMix',
      'portfolio.accounts',
      'portfolio.holdings',
      'assumptions.portfolio.mode',
      'assumptions.portfolio.allowTaxableSelling',
      'assumptions.portfolio.showPlacementAdvice',
    ]);
    render(<Wizard flow="portfolio" />);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
  });
});
