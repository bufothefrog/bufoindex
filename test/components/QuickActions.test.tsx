/**
 * QuickActions: the prioritized action cards above the step list.
 *
 * The impact row pairs a short figure with a prose qualifier. The qualifier
 * is a full phrase ("unclaimed match per bi-weekly paycheck"), so it lives
 * in the row's label column (the dt), where it wraps; only the figure goes
 * in the value column (the dd), which never shrinks. A sentence there would
 * overflow the row and paint over the "Impact" label.
 *
 * The per-profile table checks, for eight profiles that between them reach
 * every action, urgency, frequency and age band: which cards appear and in
 * which order, the group headings, each card's title and badge, its impact
 * and time figures, every number in its prose, its button, and the input
 * section that button opens. The prose itself is not pinned, so a wording
 * change needs no test edit; a changed number, card or order does.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuickActions } from '@/components/paycheck-allocator/QuickActions';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { PAYCHECK_FORM } from '@/lib/calculators/paycheck/form';
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

const NO_STAMP = { lastUpdated: 0 };

/** Eight profiles that between them reach every action, urgency, frequency and age band. */
const PROFILES: Record<string, PaycheckProfile> = {
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

type ScreenId = (typeof PAYCHECK_FORM.screens)[number]['id'];

interface ExpectedCard {
  title: string;
  badge: string;
  /** The figure in the Impact row's value cell. */
  impact: string;
  /** The figure in the Time to implement row's value cell. */
  time: string;
  /** Every number in the description and the impact qualifier, in order; the words around them are not pinned. */
  prose: string[];
  button: string;
  /** The paycheck form screen whose input section the button opens. */
  screen: ScreenId;
}

const MATCH = 'Employer Match Not Fully Captured';
const HSA = 'No HSA Contributions';
const ROTH = 'No Roth IRA Contributions';
const EMERGENCY = 'Emergency Fund Below One Month of Expenses';
const HIGHEST = 'HIGHEST IMPACT';
const HIGH = 'HIGH IMPACT';
const CRITICAL_HEADING = 'Highest-Impact Items';
const IMPORTANT_HEADING = 'High-Impact Optimizations';

/** What each profile shows: the group headings, then every card in order. */
const EXPECTED: Record<string, { headings: string[]; cards: ExpectedCard[] }> = {
  factory: {
    headings: [CRITICAL_HEADING],
    cards: [
      { title: '18.0% Debt Accruing Interest', badge: HIGHEST, impact: '$35', time: '6-24 months', prose: ['18.0%'], button: 'Create Payoff Plan', screen: 'debts' },
    ],
  },
  weeklyMatchGap: {
    headings: [CRITICAL_HEADING, IMPORTANT_HEADING],
    cards: [
      { title: MATCH, badge: HIGHEST, impact: '$42', time: '5 minutes', prose: ['6%'], button: 'Increase 401k to 6%', screen: '401k' },
      { title: HSA, badge: HIGH, impact: '$44/month', time: '5 minutes', prose: ['65', '12%'], button: 'Contribute $367/month to HSA', screen: 'hsa' },
      { title: ROTH, badge: HIGH, impact: '$44/month', time: '30 minutes', prose: ['7%'], button: 'Open Roth IRA - $625/month', screen: 'ira-taxable' },
    ],
  },
  monthlyAge56Family: {
    headings: [IMPORTANT_HEADING],
    cards: [
      { title: HSA, badge: HIGH, impact: '$195/month', time: '5 minutes', prose: ['65', '24%'], button: 'Contribute $813/month to HSA', screen: 'hsa' },
      { title: ROTH, badge: HIGH, impact: '$50/month', time: '30 minutes', prose: ['7%'], button: 'Open Roth IRA - $717/month', screen: 'ira-taxable' },
    ],
  },
  semiMonthlyDebts: {
    headings: [CRITICAL_HEADING, IMPORTANT_HEADING],
    cards: [
      { title: '24.0% Debt Accruing Interest', badge: HIGHEST, impact: '$40', time: '6-24 months', prose: ['24.0%'], button: 'Create Payoff Plan', screen: 'debts' },
      { title: EMERGENCY, badge: HIGH, impact: '0.1 months', time: '3-6 months', prose: [], button: 'Setup Emergency Fund', screen: 'emergency-fund' },
    ],
  },
  nothingToDo: { headings: [], cards: [] },
  age61Everything: {
    headings: [CRITICAL_HEADING, IMPORTANT_HEADING],
    cards: [
      { title: MATCH, badge: HIGHEST, impact: '$138', time: '5 minutes', prose: ['5%'], button: 'Increase 401k to 5%', screen: '401k' },
      { title: '29.9% Debt Accruing Interest', badge: HIGHEST, impact: '$92', time: '6-24 months', prose: ['29.9%'], button: 'Create Payoff Plan', screen: 'debts' },
      { title: HSA, badge: HIGH, impact: '$260/month', time: '5 minutes', prose: ['65', '32%'], button: 'Contribute $813/month to HSA', screen: 'hsa' },
      { title: ROTH, badge: HIGH, impact: '$50/month', time: '30 minutes', prose: ['7%'], button: 'Open Roth IRA - $717/month', screen: 'ira-taxable' },
      { title: EMERGENCY, badge: HIGH, impact: '0 months', time: '3-6 months', prose: [], button: 'Setup Emergency Fund', screen: 'emergency-fund' },
    ],
  },
  age50ZeroBracket: {
    headings: [IMPORTANT_HEADING],
    cards: [
      { title: ROTH, badge: HIGH, impact: '$50/month', time: '30 minutes', prose: ['7%'], button: 'Open Roth IRA - $717/month', screen: 'ira-taxable' },
      { title: HSA, badge: HIGH, impact: '$0/month', time: '5 minutes', prose: ['65', '0%'], button: 'Contribute $367/month to HSA', screen: 'hsa' },
    ],
  },
  age54Edge: {
    headings: [CRITICAL_HEADING, IMPORTANT_HEADING],
    cards: [
      { title: '7.0% Debt Accruing Interest', badge: HIGHEST, impact: '$2', time: '6-24 months', prose: ['7.0%'], button: 'Create Payoff Plan', screen: 'debts' },
      { title: ROTH, badge: HIGH, impact: '$50/month', time: '30 minutes', prose: ['7%'], button: 'Open Roth IRA - $717/month', screen: 'ira-taxable' },
      { title: HSA, badge: HIGH, impact: '$44/month', time: '5 minutes', prose: ['65', '12%'], button: 'Contribute $367/month to HSA', screen: 'hsa' },
    ],
  },
};

/** The numbers in `text`: "$1,200", "18.0%", "0.1", "65"; not the 401 of "401k". */
const numbersIn = (text: string) => text.match(/\$?\d+(?:[.,]\d+)*%?(?!\w)/g) ?? [];

/** What a rendered card shows, in ExpectedCard's shape (screen excepted). */
function readCard(card: HTMLElement): Omit<ExpectedCard, 'screen'> {
  const prose = card.cloneNode(true) as HTMLElement;
  // The prose is what is left without the title, the badge, the value cells and the button.
  for (const node of Array.from(prose.querySelectorAll('h4, h4 + span, dd, button'))) node.remove();
  return {
    title: within(card).getByRole('heading', { level: 4 }).textContent ?? '',
    badge: card.querySelector('h4 + span')?.textContent ?? '',
    impact: rowFor('Impact', card).value.textContent ?? '',
    time: rowFor('Time to implement', card).value.textContent ?? '',
    prose: numbersIn(prose.textContent ?? ''),
    button: within(card).getByRole('button').textContent ?? '',
  };
}

/** One input section per paycheck form screen, as the calculator page labels them. */
function mountScreenSections(): Map<HTMLElement, ScreenId> {
  const sections = new Map<HTMLElement, ScreenId>();
  for (const formScreen of PAYCHECK_FORM.screens) {
    const section = document.createElement('section');
    section.setAttribute('aria-label', formScreen.title);
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    sections.set(section, formScreen.id);
  }
  return sections;
}

describe('QuickActions', () => {
  describe('per profile', () => {
    it.each(Object.keys(PROFILES))('shows the expected cards, in order, with their figures for %s', (name) => {
      renderActions(PROFILES[name]);
      const expected = EXPECTED[name];
      expect(screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(expected.headings);
      // toEqual ignores the screen, undefined here; the next test clicks through to it.
      expect(screen.queryAllByRole('article').map(readCard)).toEqual(expected.cards.map((card) => ({ ...card, screen: undefined })));
      // Every button is a card's own: none outside the cards.
      expect(screen.queryAllByRole('button')).toHaveLength(expected.cards.length);
    });

    it.each(Object.keys(PROFILES))('opens the input section of each card for %s', async (name) => {
      const sections = mountScreenSections();
      try {
        renderActions(PROFILES[name]);
        const user = userEvent.setup();
        const opened: (ScreenId | undefined)[] = [];
        for (const button of screen.queryAllByRole('button')) {
          await user.click(button);
          opened.push(sections.get(document.activeElement as HTMLElement));
        }
        expect(opened).toEqual(EXPECTED[name].cards.map((card) => card.screen));
      } finally {
        for (const section of sections.keys()) section.remove();
      }
    });

    it('renders nothing when no action applies', () => {
      const { container } = renderActions(PROFILES.nothingToDo);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('cards and groups', () => {
    it('groups the cards under one heading per urgency, most urgent first', () => {
      renderActions(PROFILES.age61Everything);

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
      renderActions(PROFILES.weeklyMatchGap);

      const match = screen.getByRole('article', { name: 'Employer Match Not Fully Captured' });
      expect(within(match).getByText('HIGHEST IMPACT')).toBeInTheDocument();
      const hsa = screen.getByRole('article', { name: 'No HSA Contributions' });
      expect(within(hsa).getByText('HIGH IMPACT')).toBeInTheDocument();
    });

    it('names the highest-rate qualifying debt, not the first one listed', () => {
      renderActions(PROFILES.semiMonthlyDebts);

      expect(screen.getByRole('article', { name: '24.0% Debt Accruing Interest' })).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: '9.0% Debt Accruing Interest' })).not.toBeInTheDocument();
    });

    it('sizes the HSA action with the 55+ catch-up', () => {
      renderActions(PROFILES.monthlyAge56Family);

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
        within(row).getByText('of necessary expenses on hand')
      ).toBeInTheDocument();
      // $1,000 against $3,000 a month: 0.33, rounded down to 0.3 months.
      expect(value).toHaveTextContent(/^0\.3 months$/);
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
