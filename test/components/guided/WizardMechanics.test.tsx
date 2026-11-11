import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nextNavigationFactory, resetRouterMock, routerMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { Wizard } from '@/components/guided/Wizard';
import { CORE_PATHS } from '@/lib/constants/intake';
import { useProfileStore } from '@/lib/store/profileStore';

vi.mock('next/navigation', () => nextNavigationFactory());

// Wizard mechanics on a fixture form injected as the leverage intent, so the
// assertions do not depend on any calculator's real question set.
const FIXTURE_HREF = '/tools/leverage-comparison?from=profile';

vi.mock('@/lib/calculators/forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculators/forms')>();
  const shared = await import('@/lib/fields/shared');
  const fixture: import('@/lib/fields/types').FormSpec = {
    id: 'leverage',
    fields: [
      shared.AGE,
      shared.withOverrides(shared.RETIREMENT_AGE, { label: 'Stop age' }),
      shared.withOverrides(shared.INVESTED_BALANCE, { label: 'Balance', max: 10000 }),
      {
        path: 'workplace.has401k',
        kind: 'boolean',
        label: 'Plan',
        tier: 'details',
      },
      {
        path: 'workplace.matchPercent',
        kind: 'percent',
        label: 'Match rate',
        min: 0,
        max: 2,
        tier: 'details',
        visibleWhen: (get) => get('workplace.has401k') === true,
      },
      {
        path: 'assumptions.leverage.financingRate',
        kind: 'percent',
        label: 'Financing rate',
        min: 0,
        max: 0.2,
        tier: 'assumption',
      },
    ],
    screens: [
      // The assumption screen is listed first on purpose: the wizard asks it last (O3).
      { id: 'market', title: 'Market assumptions', tier: 'assumption', fields: ['assumptions.leverage.financingRate'] },
      { id: 'horizon', title: 'Horizon screen', tier: 'details', fields: ['person.age', 'person.retirementAge'] },
      { id: 'balance', title: 'Balance screen', tier: 'details', fields: ['investing.investedBalance'] },
      { id: 'plan', title: 'Plan screen', tier: 'details', fields: ['workplace.has401k'] },
      { id: 'match', title: 'Match screen', tier: 'details', fields: ['workplace.matchPercent'] },
    ],
    relations: [shared.AGE_BELOW_RETIREMENT],
    onSubmit: shared.intakeOnSubmit,
  };
  return {
    ...actual,
    FORMS: { ...actual.FORMS, leverage: fixture },
    INTAKE_DESTINATIONS: { ...actual.INTAKE_DESTINATIONS, leverage: () => FIXTURE_HREF },
    formForFlow: (flow: Parameters<typeof actual.formForFlow>[0]) =>
      flow === 'leverage' ? fixture : actual.formForFlow(flow),
  };
});

const { push, replace } = routerMock;

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  useProfileStore.getState().reset();
  resetProfileStore({ hydrated: true });
});

function answer(paths: readonly string[]) {
  useProfileStore.getState().setValues([], { provide: [...paths] });
}

/** A profile within the fixture's balance bound, with the basics answered. */
function seedValidProfile() {
  useProfileStore.getState().setValues([{ path: 'investing.investedBalance', value: 5000 }], { provide: [...CORE_PATHS] });
}

const heading = (name: string) => screen.getByRole('heading', { level: 2, name });

