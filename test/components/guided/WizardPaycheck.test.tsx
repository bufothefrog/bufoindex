/**
 * The paycheck intent in the wizard, with the grown PAYCHECK_FORM: seven
 * screens after the core (fun money and bonuses, emergency fund, 401(k),
 * HSA, IRAs and taxable investing, debts, assumptions), the debts list with
 * its "I have no debts" answer (O4), the skip affordances, and the finish on
 * the allocator path with from=profile and no hash. The wizard mechanics
 * are tested apart in Wizard.test.tsx.
 */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { intakePaths } from '@/test/utils/intakeFixture';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { answer, typeInto } from '@/test/utils/wizard';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const { push, replace } = routerMock;

const CALCULATOR = '/tools/paycheck-allocator?from=profile';

/** Every paycheck question but the debts and the assumptions. */
const BEFORE_DEBTS = intakePaths('paycheck').filter(
  (path) =>
    path !== 'debts' &&
    path !== 'cash.targetMonths' &&
    !path.startsWith('assumptions.')
);

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

const next = () => userEvent.setup().click(screen.getByRole('button', { name: /Next/ }));

describe('Wizard, paycheck intent', () => {
  it('asks the seven paycheck screens after the core and opens the allocator', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="paycheck" />);

    // 1. Fun money and bonuses: the bonus details follow the bonus answer.
    expect(screen.getByRole('heading', { name: 'How much fun money do you want each month?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip, use a typical value' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip the rest' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Average bonus amount')).not.toBeInTheDocument();
    await typeInto('At least, per month', '200');
    await user.click(within(screen.getByRole('radiogroup', { name: 'I receive regular bonuses' })).getByRole('radio', { name: /^Yes/ }));
    expect(screen.getByLabelText('Average bonus amount')).toBeInTheDocument();
    expect(
      screen.getByText('Bonuses are recorded for context; the per-paycheck allocation math is based on regular paychecks only.')
    ).toBeInTheDocument();
    await typeInto('Average bonus amount', '5000');
    await next();

    // 2. Emergency fund.
    expect(screen.getByRole('heading', { name: 'What does your emergency fund look like today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
    await typeInto('Cash set aside for emergencies', '8000');
    await next();

    // 3. 401(k): "No" hides the plan terms.
    expect(screen.getByRole('heading', { name: 'Does your employer offer a 401(k) or similar plan?' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
    expect(screen.getByLabelText('Employer match rate')).toBeInTheDocument();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Workplace retirement plan' })).getByRole('radio', { name: 'No' }));
    expect(screen.queryByLabelText('Employer match rate')).not.toBeInTheDocument();
    await next();

    // 4. HSA: skipped, so its typical values stay unanswered.
    expect(screen.getByRole('heading', { name: 'Do you have a health savings account (HSA)?' })).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));

    // 5. IRAs and taxable investing: skipped.
    expect(screen.getByRole('heading', { name: 'Do you invest in an IRA or a taxable account?' })).toBeInTheDocument();
    expect(screen.getByText('Step 5 of 7')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));

    // 6. Debts: "I have no debts" answers the screen with the empty list.
    expect(screen.getByRole('heading', { name: 'Do you have any debts?' })).toBeInTheDocument();
    expect(screen.getByText('Step 6 of 7')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I have no debts' }));

    // 7. Assumptions, last: no "Skip the rest".
    expect(screen.getByRole('heading', { name: 'Which assumptions should the allocation use?' })).toBeInTheDocument();
    expect(screen.getByText('Step 7 of 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep the default assumptions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Emergency fund target')).toBeInTheDocument();
    expect(screen.getByLabelText('Expected tax bracket in retirement')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));

    const { profile } = useProfileStore.getState();
    expect(profile.spending.funMoneyMin).toBe(200);
    expect(profile.income).toMatchObject({ hasBonus: true, bonusAmount: 5000 });
    expect(profile.cash.emergencyFundBalance).toBe(8000);
    expect(profile.workplace.has401k).toBe(false);
    expect(profile.debts).toEqual([]);
    expect(profile.provided).toEqual([
      ...CORE_PATHS,
      'spending.funMoneyMin',
      'spending.funMoneyMax',
      'income.hasBonus',
      'income.bonusAmount',
      'income.bonusFrequency',
      'cash.emergencyFundBalance',
      'cash.emergencyFundApy',
      'workplace.has401k',
      'debts',
      'cash.targetMonths',
      'assumptions.paycheck.riskTolerance',
      'assumptions.paycheck.optimizationGoal',
      'assumptions.paycheck.expectedRetirementBracket',
    ]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(push).not.toHaveBeenCalled();
  });

  it('adds a debt row with its rate badge and the totals, and drops "I have no debts"', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, ...BEFORE_DEBTS]);
    render(<Wizard flow="paycheck" />);

    expect(screen.getByRole('heading', { name: 'Do you have any debts?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('No debts added yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add a debt' }));
    expect(screen.queryByRole('button', { name: 'I have no debts' })).not.toBeInTheDocument();
    expect(screen.getByText('7% or less')).toBeInTheDocument();
    await typeInto('Debt name', 'Card');
    await typeInto('Balance', '3000');
    await typeInto('Interest rate', '18');
    await typeInto('Minimum payment', '90');
    expect(screen.getByText('High-interest (over 7%)')).toBeInTheDocument();
    expect(screen.getByText('Total debt')).toBeInTheDocument();
    expect(screen.getByText('$3,000')).toBeInTheDocument();
    expect(screen.getByText('Monthly payments')).toBeInTheDocument();
    await next();

    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep the default assumptions' }));

    const [debt] = useProfileStore.getState().profile.debts;
    expect(debt).toMatchObject({ name: 'Card', balance: 3000, interestRate: 0.18, minimumPayment: 90, extraPayment: 0 });
    expect(useProfileStore.getState().profile.provided).toContain('debts');
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
  });

  it('asks the core first in "all" mode, with the tax note, then the same seven screens', () => {
    render(<Wizard flow="paycheck" mode="all" />);
    expect(screen.getByRole('heading', { name: 'A little about you' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tax savings in this allocator use a fixed 22% federal bracket plus one 2026 rate for your state. Brackets are not calculated from your income.'
      )
    ).toBeInTheDocument();
  });

  it('skips a fully answered screen in "remaining" mode', () => {
    answer([...CORE_PATHS, 'spending.funMoneyMin', 'spending.funMoneyMax', 'income.hasBonus']);
    render(<Wizard flow="paycheck" />);
    expect(screen.getByRole('heading', { name: 'What does your emergency fund look like today?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('shows a broken fun-money range as the screen alert and stays on the screen', async () => {
    answer(CORE_PATHS);
    render(<Wizard flow="paycheck" />);

    await typeInto('At least, per month', '900');
    await next();

    expect(screen.getByRole('alert')).toHaveTextContent('The minimum is above the maximum. Adjust one of them.');
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('goes straight to the allocator when nothing is left to ask', () => {
    answer([...CORE_PATHS, ...intakePaths('paycheck')]);
    render(<Wizard flow="paycheck" mode="remaining" />);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(screen.queryByRole('button', { name: /Next|Finish/ })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('replaces itself with the allocator on "Skip the rest", leaving the skipped screens unanswered', async () => {
    const user = userEvent.setup();
    answer(CORE_PATHS);
    render(<Wizard flow="paycheck" />);

    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(CALCULATOR);
    expect(replace.mock.calls[0][0]).not.toContain('#');
    expect(useProfileStore.getState().profile.provided).toEqual([...CORE_PATHS]);
  });
});
