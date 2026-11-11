import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INTAKE_DESTINATION } from '@/components/calculators/renderers';
import { Wizard } from '@/components/guided/Wizard';
import { PROFILE_FORM_SECTION_LABELS, profileFormSection } from '@/lib/calculators/forms';
import { CORE_PATHS, intakePaths, isCoreComplete, remainingIntakeScreens } from '@/lib/constants/intake';
import type { FormSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { leverageLink } from '@/lib/profile/links';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

// An injected fixture form stands in for the leverage form while
// `injected.form` is set, so the wizard mechanics are tested apart from any
// calculator's questions; the prewarm hook is a spy.
const injected = vi.hoisted(() => ({ form: null as FormSpec | null, prewarm: vi.fn() }));

vi.mock('@/lib/calculators/forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculators/forms')>();
  return {
    ...actual,
    formForFlow: (flow: Parameters<typeof actual.formForFlow>[0]) =>
      flow === 'leverage' && injected.form ? injected.form : actual.formForFlow(flow),
  };
});

vi.mock('@/components/calculators/renderers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/calculators/renderers')>();
  return { ...actual, INTAKE_PREWARM: { retirement: () => injected.prewarm() } };
});

const { push, replace } = routerMock;

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
  injected.form = null;
  injected.prewarm.mockReset();
});

afterEach(() => {
  // Unmount first, so effect cleanups still see the stubbed globals.
  cleanup();
  vi.unstubAllGlobals();
});

describe('Wizard, a saved value the intake does not offer', () => {
  it('keeps a saved filing status the intake does not offer, chosen, and moves on with it', async () => {
    useProfileStore.getState().setValues([{ path: 'person.filingStatus', value: 'headOfHousehold' }]);
    const user = userEvent.setup();
    render(<Wizard flow="core" />);

    const group = screen.getByRole('radiogroup', { name: 'Tax filing status' });
    expect(group).not.toHaveAccessibleDescription(/listed options/);
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Single',
      'Married filing jointly',
      'Head of household',
    ]);
    expect(screen.getByRole('radio', { name: 'Head of household' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What does a typical paycheck look like?' })).toBeInTheDocument();
    expect(screen.queryByText(/must be one of the listed options/)).not.toBeInTheDocument();
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
});

describe('Wizard, remaining questions of an intent', () => {
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

  it('labels profile screens with their section and finishes at the overview', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, ...intakePaths('retirement'), ...intakePaths('paycheck'), ...intakePaths('portfolio')]);
    // What is left: the screens of the sections after those three (the
    // taxable contribution, then the two cash screens, with the provisional forms).
    const left = remainingIntakeScreens('profile', useProfileStore.getState().profile);
    const cashAt = left.findIndex((s) => profileFormSection(s.id) === 'cash');
    expect(cashAt).toBeGreaterThan(0);
    render(<Wizard flow="profile" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Finish your profile' })).toBeInTheDocument();
    expect(screen.getByText('Just the questions your profile still needs.')).toBeInTheDocument();
    const label = (i: number) =>
      `${PROFILE_FORM_SECTION_LABELS[profileFormSection(left[i].id)!]} · Step ${i + 1} of ${left.length}`;
    for (let i = 0; i < cashAt; i += 1) {
      expect(screen.getByText(label(i))).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Next/ }));
    }
    expect(screen.getByText(label(cashAt))).toBeInTheDocument();
    expect(label(cashAt).startsWith('Cash and strategy · ')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Skip the rest of this section' }));

    expect(replace).toHaveBeenCalledWith('/overview');
    expect(push).not.toHaveBeenCalled();
    const { provided } = useProfileStore.getState().profile;
    for (const screen of left.slice(0, cashAt)) expect(provided).toEqual(expect.arrayContaining([...screen.fields]));
    expect(provided).not.toContain('cash.emergencyFundBalance');
  });
});

