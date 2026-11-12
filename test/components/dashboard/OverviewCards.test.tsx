/**
 * Every figure the overview cards show, for three fixed profiles. The
 * paycheck, retirement, cash (apart from O16) and automation figures were
 * captured once from the dashboard before slice d1 and must not move; the
 * leverage figures are the comparison page's own (the card now runs the
 * calculator's inputs: the invested balance as the starting balance and 500
 * paths), and the cash-drag return is O16's 7%.
 */

import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import OverviewDashboard from '@/components/dashboard/OverviewDashboard';
import { LeverageResults } from '@/app/tools/leverage-comparison/components/LeverageResults';
import { LEVERAGE_CALCULATOR } from '@/lib/calculators/leverage/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { ASSUMED_PORTFOLIO_RETURN } from '@/lib/dashboard/derive';
import { formatPercent } from '@/lib/format';
import type { ProfilePatch } from '@/lib/profile/types';
import { useProfileStore } from '@/lib/store/profileStore';
import { resetProfileStore } from '@/test/utils/stores';

const PROFILES = {
  /** The default profile, with only the age answered. */
  basics: { person: { age: 30 } },
  /** Weekly pay, joint filing, cash above a standard 3-month target, a 3x ratio. */
  rich: {
    person: { age: 41, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 60, lifeExpectancy: 92 },
    income: { grossPerPaycheck: 2400, netPerPaycheck: 1750, frequency: 'weekly' },
    spending: { necessaryMonthly: 4200, funMoneyMin: 300, funMoneyMax: 800, targetRetirementIncome: 90000 },
    cash: { emergencyFundBalance: 30000, emergencyFundApy: 0.04 },
    workplace: { has401k: true, matchPercent: 0.5, matchLimit: 0.06, contributionPercent: 0.08 },
    investing: { investedBalance: 250000, monthlyContribution: 2500, taxableMonthlyContribution: 700, targetMix: '60-40' },
    strategy: { preset: 'standard', leverageRatio: 3 },
  },
  /** Monthly pay, a thin margin, a custom 2-month target, no monthly investing. */
  lean: {
    person: { age: 52, retirementAge: 67 },
    income: { grossPerPaycheck: 5200, netPerPaycheck: 3900, frequency: 'monthly' },
    spending: { necessaryMonthly: 3500 },
    cash: { emergencyFundBalance: 1500, emergencyFundApy: 0.01, targetMonths: 2 },
    investing: { investedBalance: 40000, monthlyContribution: 0, taxableMonthlyContribution: 0, targetMix: 'custom' },
    strategy: { preset: 'cashflow-investor', leverageRatio: 1.5 },
  },
} satisfies Record<string, ProfilePatch>;

type ProfileName = keyof typeof PROFILES;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

/** Renders the overview for a profile and waits for both simulations to finish. */
async function renderOverview(name: ProfileName) {
  resetProfileStore({ profile: PROFILES[name] });
  render(<OverviewDashboard />);
  await within(screen.getByTestId('overview-retirement')).findByText(/same simulated markets/, {}, { timeout: 10000 });
  await within(screen.getByTestId('overview-leverage')).findByText(/simulated paths\. Estimated/, {}, { timeout: 10000 });
}

const card = (id: string) => screen.getByTestId(`overview-${id}`);

/** The figure in the stat tile named `label`. */
function tile(container: HTMLElement, label: string): string {
  const group = within(container).getByRole('group', { name: label });
  const text = group.textContent ?? '';
  return text.slice(label.length);
}

/** Each table row as its cells' text, header row first. */
function tableRows(container: HTMLElement): string[][] {
  return within(container)
    .getAllByRole('row')
    .map((row) => Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent ?? ''));
}

