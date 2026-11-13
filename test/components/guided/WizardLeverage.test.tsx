/**
 * The leverage intent in the wizard (slice c7's LEVERAGE_FORM): the facts
 * screen and the shared accounts screen (the leverage ratio is
 * calculator-only and the market assumptions stay on the page), then the
 * comparison at
 * /tools/leverage-comparison?from=profile, which reads the saved profile
 * itself (no hash, no c/y/b/l query). The wizard mechanics are tested apart
 * in Wizard.test.tsx.
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard, isCoreReady } from '@/components/guided/Wizard';
import { CORE_PATHS, isCoreComplete } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';
import { fillPay, skip, skipToEnd } from './wizardSteps';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;

const DESTINATION = '/tools/leverage-comparison?from=profile';
const FACTS = 'What goes into the comparison?';
const ACCOUNTS = 'What do you have saved and invested?';

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

describe('Wizard, leverage intent', () => {
  it('asks the facts and the accounts, then opens the comparison from the profile', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);

    expect(screen.getByRole('heading', { name: FACTS })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Your age')).toHaveValue('');
    expect(screen.getByLabelText('Your age')).toHaveAttribute('placeholder', '25');
    expect(screen.getByLabelText('Age you plan to stop contributing')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly taxable contribution')).toBeInTheDocument();
    // The comparison's own overrides and the leverage ratio are calculator-only.
    expect(screen.queryByLabelText('Monthly contribution')).not.toBeInTheDocument();
    expect(screen.queryByText('Years')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Leverage ratio')).not.toBeInTheDocument();

    await typeInto('Your age', '28');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    // The accounts screen renders its editor (no missing-renderer alert); the invested
    // total is the comparison's starting balance.
    expect(screen.getByRole('heading', { name: ACCOUNTS })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await typeInto('401(k) or similar balance', '31225');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // No market assumptions screen follows.
    expect(screen.queryByRole('heading', { name: 'Which market assumptions should the comparison use?' })).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    expect(push).not.toHaveBeenCalled();

    const { profile, hasProfile } = useProfileStore.getState();
    expect(hasProfile).toBe(true);
    expect(profile.person.age).toBe(28);
    // 31,225 typed in the 401(k) + 8,775 of example brokerage holdings.
    expect(profile.portfolio.accounts.map((a) => [a.id, a.balance])).toEqual([
      ['acc-401k', 31225],
      ['acc-brok', 0],
    ]);
    expect(profile.strategy.leverageRatio).toBe(2);
    // Both screens were answered whole; the ratio and the assumptions stay unanswered.
    expect(profile.provided).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.taxableMonthlyContribution',
      'portfolio.accounts',
      'portfolio.holdings',
      'portfolio.securities',
    ]);
    expect(profile.assumptions.leverage).toEqual(getDefaultFinancialProfile().assumptions.leverage);
    // The intake never asked for a cash target and derives none: the stored 3 months stay.
    expect(profile.cash.targetMonths).toBe(3);
    expect(profile.provided).not.toContain('cash.targetMonths');
  });

  it('goes straight to the comparison when only the ratio and the market assumptions are unanswered', () => {
    answer([...CORE_PATHS, 'person.retirementAge', 'investing.taxableMonthlyContribution', 'portfolio.accounts']);
    render(<Wizard flow="leverage" />);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
  });

  it('blocks Next when the stop age is not above the current age', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);

    await typeInto('Your age', '65');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('The retirement age needs to be above your current age.');
    expect(screen.getByRole('heading', { name: FACTS })).toBeInTheDocument();
  });

  it('lets a visitor who skipped core questions continue, until the profile is reset', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wizard flow="core" next="leverage" />);
    await skip(user);
    await fillPay(user);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await typeInto('Must-pay costs per month', '3000');
    await user.click(screen.getByRole('button', { name: /Finish/ }));
    expect(push).toHaveBeenCalledWith('/start/leverage');
    unmount();

    const { profile } = useProfileStore.getState();
    expect(isCoreComplete(profile)).toBe(false);
    expect(isCoreReady(profile)).toBe(true);

    const second = render(<Wizard flow="leverage" />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: FACTS })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    // Age is a core question, so the facts screen asks only the end age.
    expect(screen.queryByLabelText('Your age')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Age you plan to stop contributing')).toBeInTheDocument();
    second.unmount();

    useProfileStore.getState().reset();
    expect(isCoreReady(useProfileStore.getState().profile)).toBe(false);
    render(<Wizard flow="leverage" />);
    expect(replace).toHaveBeenCalledWith('/start?next=leverage');
  });

  it('replaces itself with the comparison, no hash and no query, after skipping every screen', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="leverage" />);

    expect(await skipToEnd(user)).toBe(2);

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
