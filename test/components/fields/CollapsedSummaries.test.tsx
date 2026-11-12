/**
 * Every collapsed input card of every calculator page shows its saved values
 * in one compact line, never its description: the four calculators' forms
 * as FieldSections renders them, every card collapsed, for the default
 * profile with every leaf marked answered and for a rich profile.
 */

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FieldSections } from '@/components/fields';
import { FORMS } from '@/lib/calculators/forms';
import { CALCULATOR_IDS } from '@/lib/calculators/registry';
import { makeGet, setAt } from '@/lib/fields/paths';
import { screensFor } from '@/lib/fields/runtime';
import type { FormSpec, Get, Tier } from '@/lib/fields/types';
import { PROFILE_LEAF_PATHS, PROFILE_LIST_PATHS, getDefaultFinancialProfile } from '@/lib/profile/defaults';

const MAX_LENGTH = 120;

const RICH: Record<string, unknown> = {
  'person.age': 41,
  'person.state': 'CA',
  'person.filingStatus': 'marriedSeparate',
  'income.grossPerPaycheck': 7250,
  'income.netPerPaycheck': 5100,
  'income.frequency': 'semi-monthly',
  'spending.necessaryMonthly': 6200,
  'income.hasBonus': true,
  'income.bonusAmount': 6000,
  'income.bonusFrequency': 'quarterly',
  'workplace.contributionType': 'split',
  'workplace.rothContributionPercent': 0.5,
  'workplace.afterTaxAvailable': true,
  'hsa.eligible': true,
  'hsa.coverage': 'family',
  'hsa.monthlyContribution': 300,
  'hsa.employerAnnualContribution': 1000,
  'hsa.investing': true,
  'ira.traditional': true,
  'ira.traditionalMonthly': 200,
  'ira.traditionalBalance': 12000,
  'ira.roth': true,
  'ira.rothMonthly': 500,
  'ira.rothBalance': 30000,
  debts: [
    { id: 'd1', name: 'Card', balance: 3000, interestRate: 0.24, minimumPayment: 90, extraPayment: 0, taxDeductible: false },
    { id: 'd2', name: 'Car', balance: 13000, interestRate: 0.06, minimumPayment: 300, extraPayment: 50, taxDeductible: false },
  ],
  'cash.targetMonths': 4.5,
  'assumptions.paycheck.riskTolerance': 'optimizer',
  'assumptions.retirement.riskProfile': 'custom',
  'assumptions.retirement.effectiveTaxRate': 0.15,
  'retirementIncome.annualHealthcareCost': 9000,
  'investing.targetMix': 'custom',
  'assumptions.portfolio.mode': 'fractional',
  'assumptions.portfolio.allowTaxableSelling': true,
  'leverage.monthlyContribution': 750,
  'leverage.years': 1,
  'leverage.startingBalance': 100000,
  'strategy.leverageRatio': 3,
};

function profileGet(writes: Record<string, unknown> = {}): Get {
  let values: unknown = getDefaultFinancialProfile();
  for (const [path, value] of Object.entries(writes)) values = setAt(values, path, value);
  return makeGet(values);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EVERY_LEAF: readonly string[] = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS];

/** Each card's title, tier, description and the line its collapsed body shows. */
function collapsedLines(form: FormSpec, get: Get) {
  render(
    <FieldSections
      form={form}
      get={get}
      errors={{}}
      onWrite={() => {}}
      provided={EVERY_LEAF}
      initiallyCollapsed={() => true}
    />
  );
  const screens = screensFor(form, get, { mode: 'all', surface: 'calculator' });
  return screens.map((spec) => {
    const region = screen.getByRole('region', { name: spec.title });
    const toggle = within(region).getByRole('button', { expanded: false, name: new RegExp(`${escapeRegExp(spec.title)}$`, 'i') });
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    return { title: spec.title, tier: spec.tier, description: spec.description, line: body?.textContent?.trim() ?? '' };
  });
}

afterEach(cleanup);

describe.each([
  ['the default profile, every leaf answered', {}],
  ['a rich profile', RICH],
])('collapsed cards for %s', (_, writes) => {
  it.each(CALCULATOR_IDS)('%s: every card shows a compact line of values', (id) => {
    const cards = collapsedLines(FORMS[id], profileGet(writes));
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.line, card.title).not.toBe('');
      expect(card.line, card.title).not.toBe(card.description);
      expect(card.line.length, `${card.title}: ${card.line}`).toBeLessThanOrEqual(MAX_LENGTH);
    }
  });
});

describe('collapsed cards across the calculators', () => {
  it('cover the core, details and assumption tiers', () => {
    const tiers = new Set<Tier>();
    for (const id of CALCULATOR_IDS) {
      for (const card of collapsedLines(FORMS[id], profileGet())) tiers.add(card.tier);
      cleanup();
    }
    expect([...tiers].sort()).toEqual(['assumption', 'core', 'details']);
  });

  it('read the core values on the paycheck page', () => {
    const lines = collapsedLines(FORMS.paycheck, profileGet(RICH)).slice(0, 3).map((card) => card.line);
    expect(lines).toEqual([
      '41, CA, married filing separately',
      '$7,250 gross twice a month, $5,100 take-home',
      '$6,200 a month',
    ]);
  });
});
