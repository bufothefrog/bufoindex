import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard, isCoreReady } from '@/components/guided/Wizard';
import { CORE_PATHS, intakePaths, isCoreComplete } from '@/lib/constants/intake';
import { portfolioLink, retirementLink } from '@/lib/profile/links';
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

/** Saves the default values for `paths` as answered, like a finished intake. */
function answer(paths: readonly string[]) {
  useProfileStore.getState().setFields({}, [...paths]);
}

async function typeInto(label: string, text: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
  return user;
}

describe('Wizard, every question of an intent (mode all)', () => {
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
    expect(screen.getByText('Good enough to start. You can refine the details on the calculator.')).toBeInTheDocument();
    await typeInto('Starting balance', '40000');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // Age 28 to the default retirement age 60 = 32 years; the skipped taxable
    // contribution keeps its typical 500.
    expect(replace).toHaveBeenCalledWith('/tools/leverage-comparison?c=500&y=32&b=40000&l=2');
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
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/paycheck-allocator#/);
    expect(useProfileStore.getState().profile.workplace.has401k).toBe(false);
  });
});

describe('Wizard, shared core flow', () => {
  it('asks only the basics and continues to the chooser', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" />);

    expect(screen.getByRole('heading', { level: 1, name: 'A few basics' })).toBeInTheDocument();
    expect(screen.getByText('Every calculator shares these answers, so you only give them once.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A little about you' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await typeInto('Your age', '34');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What does a typical paycheck look like?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What do you have to pay each month?' })).toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can edit the basics later.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // The basics stay in history (push), so Back from the chooser returns to them.
    expect(push).toHaveBeenCalledWith('/start/choose');
    expect(replace).not.toHaveBeenCalled();
    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(34);
    expect(profile.provided).toEqual([...CORE_PATHS]);
    expect(isCoreComplete(profile)).toBe(true);
  });

  it('continues to the intent named by next', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" next="retirement" />);

    expect(screen.getByText('After this: See if I am on track to retire.')).toBeInTheDocument();
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Next|Finish/ }));
    }
    expect(push).toHaveBeenCalledWith('/start/retirement');
  });

  it('ignores a next value that is not an intent', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" next="choose" />);

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: /Next|Finish/ }));
    }
    expect(push).toHaveBeenCalledWith('/start/choose');
  });

  it('prefills saved basics and offers to keep them as they are', () => {
    useProfileStore.getState().setFields({ person: { age: 52 } }, [...CORE_PATHS]);
    const { unmount } = render(<Wizard flow="core" next="portfolio" />);

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Your age')).toHaveValue('52');
    expect(screen.getByRole('link', { name: 'Keep them and continue' })).toHaveAttribute('href', '/start/portfolio');
    unmount();

    render(<Wizard flow="core" />);
    expect(screen.getByRole('link', { name: 'Keep them and continue' })).toHaveAttribute('href', '/start/choose');
  });

  it('does not offer the shortcut while a basic is unanswered', () => {
    answer(CORE_PATHS.filter((path) => path !== 'spending.necessaryMonthly'));
    render(<Wizard flow="core" />);
    expect(screen.queryByRole('link', { name: 'Keep them and continue' })).not.toBeInTheDocument();
  });
});

describe('Wizard, remaining questions of an intent', () => {
  it('asks only what retirement still needs and opens the seeded calculator', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);

    expect(screen.getByRole('heading', { level: 1, name: 'See if I am on track to retire' })).toBeInTheDocument();
    expect(screen.getByText('Just the questions this calculator still needs.')).toBeInTheDocument();
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
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/retirement-calculator#/);
    expect(push).not.toHaveBeenCalled();
  });

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
    expect(replace.mock.calls[0][0]).toMatch(/^\/tools\/portfolio-rebalancing-calculator#/);
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

  it('opens the overview when the profile has nothing left to ask', () => {
    answer(intakePaths('profile'));
    render(<Wizard flow="profile" />);
    expect(replace).toHaveBeenCalledWith('/overview');
  });

  it('skips the core in remaining mode when every basic is saved, keeping next', () => {
    answer(CORE_PATHS);
    const { unmount } = render(<Wizard flow="core" mode="remaining" next="portfolio" />);
    expect(replace).toHaveBeenCalledWith('/start/portfolio');
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
    unmount();

    render(<Wizard flow="core" mode="remaining" />);
    expect(replace).toHaveBeenLastCalledWith('/start/choose');
  });

  it('asks only the unanswered basics in core remaining mode', () => {
    answer(CORE_PATHS.filter((path) => path !== 'spending.necessaryMonthly'));
    render(<Wizard flow="core" mode="remaining" />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'What do you have to pay each month?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
  });

  it('sends a visitor without the basics to the core first', () => {
    answer(['investing.investedBalance']);
    render(<Wizard flow="retirement" />);

    expect(replace).toHaveBeenCalledWith('/start?next=retirement');
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
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

  it('labels profile screens with their section and finishes at the overview', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, ...intakePaths('retirement'), ...intakePaths('paycheck'), ...intakePaths('portfolio')]);
    render(<Wizard flow="profile" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Finish your profile' })).toBeInTheDocument();
    expect(screen.getByText('Just the questions your profile still needs.')).toBeInTheDocument();
    // Left: the taxable contribution, then the two cash screens.
    expect(screen.getByText('Portfolio · Step 1 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Cash and strategy · Step 2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip the rest of this section' }));

    expect(replace).toHaveBeenCalledWith('/overview');
    expect(push).not.toHaveBeenCalled();
    expect(useProfileStore.getState().profile.provided).toContain('investing.taxableMonthlyContribution');
    expect(useProfileStore.getState().profile.provided).not.toContain('cash.emergencyFundBalance');
  });
});