describe('PaycheckCard', () => {
  it.each<[ProfileName, string, [string, string][]]>([
    [
      'basics',
      'Take-home $2,600 per bi-weekly paycheck: $1,385 necessary expenses, $138 fun money (the minimum), and $1,077 to allocate.',
      [['Emergency FundBuild from 1.7 to 3 months expenses. Good HYSA rate', '$1,077']],
    ],
    [
      'rich',
      'Take-home $1,750 per weekly paycheck: $969 necessary expenses, $69 fun money (the minimum), and $712 to allocate.',
      [
        ['Roth IRATax diversification recommended - consider splitting with Traditional', '$144'],
        ['401k (Roth + Traditional)Consider splitting between Roth and Traditional 401k for tax diversification', '$279'],
        ['Taxable InvestmentBuild wealth with tax-efficient index funds (VTI/VTSAX)', '$288'],
      ],
    ],
    [
      'lean',
      'Take-home $3,900 per monthly paycheck: $3,500 necessary expenses, $300 fun money (the minimum), and $100 to allocate.',
      [
        [
          '1-Month Emergency FundBuild basic financial security before optimization. One month of expenses provides essential protection.',
          '$100',
        ],
      ],
    ],
  ])('%s: the paycheck flow and the first allocation steps', async (name, flow, rows) => {
    await renderOverview(name);
    const paycheck = card('paycheck');
    expect(paycheck).toHaveTextContent(flow);
    const terms = within(paycheck).getAllByRole('term').map((term) => term.textContent);
    const values = within(paycheck).getAllByRole('definition').map((value) => value.textContent);
    expect(terms.map((term, i) => [term, values[i]])).toEqual(rows);
    expect(within(paycheck).getByRole('link', { name: /Open the allocator/ })).toHaveAttribute(
      'href',
      '/tools/paycheck-allocator?from=profile'
    );
  });

  it('reports a shortfall when necessary expenses exceed take-home pay', async () => {
    resetProfileStore({ profile: { ...PROFILES.lean, spending: { necessaryMonthly: 4200 } } });
    render(<OverviewDashboard />);
    const paycheck = card('paycheck');
    expect(paycheck).toHaveTextContent('Necessary expenses exceed take-home pay by $300 per paycheck.');
    expect(paycheck).toHaveTextContent('and $0 to allocate.');
  });
});

describe('RetirementOddsCard', () => {
  it.each<[ProfileName, string, string, string, string, string]>([
    ['basics', '5%', 'Share of 1,000 seeded paths with money left at age 85, retiring at 60', '$1,037,677', '$2,000,000',
      'Saving $500 more per month moves the simulated success rate from 5% to 36.4% and the projected balance to $1,343,473 (same simulated markets).'],
    ['rich', '8.3%', 'Share of 1,000 seeded paths with money left at age 92, retiring at 60', '$1,350,387', '$2,250,000',
      'Saving $500 more per month moves the simulated success rate from 8.3% to 18% and the projected balance to $1,495,138 (same simulated markets).'],
    ['lean', '0%', 'Share of 1,000 seeded paths with money left at age 85, retiring at 67', '$72,086', '$2,000,000',
      'Saving $500 more per month moves the simulated success rate from 0% to 0% and the projected balance to $170,930 (same simulated markets).'],
  ])('%s: the calculator headline under the card labels, and the lever', async (name, success, hint, projected, required, lever) => {
    await renderOverview(name);
    const retirement = card('retirement');
    expect(tile(retirement, 'Simulated success rate')).toBe(`${success}${hint}`);
    expect(tile(retirement, 'Projected at retirement')).toBe(`${projected}Today's dollars`);
    expect(tile(retirement, 'Balance the 4% guideline implies')).toBe(`${required}Today's dollars`);
    expect(retirement).toHaveTextContent(lever);
    expect(within(retirement).getByRole('link', { name: /Open the retirement calculator/ })).toHaveAttribute(
      'href',
      '/tools/retirement-calculator?from=profile'
    );
  });

  it('lists the engine messages for inputs it rejects', async () => {
    resetProfileStore({ profile: { person: { retirementAge: 70, lifeExpectancy: 65 } } });
    render(<OverviewDashboard />);
    const retirement = card('retirement');
    expect(await within(retirement).findByText('The retirement inputs from the profile need attention:')).toBeInTheDocument();
    expect(within(retirement).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(retirement).queryByRole('group', { name: 'Simulated success rate' })).not.toBeInTheDocument();
  });
});

