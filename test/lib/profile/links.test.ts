/**
 * Profile deep-link tests. Each hash link must decode, through the
 * destination calculator's own codec, back to exactly the mapped inputs, so
 * navigating to the link seeds the calculator with the profile.
 */

import { describe, expect, it } from 'vitest';
import {
  getDefaultFinancialProfile,
  leverageLink,
  paycheckLink,
  portfolioLink,
  retirementLink,
  toPaycheckProfile,
  toRebalanceInputs,
  toRetirementInputs,
} from '@/lib/profile';
import type { FinancialProfile } from '@/lib/profile';
import { decodeFromUrlHash } from '@/lib/utils';
import { decodeRetirementFromUrlHash } from '@/lib/utils/retirementState';
import { decodeRebalancingFromUrlHash } from '@/lib/utils/portfolioRebalancingState';
import type { PaycheckProfile } from '@/lib/types';
import { calculateOptimalAllocation } from '@/lib/calculations/core';

/** A profile that differs from the defaults in every section. */
function customProfile(): FinancialProfile {
  const p = getDefaultFinancialProfile();
  return {
    ...p,
    updatedAt: 1760000000000,
    person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
    income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
    spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
    cash: { emergencyFundBalance: 12000, emergencyFundApy: 0.045, targetMonths: 1 },
    workplace: { has401k: true, matchPercent: 1, matchLimit: 0.04, contributionPercent: 0.1 },
    investing: {
      investedBalance: 140000,
      monthlyContribution: 2200,
      taxableMonthlyContribution: 900,
      targetMix: '60-40',
      newCashThisMonth: 3000,
    },
    strategy: { preset: 'standard', leverageRatio: 1.5 },
    provided: ['person.age'],
  };
}

function hashOf(link: string): string {
  const idx = link.indexOf('#');
  expect(idx).toBeGreaterThan(0);
  return link.slice(idx + 1);
}

