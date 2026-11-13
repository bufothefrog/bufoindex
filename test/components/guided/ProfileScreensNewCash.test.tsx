/**
 * A Custom new cash typed on the rebalancer (the calculator-only
 * portfolio.newCash) never changes the profile screens a visitor sees: the
 * review page's "N of M" line, its topic list and its remaining-questions
 * link, and the steps the profile wizard asks in remaining mode, agree with
 * and without it (intakeScreens in lib/calculators/forms.ts).
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProfileReview } from '@/components/guided/ProfileReview';
import { Wizard } from '@/components/guided/Wizard';
import { PROFILE_FORM } from '@/lib/calculators/forms';
import { makeGet } from '@/lib/fields/paths';
import { screensFor } from '@/lib/fields/runtime';
import { getDefaultFinancialProfile } from '@/lib/profile/defaults';
import type { FinancialProfile } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetRouterMock } from '@/test/utils/navigation';
import { clearBrowserState, resetProfileStore } from '@/test/utils/stores';

vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory());

beforeEach(() => {
  resetRouterMock();
  clearBrowserState();
  resetProfileStore();
});

afterEach(() => {
  cleanup();
});

/** One stored empty brokerage, no 401(k), taxable 0, every profile topic answered but `leave`. */
function emptyBrokerage(leave: readonly string[]): FinancialProfile {
  const profile = getDefaultFinancialProfile();
  profile.workplace.has401k = false;
  profile.investing.taxableMonthlyContribution = 0;
  profile.portfolio.accounts = [{ id: 'acc-b', kind: 'brokerage', name: '', balance: 0, holdsEmergencyFund: false }];
  profile.portfolio.holdings = [];
  profile.portfolio.securities = [];
  const shown = screensFor(PROFILE_FORM, makeGet(profile), { mode: 'all', surface: 'intake' }).filter(
    (s) => !leave.includes(s.id)
  );
  profile.provided = Array.from(
    new Set(['workplace.has401k', 'investing.taxableMonthlyContribution', ...shown.flatMap((s) => s.fields)])
  );
  return profile;
}

const withCustom = (profile: FinancialProfile, id: string, amount: number): FinancialProfile => ({
  ...profile,
  portfolio: { ...profile.portfolio, newCash: [{ id, amount }] },
});

/** What the review page shows: its count line, its topic headings and whether the remaining-questions link shows. */
function reviewOf(profile: FinancialProfile) {
  useProfileStore.setState({ profile, hasHydrated: true });
  render(<ProfileReview />);
  const shown = {
    count: screen.getByText(/topics answered$/).textContent,
    topics: screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    remainingLink: screen.queryByRole('link', { name: 'Answer the remaining questions' }) !== null,
  };
  cleanup();
  return shown;
}

/** What the profile wizard shows in remaining mode: its headings and its step caption. */
function remainingWizardOf(profile: FinancialProfile) {
  useProfileStore.setState({ profile, hasHydrated: true });
  render(<Wizard flow="profile" mode="remaining" />);
  const shown = {
    headings: screen.queryAllByRole('heading').map((heading) => heading.textContent),
    step: screen.queryByText(/Step \d+ of \d+/)?.textContent ?? null,
  };
  cleanup();
  return shown;
}

describe('the review page and the remaining wizard with a Custom new cash', () => {
  it('one empty brokerage and taxable 0, every topic answered: N of N, no targets topic, no remaining link', () => {
    const before = emptyBrokerage([]);
    const plain = reviewOf(before);
    const custom = reviewOf(withCustom(before, 'acc-b', 300));
    expect(custom).toEqual(plain);
    expect(plain.count).toMatch(/^(\d+) of \1 topics answered$/);
    expect(plain.topics).not.toContain('Target allocation');
    expect(plain.remainingLink).toBe(false);
  });

  it('one empty brokerage and taxable 0, debts left: the remaining wizard asks the one debts step, Custom or not', () => {
    const before = emptyBrokerage(['debts']);
    const plain = remainingWizardOf(before);
    const custom = remainingWizardOf(withCustom(before, 'acc-b', 300));
    expect(custom).toEqual(plain);
    expect(plain.step).toMatch(/Step 1 of 1$/);
    expect(reviewOf(withCustom(before, 'acc-b', 300))).toEqual(reviewOf(before));
    expect(reviewOf(before).remainingLink).toBe(true);
  });

  it('the default profile: a Custom new cash changes neither the review nor the remaining wizard', () => {
    const before = getDefaultFinancialProfile();
    expect(reviewOf(withCustom(before, 'acc-brok', 0))).toEqual(reviewOf(before));
    expect(remainingWizardOf(withCustom(before, 'acc-brok', 0))).toEqual(remainingWizardOf(before));
    expect(reviewOf(before).topics).toContain('Target allocation');
  });
});
