/**
 * Profile deep-link tests. Each hash link must decode, through the
 * destination calculator's own codec, back to exactly the mapped inputs, so
 * navigating to the link seeds the calculator with the profile. Every link
 * carries ?from=profile.
 *
 * Goldens: the hashes and leverage queries below were captured from the v1
 * link builders before the profile moved to v2; for v1-shaped data the v2
 * links are the same hash (or query) behind ?from=profile.
 */

import { describe, expect, it } from 'vitest';
import {
  getDefaultFinancialProfile,
  LEVERAGE_PATH,
  leverageLink,
  migrateProfile,
  PAYCHECK_PATH,
  paycheckLink,
  PORTFOLIO_PATH,
  portfolioLink,
  PROFILE_HANDOFF_PARAM,
  PROFILE_HANDOFF_VALUE,
  RETIREMENT_PATH,
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

/** A saved v1 profile that differs from the defaults in every section, loaded through the v1 migration. */
function customProfile(): FinancialProfile {
  return migrateProfile(
    {
      version: 1,
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
    },
    1
  );
}

/** Hashes the v1 builders produced, per profile: [retirement, paycheck, portfolio]. */
const GOLDEN_HASHES: Record<'default' | 'custom', readonly [string, string, string]> = {
  default: [
    'eyJ2IjoyLCJzYSI6MzAsInNiIjoyNTAwMCwiY2kiOjkxMDAwLCJpYSI6MzUwMCwiaXAiOiJiaXdlZWtseSIsIm1zIjoxNTAwLCJubWUiOjMwMDB9',
    'eyJ2IjoyLCJwIjp7ImlnIjo3NTgzLjMzMzMzMzMzMzMzMywiaW4iOjU2MzMuMzMzMzMzMzMzMzMzLCJpZiI6ImJpLXdlZWtseSIsImlwZyI6MzUwMCwiaXBuIjoyNjAwLCJ0cyI6IlRYIiwiYjQwMSI6eyJhIjp0cnVlLCJtcCI6MC41LCJtbCI6MC4wNiwiY2MiOjAuMDYsInRjIjowLjA2fSwicHIiOnsibmUiOjMwMDAsImVmbSI6MywiZWYiOjUwMDAsImZtbiI6MzAwLCJmbXgiOjYwMCwiYWdlIjozMCwiaHRhIjp0cnVlLCJ0YWMiOjUwMH19fQ',
    'eyJ2IjozLCJzbSI6Im11bHRpLXNoYXJlZCIsInNlIjpbeyJpIjoic2VjLXZ0aSIsInQiOiJWVEkiLCJwIjoyNTAsImsiOiJ1cy1zdG9jayIsIm4iOiJWYW5ndWFyZCBUb3RhbCBVUyBTdG9jayJ9LHsiaSI6InNlYy12eHVzIiwidCI6IlZYVVMiLCJwIjo2MCwiayI6ImludGwtc3RvY2siLCJuIjoiVmFuZ3VhcmQgVG90YWwgSW50bCBTdG9jayJ9LHsiaSI6InNlYy1ibmQiLCJ0IjoiQk5EIiwicCI6NzUsImsiOiJib25kcyIsIm4iOiJWYW5ndWFyZCBUb3RhbCBCb25kIn1dLCJhYyI6W3siaSI6ImFjYy1yb3RoIiwibiI6IlJvdGggSVJBIiwiYyI6InRheC1mcmVlIiwiZCI6MH0seyJpIjoiYWNjLWJyb2siLCJuIjoiQnJva2VyYWdlIiwiYyI6InRheGFibGUiLCJkIjoxMDAwfV0sImhvIjpbeyJpIjoiaGxkLXJvdGgtdnRpIiwiYSI6ImFjYy1yb3RoIiwicyI6InNlYy12dGkiLCJoIjoxMH0seyJpIjoiaGxkLXJvdGgtYm5kIiwiYSI6ImFjYy1yb3RoIiwicyI6InNlYy1ibmQiLCJoIjo1fSx7ImkiOiJobGQtYnJvay12dGkiLCJhIjoiYWNjLWJyb2siLCJzIjoic2VjLXZ0aSIsImgiOjIwfSx7ImkiOiJobGQtYnJvay12eHVzIiwiYSI6ImFjYy1icm9rIiwicyI6InNlYy12eHVzIiwiaCI6MTV9XSwiY3QiOlt7ImEiOm51bGwsImsiOiJ1cy1zdG9jayIsInQiOjAuNn0seyJhIjpudWxsLCJrIjoiaW50bC1zdG9jayIsInQiOjAuMn0seyJhIjpudWxsLCJrIjoiYm9uZHMiLCJ0IjowLjJ9LHsiYSI6bnVsbCwiayI6ImNhc2giLCJ0IjowfV0sInAiOnRydWV9',
  ],
  custom: [
    'eyJ2IjoyLCJzYSI6MzgsInJhIjo1OCwidGkiOjExMDAwMCwic2IiOjE0MDAwMCwiY2kiOjEwOTIwMCwiaWEiOjEwOTIwMCwibXMiOjIyMDAsImZzIjoibWFycmllZEpvaW50Iiwic3QiOiJDQSIsIm5tZSI6NDIwMH0',
    'eyJ2IjoyLCJwIjp7ImlnIjo5MTAwLCJpbiI6NjcxNi42NjY2NjY2NjY2NjYsImlmIjoid2Vla2x5IiwiaXBnIjoyMTAwLCJpcG4iOjE1NTAsInRzIjoiQ0EiLCJ0ZiI6Im1hcnJpZWRKb2ludCIsImI0MDEiOnsiYSI6dHJ1ZSwibXAiOjEsIm1sIjowLjA0LCJjYyI6MC4xLCJ0YyI6MC4xfSwicHIiOnsibmUiOjQyMDAsImVmbSI6MSwiZWYiOjEyMDAwLCJhcHkiOjAuMDQ1LCJmbW4iOjI1MCwiZm14Ijo5MDAsImFnZSI6MzgsImh0YSI6dHJ1ZSwidGFjIjo5MDB9fX0',
    'eyJ2IjozLCJzbSI6Im11bHRpLXNoYXJlZCIsInNlIjpbeyJpIjoic2VjLXZ0aSIsInQiOiJWVEkiLCJwIjoyNTAsImsiOiJ1cy1zdG9jayIsIm4iOiJWYW5ndWFyZCBUb3RhbCBVUyBTdG9jayJ9LHsiaSI6InNlYy12eHVzIiwidCI6IlZYVVMiLCJwIjo2MCwiayI6ImludGwtc3RvY2siLCJuIjoiVmFuZ3VhcmQgVG90YWwgSW50bCBTdG9jayJ9LHsiaSI6InNlYy1ibmQiLCJ0IjoiQk5EIiwicCI6NzUsImsiOiJib25kcyIsIm4iOiJWYW5ndWFyZCBUb3RhbCBCb25kIn1dLCJhYyI6W3siaSI6ImFjYy1yb3RoIiwibiI6IlJvdGggSVJBIiwiYyI6InRheC1mcmVlIiwiZCI6MH0seyJpIjoiYWNjLWJyb2siLCJuIjoiQnJva2VyYWdlIiwiYyI6InRheGFibGUiLCJkIjozMDAwfV0sImhvIjpbeyJpIjoiaGxkLXJvdGgtdnRpIiwiYSI6ImFjYy1yb3RoIiwicyI6InNlYy12dGkiLCJoIjoxMH0seyJpIjoiaGxkLXJvdGgtYm5kIiwiYSI6ImFjYy1yb3RoIiwicyI6InNlYy1ibmQiLCJoIjo1fSx7ImkiOiJobGQtYnJvay12dGkiLCJhIjoiYWNjLWJyb2siLCJzIjoic2VjLXZ0aSIsImgiOjIwfSx7ImkiOiJobGQtYnJvay12eHVzIiwiYSI6ImFjYy1icm9rIiwicyI6InNlYy12eHVzIiwiaCI6MTV9XSwiY3QiOlt7ImEiOm51bGwsImsiOiJ1cy1zdG9jayIsInQiOjAuNDV9LHsiYSI6bnVsbCwiayI6ImludGwtc3RvY2siLCJ0IjowLjE1fSx7ImEiOm51bGwsImsiOiJib25kcyIsInQiOjAuNH0seyJhIjpudWxsLCJrIjoiY2FzaCIsInQiOjB9XSwicCI6dHJ1ZX0',
  ],
};

const PROFILES = { default: getDefaultFinancialProfile, custom: customProfile };

/** The `from` query value of a link, or null. */
function handoffOf(link: string): string | null {
  const query = link.split('#')[0].split('?')[1] ?? '';
  return new URLSearchParams(query).get(PROFILE_HANDOFF_PARAM);
}

function hashOf(link: string): string {
  const idx = link.indexOf('#');
  expect(idx).toBeGreaterThan(0);
  return link.slice(idx + 1);
}

describe('profile handoff', () => {
  it('marks every link with ?from=profile', () => {
    expect(PROFILE_HANDOFF_PARAM).toBe('from');
    expect(PROFILE_HANDOFF_VALUE).toBe('profile');
    for (const build of [retirementLink, paycheckLink, portfolioLink, leverageLink]) {
      expect(handoffOf(build(getDefaultFinancialProfile()))).toBe('profile');
      expect(handoffOf(build(customProfile()))).toBe('profile');
    }
  });

  it.each(['default', 'custom'] as const)('keeps the v1 hashes behind ?from=profile for the %s profile', (name) => {
    const profile = PROFILES[name]();
    const [retirement, paycheck, portfolio] = GOLDEN_HASHES[name];
    expect(retirementLink(profile)).toBe(`${RETIREMENT_PATH}?from=profile#${retirement}`);
    expect(paycheckLink(profile)).toBe(`${PAYCHECK_PATH}?from=profile#${paycheck}`);
    expect(portfolioLink(profile)).toBe(`${PORTFOLIO_PATH}?from=profile#${portfolio}`);
  });
});

describe('retirementLink', () => {
  it('targets the retirement calculator with a URL-safe hash', () => {
    const link = retirementLink(getDefaultFinancialProfile());
    expect(link.startsWith('/tools/retirement-calculator?from=profile#')).toBe(true);
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
    expect(link.startsWith('/tools/paycheck-allocator?from=profile#')).toBe(true);
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
    expect(link.startsWith('/tools/portfolio-rebalancing-calculator?from=profile#')).toBe(true);
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
      '/tools/leverage-comparison?c=500&y=30&b=25000&l=2&from=profile'
    );
    expect(leverageLink(customProfile())).toBe('/tools/leverage-comparison?c=900&y=20&b=140000&l=1.5&from=profile');
  });

  it('falls back to the total monthly contribution when there is no taxable contribution', () => {
    const base = getDefaultFinancialProfile();
    const profile = { ...base, investing: { ...base.investing, taxableMonthlyContribution: 0 } };
    expect(leverageLink(profile)).toBe('/tools/leverage-comparison?c=1500&y=30&b=25000&l=2&from=profile');
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
    expect(leverageLink(broken)).toBe('/tools/leverage-comparison?c=0&y=1&b=0&l=2&from=profile');
  });

  it('uses the leverage overrides when they are set', () => {
    const base = getDefaultFinancialProfile();
    const overridden = { ...base, leverage: { monthlyContribution: 750, years: 12, startingBalance: 0 } };
    expect(leverageLink(overridden)).toBe(`${LEVERAGE_PATH}?c=750&y=12&b=0&l=2&from=profile`);
    const tooLong = { ...base, leverage: { ...base.leverage, years: 75 } };
    expect(new URLSearchParams(leverageLink(tooLong).split('?')[1]).get('y')).toBe('60');
  });
});
