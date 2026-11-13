/**
 * The retirement results on the shared vocabulary (rebuild slice c2): for a
 * fixed result object they show the same texts as before the move (the
 * header tiles, the scenario cards and their details and alerts, the dollar
 * captions), and the two charts load into ChartFrames whose captions and
 * axis suffixes follow the shared dollar-display preference.
 */

import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ResultsSection } from '@/app/tools/retirement-calculator/components/ResultsSection';
import type { RetirementInputs, RetirementResults } from '@/lib/calculations/retirement';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import { clearBrowserState } from '@/test/utils/stores';

// jsdom lays nothing out, so ResponsiveContainer would measure zero and draw
// nothing; a fixed size lets the charts render their axes.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: (props: React.ComponentProps<typeof actual.ResponsiveContainer>) => (
      <actual.ResponsiveContainer {...props} width={800} height={400} />
    ),
  };
});

// $2,000 x 12 / $100,000 = 24%; retiring at 60 needs 10.37% on the curve
// (9.69% before PR 5; test/components/retirement/savingsRateMarkers.test.ts).
const SAVINGS_CAPTION =
  "contributions start today \u2014 shown in today's dollars in either display mode. " +
  'Your current savings rate is 24%. Retiring at 60 needs about 10%.';

const INPUTS: RetirementInputs = {
  startingAge: 25,
  retirementAge: 60,
  lifeExpectancy: 85,
  targetIncome: 80000,
  startingBalance: 10000,
  currentIncome: 100000,
  incomeAmount: 100000,
  incomePeriod: 'yearly',
  monthlySavings: 2000,
  necessaryMonthlyExpenses: 4000,
  accumulationReturn: 0.08,
  retirementReturn: 0.06,
  inflationRate: 0.03,
  socialSecurityAge: 67,
  socialSecurityBenefit: 30000,
  healthcareCostMultiplier: 1,
  volatility: 0.15,
  filingStatus: 'single',
  state: 'TX',
  riskProfile: 'tdf',
  effectiveTaxRate: null,
  estimatedAnnualHealthcareCost: null,
};

const RESULTS: RetirementResults = {
  scenarios: [
    {
      id: 'current-plan-baseline',
      name: 'Your Current Plan',
      retirementAge: 60,
      requiredBalance: 2_000_000,
      projectedBalance: 2_500_000,
      monthlyWithdrawal: 5000,
      successProbability: 0.856,
      yearsOfIncome: 25,
    },
    {
      id: 'conservative-buffer',
      name: 'Conservative: $6,000/month with $8,000 annual buffer',
      retirementAge: 60,
      requiredBalance: 1_800_000,
      projectedBalance: 2_500_000,
      monthlyWithdrawal: 4500,
      successProbability: 0.72,
      yearsOfIncome: 25,
    },
    {
      id: 'reality-age',
      name: 'Work until age 66',
      retirementAge: 66,
      requiredBalance: 2_400_000,
      projectedBalance: 1_900_000,
      monthlyWithdrawal: 5000,
      successProbability: 0.45,
      yearsOfIncome: 19,
    },
  ],
  netWorthByAge: { 25: 10000, 60: 2_500_000, 61: 2_450_000 },
  withdrawalsByAge: { 61: 100_000 },
  insights: [],
  initialWithdrawalRate: 0.032,
};

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const renderResults = (results: RetirementResults = RESULTS) =>
  render(
    <ThemeProvider>
      <ResultsSection results={results} inputs={INPUTS} stale={false} />
    </ThemeProvider>
  );

const tile = (label: string) => screen.getByRole('group', { name: label });

