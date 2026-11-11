/**
 * The leverage intent in the wizard, with slice w1's provisional
 * LEVERAGE_FORM. Slice c7 owns this file and updates it when it grows the
 * form; the wizard mechanics are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard, isCoreReady } from '@/components/guided/Wizard';
import { CORE_PATHS, isCoreComplete } from '@/lib/constants/intake';
import { leverageLink } from '@/lib/profile/links';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
});

describe('Wizard, leverage intent', () => {
  it('walks the leverage intake, skips one screen, and opens the seeded comparison', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);

    expect(screen.getByRole('heading', { name: 'What is your time horizon?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await typeInto('Your age', '28');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(
      screen.getByRole('heading', { name: 'How much goes into a taxable brokerage account each month?' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));

    expect(screen.getByRole('heading', { name: 'Roughly how much do you have invested?' })).toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can change any answer on the calculator.')).toBeInTheDocument();
    await typeInto('Starting balance', '40000');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // Age 28 to the default retirement age 60 = 32 years; the skipped taxable
    // contribution keeps its typical 500.
    expect(replace).toHaveBeenCalledWith('/tools/leverage-comparison?c=500&y=32&b=40000&l=2&from=profile');
    expect(push).not.toHaveBeenCalled();

    const { profile, hasProfile } = useProfileStore.getState();
    expect(hasProfile).toBe(true);
    expect(profile.person.age).toBe(28);
    expect(profile.investing.investedBalance).toBe(40000);
    expect(profile.provided).toEqual(['person.age', 'person.retirementAge', 'investing.investedBalance']);
    expect(profile.provided).not.toContain('investing.taxableMonthlyContribution');
    // The intake never asked for a cash target, so it follows the active
    // cashflow-investor preset (1 month) instead of the 3-month placeholder.
    expect(profile.strategy.preset).toBe('cashflow-investor');
    expect(profile.cash.targetMonths).toBe(1);
    expect(profile.provided).not.toContain('cash.targetMonths');
  });

  it('blocks Next when the retirement age is not above the current age', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);

    await typeInto('Your age', '65');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('The retirement age needs to be above your current age.');
    expect(screen.getByRole('heading', { name: 'What is your time horizon?' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'What is your time horizon?' })).toBeInTheDocument();
    // Age is a core question, so the horizon screen asks only the end age.
    expect(screen.queryByLabelText('Your age')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Age you plan to stop contributing')).toBeInTheDocument();
    second.unmount();

    useProfileStore.getState().reset();
    expect(isCoreReady(useProfileStore.getState().profile)).toBe(false);
    render(<Wizard flow="leverage" />);
    expect(replace).toHaveBeenCalledWith('/start?next=leverage');
  });

  it('replaces itself with the same seeded link as before on "Skip the rest"', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="leverage" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(leverageLink(useProfileStore.getState().profile));
    expect(replace.mock.calls[0][0].startsWith('/tools/leverage-comparison?')).toBe(true);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
