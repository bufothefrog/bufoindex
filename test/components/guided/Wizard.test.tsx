import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { useProfileStore } from '@/lib/store/profileStore';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  useProfileStore.getState().reset();
});

async function typeInto(label: string, text: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
  return user;
}

describe('Wizard', () => {
  it('walks the leverage intake, skips one screen, and opens the seeded comparison', async () => {
    const user = userEvent.setup();
    render(<Wizard intent="leverage" />);

    expect(screen.getByRole('heading', { name: 'What is your time horizon?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await typeInto('Your age', '28');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(
      screen.getByRole('heading', { name: 'How much goes into a taxable brokerage account each month?' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));

    expect(screen.getByRole('heading', { name: 'Roughly how much do you have invested?' })).toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can refine the details on the calculator.')).toBeInTheDocument();
    await typeInto('Starting balance', '40000');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // Age 28 to the default retirement age 60 = 32 years; the skipped taxable
    // contribution keeps its typical 500.
    expect(push).toHaveBeenCalledWith('/tools/leverage-comparison?c=500&y=32&b=40000&l=2');

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
    render(<Wizard intent="leverage" />);

    await typeInto('Your age', '65');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('The retirement age needs to be above your current age.');
    expect(screen.getByRole('heading', { name: 'What is your time horizon?' })).toBeInTheDocument();
  });

  it('hides the employer-match screen once "No" is chosen, using Enter to choose and advance', async () => {
    const user = userEvent.setup();
    render(<Wizard intent="paycheck" />);

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
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/tools\/paycheck-allocator#/);
    expect(useProfileStore.getState().profile.workplace.has401k).toBe(false);
  });
});
