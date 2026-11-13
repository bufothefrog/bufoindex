/**
 * The engine names its first emergency fund step '1-Month Emergency Fund'
 * and says one month of expenses provides essential protection. Every page
 * that renders an allocation item shows that step as the starter emergency
 * fund instead (PR 3, second fix round): the overview's paycheck card and
 * automation checklist and the allocator's payroll setup guide at every
 * automation level.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AutomationChecklistCard } from '@/components/dashboard/AutomationChecklistCard';
import { PaycheckCard } from '@/components/dashboard/PaycheckCard';
import { PayrollSetupGuide } from '@/components/paycheck-allocator/PayrollSetupGuide';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import type { AllocationResult, PaycheckProfile } from '@/lib/types';
import { createPaycheckProfile, createUserPreferences } from '@/test/factories/test-data-factory';

const OLD_TEXT = /1-Month Emergency Fund|one month of expenses|1-month emergency fund/i;

/** A paycheck with $500 of cash against $3,000 of monthly expenses: under one month. */
function starterProfile(): PaycheckProfile {
  return createPaycheckProfile({
    lastUpdated: 0,
    debts: [],
    preferences: createUserPreferences({ currentEmergencyFund: 500, necessaryExpenses: 3000 }),
  });
}

function starterAllocation(profile: PaycheckProfile): AllocationResult {
  const result = calculateOptimalAllocation(profile);
  // The engine still names the step by its one-month name.
  expect(result.allocations.map((item) => item.account)).toContain('1-Month Emergency Fund');
  return result;
}

beforeEach(() => {
  usePreferencesStore.setState({ displayMode: 'today' });
});

afterEach(cleanup);

describe('the starter step on screen', () => {
  it('the overview paycheck card shows the starter label and reasoning', () => {
    const profile = starterProfile();
    const { container } = render(<PaycheckCard inputs={profile} allocation={starterAllocation(profile)} />);
    expect(container.textContent).not.toMatch(OLD_TEXT);
    expect(screen.getByText('Starter Emergency Fund')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A first cash buffer for small surprises, built before the steps below and before the full emergency fund target.'
      )
    ).toBeInTheDocument();
  });

  it('the overview automation checklist shows the starter label', () => {
    const profile = starterProfile();
    const { container } = render(
      <AutomationChecklistCard profile={getDefaultFinancialProfile()} allocation={starterAllocation(profile)} />
    );
    expect(container.textContent).not.toMatch(OLD_TEXT);
    expect(screen.getByText('Starter Emergency Fund')).toBeInTheDocument();
  });

  it('the allocator payroll guide shows the starter label at every automation level', async () => {
    const user = userEvent.setup();
    const profile = starterProfile();
    const { container } = render(<PayrollSetupGuide profile={profile} result={starterAllocation(profile)} />);
    for (const level of ['Basic', 'Intermediate', 'Advanced']) {
      await user.click(screen.getByRole('radio', { name: new RegExp(level) }));
      expect(container.textContent, level).not.toMatch(OLD_TEXT);
      expect(container.textContent, level).toMatch(/Starter Emergency Fund: \$/);
    }
  });
});