describe('Wizard, every intent finishes on its calculator', () => {
  // Each calculator intent's case (the same seeded link as before) lives in
  // its own Wizard<Calc>.test.tsx; this checks they all go through
  // INTAKE_DESTINATION and replace the wizard page.
  it.each(['paycheck', 'retirement', 'portfolio', 'leverage'] as const)(
    '%s replaces itself with its INTAKE_DESTINATION',
    async (intent) => {
      const user = userEvent.setup();
      answer(CORE_PATHS);
      render(<Wizard flow={intent} />);

      await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

      expect(push).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith(INTAKE_DESTINATION[intent](useProfileStore.getState().profile));
      expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
    }
  );

  it('profile replaces itself with the overview', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="profile" />);
    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));
    expect(replace).toHaveBeenCalledWith('/overview');
  });

  it('keeps the saved status on offer after another is chosen, so it can be chosen again', async () => {
    useProfileStore.getState().setValues([{ path: 'person.filingStatus', value: 'headOfHousehold' }]);
    const user = userEvent.setup();
    render(<Wizard flow="core" />);

    await user.click(screen.getByRole('radio', { name: 'Single' }));
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await user.click(screen.getByRole('radio', { name: 'Head of household' }));
    expect(screen.getByRole('radio', { name: 'Head of household' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'What does a typical paycheck look like?' })).toBeInTheDocument();
  });

  it('does not accept an emptied state, so a blank answer is never saved as the old state', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="core" />);
    const state = screen.getByRole('combobox', { name: 'State you live in' });
    await user.click(state);
    await user.type(state, 'zz');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(screen.getByText('State you live in is required.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What does a typical paycheck look like?' })).not.toBeInTheDocument();
    expect(useProfileStore.getState().profile.provided).not.toContain('person.state');
  });

  it('offers no "Skip the rest" in the core flow', () => {
    render(<Wizard flow="core" />);
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
  });
});

const FIXTURE: FormSpec = {
  id: 'fixture',
  fields: [
    { path: 'person.age', kind: 'number', label: 'Age now', min: 16, max: 100, step: 1, tier: 'details' },
    { path: 'person.retirementAge', kind: 'number', label: 'Stop age', min: 30, max: 85, step: 1, tier: 'details' },
    {
      path: 'investing.targetMix',
      kind: 'choice',
      label: 'Mix',
      options: [
        { value: '100-0', label: 'All stocks' },
        { value: '80-20', label: 'Mostly stocks' },
        { value: '60-40', label: 'Balanced' },
      ],
      tier: 'details',
    },
    { path: 'cash.emergencyFundBalance', kind: 'money', label: 'Cash on hand', min: 0, tier: 'details' },
    { path: 'assumptions.retirement.inflationRate', kind: 'percent', label: 'Inflation', min: 0, max: 0.1, tier: 'assumption' },
  ],
  screens: [
    { id: 'ages', title: 'Fixture ages?', tier: 'details', fields: ['person.age', 'person.retirementAge'] },
    { id: 'mix', title: 'Fixture mix?', tier: 'details', fields: ['investing.targetMix'] },
    {
      id: 'cash',
      title: 'Fixture cash?',
      tier: 'details',
      fields: ['cash.emergencyFundBalance'],
      notes: [{ text: 'A fixture note.', tone: 'caution' }],
    },
    { id: 'assume', title: 'Fixture assumptions?', tier: 'assumption', fields: ['assumptions.retirement.inflationRate'] },
  ],
  relations: [
    { lower: 'person.age', upper: 'person.retirementAge', strict: true, checkOn: 'person.retirementAge', message: 'Stop after now.' },
  ],
  onSubmit: () => [{ path: 'cash.targetMonths', value: 7 }],
};