describe('CashBufferCard', () => {
  it.each<[ProfileName, [string, string][], string]>([
    [
      'basics',
      [['Emergency fund', '$5,000Earning 4% APY'], ['Months on hand', '1.7 monthsAt $3,000/mo necessary expenses'],
        ['Cash-flow investor', 'Active$3,0001 month'], ['Standard', '$9,0003 months']],
      'The fund is $4,000 below the 3 months target.',
    ],
    [
      'rich',
      [['Emergency fund', '$30,000Earning 4% APY'], ['Months on hand', '7.1 monthsAt $4,200/mo necessary expenses'],
        ['Cash-flow investor', '$4,2001 month'], ['Standard', 'Active$12,6003 months']],
      '$17,400 sits above the 3 months target. At an assumed 7% long-run portfolio return versus 4% APY, its expected cost is about $522 a year, in exchange for more cushion.',
    ],
    [
      'lean',
      [['Emergency fund', '$1,500Earning 1% APY'], ['Months on hand', '0.4 monthsAt $3,500/mo necessary expenses'],
        ['Cash-flow investor', 'Active$3,5001 month'], ['Standard', '$10,5003 months']],
      'Your own target of 2 months ($7,000) is used below instead of the preset.The fund is $5,500 below the 2 months target.',
    ],
  ])('%s: the fund, both preset targets and the gap', async (name, tiles, gap) => {
    await renderOverview(name);
    const cash = card('cash');
    expect(tiles.map(([label]) => [label, tile(cash, label)])).toEqual(tiles);
    expect(cash).toHaveTextContent(gap);
  });

  it('prices the excess at the one cash-drag return (O16)', async () => {
    await renderOverview('rich');
    expect(ASSUMED_PORTFOLIO_RETURN).toBe(0.07);
    expect(card('cash')).toHaveTextContent(`At an assumed ${formatPercent(ASSUMED_PORTFOLIO_RETURN)} long-run portfolio return`);
  });

  it('shows the missing-value dash when necessary expenses are not set', () => {
    resetProfileStore({ profile: { spending: { necessaryMonthly: 0 } } });
    render(<OverviewDashboard />);
    expect(tile(card('cash'), 'Months on hand')).toBe('\u2014Necessary expenses not set');
  });
});