describe('retirementLink', () => {
  it('targets the retirement calculator with a URL-safe hash', () => {
    const link = retirementLink(getDefaultFinancialProfile());
    expect(link.startsWith('/tools/retirement-calculator#')).toBe(true);
    expect(hashOf(link)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['default', getDefaultFinancialProfile()],
    ['custom', customProfile()],
  ])('round-trips the %s profile through decodeRetirementFromUrlHash', (_name, profile) => {
    const decoded = decodeRetirementFromUrlHash(hashOf(retirementLink(profile)));
    expect(decoded).not.toBeNull();
    expect(decoded!.displayMode).toBe('today');
    expect(decoded!.inputs).toEqual(toRetirementInputs(profile));
  });

  it('decodes the concrete default values', () => {
    const decoded = decodeRetirementFromUrlHash(hashOf(retirementLink(getDefaultFinancialProfile())))!;
    expect(decoded.inputs.startingAge).toBe(30);
    expect(decoded.inputs.currentIncome).toBe(91000);
    expect(decoded.inputs.incomeAmount).toBe(3500);
    expect(decoded.inputs.incomePeriod).toBe('biweekly');
    expect(decoded.inputs.monthlySavings).toBe(1500);
    expect(decoded.inputs.startingBalance).toBe(25000);
    expect(decoded.inputs.necessaryMonthlyExpenses).toBe(3000);
  });
});

describe('paycheckLink', () => {
  type DecodedShare = { displayMode: 'today' | 'nominal'; profile: PaycheckProfile };

  it('targets the paycheck allocator with a URL-safe hash', () => {
    const link = paycheckLink(getDefaultFinancialProfile());
    expect(link.startsWith('/tools/paycheck-allocator#')).toBe(true);
    expect(hashOf(link)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['default', getDefaultFinancialProfile()],
    ['custom', customProfile()],
  ])('round-trips the fields the share codec carries for the %s profile', (_name, profile) => {
    const decoded = decodeFromUrlHash(hashOf(paycheckLink(profile))) as DecodedShare;
    const mapped = toPaycheckProfile(profile);
    expect(decoded.displayMode).toBe('today');

    const { income, taxes, benefits, preferences } = decoded.profile;
    expect(income.grossPaycheck).toBe(mapped.income.grossPaycheck);
    expect(income.netPaycheck).toBe(mapped.income.netPaycheck);
    expect(income.frequency).toBe(mapped.income.frequency);
    expect(income.monthlyGross).toBe(mapped.income.monthlyGross);
    expect(income.monthlyNet).toBe(mapped.income.monthlyNet);
    expect(taxes.state).toBe(mapped.taxes.state);
    expect(taxes.filingStatus).toBe(mapped.taxes.filingStatus);
    expect(benefits.employer401k.available).toBe(true);
    expect(benefits.employer401k.matchPercent).toBe(mapped.benefits.employer401k.matchPercent);
    expect(benefits.employer401k.matchLimit).toBe(mapped.benefits.employer401k.matchLimit);
    expect(benefits.employer401k.currentContribution).toBe(mapped.benefits.employer401k.currentContribution);
    expect(benefits.employer401k.traditionalContribution).toBe(
      mapped.benefits.employer401k.traditionalContribution
    );
    expect(preferences.age).toBe(mapped.preferences.age);
    expect(preferences.necessaryExpenses).toBe(mapped.preferences.necessaryExpenses);
    expect(preferences.currentEmergencyFund).toBe(mapped.preferences.currentEmergencyFund);
    expect(preferences.emergencyFundAPY).toBe(mapped.preferences.emergencyFundAPY);
    expect(preferences.funMoney.min).toBe(mapped.preferences.funMoney.min);
    expect(preferences.funMoney.max).toBe(mapped.preferences.funMoney.max);
    expect(preferences.hasTaxableAccount).toBe(true);
    expect(preferences.taxableAccountContribution).toBe(mapped.preferences.taxableAccountContribution);
  });

  it('decodes the concrete default values', () => {
    const decoded = decodeFromUrlHash(hashOf(paycheckLink(getDefaultFinancialProfile()))) as DecodedShare;
    expect(decoded.profile.income.grossPaycheck).toBe(3500);
    expect(decoded.profile.income.netPaycheck).toBe(2600);
    expect(decoded.profile.income.frequency).toBe('bi-weekly');
    expect(decoded.profile.income.monthlyGross).toBeCloseTo(7583.33, 2);
    expect(decoded.profile.taxes.state).toBe('TX');
    expect(decoded.profile.benefits.employer401k.matchPercent).toBe(0.5);
    expect(decoded.profile.preferences.necessaryExpenses).toBe(3000);
    expect(decoded.profile.preferences.taxableAccountContribution).toBe(500);
  });

  it('carries the emergency-fund target months (cash.targetMonths) through the link', () => {
    expect(
      (decodeFromUrlHash(hashOf(paycheckLink(customProfile()))) as DecodedShare).profile.preferences.emergencyFundMonths
    ).toBe(1);
    expect(
      (decodeFromUrlHash(hashOf(paycheckLink(getDefaultFinancialProfile()))) as DecodedShare).profile.preferences
        .emergencyFundMonths
    ).toBe(3);
  });

  it('decodes to a profile the allocation engine can run once the emergency fund is already funded', () => {
    // Regression: the decoded profile used to lack benefits.ira, so the Roth IRA
    // step threw as soon as money flowed past the emergency-fund top-up.
    const base = getDefaultFinancialProfile();
    const profile: FinancialProfile = {
      ...base,
      income: { ...base.income, grossPerPaycheck: 4500, netPerPaycheck: 3800 },
      cash: { ...base.cash, emergencyFundBalance: 50000 },
    };
    const decoded = decodeFromUrlHash(hashOf(paycheckLink(profile))) as DecodedShare;
    const result = calculateOptimalAllocation(decoded.profile);
    const allocated = result.allocations.reduce((sum, item) => sum + item.amount, 0);
    expect(result.allocations.length).toBeGreaterThan(0);
    expect(allocated).toBeLessThanOrEqual(3800 + 0.01);
  });

  it('decodes a profile without a 401(k) as unavailable', () => {
    const base = getDefaultFinancialProfile();
    const profile = { ...base, workplace: { ...base.workplace, has401k: false } };
    const decoded = decodeFromUrlHash(hashOf(paycheckLink(profile))) as DecodedShare;
    expect(decoded.profile.benefits.employer401k.available).toBe(false);
  });
});

describe('portfolioLink', () => {
  it('targets the rebalancer with a URL-safe hash', () => {
    const link = portfolioLink(getDefaultFinancialProfile());
    expect(link.startsWith('/tools/portfolio-rebalancing-calculator#')).toBe(true);
    expect(hashOf(link)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['default', getDefaultFinancialProfile()],
    ['custom', customProfile()],
  ])('round-trips the %s profile through decodeRebalancingFromUrlHash', (_name, profile) => {
    const decoded = decodeRebalancingFromUrlHash(hashOf(portfolioLink(profile)));
    // The codec omits an empty customAssetClasses list from the hash but
    // always restores it as [] on decode, so the round trip is exact.
    expect(decoded).toEqual(toRebalanceInputs(profile));
    expect(decoded?.customAssetClasses).toEqual([]);
  });

  it('decodes the 60/40 targets and the brokerage deposit', () => {
    const decoded = decodeRebalancingFromUrlHash(hashOf(portfolioLink(customProfile())))!;
    expect(decoded.classTargets.map((t) => [t.assetClass, t.target])).toEqual([
      ['us-stock', 0.45],
      ['intl-stock', 0.15],
      ['bonds', 0.4],
      ['cash', 0],
    ]);
    expect(decoded.accounts.find((a) => a.name === 'Brokerage')?.deposit).toBe(3000);
    expect(decoded.accounts.find((a) => a.name === 'Roth IRA')?.deposit).toBe(0);
  });
});

describe('leverageLink', () => {
  it('uses the taxable contribution, years to retirement, balance and ratio', () => {
    expect(leverageLink(getDefaultFinancialProfile())).toBe(
      '/tools/leverage-comparison?c=500&y=30&b=25000&l=2'
    );
    expect(leverageLink(customProfile())).toBe('/tools/leverage-comparison?c=900&y=20&b=140000&l=1.5');
  });

  it('falls back to the total monthly contribution when there is no taxable contribution', () => {
    const base = getDefaultFinancialProfile();
    const profile = { ...base, investing: { ...base.investing, taxableMonthlyContribution: 0 } };
    expect(leverageLink(profile)).toBe('/tools/leverage-comparison?c=1500&y=30&b=25000&l=2');
  });

  it('clamps years to 1..60', () => {
    const base = getDefaultFinancialProfile();
    const past = { ...base, person: { ...base.person, age: 70, retirementAge: 60 } };
    const far = { ...base, person: { ...base.person, age: 18, retirementAge: 95 } };
    expect(new URLSearchParams(leverageLink(past).split('?')[1]).get('y')).toBe('1');
    expect(new URLSearchParams(leverageLink(far).split('?')[1]).get('y')).toBe('60');
  });

  it('substitutes safe values for non-finite numbers', () => {
    const base = getDefaultFinancialProfile();
    const broken = {
      ...base,
      person: { ...base.person, age: Number.NaN },
      investing: { ...base.investing, taxableMonthlyContribution: Number.NaN, monthlyContribution: Number.NaN, investedBalance: Number.NaN },
      strategy: { ...base.strategy, leverageRatio: Number.NaN },
    };
    expect(leverageLink(broken)).toBe('/tools/leverage-comparison?c=0&y=1&b=0&l=2');
  });
});
