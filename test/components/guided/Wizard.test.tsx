import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nextNavigationFactory, resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { Wizard, WizardPlaceholder, isCoreReady } from '@/components/guided/Wizard';
import { INTAKE_DESTINATIONS, PROFILE_FORM } from '@/lib/calculators/forms';
import { CORE_PATHS, intakePaths, isCoreComplete } from '@/lib/constants/intake';
import { CORE_SCREENS } from '@/lib/fields/shared';
import { LEVERAGE_PATH, PAYCHECK_PATH, PORTFOLIO_PATH, RETIREMENT_PATH } from '@/lib/profile/links';
import { useProfileStore } from '@/lib/store/profileStore';

vi.mock('next/navigation', () => nextNavigationFactory());

// Calculator-specific flows (which screens each intent asks, the seeded
// links) are pinned in each calculator slice's Wizard<Calc>.test.tsx. This
// file covers the shared core and what every intent has in common; the
// mechanics on a fixture form live in WizardMechanics.test.tsx.

const { push, replace } = routerMock;

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  useProfileStore.getState().reset();
  resetProfileStore({ hydrated: true });
});

/** Saves the default values for `paths` as answered, like a finished intake. */
function answer(paths: readonly string[]) {
  useProfileStore.getState().setValues([], { provide: [...paths] });
}

async function typeInto(label: string, text: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
  return user;
}

const CALCULATOR_PATHS = {
  paycheck: PAYCHECK_PATH,
  retirement: RETIREMENT_PATH,
  portfolio: PORTFOLIO_PATH,
  leverage: LEVERAGE_PATH,
} as const;

describe('Wizard, shared core flow', () => {
  it('asks only the basics and continues to the chooser', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" />);

    expect(screen.getByRole('heading', { level: 1, name: 'A few basics' })).toBeInTheDocument();
    expect(screen.getByText('Every calculator shares these answers, so you only give them once.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A little about you' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    // The core is not an intent: no "Skip the rest".
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();

    await typeInto('Your age', '34');
    await user.click(screen.getByRole('radio', { name: 'Head of household' }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What does a typical paycheck look like?' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What do you have to pay each month?' })).toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can edit the basics later.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // The basics stay in history (push), so Back from the chooser returns to them.
    expect(push).toHaveBeenCalledWith('/start/choose');
    expect(replace).not.toHaveBeenCalled();
    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(34);
    expect(profile.person.filingStatus).toBe('headOfHousehold');
    expect(profile.provided).toEqual([...CORE_PATHS]);
    expect(isCoreComplete(profile)).toBe(true);
    // The intake never asked for a cash target, so it follows the active
    // cashflow-investor preset (1 month), unmarked.
    expect(profile.cash.targetMonths).toBe(1);
    expect(profile.provided).not.toContain('cash.targetMonths');
  });

  it('shows a take-home-above-gross answer as one screen-level alert', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" />);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await typeInto('Take-home pay per paycheck', '9000');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Take-home pay is above gross pay.');
    expect(screen.getByRole('heading', { name: 'What does a typical paycheck look like?' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('continues to the intent named by next', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" next="retirement" />);

    expect(screen.getByText('After this: See if I am on track to retire.')).toBeInTheDocument();
    for (let i = 0; i < CORE_SCREENS.length; i += 1) {
      await user.click(screen.getByRole('button', { name: /Next|Finish/ }));
    }
    expect(push).toHaveBeenCalledWith('/start/retirement');
  });

  it('ignores a next value that is not an intent', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" next="choose" />);

    for (let i = 0; i < CORE_SCREENS.length; i += 1) {
      await user.click(screen.getByRole('button', { name: /Next|Finish/ }));
    }
    expect(push).toHaveBeenCalledWith('/start/choose');
  });

  it('prefills saved basics and offers to keep them as they are', () => {
    useProfileStore.getState().setValues([{ path: 'person.age', value: 52 }], { provide: [...CORE_PATHS] });
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

  it('renders the header and a skeleton until the profile store hydrates', () => {
    resetProfileStore({ hydrated: false });
    render(<Wizard flow="core" next="leverage" />);
    expect(screen.getByRole('heading', { level: 1, name: 'A few basics' })).toBeInTheDocument();
    expect(screen.getByLabelText('Loading questions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });
});

describe('WizardPlaceholder', () => {
  it('sizes the skeleton to the first screen: one block per field', () => {
    const { container } = render(<WizardPlaceholder flow="core" />);
    const fields = container.querySelector('[aria-label="Loading questions"] > .space-y-5');
    expect(fields?.children).toHaveLength(CORE_SCREENS[0].fields.length);
  });
});

describe('Wizard, remaining questions of an intent', () => {
  it.each(['paycheck', 'retirement', 'leverage'] as const)(
    '%s: skips the rest and opens its calculator, replacing the intake entry',
    async (intent) => {
      const user = userEvent.setup();
      answer(CORE_PATHS);
      render(<Wizard flow={intent} />);

      expect(screen.getByText('Just the questions this calculator still needs, a few related ones per screen.')).toBeInTheDocument();
      const skipRest = screen.queryByRole('button', { name: 'Skip the rest' });
      await user.click(skipRest ?? screen.getByRole('button', { name: /Finish/ }));

      expect(push).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledTimes(1);
      const href = replace.mock.calls[0][0];
      expect(href.startsWith(CALCULATOR_PATHS[intent])).toBe(true);
      expect(href).toBe(INTAKE_DESTINATIONS[intent](useProfileStore.getState().profile));
    }
  );

  it('goes straight to the calculator when nothing is left to ask', () => {
    answer([...CORE_PATHS, ...intakePaths('retirement')]);
    render(<Wizard flow="retirement" mode="remaining" />);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(INTAKE_DESTINATIONS.retirement(useProfileStore.getState().profile));
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

  it('lets the portfolio intake start without the basics (O5)', () => {
    render(<Wizard flow="portfolio" />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Next|Finish/ })).toBeInTheDocument();
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
    // Core fields are never asked again by an intent, even on a shared screen.
    expect(screen.queryByLabelText('Your age')).not.toBeInTheDocument();
    second.unmount();

    useProfileStore.getState().reset();
    expect(isCoreReady(useProfileStore.getState().profile)).toBe(false);
    render(<Wizard flow="leverage" />);
    expect(replace).toHaveBeenCalledWith('/start?next=leverage');
  });

  it('labels profile screens with their section and skips a section at once', async () => {
    const user = userEvent.setup();
    // Leave only the profile extras (cash buffer, strategy) unanswered.
    const extras = PROFILE_FORM.screens.slice(-2).flatMap((s) => s.fields);
    answer(intakePaths('profile').filter((path) => !extras.includes(path)));
    render(<Wizard flow="profile" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Finish your profile' })).toBeInTheDocument();
    expect(screen.getByText('Just the questions your profile still needs, a few related ones per screen.')).toBeInTheDocument();
    expect(screen.getByText('Cash and strategy · Step 1 of 2')).toBeInTheDocument();
    // The whole rest is one section, so only the section skip shows.
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip the rest of this section' }));

    expect(replace).toHaveBeenCalledWith('/overview');
    expect(push).not.toHaveBeenCalled();
    expect(useProfileStore.getState().profile.provided).not.toContain('cash.emergencyFundBalance');
  });
});
