/**
 * QuickActions: the prioritized action cards above the step list.
 *
 * The impact row pairs a short figure with a prose qualifier. The qualifier
 * is a full phrase ("unclaimed match per bi-weekly paycheck"), so it lives
 * in the row's label column (the dt), where it wraps; only the figure goes
 * in the value column (the dd), which never shrinks. A sentence there would
 * overflow the row and paint over the "Impact" label.
 *
 * The golden table pins every visible string, in order, for eight profiles
 * as the component printed them before the rebuild (c4): the limit math now
 * comes from lib/calculations/contributionLimits and the wording from the
 * shared frequency and format tables, and none of it may change the output.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuickActions } from '@/components/paycheck-allocator/QuickActions';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import {
  createPaycheckProfile,
  createBenefitsData,
  createDebtData,
  createEmployerBenefits,
  createHSABenefits,
  createIRAData,
  createUserPreferences,
  createIncomeData,
  createTaxData,
} from '@/test/factories/test-data-factory';
import type { PaycheckProfile } from '@/lib/types';

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

/** Classes that would clip or refuse to wrap the impact phrase. */
const CLIPPING_CLASSES = ['truncate', 'overflow-hidden', 'whitespace-nowrap', 'text-nowrap'];

/** The label (dt) and value (dd) of the row whose label is `label`, within one action card. */
function rowFor(label: string, card: HTMLElement = document.body) {
  const term = within(card).getByText(label).closest('dt');
  expect(term).not.toBeNull();
  const row = term!.parentElement as HTMLElement;
  return { row, term: term as HTMLElement, value: within(row).getByRole('definition') };
}

/** Every non-empty text node under `root`, trimmed, in document order. */
function visibleText(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim();
    if (text) out.push(text);
  }
  return out;
}

const NO_STAMP = { lastUpdated: 0 };

