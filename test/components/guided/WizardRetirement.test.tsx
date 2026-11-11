/**
 * The retirement intent in the wizard, with slice w1's provisional
 * RETIREMENT_FORM. Slice c1 owns this file and updates it when it grows the
 * form; the wizard mechanics are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS, intakePaths } from '@/lib/constants/intake';
import { retirementLink } from '@/lib/profile/links';
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

describe('Wizard, retirement intent', () => {
  it('asks only what retirement still needs and opens the seeded calculator', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);

    expect(screen.getByRole('heading', { level: 1, name: 'See if I am on track to retire' })).toBeInTheDocument();
    expect(screen.getByText('Everything this calculator uses, a few related questions per screen.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();

    await typeInto('Target retirement age', '62');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    // The invested-balance screen is skipped: it is already answered.
    expect(screen.getByRole('heading', { name: 'How much do you invest each month?' })).toBeInTheDocument();
    await typeInto('Monthly investing contribution', '900');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.person.retirementAge).toBe(62);
    expect(profile.investing.monthlyContribution).toBe(900);
    expect(profile.provided).toEqual([
      ...CORE_PATHS,
      'investing.investedBalance',
      'person.retirementAge',
      'investing.monthlyContribution',
    ]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(retirementLink(profile));
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/retirement-calculator\?from=profile#/);
    expect(push).not.toHaveBeenCalled();
  });

  it('goes straight to the calculator when nothing is left to ask', () => {
    answer([...CORE_PATHS, ...intakePaths('retirement')]);
    render(<Wizard flow="retirement" mode="remaining" />);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(retirementLink(useProfileStore.getState().profile));
    expect(screen.getByLabelText('Loading questions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('replaces itself with the same seeded link as before on "Skip the rest"', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(retirementLink(useProfileStore.getState().profile));
    expect(replace.mock.calls[0][0].startsWith('/tools/retirement-calculator?from=profile#')).toBe(true);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