/** The scenario card's header, a button named by everything it shows. */
const scenarioHeader = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name.replace(/[$]/g, '\\$')}`) });

beforeEach(() => {
  clearBrowserState();
  stubMatchMedia();
  usePreferencesStore.setState({ displayMode: 'today' });
});

describe('ResultsSection', () => {
  it('shows the dollar caption and the two header tiles', () => {
    renderResults();

    expect(screen.getByText("Amounts adjusted to today's dollars using your inflation rate")).toBeInTheDocument();
    expect(tile('Implied Withdrawal Rate')).toHaveTextContent('Implied Withdrawal Rate3.2%at or below the 4% guideline');
    expect(tile('Scenarios Analyzed')).toHaveTextContent('Scenarios Analyzed3retirement options');
  });

  it('says a withdrawal rate above 4% is above the guideline', () => {
    renderResults({ ...RESULTS, initialWithdrawalRate: 0.0475 });
    expect(tile('Implied Withdrawal Rate')).toHaveTextContent('4.8%above the 4% guideline');
  });

  it('lists every scenario with its age, success rate and monthly income in today\'s dollars', () => {
    renderResults();

    expect(scenarioHeader('Your Current Plan')).toHaveTextContent(
      'Your Current PlanRetire at 60 \u2022 85.6% success rate$5,000monthly'
    );
    expect(scenarioHeader('Conservative')).toHaveTextContent(
      'Conservative: $6,000/month with $8,000 annual bufferRetire at 60 \u2022 72% success rate$4,500monthly'
    );
    expect(scenarioHeader('Work until age 66')).toHaveTextContent('Retire at 66 \u2022 45% success rate$5,000monthly');
    expect(screen.queryByText('Required Balance')).not.toBeInTheDocument();
  });

  it('opens a scenario to its balances in the display mode, years of income and success', async () => {
    renderResults();
    await userEvent.setup().click(scenarioHeader('Your Current Plan'));

    // 35 years at 3%: $2,000,000 / 1.03^35 = $710,767; $2,500,000 -> $888,458.
    const details = screen.getByText('Required Balance').closest('dl') as HTMLElement;
    expect(within(details).getByText('Required Balance').nextElementSibling).toHaveTextContent('$710,767');
    expect(within(details).getByText('Projected Balance').nextElementSibling).toHaveTextContent('$888,458');
    expect(within(details).getByText('Years of Income').nextElementSibling).toHaveTextContent('25 years');
    expect(within(details).getByText('Success Probability').nextElementSibling).toHaveTextContent('85.6%');
    // 85.6% is at or above 80%: no alert.
    expect(screen.queryByText('Consider Adjustments')).not.toBeInTheDocument();
  });

  it('suggests adjustments below 80% and calls a plan under 50% very risky', async () => {
    renderResults();
    const user = userEvent.setup();

    await user.click(scenarioHeader('Conservative'));
    expect(screen.getByText('Consider Adjustments')).toBeInTheDocument();
    expect(
      screen.getByText(/This scenario has a 28% chance of running out of money\. Consider increasing savings or delaying retirement\./)
    ).toBeInTheDocument();

    await user.click(scenarioHeader('Work until age 66'));
    expect(screen.queryByText('Consider Adjustments')).not.toBeInTheDocument();
    expect(screen.getByText('High Risk')).toBeInTheDocument();
    expect(
      screen.getByText(/This scenario has a 55% chance of running out of money\. This is a very risky plan\./)
    ).toBeInTheDocument();
  });

  it('shows future dollars when the shared preference says so', async () => {
    renderResults();
    act(() => usePreferencesStore.setState({ displayMode: 'nominal' }));

    expect(screen.getByText('Amounts in future dollars, as of the year they occur')).toBeInTheDocument();
    // $5,000 of today's income, 35 years out at 3%: $5,000 x 2.813862 = $14,069.
    expect(scenarioHeader('Your Current Plan')).toHaveTextContent('$14,069monthly');
    await userEvent.setup().click(scenarioHeader('Your Current Plan'));
    expect(screen.getByText('Required Balance').nextElementSibling).toHaveTextContent('$2,000,000');
  });

  it('loads both charts into captioned frames whose axes follow the dollar mode', async () => {
    renderResults();

    const projections = screen.getByRole('figure', { name: "in today's dollars" });
    const savings = screen.getByRole('figure', { name: SAVINGS_CAPTION });
    expect(await within(projections).findByText("Net Worth (today's $)")).toBeInTheDocument();
    expect(within(projections).getByText("Annual Withdrawals (today's $)")).toBeInTheDocument();
    expect(await within(savings).findByText('Required Savings Rate (%)')).toBeInTheDocument();
    expect(within(savings).getByText('Retirement Age')).toBeInTheDocument();
    // The visitor's own position, drawn on the chart and said in the caption.
    expect(within(savings).getByText('Your savings rate: 24%')).toBeInTheDocument();
    expect(within(savings).getByText('Retire at 60')).toBeInTheDocument();

    act(() => usePreferencesStore.setState({ displayMode: 'nominal' }));
    const future = screen.getByRole('figure', { name: 'in future dollars' });
    expect(within(future).getByText('Net Worth (future $)')).toBeInTheDocument();
    expect(within(future).getByText('Annual Withdrawals (future $)')).toBeInTheDocument();
    // The savings caption does not follow the toggle.
    expect(
      screen.getByRole('figure', { name: SAVINGS_CAPTION })
    ).toBeInTheDocument();
  });

  it('converts a scenario title with title parts to the dollar mode; a name with none stays as it is', () => {
    // 2,733.33 of today's income a month, 35 years out at 3%: x 2.813862 = 7,691.89,
    // rounded to 100 gives $7,700. The legacy, nominal 65 years out at 3%
    // (1.03^65 = 6.829983): 7,248,462.75 / 6.829983 = 1,061,271.02 -> $1,061,000.
    const titled: RetirementResults = {
      ...RESULTS,
      scenarios: [
        {
          ...RESULTS.scenarios[0],
          id: 'conservative-wealth-building',
          name: 'Conservative: $2,700/month, leave $7,248,000 legacy',
          title: [
            'Conservative: ',
            { amount: 41000 * 0.8 / 12, basis: 'today', yearsFromNow: 35, roundTo: 100 },
            '/month, leave ',
            { amount: 7248462.75, basis: 'nominal', yearsFromNow: 65, roundTo: 1000 },
            ' legacy',
          ],
        },
        RESULTS.scenarios[2],
      ],
    };
    renderResults(titled);
    expect(scenarioHeader('Conservative')).toHaveTextContent(/^Conservative: \$2,700\/month, leave \$1,061,000 legacyRetire/);
    expect(scenarioHeader('Work until age 66')).toBeInTheDocument();

    act(() => usePreferencesStore.setState({ displayMode: 'nominal' }));
    expect(scenarioHeader('Conservative')).toHaveTextContent(/^Conservative: \$7,700\/month, leave \$7,248,000 legacyRetire/);
    expect(scenarioHeader('Work until age 66')).toBeInTheDocument();
  });
});
