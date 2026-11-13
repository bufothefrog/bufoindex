/**
 * The shared accounts screen in the wizard: a suggested row follows the
 * answers given earlier in the same visit, an added row shows before Next,
 * the beginner's list is saved as the one 401(k) with the holdings and
 * targets screens left hidden, and every intent that asks the screen finds
 * its renderer.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS, EXAMPLE_ROWS_NOTE } from '@/lib/constants/intake';
import { normalizeProfile } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';
import { beginnerRaw, rawWith } from '@/test/factories/accountsFixtures';
import { intakePaths } from '@/test/utils/intakeFixture';
import { resetRouterMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer } from '@/test/utils/wizard';
import { next } from './wizardSteps';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const ACCOUNTS_HEADING = 'What do you have saved and invested?';
const HOLDINGS_HEADING = 'What does each account hold today?';
const MIX_HEADING = 'Which stock and bond mix are you aiming for?';
const profile = () => useProfileStore.getState().profile;
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Wizard, the accounts screen', () => {
  it('shows a suggested HSA row after HSA eligible Yes in the same visit, and drops it after No', async () => {
    const user = userEvent.setup();
    answer(intakePaths('profile').filter((path) => !path.startsWith('hsa.') && !path.startsWith('portfolio.')));
    render(<Wizard flow="profile" />);

    const eligible = () => screen.getByRole('radiogroup', { name: 'HSA eligible (high-deductible health plan)' });
    await user.click(within(eligible()).getByRole('radio', { name: 'Yes' }));
    while (!screen.queryByRole('heading', { name: ACCOUNTS_HEADING })) await next(user);
    expect(screen.getByTestId('account-acc-hsa')).toHaveTextContent('HSA');
    expect(screen.getByRole('textbox', { name: 'HSA balance' })).toHaveValue('');

    while (!screen.queryByRole('radiogroup', { name: 'HSA eligible (high-deductible health plan)' })) {
      await user.click(screen.getByRole('button', { name: 'Back' }));
    }
    await user.click(within(eligible()).getByRole('radio', { name: 'No' }));
    while (!screen.queryByRole('heading', { name: ACCOUNTS_HEADING })) await next(user);
    expect(screen.queryByTestId('account-acc-hsa')).not.toBeInTheDocument();
  });

  it('keeps an added Roth IRA row visible before Next in /start/portfolio', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="portfolio" />);
    await user.click(screen.getByRole('radio', { name: /80% stocks, 20% bonds/ }));
    await next(user);

    expect(screen.getByRole('heading', { name: ACCOUNTS_HEADING })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('New account kind'), 'roth-ira');
    await user.click(screen.getByRole('button', { name: 'Add account' }));

    const list = screen.getByRole('group', { name: 'Accounts' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => within(item).getAllByRole('paragraph')[0]?.textContent)).toEqual([
      '401(k) or similar',
      'Brokerage (taxable)',
      'Roth IRA',
    ]);
    expect(within(items[2]).getByRole('textbox', { name: 'Roth IRA balance' })).toHaveValue('0');
  });

  it('saves the beginner list as the one 401(k) and leaves the holdings and targets screens hidden', async () => {
    const user = userEvent.setup();
    useProfileStore.setState({ profile: normalizeProfile(beginnerRaw()) });
    answer(CORE_PATHS);
    render(<Wizard flow="profile" />);

    const seen: string[] = [];
    for (let i = 0; i < 30 && screen.queryByRole('button', { name: /^(Next|Finish)/ }); i++) {
      seen.push(heading() ?? '');
      if (heading() === ACCOUNTS_HEADING) {
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(screen.getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('16,225');
      }
      await next(user);
    }

    expect(seen).toContain(ACCOUNTS_HEADING);
    expect(seen).not.toContain(HOLDINGS_HEADING);
    expect(seen).not.toContain(MIX_HEADING);
    expect(profile().portfolio.accounts.map((a) => a.id)).toEqual(['acc-401k']);
    expect(profile().portfolio.holdings).toEqual([]);
  });

  it('shows the example line only while an example account is on the screen', async () => {
    const user = userEvent.setup();
    // The beginner without a 401(k): no account in effect, nothing to change.
    useProfileStore.setState({ profile: normalizeProfile(rawWith({ 'workplace.has401k': false }, undefined, beginnerRaw())) });
    answer(CORE_PATHS);
    const { unmount } = render(<Wizard flow="profile" />);
    while (heading() !== ACCOUNTS_HEADING) await next(user);
    expect(screen.getByText('No accounts yet.')).toBeInTheDocument();
    expect(screen.queryByText(EXAMPLE_ROWS_NOTE)).not.toBeInTheDocument();

    // The same visitor adds an account: the row is their own, so still no line.
    await user.selectOptions(screen.getByLabelText('New account kind'), 'roth-ira');
    await user.click(screen.getByRole('button', { name: 'Add account' }));
    expect(screen.getByRole('textbox', { name: 'Roth IRA balance' })).toBeInTheDocument();
    expect(screen.queryByText(EXAMPLE_ROWS_NOTE)).not.toBeInTheDocument();
    unmount();

    // The beginner: the example 401(k) row is on the screen, so the line stays.
    useProfileStore.setState({ profile: normalizeProfile(beginnerRaw()) });
    answer(CORE_PATHS);
    render(<Wizard flow="profile" />);
    while (heading() !== ACCOUNTS_HEADING) await next(user);
    expect(screen.getByRole('textbox', { name: '401(k) or similar balance' })).toHaveValue('16,225');
    expect(screen.getByText(EXAMPLE_ROWS_NOTE)).toBeInTheDocument();
  });

  it.each(['retirement', 'leverage'] as const)('renders the accounts screen in /start/%s without a missing renderer', async (flow) => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow={flow} />);
    while (!screen.queryByRole('heading', { name: ACCOUNTS_HEADING })) await next(user);
    expect(screen.queryByText('Missing field renderer')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('$8,775 from 3 holdings')).toBeInTheDocument();
  });
});
