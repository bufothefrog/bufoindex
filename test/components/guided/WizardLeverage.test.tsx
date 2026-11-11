/**
 * The leverage intent in the wizard (slice c7's LEVERAGE_FORM): the facts
 * screen, then the market assumptions, then the comparison at
 * /tools/leverage-comparison?from=profile, which reads the saved profile
 * itself (no hash, no c/y/b/l query). The wizard mechanics are tested apart
 * in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard, isCoreReady } from '@/components/guided/Wizard';
import { CORE_PATHS, isCoreComplete } from '@/lib/constants/intake';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;

const DESTINATION = '/tools/leverage-comparison?from=profile';
const FACTS = 'What goes into the comparison?';
const MARKET = 'Which market assumptions should the comparison use?';

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
});

describe('Wizard, leverage intent', () => {
  it('asks the facts, then the market assumptions, and opens the comparison from the profile', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);

    expect(screen.getByRole('heading', { name: FACTS })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Your age')).toBeInTheDocument();
    expect(screen.getByLabelText('Age you plan to stop contributing')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly taxable contribution')).toBeInTheDocument();
    // The comparison's own overrides are calculator-only.
    expect(screen.queryByLabelText('Monthly contribution')).not.toBeInTheDocument();
    expect(screen.queryByText('Years')).not.toBeInTheDocument();

    await typeInto('Your age', '28');
    await typeInto('Starting balance', '40000');
    await user.selectOptions(screen.getByLabelText('Leverage ratio'), '3x (UPRO-like daily-reset fund)');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('heading', { name: MARKET })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(
      screen.getByText(
        '500 simulated paths with a fixed seed, so the same inputs always give the same results. A different seed would move the summary figures by a few percentage points.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can change any answer on the calculator.')).toBeInTheDocument();
    // The last screen has no "Skip the rest".
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep the default assumptions' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    expect(push).not.toHaveBeenCalled();

    const { profile, hasProfile } = useProfileStore.getState();
    expect(hasProfile).toBe(true);
    expect(profile.person.age).toBe(28);
    expect(profile.investing.investedBalance).toBe(40000);
    expect(profile.strategy.leverageRatio).toBe(3);
    // The facts screen was answered whole; the kept assumptions stay unanswered.
    expect(profile.provided).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.taxableMonthlyContribution',
      'investing.investedBalance',
      'strategy.leverageRatio',
    ]);
    expect(profile.assumptions.leverage).toEqual(getDefaultFinancialProfile().assumptions.leverage);
    // The intake never asked for a cash target, so it follows the active
    // cashflow-investor preset (1 month) instead of the 3-month placeholder.
    expect(profile.cash.targetMonths).toBe(1);
    expect(profile.provided).not.toContain('cash.targetMonths');
  });

  it('saves the market assumptions it is given', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="leverage" />);

    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    expect(screen.getByRole('heading', { name: MARKET })).toBeInTheDocument();
    await typeInto('Index expected annual return', '6');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.assumptions.leverage.indexMeanReturn).toBeCloseTo(0.06, 10);
    expect(profile.provided).toEqual([
      ...CORE_PATHS,
      'assumptions.leverage.indexMeanReturn',
      'assumptions.leverage.indexVolatility',
      'assumptions.leverage.financingRate',
      'assumptions.leverage.expenseRatio',
      'assumptions.leverage.indexExpenseRatio',
    ]);
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
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
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

  it('replaces itself with the comparison, no hash and no query, on "Skip the rest"', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="leverage" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(DESTINATION);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
