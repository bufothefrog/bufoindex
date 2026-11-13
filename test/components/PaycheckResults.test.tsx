/**
 * The paycheck allocator's results on the shared vocabulary (c4): the
 * allocation header and step progress, the step cards (with the 55+ HSA
 * catch-up, bug 4), the payroll guide's paycheck flow tiles and automation
 * level choice, and the long-term projection rows. Figures come from the
 * real engine; the ones asserted here are what the results printed before
 * the rebuild for the same inputs, except the HSA limit at 55 and over.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FinancialStepCard } from '@/components/paycheck-allocator/FinancialStepCard';
import { ResultsSection } from '@/components/paycheck-allocator/ResultsSection';
import { calculateOptimalAllocation } from '@/lib/calculations/core';
import { PAYCHECK_CALCULATOR } from '@/lib/calculators/paycheck/definition';
import { engineInputsFor } from '@/lib/calculators/runtime';
import { FINANCIAL_STEPS } from '@/lib/constants/financialSteps';
import { applyProfileWrites, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import type { PaycheckProfile } from '@/lib/types';
import { calculateStepStatus } from '@/lib/utils/stepStatusUtils';
import {
  createBenefitsData,
  createHSABenefits,
  createIRAData,
  createIncomeData,
  createPaycheckProfile,
  createTaxData,
  createUserPreferences,
} from '@/test/factories/test-data-factory';

/** A monthly earner with family HSA coverage and no HSA or IRA contributions yet. */
function hsaProfile(age: number): PaycheckProfile {
  return createPaycheckProfile({
    lastUpdated: 0,
    income: createIncomeData({ frequency: 'monthly', gross: 12000, monthlyGross: 12000, netPaycheck: 8000, grossPaycheck: 12000 }),
    taxes: createTaxData({ federalBracket: 0.24 }),
    benefits: createBenefitsData({
      hsa: createHSABenefits({ currentContribution: 0, coverageType: 'family' }),
      ira: createIRAData({ currentContributions: { traditional: 0, roth: 0 } }),
    }),
    preferences: createUserPreferences({ age }),
    debts: [],
  });
}

function renderResults(profile: PaycheckProfile) {
  return render(<ResultsSection result={calculateOptimalAllocation(profile)} inputs={profile} stale={false} />);
}

/** The value (dd) printed for the row whose label (dt) contains `label`, within `root`. */
function valueOf(root: HTMLElement, label: string): string | null {
  const term = within(root).getAllByRole('term').find((dt) => within(dt).queryByText(label) !== null);
  expect(term, `a row labelled ${label}`).toBeDefined();
  return within(term!.parentElement as HTMLElement).getByRole('definition').textContent;
}

beforeEach(() => {
  usePreferencesStore.setState({ displayMode: 'today' });
});

describe('FinancialStepCard: HSA limit (bug 4)', () => {
  function renderHsaStep(age: number) {
    const profile = hsaProfile(age);
    const steps = calculateStepStatus(FINANCIAL_STEPS, calculateOptimalAllocation(profile).allocations, profile);
    const step = steps.find((candidate) => candidate.id === 'hsa-max')!;
    render(<FinancialStepCard step={step} profile={profile} expanded={false} onToggle={() => {}} />);
  }

  it('includes the $1,000 catch-up at 55 and over', () => {
    renderHsaStep(56);

    // Family 8,750 + 1,000 catch-up; 9,750 / 12 = $812.50 a monthly paycheck.
    expect(screen.getByText('$0 of $9,750')).toBeInTheDocument();
    expect(screen.getByText('$813')).toBeInTheDocument();
    expect(screen.getByText('per paycheck to reach the limit', { exact: false })).toBeInTheDocument();
  });

  it('leaves it out below 55', () => {
    renderHsaStep(54);

    // 8,750 / 12 = $729.17.
    expect(screen.getByText('$0 of $8,750')).toBeInTheDocument();
    expect(screen.getByText('$729')).toBeInTheDocument();
  });
});

describe('FinancialStepCard: Emergency Fund on the zero-cash default', () => {
  it('quotes the same monthly figure in the header and in How to Implement', async () => {
    // Default profile with the emergency fund answered 0: 1,026.92 per bi-weekly paycheck,
    // 1,026.92 x 26 / 12 = $2,225/month, toward a 3 x 3,000 = $9,000 target.
    const writes = [{ path: 'cash.emergencyFundBalance', value: 0 }];
    const { profile: stored, accepted } = applyProfileWrites(getDefaultFinancialProfile(), writes);
    const profile = engineInputsFor(PAYCHECK_CALCULATOR, { ...stored, provided: [...stored.provided, ...accepted] });
    const steps = calculateStepStatus(FINANCIAL_STEPS, calculateOptimalAllocation(profile).allocations, profile);
    const step = steps.find((candidate) => candidate.id === 'emergency-full')!;
    render(<FinancialStepCard step={step} profile={profile} expanded onToggle={() => {}} />);

    expect(screen.getByText('$1,027')).toBeInTheDocument();
    expect(screen.getByText('$2,225/month')).toBeInTheDocument();
    const howTo = screen.getByRole('list');
    expect(within(howTo).getByText('Calculate total needed: $9,000')).toBeInTheDocument();
    expect(within(howTo).getByText('Set automatic transfer for $2,225/month')).toBeInTheDocument();
    expect(screen.queryByText(/\$750\/month/)).not.toBeInTheDocument();
  });
});

