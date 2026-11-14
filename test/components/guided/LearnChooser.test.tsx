import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearnChooser } from '@/components/guided/LearnChooser';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { intakePaths } from '@/test/utils/intake';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS } from '@/lib/profile/defaults';
import { useProfileStore } from '@/lib/store/profileStore';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), replace, prefetch: vi.fn() }),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  useProfileStore.getState().reset();
});

function answer(paths: readonly string[]) {
  useProfileStore.getState().setFields({}, [...paths]);
}

function optionLinks() {
  return within(screen.getByRole('list')).getAllByRole('link');
}

describe('LearnChooser', () => {
  it('offers finishing the profile first, then the four calculators', () => {
    answer(CORE_PATHS);
    render(<LearnChooser />);

    expect(screen.getByRole('heading', { level: 1, name: 'What do you want to learn?' })).toBeInTheDocument();
    const links = optionLinks();
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/start/profile',
      '/start/paycheck',
      '/start/retirement',
      '/start/portfolio',
      '/start/leverage',
    ]);
    expect(links[0]).toHaveTextContent('Finish your profile');
    expect(links[0]).toHaveTextContent('Answer the rest once; every calculator and your overview use it. 10 more questions.');
    expect(links[2]).toHaveTextContent('See if I am on track to retire');
    // The accounts and the target; monthly investing and the assumptions stay on the calculator page.
    expect(links[2]).toHaveTextContent('2 more questions.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('summarizes the basics with a link to edit them', () => {
    answer(CORE_PATHS);
    render(<LearnChooser />);

    expect(screen.getByText('25, CA, single, $4,000 gross every 2 weeks, $2,550 take-home, $3,000 a month in must-pay costs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit the basics' })).toHaveAttribute('href', '/start');
  });

  it('counts what each calculator still needs from the saved answers', () => {
    answer([...CORE_PATHS, ...intakePaths('retirement'), 'investing.newCashThisMonth']);
    render(<LearnChooser />);

    const links = optionLinks();
    expect(links[2]).toHaveTextContent('Nothing more to ask; opens with your answers.');
    // The deprecated new cash answers no portfolio screen; retirement answered the shared accounts
    // screen, so the targets and holdings are left.
    expect(links[3]).toHaveTextContent('2 more questions.');
    // Retirement covered the leverage horizon and balance; the taxable contribution is left. The ratio
    // (calculator-only) and the market assumptions are asked on the comparison page.
    expect(links[4]).toHaveTextContent('1 more question.');
  });

  it('points the profile option at the overview once the intake questions run out', () => {
    // Every topic the profile intake asks is answered, though the intake never
    // asks the calculator-only leaves or the assumptions; /start/profile would
    // only redirect, so link the overview.
    answer(intakePaths('profile'));
    render(<LearnChooser />);

    const first = optionLinks()[0];
    expect(first).toHaveAttribute('href', '/overview');
    expect(first).toHaveTextContent('See your overview');
    expect(first).toHaveTextContent('Every topic is saved. The overview runs each calculator from your profile.');
    expect(screen.queryByText('Finish your profile')).not.toBeInTheDocument();
  });

  it('does not wait for the optional screen: the overview is offered with it unanswered', () => {
    const optional = ['retirementIncome.socialSecurityBenefit', 'retirementIncome.annualHealthcareCost'];
    answer(intakePaths('profile').filter((path) => !optional.includes(path)));
    render(<LearnChooser />);

    expect(optionLinks()[0]).toHaveAttribute('href', '/overview');
    // The retirement intent does not ask it either, nor its assumptions: nothing is left.
    expect(optionLinks()[2]).toHaveTextContent('Nothing more to ask; opens with your answers.');
  });

  it('counts the topics still on typical values when a skipped basic is all that is left', () => {
    // The basics were finished in this tab with the age skipped: /start/profile
    // does not ask the basics again, so the overview is offered while the
    // "A little about you" topic still uses a typical value.
    sessionStorage.setItem('bufo-core-finished', '1');
    answer(intakePaths('profile').filter((path) => path !== 'person.age'));
    render(<LearnChooser />);

    const first = optionLinks()[0];
    expect(first).toHaveAttribute('href', '/overview');
    expect(first).toHaveTextContent(
      'No questions left to ask. The overview runs each calculator from your profile and lists the 1 topic that still uses a typical value.'
    );
  });

  it('swaps option one for the overview when every profile path is saved', () => {
    answer([...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS]);
    render(<LearnChooser />);

    const first = optionLinks()[0];
    expect(first).toHaveAttribute('href', '/overview');
    expect(first).toHaveTextContent('See your overview');
    expect(first).toHaveTextContent('Every topic is saved. The overview runs each calculator from your profile.');
    expect(screen.queryByText('Finish your profile')).not.toBeInTheDocument();
    expect(optionLinks()).toHaveLength(5);
  });

  it('sends a visitor who has not answered the basics to /start', () => {
    answer(['person.age', 'portfolio.accounts']);
    render(<LearnChooser />);

    expect(replace).toHaveBeenCalledWith('/start');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Loading your answers')).toBeInTheDocument();
  });

  it('lets a visitor in after finishing the basics with questions skipped', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wizard flow="core" />);
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Skip' }));
    }
    expect(push).toHaveBeenCalledWith('/start/choose');
    unmount();

    render(<LearnChooser />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('none saved yet, so the calculators use typical values.')).toBeInTheDocument();
    expect(optionLinks()).toHaveLength(5);
  });
});
