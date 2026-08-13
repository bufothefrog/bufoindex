/**
 * QuickActions Component Test Suite
 *
 * The impact row pairs a short dollar figure with a prose qualifier. The
 * qualifier is a full phrase ("unclaimed match per bi-weekly paycheck"), so it
 * has to live in the wrapping label column of BreakdownRow — passing it as the
 * row's value pushed it into the fixed-width (`shrink-0`) value cell, where it
 * overflowed the row and painted over the "Impact" label.
 */

import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { QuickActions } from '@/components/paycheck-allocator/QuickActions';
import {
  createPaycheckProfile,
  createBenefitsData,
  createEmployerBenefits,
  createUserPreferences,
  createIncomeData,
} from '@/test/factories/test-data-factory';
import type { PaycheckProfile } from '@/lib/types';

/** Classes that would clip or collapse a long impact phrase. */
const CLIPPING_CLASSES = [
  'truncate',
  'overflow-hidden',
  'whitespace-nowrap',
  'text-nowrap',
];

/** Walks up from `node` to `root`, asserting nothing clips the text. */
function expectNoClippingAncestor(node: HTMLElement, root: HTMLElement) {
  let current: HTMLElement | null = node;
  while (current && current !== root.parentElement) {
    for (const className of CLIPPING_CLASSES) {
      expect(
        Array.from(current.classList),
        `"${current.className}" must not clip the impact text`
      ).not.toContain(className);
    }
    current = current.parentElement;
  }
}

/** Profile whose only quick action is the unclaimed employer match. */
function matchOnlyProfile(
  overrides: Partial<PaycheckProfile['income']> = {}
): PaycheckProfile {
  return createPaycheckProfile({
    // `income.gross` is the monthly gross (see updateLegacyIncomeFields).
    income: createIncomeData({ gross: 6500, monthlyGross: 6500, ...overrides }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({
        available: true,
        matchPercent: 0.5,
        matchLimit: 0.06,
        currentContribution: 0.03,
      }),
    }),
    debts: [],
  });
}

function renderActions(profile: PaycheckProfile) {
  return render(<QuickActions profile={profile} />);
}

/** The bordered BreakdownRow wrapping a given label. */
function rowFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest('div.rounded-lg');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

describe('QuickActions', () => {
  afterEach(() => {
    cleanup();
  });

  describe('impact row', () => {
    it('renders the full impact phrase alongside the figure', () => {
      // 6500 * (0.06 - 0.03) * 0.5 = $97.50/month over 26/12 paychecks = $45.
      renderActions(matchOnlyProfile());

      const row = rowFor('Impact');
      expect(
        within(row).getByText('unclaimed match per bi-weekly paycheck')
      ).toBeInTheDocument();
      expect(within(row).getByText('$45')).toBeInTheDocument();
    });

    it('keeps the figure in the value cell and the phrase out of it', () => {
      renderActions(matchOnlyProfile());

      const row = rowFor('Impact');
      const valueCell = row.querySelector('.font-mono') as HTMLElement;

      // The value cell is `shrink-0`, so only a short figure belongs in it.
      expect(valueCell).not.toBeNull();
      expect(valueCell.textContent).toBe('$45');
      expect(valueCell.textContent).not.toMatch(/paycheck/);
    });

    it('puts the phrase in a container that can wrap rather than clip', () => {
      renderActions(matchOnlyProfile());

      const row = rowFor('Impact');
      const phrase = within(row).getByText(
        'unclaimed match per bi-weekly paycheck'
      );

      expectNoClippingAncestor(phrase, row);
      // The label column is the shrinkable half of the row.
      expect(phrase.closest('.min-w-0')).not.toBeNull();
      // The label must not share a node with the phrase or the figure.
      expect(within(row).getByText('Impact').textContent).toBe('Impact');
    });

    it('renders the impact and time-to-implement rows as separate rows', () => {
      renderActions(matchOnlyProfile());

      const impactRow = rowFor('Impact');
      const timeRow = rowFor('Time to implement');

      expect(impactRow).not.toBe(timeRow);
      expect(within(timeRow).getByText('5 minutes')).toBeInTheDocument();
      expect(impactRow.textContent).not.toMatch(/Time to implement/);
    });

    it('names the pay frequency the user selected', () => {
      renderActions(matchOnlyProfile({ frequency: 'semi-monthly' }));

      expect(
        screen.getByText('unclaimed match per semi-monthly paycheck')
      ).toBeInTheDocument();
    });
  });

  describe('non-dollar impact', () => {
    it('states the emergency-fund impact without a dollar figure', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 6500, monthlyGross: 6500 }),
        benefits: createBenefitsData({
          employer401k: createEmployerBenefits({ currentContribution: 0.06 }),
        }),
        preferences: createUserPreferences({
          currentEmergencyFund: 1000,
          necessaryExpenses: 3000,
        }),
        debts: [],
      });

      renderActions(profile);

      const row = rowFor('Impact');
      expect(
        within(row).getByText('of necessary expenses covered')
      ).toBeInTheDocument();
      expect(within(row).getByText('1 month')).toBeInTheDocument();
      expect(row.textContent).not.toMatch(/\$/);
    });
  });

  describe('interest impact', () => {
    it('splits the per-paycheck interest figure from its qualifier', () => {
      const profile = createPaycheckProfile({
        income: createIncomeData({ gross: 6500, monthlyGross: 6500 }),
        benefits: createBenefitsData({
          employer401k: createEmployerBenefits({ currentContribution: 0.06 }),
        }),
        debts: [
          {
            id: 'card-1',
            name: 'Credit Card',
            balance: 5000,
            interestRate: 0.18,
            minimumPayment: 150,
            extraPayment: 0,
            taxDeductible: false,
          },
        ],
      });

      renderActions(profile);

      const row = rowFor('Impact');
      expect(
        within(row).getByText('in interest per bi-weekly paycheck')
      ).toBeInTheDocument();
      // 5000 * 0.18 / 12 = $75/month over 26/12 paychecks = $35.
      expect((row.querySelector('.font-mono') as HTMLElement).textContent).toBe(
        '$35'
      );
    });
  });
});
