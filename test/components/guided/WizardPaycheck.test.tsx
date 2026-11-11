/**
 * The paycheck intent in the wizard, with slice w1's provisional
 * PAYCHECK_FORM. Slice c3 owns this file and updates it when it grows the
 * form; the wizard mechanics are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { paycheckLink } from '@/lib/profile/links';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer } from '@/test/utils/wizard';

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

describe('Wizard, paycheck intent', () => {
  it('hides the employer-match screen once "No" is chosen, using Enter to choose and advance', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="paycheck" mode="all" />);

    // about, pay, must-pay, fun-money: accept the pre-filled values.
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole('button', { name: /Next/ }));
    }
    expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup');
    expect(screen.getByRole('radio', { name: /^Yes/ })).toHaveAttribute('aria-checked', 'true');

    // Arrow down moves the selection to "No"; the match screen disappears and
    // this becomes the last screen.
    screen.getByRole('radio', { name: /^Yes/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'true');
    expect(group).toBeInTheDocument();
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/paycheck-allocator\?from=profile#/);
    expect(useProfileStore.getState().profile.workplace.has401k).toBe(false);
  });

  it('replaces itself with the same seeded link as before on "Skip the rest"', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="paycheck" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(paycheckLink(useProfileStore.getState().profile));
    expect(replace.mock.calls[0][0].startsWith('/tools/paycheck-allocator?from=profile#')).toBe(true);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