/** Eight profiles that between them reach every action, urgency, frequency and age band. */
const GOLDEN_PROFILES: Record<string, PaycheckProfile> = {
  factory: createPaycheckProfile({ ...NO_STAMP, debts: [createDebtData({ id: 'd' })] }),
  weeklyMatchGap: createPaycheckProfile({
    ...NO_STAMP,
    income: createIncomeData({ frequency: 'weekly', gross: 9000, monthlyGross: 9000 }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({ currentContribution: 0.02, traditionalContribution: 0.02 }),
      hsa: createHSABenefits({ currentContribution: 0 }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age: 45 }),
    debts: [],
  }),
  monthlyAge56Family: createPaycheckProfile({
    ...NO_STAMP,
    income: createIncomeData({ frequency: 'monthly', gross: 12000, monthlyGross: 12000, netPaycheck: 8000, grossPaycheck: 12000 }),
    taxes: createTaxData({ federalBracket: 0.24 }),
    benefits: createBenefitsData({
      hsa: createHSABenefits({ currentContribution: 0, coverageType: 'family' }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age: 56 }),
    debts: [],
  }),
  semiMonthlyDebts: createPaycheckProfile({
    ...NO_STAMP,
    income: createIncomeData({ frequency: 'semi-monthly' }),
    preferences: createUserPreferences({ currentEmergencyFund: 500, necessaryExpenses: 3000 }),
    debts: [
      createDebtData({ id: 'a', name: 'Store card', balance: 1200, interestRate: 0.09 }),
      createDebtData({ id: 'b', name: 'Visa', balance: 4000, interestRate: 0.24 }),
      createDebtData({ id: 'c', name: 'Car', balance: 9000, interestRate: 0.07 }),
    ],
  }),
  nothingToDo: createPaycheckProfile({
    ...NO_STAMP,
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({ available: false }),
      hsa: createHSABenefits({ eligible: false }),
    }),
    debts: [],
  }),
  age61Everything: createPaycheckProfile({
    ...NO_STAMP,
    income: createIncomeData({ frequency: 'bi-weekly', gross: 15000, monthlyGross: 15000, grossPaycheck: 6900, netPaycheck: 4600 }),
    taxes: createTaxData({ federalBracket: 0.32 }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({
        currentContribution: 0.03,
        traditionalContribution: 0.01,
        rothContribution: 0.02,
        matchPercent: 1,
        matchLimit: 0.05,
        afterTaxAvailable: true,
      }),
      hsa: createHSABenefits({ currentContribution: 0, coverageType: 'family' }),
      ira: createIRAData({ currentContributions: { traditional: 100, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age: 61, currentEmergencyFund: 0, necessaryExpenses: 5000 }),
    debts: [createDebtData({ id: 'x', name: 'Card', balance: 8000, interestRate: 0.299 })],
  }),
  age50ZeroBracket: createPaycheckProfile({
    ...NO_STAMP,
    taxes: createTaxData({ federalBracket: 0 }),
    benefits: createBenefitsData({
      hsa: createHSABenefits({ currentContribution: 0 }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age: 50 }),
    debts: [],
  }),
  age54Edge: createPaycheckProfile({
    ...NO_STAMP,
    income: createIncomeData({ frequency: 'monthly' }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({ currentContribution: 0.06, matchLimit: 0.06 }),
      hsa: createHSABenefits({ currentContribution: 0, coverageType: 'individual' }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age: 54 }),
    debts: [createDebtData({ id: 't', name: 'Loan', balance: 300, interestRate: 0.0701 })],
  }),
};

/** What the component printed for each golden profile before the rebuild. */
const GOLDEN_OUTPUT: Record<string, { text: string[]; buttons: string[] }> = {
  factory: {
    text: [
      "Highest-Impact Items",
      "18.0% Debt Accruing Interest",
      "HIGHEST IMPACT",
      "This balance accrues interest at 18.0% a year. Paying it down avoids that rate; whether that compares favorably to investing the same dollars depends on the return you expect.",
      "Impact",
      "in interest per bi-weekly paycheck",
      "$35",
      "Time to implement",
      "6-24 months",
      "Create Payoff Plan",
    ],
    buttons: ["Create Payoff Plan"],
  },
  weeklyMatchGap: {
    text: [
      "Highest-Impact Items",
      "Employer Match Not Fully Captured",
      "HIGHEST IMPACT",
      "Your employer matches contributions up to 6% of salary. Contributing below that limit leaves the unmatched portion of the benefit unpaid.",
      "Impact",
      "unclaimed match per weekly paycheck",
      "$42",
      "Time to implement",
      "5 minutes",
      "Increase 401k to 6%",
      "High-Impact Optimizations",
      "No HSA Contributions",
      "HIGH IMPACT",
      "HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.",
      "Impact",
      "deferred tax at your 12% federal bracket",
      "$44/month",
      "Time to implement",
      "5 minutes",
      "Contribute $367/month to HSA",
      "No Roth IRA Contributions",
      "HIGH IMPACT",
      "Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.",
      "Impact",
      "at an assumed 7% return",
      "$44/month",
      "Time to implement",
      "30 minutes",
      "Open Roth IRA - $625/month",
    ],
    buttons: ["Increase 401k to 6%", "Contribute $367/month to HSA", "Open Roth IRA - $625/month"],
  },
  monthlyAge56Family: {
    text: [
      "High-Impact Optimizations",
      "No HSA Contributions",
      "HIGH IMPACT",
      "HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.",
      "Impact",
      "deferred tax at your 24% federal bracket",
      "$195/month",
      "Time to implement",
      "5 minutes",
      "Contribute $813/month to HSA",
      "No Roth IRA Contributions",
      "HIGH IMPACT",
      "Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.",
      "Impact",
      "at an assumed 7% return",
      "$50/month",
      "Time to implement",
      "30 minutes",
      "Open Roth IRA - $717/month",
    ],
    buttons: ["Contribute $813/month to HSA", "Open Roth IRA - $717/month"],
  },
  semiMonthlyDebts: {
    text: [
      "Highest-Impact Items",
      "24.0% Debt Accruing Interest",
      "HIGHEST IMPACT",
      "This balance accrues interest at 24.0% a year. Paying it down avoids that rate; whether that compares favorably to investing the same dollars depends on the return you expect.",
      "Impact",
      "in interest per semi-monthly paycheck",
      "$40",
      "Time to implement",
      "6-24 months",
      "Create Payoff Plan",
      "High-Impact Optimizations",
      "Emergency Fund Below One Month of Expenses",
      "HIGH IMPACT",
      "A month of necessary expenses on hand covers a minor emergency without borrowing at credit-card rates.",
      "Impact",
      "of necessary expenses covered",
      "1 month",
      "Time to implement",
      "3-6 months",
      "Setup Emergency Fund",
    ],
    buttons: ["Create Payoff Plan", "Setup Emergency Fund"],
  },
  nothingToDo: {
    text: [
    ],
    buttons: [],
  },
  age61Everything: {
    text: [
      "Highest-Impact Items",
      "Employer Match Not Fully Captured",
      "HIGHEST IMPACT",
      "Your employer matches contributions up to 5% of salary. Contributing below that limit leaves the unmatched portion of the benefit unpaid.",
      "Impact",
      "unclaimed match per bi-weekly paycheck",
      "$138",
      "Time to implement",
      "5 minutes",
      "Increase 401k to 5%",
      "29.9% Debt Accruing Interest",
      "HIGHEST IMPACT",
      "This balance accrues interest at 29.9% a year. Paying it down avoids that rate; whether that compares favorably to investing the same dollars depends on the return you expect.",
      "Impact",
      "in interest per bi-weekly paycheck",
      "$92",
      "Time to implement",
      "6-24 months",
      "Create Payoff Plan",
      "High-Impact Optimizations",
      "No HSA Contributions",
      "HIGH IMPACT",
      "HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.",
      "Impact",
      "deferred tax at your 32% federal bracket",
      "$260/month",
      "Time to implement",
      "5 minutes",
      "Contribute $813/month to HSA",
      "No Roth IRA Contributions",
      "HIGH IMPACT",
      "Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.",
      "Impact",
      "at an assumed 7% return",
      "$50/month",
      "Time to implement",
      "30 minutes",
      "Open Roth IRA - $717/month",
      "Emergency Fund Below One Month of Expenses",
      "HIGH IMPACT",
      "A month of necessary expenses on hand covers a minor emergency without borrowing at credit-card rates.",
      "Impact",
      "of necessary expenses covered",
      "1 month",
      "Time to implement",
      "3-6 months",
      "Setup Emergency Fund",
    ],
    buttons: ["Increase 401k to 5%", "Create Payoff Plan", "Contribute $813/month to HSA", "Open Roth IRA - $717/month", "Setup Emergency Fund"],
  },
  age50ZeroBracket: {
    text: [
      "High-Impact Optimizations",
      "No Roth IRA Contributions",
      "HIGH IMPACT",
      "Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.",
      "Impact",
      "at an assumed 7% return",
      "$50/month",
      "Time to implement",
      "30 minutes",
      "Open Roth IRA - $717/month",
      "No HSA Contributions",
      "HIGH IMPACT",
      "HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.",
      "Impact",
      "deferred tax at your 0% federal bracket",
      "$0/month",
      "Time to implement",
      "5 minutes",
      "Contribute $367/month to HSA",
    ],
    buttons: ["Open Roth IRA - $717/month", "Contribute $367/month to HSA"],
  },
  age54Edge: {
    text: [
      "Highest-Impact Items",
      "7.0% Debt Accruing Interest",
      "HIGHEST IMPACT",
      "This balance accrues interest at 7.0% a year. Paying it down avoids that rate; whether that compares favorably to investing the same dollars depends on the return you expect.",
      "Impact",
      "in interest per monthly paycheck",
      "$2",
      "Time to implement",
      "6-24 months",
      "Create Payoff Plan",
      "High-Impact Optimizations",
      "No Roth IRA Contributions",
      "HIGH IMPACT",
      "Roth IRA contributions are made after tax; qualified withdrawals are untaxed, and contributions themselves can be withdrawn at any time without penalty.",
      "Impact",
      "at an assumed 7% return",
      "$50/month",
      "Time to implement",
      "30 minutes",
      "Open Roth IRA - $717/month",
      "No HSA Contributions",
      "HIGH IMPACT",
      "HSA contributions are deductible, growth is untaxed, and withdrawals for qualified medical costs are untaxed. Non-medical withdrawals after 65 are taxed as income.",
      "Impact",
      "deferred tax at your 12% federal bracket",
      "$44/month",
      "Time to implement",
      "5 minutes",
      "Contribute $367/month to HSA",
    ],
    buttons: ["Create Payoff Plan", "Open Roth IRA - $717/month", "Contribute $367/month to HSA"],
  },
};

describe('QuickActions', () => {
  describe('golden output', () => {
    it.each(Object.keys(GOLDEN_PROFILES))('prints exactly the pre-rebuild text for %s', (name) => {
      const { container } = renderActions(GOLDEN_PROFILES[name]);
      expect(visibleText(container)).toEqual(GOLDEN_OUTPUT[name].text);
      expect(screen.queryAllByRole('button').map((button) => button.textContent)).toEqual(GOLDEN_OUTPUT[name].buttons);
    });

    it('renders nothing when no action applies', () => {
      const { container } = renderActions(GOLDEN_PROFILES.nothingToDo);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('cards and groups', () => {
    it('groups the cards under one heading per urgency, most urgent first', () => {
      renderActions(GOLDEN_PROFILES.age61Everything);

      expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
        'Highest-Impact Items',
        'High-Impact Optimizations',
      ]);
      expect(screen.getAllByRole('article').map((card) => within(card).getByRole('heading', { level: 4 }).textContent)).toEqual([
        'Employer Match Not Fully Captured',
        '29.9% Debt Accruing Interest',
        'No HSA Contributions',
        'No Roth IRA Contributions',
        // Same urgency, ordered by monthly value: the emergency fund has none.
        'Emergency Fund Below One Month of Expenses',
      ]);
    });

    it('names each card by its title and badges it with its urgency', () => {
      renderActions(GOLDEN_PROFILES.weeklyMatchGap);

      const match = screen.getByRole('article', { name: 'Employer Match Not Fully Captured' });
      expect(within(match).getByText('HIGHEST IMPACT')).toBeInTheDocument();
      const hsa = screen.getByRole('article', { name: 'No HSA Contributions' });
      expect(within(hsa).getByText('HIGH IMPACT')).toBeInTheDocument();
    });

    it('names the highest-rate qualifying debt, not the first one listed', () => {
      renderActions(GOLDEN_PROFILES.semiMonthlyDebts);

      expect(screen.getByRole('article', { name: '24.0% Debt Accruing Interest' })).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: '9.0% Debt Accruing Interest' })).not.toBeInTheDocument();
    });

    it('sizes the HSA action with the 55+ catch-up', () => {
      renderActions(GOLDEN_PROFILES.monthlyAge56Family);

      // Family 8,750 + 1,000 catch-up = 9,750 a year = $813 a month.
      expect(screen.getByRole('button', { name: 'Contribute $813/month to HSA' })).toBeInTheDocument();
    });

    it('scrolls to the calculator section that holds the inputs to change', async () => {
      const scrollIntoView = vi.fn();
      const section = document.createElement('section');
      section.setAttribute('aria-label', '401(k) or similar plan');
      section.scrollIntoView = scrollIntoView;
      document.body.appendChild(section);
      try {
        renderActions(matchOnlyProfile());
        await userEvent.setup().click(screen.getByRole('button', { name: 'Increase 401k to 6%' }));
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
      } finally {
        section.remove();
      }
    });

    it('moves focus to the section it scrolls to', async () => {
      const section = document.createElement('section');
      section.setAttribute('aria-label', '401(k) or similar plan');
      section.scrollIntoView = vi.fn();
      document.body.appendChild(section);
      try {
        renderActions(matchOnlyProfile());
        await userEvent.setup().click(screen.getByRole('button', { name: 'Increase 401k to 6%' }));
        expect(section).toHaveFocus();
      } finally {
        section.remove();
      }
    });

    it('on the phone layout with Results open, switches to Inputs, then focuses the section', async () => {
      const user = userEvent.setup();
      const scrollIntoView = vi.fn();
      render(
        <CalculatorLayout
          title="Paycheck"
          description="Quick action test."
          inputSections={
            <section aria-label="401(k) or similar plan" ref={(el) => { if (el) el.scrollIntoView = scrollIntoView; }}>
              Plan inputs
            </section>
          }
          resultSection={<QuickActions profile={matchOnlyProfile()} />}
        />
      );

      await user.click(screen.getByRole('tab', { name: /Results/ }));
      expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');

      await user.click(screen.getByRole('button', { name: 'Increase 401k to 6%' }));

      expect(screen.getByRole('tab', { name: /Inputs/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('region', { name: '401(k) or similar plan' })).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
    it('on the phone layout, stops the section just below the sticky tab bar', async () => {
      const user = userEvent.setup();
      const scrollIntoView = vi.fn();
      const scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      try {
        render(
          <CalculatorLayout
            title="Paycheck"
            description="Quick action test."
            inputSections={
              <section
                aria-label="401(k) or similar plan"
                ref={(el) => {
                  if (!el) return;
                  el.scrollIntoView = scrollIntoView;
                  el.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
                }}
              >
                Plan inputs
              </section>
            }
            resultSection={<QuickActions profile={matchOnlyProfile()} />}
          />
        );
        // jsdom lays nothing out: give the sticky bar (the tab list's wrapper)
        // the box it has below lg, 65 px tall.
        const bar = screen.getByRole('tablist', { name: 'Calculator view' }).parentElement as HTMLElement;
        bar.getClientRects = () => [{}] as unknown as DOMRectList;
        bar.getBoundingClientRect = () => ({ height: 65 }) as DOMRect;

        await user.click(screen.getByRole('tab', { name: /Results/ }));
        await user.click(screen.getByRole('button', { name: 'Increase 401k to 6%' }));

        expect(scrollTo).toHaveBeenCalledWith({ top: 500 + window.scrollY - 65, behavior: 'smooth' });
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(screen.getByRole('region', { name: '401(k) or similar plan' })).toHaveFocus();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('impact row', () => {
    it('renders the full impact phrase alongside the figure', () => {
      // 6500 * (0.06 - 0.03) * 0.5 = $97.50/month over 26/12 paychecks = $45.
      renderActions(matchOnlyProfile());

      const { row } = rowFor('Impact');
      expect(
        within(row).getByText('unclaimed match per bi-weekly paycheck')
      ).toBeInTheDocument();
      expect(within(row).getByText('$45')).toBeInTheDocument();
    });

    it('keeps the figure in the value cell and the phrase out of it', () => {
      renderActions(matchOnlyProfile());

      const { value } = rowFor('Impact');

      // The value cell never shrinks, so only a short figure belongs in it.
      expect(value).toHaveTextContent(/^\$45$/);
      expect(value.textContent).not.toMatch(/paycheck/);
    });

    it('puts the phrase in the label column, apart from the label itself', () => {
      renderActions(matchOnlyProfile());

      const { term } = rowFor('Impact');
      // The label column is the half of the row that wraps.
      expect(
        within(term).getByText('unclaimed match per bi-weekly paycheck')
      ).toBeInTheDocument();
      // The label must not share a node with the phrase or the figure.
      expect(within(term).getByText('Impact').textContent).toBe('Impact');
    });

    it('puts the phrase in a container that can wrap rather than clip', () => {
      renderActions(matchOnlyProfile());

      const { row, term } = rowFor('Impact');
      const phrase = within(term).getByText('unclaimed match per bi-weekly paycheck');

      // Nothing between the phrase and the row clips or forbids wrapping.
      let current: HTMLElement | null = phrase;
      while (current && current !== row.parentElement) {
        for (const className of CLIPPING_CLASSES) {
          expect(Array.from(current.classList), `"${current.className}" must not clip the impact text`).not.toContain(
            className
          );
        }
        current = current.parentElement;
      }
      // The label column is the shrinkable half of the row.
      expect(phrase.closest('.min-w-0')).not.toBeNull();
    });

    it('renders the impact and time-to-implement rows as separate rows', () => {
      renderActions(matchOnlyProfile());

      const impact = rowFor('Impact');
      const time = rowFor('Time to implement');

      expect(impact.row).not.toBe(time.row);
      expect(time.value).toHaveTextContent(/^5 minutes$/);
      expect(impact.row.textContent).not.toMatch(/Time to implement/);
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

      const { row, value } = rowFor('Impact');
      expect(
        within(row).getByText('of necessary expenses covered')
      ).toBeInTheDocument();
      expect(value).toHaveTextContent(/^1 month$/);
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

      const { row, value } = rowFor('Impact');
      expect(
        within(row).getByText('in interest per bi-weekly paycheck')
      ).toBeInTheDocument();
      // 5000 * 0.18 / 12 = $75/month over 26/12 paychecks = $35.
      expect(value.textContent).toBe('$35');
    });
  });
});