describe('ResultsSection', () => {
  it('heads the allocation with the pay frequency, the take-home pay and the step progress', () => {
    renderResults(hsaProfile(56));

    expect(screen.getByRole('heading', { name: 'Your Monthly Paycheck Allocation' })).toBeInTheDocument();
    // PR 5: the one-month step is gone, so 6 steps apply (debt and the mega
    // backdoor do not) and 2 are complete (the match and the emergency fund).
    expect(screen.getByText('Optimization Progress: 2 of 6 steps')).toBeInTheDocument();
    expect(screen.getByText('33% Complete')).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: 'Optimization progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '33');
    expect(progress).toHaveAttribute('aria-valuetext', '2 of 6 steps');
    expect(screen.getByText('3 Optimizations')).toBeInTheDocument();
  });

  it('lists the steps with their per-paycheck figures', () => {
    renderResults(hsaProfile(56));

    const steps = screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);
    expect(steps.slice(0, 8)).toEqual([
      'Employer 401k Match',
      'High-Interest Debt (7%+)',
      'Emergency Fund',
      'HSA Maximum',
      'Roth IRA Maximum',
      '401k Maximum',
      'Mega Backdoor Roth',
      'Taxable Investment',
    ]);
    expect(screen.getByText('Maximizing HSA contributions \u2014 $195/mo modeled gain')).toBeInTheDocument();
    expect(screen.getByText('$8,640 of $32,500')).toBeInTheDocument();
    expect(screen.getByText('(27% of the annual limit)')).toBeInTheDocument();
  });

  it('shows the expanded step impact as signed label and value pairs', async () => {
    renderResults(hsaProfile(56));

    await userEvent.setup().click(screen.getByRole('button', { name: /HSA Maximum/ }));
    expect(screen.getByRole('heading', { name: 'Financial Impact' })).toBeInTheDocument();
    expect(valueOf(document.body, 'Monthly Impact')).toBe('+$195');
    expect(valueOf(document.body, 'Annual Impact')).toBe('+$2,340');
  });

  it('shows the paycheck flow as headline tiles', () => {
    renderResults(hsaProfile(56));

    expect(screen.getByRole('heading', { name: 'Your Monthly Paycheck Flow' })).toBeInTheDocument();
    for (const [label, value] of [
      ['Take-Home Pay', '$8,000'],
      ['Expenses + Fun Money', '$3,200'],
      ['Priority Investments', '$4,800'],
    ]) {
      expect(within(screen.getByRole('group', { name: label })).getByText(value)).toBeInTheDocument();
    }
  });

  it('switches the setup instructions with the automation level', async () => {
    const user = userEvent.setup();
    renderResults(hsaProfile(56));

    const levels = screen.getByRole('radiogroup', { name: 'Automation level' });
    expect(within(levels).getByRole('radio', { name: 'Intermediate' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { name: 'Intermediate Setup (2-Account Split)' })).toBeInTheDocument();
    expect(screen.getByText('Account 2 - Primary Investment/Savings: $4,800')).toBeInTheDocument();
    expect(screen.getByText('\u2022 HSA Contribution: $771')).toBeInTheDocument();

    await user.click(within(levels).getByRole('radio', { name: 'Basic' }));
    const basic = screen.getByRole('region', { name: 'basic setup instructions' });
    expect(within(basic).getByRole('heading', { name: 'Basic Setup (Manual Transfers)' })).toBeInTheDocument();
    expect(within(basic).getByText('Amount per paycheck: $8,000')).toBeInTheDocument();
    expect(within(basic).getByText('\u2022 Roth IRA: $717 monthly')).toBeInTheDocument();

    await user.click(within(levels).getByRole('radio', { name: 'Advanced' }));
    const advanced = screen.getByRole('region', { name: 'advanced setup instructions' });
    expect(within(advanced).getByText('Account 1 - Checking: $3,200')).toBeInTheDocument();
    expect(within(advanced).getByText('Account 4 - 401k (Roth + Traditional): $1,988')).toBeInTheDocument();
    expect(within(advanced).queryByText(/Taxable Investment/)).not.toBeInTheDocument();
  });

  it('prints the ten-year paths and the improvement in today\'s dollars', () => {
    renderResults(hsaProfile(56));

    expect(screen.getByRole('heading', { name: 'Long-Term Impact' })).toBeInTheDocument();
    // PR 5: each yearly stream is 12 end-of-month deposits at 1.07^(1/12) - 1, so a
    // stream dollar is worth 14.2543 after 10 years (13.8164 before). Net worth 29,000
    // (9,000 fund + 20,000 IRA balances) grows to 57,047.39. Current stream 18,720,
    // optimized 78,320.57: 323,888.09 / 1,173,453.08 nominal, / 1.03^10 in today's
    // dollars (before: $234,904 / $847,642 / +$612,738, 24 years 1 month).
    expect(valueOf(document.body, 'Current Path (10 years)')).toBe('$241,003');
    expect(valueOf(document.body, 'Optimized Path (10 years)')).toBe('$873,159');
    expect(valueOf(document.body, 'Improvement')).toBe('+$632,156');
    // FI: 56 + 32.59 against 56 + 8.74, 23.85 years earlier.
    expect(screen.getByText('23 years 10 months earlier')).toBeInTheDocument();
  });

  it('warns when necessary expenses exceed take-home pay', () => {
    const profile = createPaycheckProfile({
      lastUpdated: 0,
      income: createIncomeData({ frequency: 'monthly', netPaycheck: 2000 }),
      preferences: createUserPreferences({ necessaryExpenses: 2600 }),
      debts: [],
    });
    renderResults(profile);

    expect(screen.getByText('Necessary expenses exceed take-home pay')).toBeInTheDocument();
    expect(screen.getByText(/Your necessary expenses are \$600 more than/)).toBeInTheDocument();
  });
});