describe('Wizard mechanics (fixture form)', () => {
  it('advances, goes back with answers kept, moves focus, and asks the assumption screen last', async () => {
    const user = userEvent.setup();
    seedValidProfile();
    render(<Wizard flow="leverage" mode="all" />);

    // 'all' mode keeps the core field on the shared screen.
    expect(heading('Horizon screen')).toBeInTheDocument();
    expect(heading('Horizon screen')).not.toHaveFocus();
    // horizon, balance, plan, match (the plan defaults to Yes), market.
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Your age')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous question' })).not.toBeInTheDocument();

    const stop = screen.getByLabelText('Stop age');
    await user.clear(stop);
    await user.type(stop, '62');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(heading('Balance screen')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Previous question' }));
    expect(heading('Horizon screen')).toHaveFocus();
    expect(screen.getByLabelText('Stop age')).toHaveValue('62');

    // Enter on the focused heading advances too.
    heading('Horizon screen').focus();
    await user.keyboard('{Enter}');
    expect(heading('Balance screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(heading('Plan screen')).toBeInTheDocument();

    // A choice selected with Enter advances in one step; "No" hides the match screen.
    screen.getByRole('radio', { name: 'No' }).focus();
    await user.keyboard('{Enter}');
    expect(heading('Market assumptions')).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(
      screen.getByText('Filled in with the default assumptions. Change any of them, or keep the defaults.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep the default assumptions' }));

    expect(replace).toHaveBeenCalledWith(FIXTURE_HREF);
    expect(push).not.toHaveBeenCalled();
    const { profile } = useProfileStore.getState();
    expect(profile.person.retirementAge).toBe(62);
    expect(profile.workplace.has401k).toBe(false);
    expect(profile.provided).toEqual(
      expect.arrayContaining(['person.age', 'person.retirementAge', 'investing.investedBalance', 'workplace.has401k'])
    );
    expect(profile.provided).not.toContain('assumptions.leverage.financingRate');
  });

  it('shows a field bound inline and a relation as the screen alert', async () => {
    const user = userEvent.setup();
    // The default balance (25,000) is above the fixture's 10,000 bound.
    answer(CORE_PATHS);
    render(<Wizard flow="leverage" mode="all" />);

    const age = screen.getByLabelText('Your age');
    await user.clear(age);
    await user.type(age, '70');
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const relation = screen.getByRole('alert');
    expect(relation).toHaveTextContent('The retirement age needs to be above your current age.');
    expect(relation).toHaveAttribute('id', 'intake-error-horizon');
    expect(heading('Horizon screen')).toBeInTheDocument();

    // Editing clears the message.
    await user.clear(age);
    await user.type(age, '30');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));

    expect(heading('Balance screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const inline = screen.getByRole('alert');
    expect(inline).toHaveTextContent(/Enter a value between \$0 and \$10,000/);
    expect(inline).not.toHaveAttribute('id', 'intake-error-balance');
    expect(heading('Balance screen')).toBeInTheDocument();
  });

  it('drops core fields from shared screens in remaining mode and skips answered screens', async () => {
    const user = userEvent.setup();
    answer([...CORE_PATHS, 'investing.investedBalance']);
    render(<Wizard flow="leverage" />);

    expect(heading('Horizon screen')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your age')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Stop age')).toBeInTheDocument();
    // horizon, plan, match (plan defaults to Yes), market; balance is answered.
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(heading('Plan screen')).toBeInTheDocument();
  });

  it('skips one screen back to its starting values, unmarked', async () => {
    const user = userEvent.setup();
    seedValidProfile();
    render(<Wizard flow="leverage" mode="all" />);

    const stop = screen.getByLabelText('Stop age');
    await user.clear(stop);
    await user.type(stop, '50');
    await user.click(screen.getByRole('button', { name: 'Skip, use a typical value' }));
    expect(heading('Balance screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip the rest' }));

    expect(replace).toHaveBeenCalledWith(FIXTURE_HREF);
    const { profile } = useProfileStore.getState();
    expect(profile.person.retirementAge).toBe(60);
    expect(profile.provided).toEqual([...CORE_PATHS]);
  });

  it('offers "Skip the rest" on every screen but the last', async () => {
    const user = userEvent.setup();
    seedValidProfile();
    render(<Wizard flow="leverage" mode="all" />);
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByRole('button', { name: 'Skip the rest' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Next/ }));
    }
    expect(heading('Market assumptions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the rest' })).not.toBeInTheDocument();
    expect(screen.getByText('Good enough to start. You can refine the details on the calculator.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Finish/ }));
    expect(replace).toHaveBeenCalledWith(FIXTURE_HREF);
  });
});