describe('Wizard mechanics (fixture form)', () => {
  beforeEach(() => {
    injected.form = FIXTURE;
  });

  const heading = (name: string) => screen.getByRole('heading', { level: 2, name });

  it('advances, moves focus to the new question, and goes Back with the answers kept', async () => {
    render(<Wizard flow="leverage" mode="all" />);
    expect(heading('Fixture ages?')).not.toHaveFocus();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous question' })).not.toBeInTheDocument();

    const user = await typeInto('Age now', '40');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(heading('Fixture mix?')).toHaveFocus();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous question' }));

    expect(heading('Fixture ages?')).toHaveFocus();
    expect(screen.getByLabelText('Age now')).toHaveValue('40');
  });

  it('advances with Enter on the focused heading and with Enter on a choice', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(heading('Fixture mix?')).toHaveFocus();

    // A lone choice hides its label behind the screen heading but keeps its name.
    expect(screen.getByRole('radiogroup', { name: 'Mix' })).toBeInTheDocument();
    screen.getByRole('radio', { name: 'Mostly stocks' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Balanced' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Enter}');
    expect(heading('Fixture cash?')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(heading('Fixture assumptions?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));
    expect(useProfileStore.getState().profile.investing.targetMix).toBe('60-40');
  });

  it('shows a field error inline and keeps the screen', async () => {
    // A saved custom mix is not one of the fixture's options.
    useProfileStore.getState().setValues([{ path: 'investing.targetMix', value: 'custom' }]);
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(heading('Fixture mix?')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Mix' });
    expect(group).toHaveAccessibleDescription('Mix must be one of the listed options.');
    expect(screen.getAllByText('Mix must be one of the listed options.')).toHaveLength(1);

    // Choosing an option clears the message.
    await user.click(screen.getByRole('radio', { name: 'Balanced' }));
    expect(screen.queryByText('Mix must be one of the listed options.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(heading('Fixture cash?')).toBeInTheDocument();
  });

  it('shows a cross-field rule once, as the screen alert', async () => {
    render(<Wizard flow="leverage" mode="all" />);
    await typeInto('Age now', '70');
    const user = await typeInto('Stop age', '60');
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(heading('Fixture ages?')).toBeInTheDocument();
    expect(screen.getAllByText('Stop after now.')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Stop after now.');
    expect(screen.getByLabelText('Stop age')).not.toHaveAccessibleDescription(/Stop after now/);
  });

  it('saves and marks a coupled write to a path that is on no field of the screen', async () => {
    injected.form = {
      id: 'coupled',
      fields: [
        {
          path: 'workplace.has401k',
          kind: 'boolean',
          label: 'Has a 401(k)',
          tier: 'details',
          onChange: (value) => (value === false ? [{ path: 'workplace.contributionPercent', value: 0 }] : []),
        },
      ],
      screens: [{ id: 'k', title: 'Fixture 401k?', tier: 'details', fields: ['workplace.has401k'] }],
    };
    useProfileStore.getState().setValues([
      { path: 'workplace.has401k', value: true },
      { path: 'workplace.contributionPercent', value: 0.06 },
    ]);
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.workplace.has401k).toBe(false);
    expect(profile.workplace.contributionPercent).toBe(0);
    expect(profile.provided).toEqual(expect.arrayContaining(['workplace.has401k', 'workplace.contributionPercent']));
  });

  it('drops a coupled write when its screen is skipped', async () => {
    injected.form = {
      id: 'coupled',
      fields: [
        {
          path: 'workplace.has401k',
          kind: 'boolean',
          label: 'Has a 401(k)',
          tier: 'details',
          onChange: (value) => (value === false ? [{ path: 'workplace.contributionPercent', value: 0 }] : []),
        },
        { path: 'person.age', kind: 'number', label: 'Age now', min: 16, max: 100, step: 1, tier: 'details' },
      ],
      screens: [
        { id: 'k', title: 'Fixture 401k?', tier: 'details', fields: ['workplace.has401k'] },
        { id: 'age', title: 'Fixture age?', tier: 'details', fields: ['person.age'] },
      ],
    };
    useProfileStore
      .getState()
      .setValues([{ path: 'workplace.contributionPercent', value: 0.06 }], { unprovide: ['workplace.contributionPercent'] });
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Fixture age?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.workplace.contributionPercent).toBe(0.06);
    expect(profile.provided).not.toContain('workplace.contributionPercent');
  });

  it('keeps an earlier answer to a path that a skipped screen wrote as a coupled write', async () => {
    injected.form = {
      id: 'coupled',
      fields: [
        { path: 'workplace.contributionPercent', kind: 'percent', label: 'Your contribution', min: 0, max: 1, tier: 'details' },
        {
          path: 'workplace.has401k',
          kind: 'boolean',
          label: 'Has a 401(k)',
          tier: 'details',
          onChange: (value) => (value === false ? [{ path: 'workplace.contributionPercent', value: 0 }] : []),
        },
        { path: 'person.age', kind: 'number', label: 'Age now', min: 16, max: 100, step: 1, tier: 'details' },
      ],
      screens: [
        { id: 'c', title: 'Fixture contribution?', tier: 'details', fields: ['workplace.contributionPercent'] },
        { id: 'k', title: 'Fixture 401k?', tier: 'details', fields: ['workplace.has401k'] },
        { id: 'age', title: 'Fixture age?', tier: 'details', fields: ['person.age'] },
      ],
    };
    useProfileStore.getState().setValues(
      [
        { path: 'workplace.has401k', value: true },
        { path: 'workplace.contributionPercent', value: 0.06 },
      ],
      { unprovide: ['workplace.has401k', 'workplace.contributionPercent'] }
    );
    render(<Wizard flow="leverage" mode="all" />);
    const user = await typeInto('Your contribution', '10');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Fixture age?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.workplace.contributionPercent).toBe(0.1);
    expect(profile.workplace.has401k).toBe(true);
    expect(profile.provided).toContain('workplace.contributionPercent');
    expect(profile.provided).not.toContain('workplace.has401k');
  });

  it('renders the screen notes', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    expect(screen.queryByText('A fixture note.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    expect(screen.getByText('A fixture note.')).toBeInTheDocument();
  });

  it('keeps the default assumptions on the assumption screen, which has no "Skip the rest"', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(heading('Fixture assumptions?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip, use a typical value' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    await typeInto('Inflation', '5');
    await user.click(screen.getByRole('button', { name: 'Keep the default assumptions' }));

    const { profile } = useProfileStore.getState();
    expect(profile.assumptions.retirement.inflationRate).toBe(getDefaultFinancialProfile().assumptions.retirement.inflationRate);
    expect(profile.provided).toEqual([
      'person.age',
      'person.retirementAge',
      'investing.targetMix',
      'cash.emergencyFundBalance',
    ]);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('skips the rest: finishes now, saving answered screens and the derived writes only', async () => {
    render(<Wizard flow="leverage" mode="all" />);
    const user = await typeInto('Age now', '41');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('radio', { name: 'All stocks' }));
    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    const { profile } = useProfileStore.getState();
    expect(profile.person.age).toBe(41);
    expect(profile.investing.targetMix).toBe(getDefaultFinancialProfile().investing.targetMix);
    expect(profile.cash.targetMonths).toBe(7);
    expect(profile.provided).toEqual(['person.age', 'person.retirementAge']);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(leverageLink(profile));
  });
});

describe('Wizard, prewarm hook', () => {
  it('warms the retirement intake once when idle, never during render', () => {
    const idle: (() => void)[] = [];
    const requestIdleCallback = vi.fn((callback: () => void) => idle.push(callback));
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', vi.fn());

    render(<Wizard flow="retirement" mode="all" />);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(injected.prewarm).not.toHaveBeenCalled();

    idle.forEach((callback) => callback());
    expect(injected.prewarm).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending warm-up when the wizard unmounts first', () => {
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', vi.fn(() => 17));
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const { unmount } = render(<Wizard flow="retirement" mode="all" />);
    unmount();
    expect(cancelIdleCallback).toHaveBeenCalledWith(17);
    expect(injected.prewarm).not.toHaveBeenCalled();
  });

  it('falls back to a timeout where requestIdleCallback is missing', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const user = userEvent.setup();
    render(<Wizard flow="retirement" mode="all" />);
    expect(injected.prewarm).not.toHaveBeenCalled();
    await waitFor(() => expect(injected.prewarm).toHaveBeenCalledTimes(1));

    // Answering more screens does not warm it again.
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(injected.prewarm).toHaveBeenCalledTimes(1);
  });

  it('has nothing to warm for the core flow or an intent without a hook', () => {
    const requestIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    render(<Wizard flow="core" />);
    render(<Wizard flow="leverage" mode="all" />);
    render(<Wizard flow="profile" mode="all" />);
    expect(requestIdleCallback).not.toHaveBeenCalled();
  });
});