describe('LeverageCard', () => {
  it.each<[ProfileName, string, string[][], string]>([
    [
      'basics',
      '$500/mo of taxable contributions for 30 years ($205,000 in total, starting from $25,000), into an index fund or a 2x daily-reset fund on the same dates. The cashflow-investor preset uses this comparison for taxable contributions.',
      [
        ['Metric', 'Index', '2x fund'],
        ['Median ending balance', '$1,158,212', '$1,398,228'],
        ['10th percentile', '$460,523', '$253,676'],
        ['90th percentile', '$2,607,506', '$7,455,264'],
        ['Median max drawdown', '36.8%', '70.1%'],
      ],
      'The 2x fund ended behind the index fund in 40% of 500 simulated paths. Estimated annual drag from volatility, financing, and fees: 8%.',
    ],
    [
      'rich',
      '$700/mo of taxable contributions for 19 years ($409,600 in total, starting from $250,000), into an index fund or a 3x daily-reset fund on the same dates. The standard preset does not use leverage; the comparison is shown for reference.',
      [
        ['Metric', 'Index', '3x fund'],
        ['Median ending balance', '$1,547,275', '$1,319,947'],
        ['10th percentile', '$732,336', '$176,029'],
        ['90th percentile', '$3,744,583', '$18,645,827'],
        ['Median max drawdown', '33.1%', '83.8%'],
      ],
      'The 3x fund ended behind the index fund in 55% of 500 simulated paths. Estimated annual drag from volatility, financing, and fees: 17.6%.',
    ],
    [
      'lean',
      '$0/mo of contributions for 15 years ($40,000 in total, starting from $40,000), into an index fund or a 1.5x daily-reset fund on the same dates. The cashflow-investor preset uses this comparison for taxable contributions.',
      [
        ['Metric', 'Index', '1.5x fund'],
        ['Median ending balance', '$139,252', '$141,420'],
        ['10th percentile', '$61,639', '$41,649'],
        ['90th percentile', '$294,035', '$433,920'],
        ['Median max drawdown', '30.8%', '47.6%'],
      ],
      'The 1.5x fund ended behind the index fund in 47% of 500 simulated paths. Estimated annual drag from volatility, financing, and fees: 4.1%.',
    ],
  ])('%s: the comparison on the calculator inputs', async (name, setup, rows, behind) => {
    await renderOverview(name);
    const leverage = card('leverage');
    expect(leverage).toHaveTextContent(setup);
    expect(within(leverage).getByRole('table', { name: /simulated paths$/ })).toBeInTheDocument();
    expect(tableRows(leverage)).toEqual(rows);
    expect(leverage).toHaveTextContent(behind);
    expect(leverage).toHaveTextContent('Assumes 10% mean index return, 16% volatility, and 4.5% financing, before taxes.');
    expect(within(leverage).getByRole('link', { name: /Open the comparison/ })).toHaveAttribute(
      'href',
      '/tools/leverage-comparison?from=profile'
    );
  });

  it('shows the same formatted medians as the comparison page for the same profile', async () => {
    await renderOverview('rich');
    const [, median] = tableRows(card('leverage'));
    cleanup();

    const profile = useProfileStore.getState().profile;
    const inputs = engineInputsFor(LEVERAGE_CALCULATOR, profile);
    render(<LeverageResults inputs={inputs} result={LEVERAGE_CALCULATOR.calculate(inputs)} />);
    const index = screen.getByRole('group', { name: 'Index fund, median ending balance' });
    const leveraged = screen.getByRole('group', { name: '3x fund, median ending balance' });
    expect(index).toHaveTextContent(median[1]);
    expect(leveraged).toHaveTextContent(median[2]);
    expect(median.slice(1)).toEqual(['$1,547,275', '$1,319,947']);
  });

  it('says so instead of comparing when nothing is invested', () => {
    resetProfileStore({ profile: { investing: { investedBalance: 0, monthlyContribution: 0, taxableMonthlyContribution: 0 } } });
    render(<OverviewDashboard />);
    const leverage = card('leverage');
    expect(leverage).toHaveTextContent('The profile has no monthly investing contribution yet, so there is no cash flow to compare.');
    expect(within(leverage).queryByRole('table')).not.toBeInTheDocument();
  });

  it('defers both simulations past the first paint (no long task on first render)', () => {
    resetProfileStore({ profile: PROFILES.basics });
    render(<OverviewDashboard />);
    for (const id of ['leverage', 'retirement']) {
      const region = within(card(id)).getByText(/^Running .* simulated market paths\.\.\.$/).closest('[aria-live]');
      expect(region).toHaveAttribute('aria-busy', 'true');
    }
    expect(within(card('leverage')).getByText('Running 500 simulated market paths...')).toBeInTheDocument();
    expect(within(card('retirement')).getByText('Running 1,000 simulated market paths...')).toBeInTheDocument();
    expect(within(card('leverage')).queryByRole('table')).not.toBeInTheDocument();
    expect(within(card('retirement')).getByRole('group', { name: 'Simulated success rate' })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('AutomationChecklistCard', () => {
  it.each<[ProfileName, string[], string]>([
    [
      'basics',
      [
        '401(k) payroll deferral$2106% of grossPayroll election at 6% of gross pay, set once in the benefits portal; it comes out before take-home pay.',
        'Emergency Fund$1,077Save $1,077 per paycheck toward emergency fund target',
      ],
      '0 of 2 set up.',
    ],
    [
      'rich',
      [
        '401(k) payroll deferral$1928% of grossPayroll election at 8% of gross pay, set once in the benefits portal; it comes out before take-home pay.',
        'Roth IRA$144Contribute $144 per paycheck to Roth IRA ($7,500 annually)',
        '401k (Roth + Traditional)$279+11.6% of grossIncrease 401k (Roth + Traditional) contribution by $279 per paycheck',
        'Taxable Investment$288Invest $288 per paycheck in low-cost index funds',
      ],
      '0 of 4 set up.',
    ],
    [
      'lean',
      [
        '401(k) payroll deferral$3126% of grossPayroll election at 6% of gross pay, set once in the benefits portal; it comes out before take-home pay.',
        '1-Month Emergency Fund$100Save $100 per paycheck toward emergency fund ($1,900 more needed)',
      ],
      '0 of 2 set up.',
    ],
  ])('%s: one transfer per step, amounts per paycheck', async (name, rows, count) => {
    await renderOverview(name);
    const automation = card('automation');
    const boxes = within(automation).getAllByRole('checkbox');
    expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual(rows);
    expect(automation).toHaveTextContent(count);
  });
});
