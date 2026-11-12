/**
 * The retirement intent in the wizard, with the grown RETIREMENT_FORM: four
 * screens after the core (savings, target, Social Security and healthcare,
 * assumptions), the skip affordances, and the finish on the calculator path
 * with from=profile and no hash. The wizard mechanics are tested apart in
 * Wizard.test.tsx.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  it('asks the four retirement screens after the core and opens the calculator', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);

    expect(screen.getByRole('heading', { level: 1, name: 'See if I am on track to retire' })).toBeInTheDocument();
    expect(screen.getByText('Everything this calculator uses, a few related questions per screen.')).toBeInTheDocument();

    // 1. Savings.
    expect(screen.getByRole('heading', { name: 'What are you investing today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly investing contribution')).toBeInTheDocument();
    expect(screen.getByLabelText('Invested balance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip, use a typical value' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip the rest' })).toBeInTheDocument();
    await typeInto('Monthly investing contribution', '900');
    await next();

    // 2. Target.
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(screen.getByText("Your target income is in today's dollars.")).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    await typeInto('Target retirement age', '62');
    await typeInto('Target annual income in retirement', '70000');
    await typeInto('Life expectancy', '90');
    await next();

    // 3. Social Security and healthcare: skipped, so its typical values stay.
    expect(screen.getByRole('heading', { name: 'What will Social Security and healthcare look like?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security benefit')).toBeInTheDocument();
    expect(screen.getByLabelText('Social Security age')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Annual healthcare cost' })).toHaveTextContent(
      'Typical cost the model uses: $7,500'
    );
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));

    // 4. Assumptions, last: no "Skip the rest"; the custom inputs follow the risk profile.
    expect(screen.getByRole('heading', { name: 'Which assumptions should the projection use?' })).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep the default assumptions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can change any answer on the calculator.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Accumulation return' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Inflation rate' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Effective tax rate' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Healthcare cost multiplier' })).toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Risk profile' })).getByRole('radio', { name: /Custom/ }));
    expect(screen.getByRole('textbox', { name: 'Accumulation return' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Retirement return' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Portfolio volatility' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.investing.monthlyContribution).toBe(900);
    expect(profile.person.retirementAge).toBe(62);
    expect(profile.spending.targetRetirementIncome).toBe(70000);
    expect(profile.person.lifeExpectancy).toBe(90);
    expect(profile.assumptions.retirement.riskProfile).toBe('custom');
    expect(profile.retirementIncome).toEqual({ socialSecurityBenefit: 30000, socialSecurityAge: 67, annualHealthcareCost: null });
    expect(profile.provided).toEqual([
      ...CORE_PATHS,
      'investing.monthlyContribution',
      'investing.investedBalance',
      'person.retirementAge',
      'spending.targetRetirementIncome',
      'person.lifeExpectancy',
      'assumptions.retirement.riskProfile',
      'assumptions.retirement.accumulationReturn',
      'assumptions.retirement.retirementReturn',
      'assumptions.retirement.volatility',
      'assumptions.retirement.inflationRate',
      'assumptions.retirement.effectiveTaxRate',
      'assumptions.retirement.healthcareCostMultiplier',
    ]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(push).not.toHaveBeenCalled();
  });

  it('asks the core first in "all" mode, then the same four screens', () => {
    render(<Wizard flow="retirement" mode="all" />);
    expect(screen.getByRole('heading', { name: 'A little about you' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
  });

  it('skips a fully answered screen in "remaining" mode', () => {
    answer([...CORE_PATHS, 'investing.monthlyContribution', 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);
    expect(screen.getByRole('heading', { name: 'When would you like to retire?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('shows a broken relation as the screen alert and stays on the screen', async () => {
    answer([...CORE_PATHS, 'investing.monthlyContribution', 'investing.investedBalance']);
    render(<Wizard flow="retirement" />);

    await typeInto('Target retirement age', '70');
    await typeInto('Life expectancy', '65');
    await next();

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

  it('replaces itself with the calculator on "Skip the rest", leaving the skipped screens unanswered', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="retirement" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

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
