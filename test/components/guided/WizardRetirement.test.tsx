/**
 * The retirement intent in the wizard, with the grown RETIREMENT_FORM: two
 * screens after the core (savings, target; the optional Social Security and
 * healthcare screen is left to the calculator page and the profile form, and
 * the claiming age and the assumptions to the calculator page), the skip
 * affordances, and the finish on the calculator path
 * with from=profile and no hash. The wizard mechanics are tested apart in
 * Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INTAKE_PREWARM } from '@/components/calculators/renderers';
import { RETIREMENT_INTAKE_PREWARM } from '@/components/calculators/renderers/retirement';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { intakePaths } from '@/test/utils/intakeFixture';
import { useProfileStore } from '@/lib/store/profileStore';
import { retirementRunner } from '@/lib/store/retirementStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';
import { skipToEnd } from './wizardSteps';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;

const CALCULATOR = '/tools/retirement-calculator?from=profile';

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const next = () => userEvent.setup().click(screen.getByRole('button', { name: /Next/ }));

describe('Wizard, retirement intent', () => {
  it('asks the two retirement screens after the core and opens the calculator', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);

    expect(screen.getByRole('heading', { level: 1, name: 'See if I am on track to retire' })).toBeInTheDocument();
    expect(screen.getByText('Opens the Retirement Calculator and runs the simulation with your answers.')).toBeInTheDocument();

    // 1. Savings.
    expect(screen.getByRole('heading', { name: 'What are you investing today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly investing contribution')).toBeInTheDocument();
    expect(screen.getByLabelText('Invested balance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invested balance')).toHaveValue('');
    expect(screen.getByText('Grey values are typical. Next uses them for anything left blank.')).toBeInTheDocument();
    await typeInto('Monthly investing contribution', '900');
    await next();

    // 2. Target.
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(screen.getByText("Your target income is in today's dollars.")).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    await typeInto('Target retirement age', '62');
    await typeInto('Target annual income in retirement', '70000');
    await typeInto('Life expectancy', '90');
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    // Nothing else is asked: not the optional Social Security and healthcare screen, not the claiming
    // age (calculator-only) and not the assumptions (a card on the calculator page).
    expect(screen.queryByRole('heading', { name: 'What will Social Security and healthcare look like?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Which assumptions should the projection use?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Social Security claiming age' })).not.toBeInTheDocument();

    const { profile } = useProfileStore.getState();
    expect(profile.investing.monthlyContribution).toBe(900);
    expect(profile.person.retirementAge).toBe(62);
    expect(profile.spending.targetRetirementIncome).toBe(70000);
    expect(profile.person.lifeExpectancy).toBe(90);
    expect(profile.assumptions.retirement.riskProfile).toBe('tdf');
    expect(profile.retirementIncome).toEqual({ socialSecurityBenefit: 30000, socialSecurityAge: 67, annualHealthcareCost: null });
    expect(profile.provided).toEqual([
      ...CORE_PATHS,
      'investing.monthlyContribution',
      'investing.investedBalance',
      'person.retirementAge',
      'spending.targetRetirementIncome',
      'person.lifeExpectancy',
    ]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(push).not.toHaveBeenCalled();
  });

  it('asks the core first in "all" mode, then the same two screens', () => {
    render(<Wizard flow="retirement" mode="all" />);
    expect(screen.getByRole('heading', { name: 'A little about you' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('skips a fully answered screen in "remaining" mode', () => {
    answer([...CORE_PATHS, 'investing.monthlyContribution', 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument();
  });

  it('shows a broken relation as the screen alert and stays on the screen', async () => {
    answer([...CORE_PATHS, 'investing.monthlyContribution', 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);

    await typeInto('Target retirement age', '70');
    await typeInto('Life expectancy', '65');
    await userEvent.setup().click(screen.getByRole('button', { name: /Finish/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Life expectancy needs to be at least your retirement age.');
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('goes straight to the calculator when nothing is left to ask', () => {
    answer([...CORE_PATHS, ...intakePaths('retirement')]);
    render(<Wizard flow="retirement" mode="remaining" />);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(screen.getByLabelText('Loading questions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('replaces itself with the calculator after skipping every screen, leaving them unanswered', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);

    expect(await skipToEnd(user)).toBe(2);

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });

  it('starts the retirement worker while the visitor answers', async () => {
    expect(INTAKE_PREWARM.retirement).toBe(RETIREMENT_INTAKE_PREWARM);
    const prewarm = vi.spyOn(retirementRunner, 'prewarm');
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);
    await waitFor(() => expect(prewarm).toHaveBeenCalledTimes(1));
  });
});
