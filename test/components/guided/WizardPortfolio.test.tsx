/**
 * The portfolio intent in the wizard, with slice w1's provisional
 * PORTFOLIO_FORM. Slice c5 owns this file and updates it when it grows the
 * form; the wizard mechanics are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { portfolioLink } from '@/lib/profile/links';
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

describe('Wizard, portfolio intent', () => {
  it('replaces its own history entry on finish, so Back from the result does not bounce forward', async () => {
    // /start -> /start/choose -> /start/portfolio -> Finish. Pushing the
    // calculator would leave /start/portfolio behind it in history; Back would
    // remount it with nothing left to ask and the gate would replace forward
    // to the calculator again. Replacing on finish lets Back reach the chooser.
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    // With the basics saved, portfolio asks only new cash and the target mix.
    expect(screen.getByRole('heading', { name: 'How much new cash are you investing this month?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Which stock and bond mix are you aiming for?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(portfolioLink(useProfileStore.getState().profile));
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/portfolio-rebalancing-calculator\?from=profile#/);
  });

  it('replaces itself with the same seeded link as before on "Skip the rest"', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(portfolioLink(useProfileStore.getState().profile));
    expect(replace.mock.calls[0][0].startsWith('/tools/portfolio-rebalancing-calculator?from=profile#')).toBe(true);
    // Skipped screens stay unanswered.
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
