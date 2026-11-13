/**
 * The wizard's grey typical value for each derived leaf (lib/profile/derived.ts)
 * follows the answers given on an earlier screen, and Next saves it as the
 * visitor's answer like any typical value. A fixture form stands in for the
 * leverage form: screen one asks the dependencies, screen two the derived
 * leaves.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wizard } from '@/components/guided/Wizard';
import { HSA_COVERAGE_OPTIONS } from '@/lib/constants/labels';
import type { FormSpec } from '@/lib/fields/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';
import { typeInto } from '@/test/utils/wizard';
import { next, skip } from './wizardSteps';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

const injected = vi.hoisted(() => ({ form: null as FormSpec | null }));

vi.mock('@/lib/calculators/forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calculators/forms')>();
  return {
    ...actual,
    formForFlow: (flow: Parameters<typeof actual.formForFlow>[0]) =>
      flow === 'leverage' && injected.form ? injected.form : actual.formForFlow(flow),
  };
});

const FORM: FormSpec = {
  id: 'derived-fixture',
  fields: [
    {
      path: 'person.filingStatus',
      kind: 'choice',
      label: 'Filing',
      options: [
        { value: 'single', label: 'Single' },
        { value: 'marriedJoint', label: 'Married filing jointly' },
      ],
      tier: 'details',
    },
    { path: 'spending.necessaryMonthly', kind: 'money', label: 'Must-pay', min: 0, tier: 'details' },
    { path: 'spending.funMoneyMin', kind: 'money', label: 'Fun low', min: 0, tier: 'details' },
    { path: 'spending.funMoneyMax', kind: 'money', label: 'Fun high', min: 0, tier: 'details' },
    { path: 'cash.emergencyFundBalance', kind: 'money', label: 'Emergency fund', min: 0, tier: 'details' },
    { path: 'spending.targetRetirementIncome', kind: 'money', label: 'Retirement income', min: 0, tier: 'details' },
    { path: 'hsa.coverage', kind: 'choice', label: 'Coverage', options: HSA_COVERAGE_OPTIONS, tier: 'details' },
  ],
  screens: [
    {
      id: 'inputs',
      title: 'Fixture inputs?',
      tier: 'details',
      fields: ['person.filingStatus', 'spending.necessaryMonthly', 'spending.funMoneyMin', 'spending.funMoneyMax'],
    },
    {
      id: 'derived',
      title: 'Fixture derived?',
      tier: 'details',
      fields: ['cash.emergencyFundBalance', 'spending.targetRetirementIncome', 'hsa.coverage'],
    },
  ],
};

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
  injected.form = FORM;
});

afterEach(() => {
  cleanup();
  injected.form = null;
});

const coverage = () => screen.getByRole('radiogroup', { name: 'Coverage' });

describe('Wizard, derived typical values', () => {
  it('shows each derived grey value from the answers on the earlier screen, and Next saves them as answers', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('radio', { name: 'Married filing jointly' }));
    await typeInto('Must-pay', '2000');
    await typeInto('Fun low', '200');
    await typeInto('Fun high', '400');
    await next(user);

    expect(screen.getByRole('heading', { level: 2, name: 'Fixture derived?' })).toBeInTheDocument();
    // 3 x 2,000.
    expect(screen.getByLabelText('Emergency fund')).toHaveValue('');
    expect(screen.getByLabelText('Emergency fund')).toHaveAttribute('placeholder', '6,000');
    // 12 x (2,000 + 300) = 27,600, to the nearest 1,000.
    expect(screen.getByLabelText('Retirement income')).toHaveAttribute('placeholder', '28,000');
    // Filing jointly: family coverage is the typical choice.
    expect(within(coverage()).getByRole('radio', { name: 'Family' })).toHaveAccessibleDescription('Typical');
    expect(within(coverage()).getByRole('radio', { name: 'Individual' })).not.toHaveAccessibleDescription('Typical');

    await next(user);
    const { profile } = useProfileStore.getState();
    expect(profile.cash.emergencyFundBalance).toBe(6000);
    expect(profile.spending.targetRetirementIncome).toBe(28000);
    expect(profile.hsa.coverage).toBe('family');
    expect(profile.provided).toEqual(
      expect.arrayContaining(['cash.emergencyFundBalance', 'spending.targetRetirementIncome', 'hsa.coverage'])
    );
  });

  it('derives from the typical values when the earlier screen is skipped', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await skip(user);
    // Must-pay 3,000 and fun money 300 to 600 are the typical values; single.
    expect(screen.getByLabelText('Emergency fund')).toHaveAttribute('placeholder', '9,000');
    expect(screen.getByLabelText('Retirement income')).toHaveAttribute('placeholder', '41,000');
    expect(within(coverage()).getByRole('radio', { name: 'Individual' })).toHaveAccessibleDescription('Typical');
  });

  it('ignores a stale stored value for an unanswered derived leaf', async () => {
    useProfileStore.setState((state) => ({
      profile: { ...state.profile, cash: { ...state.profile.cash, emergencyFundBalance: 5000 } },
    }));
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await typeInto('Must-pay', '1500');
    await next(user);
    expect(screen.getByLabelText('Emergency fund')).toHaveAttribute('placeholder', '4,500');
  });

  it('keeps an answered derived leaf as answered, whatever the must-pay answer', async () => {
    useProfileStore.getState().setValues([{ path: 'cash.emergencyFundBalance', value: 1234 }]);
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await typeInto('Must-pay', '2000');
    await next(user);
    expect(screen.getByLabelText('Emergency fund')).toHaveValue('1,234');
    await next(user);
    expect(useProfileStore.getState().profile.cash.emergencyFundBalance).toBe(1234);
  });

  it('keeps the Typical tag on the derived choice after the visitor picks the other one', async () => {
    const user = userEvent.setup();
    render(<Wizard flow="leverage" mode="all" />);
    await user.click(screen.getByRole('radio', { name: 'Married filing jointly' }));
    await next(user);
    await user.click(within(coverage()).getByRole('radio', { name: 'Individual' }));
    expect(within(coverage()).getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true');
    expect(within(coverage()).getByRole('radio', { name: 'Family' })).toHaveAccessibleDescription('Typical');
    await next(user);
    expect(useProfileStore.getState().profile.hsa.coverage).toBe('individual');
  });
});
