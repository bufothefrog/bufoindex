/**
 * Tests for the label vocabularies (lib/constants/labels.ts, frequency.ts)
 * and the disclaimer fragments (lib/constants/disclaimers.ts).
 */

import { describe, expect, it } from 'vitest';
import {
  FREQUENCY_MULTIPLIERS,
  PAY_FREQUENCY_META,
  PAY_FREQUENCY_OPTIONS,
  type PayFrequency,
} from '@/lib/constants/frequency';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_OPTIONS,
  BONUS_FREQUENCY_LABELS,
  BONUS_FREQUENCY_OPTIONS,
  CONTRIBUTION_TYPE_LABELS,
  CONTRIBUTION_TYPE_OPTIONS,
  FILING_STATUS_META,
  FILING_STATUS_OPTIONS,
  HSA_COVERAGE_LABELS,
  HSA_COVERAGE_OPTIONS,
  LEVERAGE_RATIO_LABELS,
  OPTIMIZATION_GOAL_LABELS,
  OPTIMIZATION_GOAL_OPTIONS,
  RISK_TOLERANCE_LABELS,
  RISK_TOLERANCE_OPTIONS,
  TARGET_MIX_LABELS,
  TARGET_MIX_OPTIONS,
  leverageRatioLabel,
  leverageRatioOptions,
  type LabelOption,
} from '@/lib/constants/labels';
import { DISCLAIMER, composeDisclaimer } from '@/lib/constants/disclaimers';
import { LEVERAGE_RATIO_OPTIONS } from '@/lib/constants/leverage';
import { PAY_FREQUENCIES, TARGET_MIX_PRESETS } from '@/lib/profile/defaults';

/** The value lists every vocabulary must cover, spelled as the types spell them. */
const VOCABULARIES: Array<{
  name: string;
  values: readonly (string | number)[];
  labels: Readonly<Record<string | number, string>>;
  options: readonly LabelOption<string | number>[];
}> = [
  {
    name: 'pay frequency',
    values: PAY_FREQUENCIES,
    labels: Object.fromEntries(Object.entries(PAY_FREQUENCY_META).map(([k, m]) => [k, m.label])),
    options: PAY_FREQUENCY_OPTIONS,
  },
  {
    name: 'filing status',
    values: ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold'],
    labels: Object.fromEntries(Object.entries(FILING_STATUS_META).map(([k, m]) => [k, m.label])),
    options: FILING_STATUS_OPTIONS,
  },
  { name: 'bonus frequency', values: ['quarterly', 'annual', 'irregular'], labels: BONUS_FREQUENCY_LABELS, options: BONUS_FREQUENCY_OPTIONS },
  { name: 'account type', values: ['taxable', 'tax-deferred', 'tax-free'], labels: ACCOUNT_TYPE_LABELS, options: ACCOUNT_TYPE_OPTIONS },
  { name: 'target mix', values: [...new Set([...TARGET_MIX_PRESETS, 'custom'])], labels: TARGET_MIX_LABELS, options: TARGET_MIX_OPTIONS },
  { name: 'risk tolerance', values: ['conservative', 'moderate', 'optimizer'], labels: RISK_TOLERANCE_LABELS, options: RISK_TOLERANCE_OPTIONS },
  {
    name: 'optimization goal',
    values: ['tax_minimization', 'wealth_maximization', 'balanced'],
    labels: OPTIMIZATION_GOAL_LABELS,
    options: OPTIMIZATION_GOAL_OPTIONS,
  },
  { name: 'HSA coverage', values: ['individual', 'family'], labels: HSA_COVERAGE_LABELS, options: HSA_COVERAGE_OPTIONS },
  { name: 'contribution type', values: ['traditional', 'roth', 'split'], labels: CONTRIBUTION_TYPE_LABELS, options: CONTRIBUTION_TYPE_OPTIONS },
  { name: 'leverage ratio', values: LEVERAGE_RATIO_OPTIONS, labels: LEVERAGE_RATIO_LABELS, options: leverageRatioOptions() },
];

describe.each(VOCABULARIES)('$name vocabulary', ({ values, labels, options }) => {
  it('labels every value and nothing else', () => {
    expect(Object.keys(labels).sort()).toEqual(values.map(String).sort());
    for (const value of values) {
      expect(labels[value]?.trim()).toBeTruthy();
    }
  });

  it('offers every value exactly once, each with a label', () => {
    const offered = options.map((o) => o.value);
    expect(new Set(offered).size).toBe(offered.length);
    expect([...offered].map(String).sort()).toEqual(values.map(String).sort());
    for (const option of options) {
      expect(option.label.trim()).toBeTruthy();
    }
  });

  it('gives every option a distinct label', () => {
    const optionLabels = options.map((o) => o.label);
    expect(new Set(optionLabels).size).toBe(optionLabels.length);
  });
});

describe('pay frequency', () => {
  it('keeps FREQUENCY_MULTIPLIERS as exported today', () => {
    expect(FREQUENCY_MULTIPLIERS).toEqual({
      weekly: 52 / 12,
      'bi-weekly': 26 / 12,
      'semi-monthly': 2,
      monthly: 1,
    });
  });

  it.each([
    ['weekly', 52],
    ['bi-weekly', 26],
    ['semi-monthly', 24],
    ['monthly', 12],
  ] as const)('%s: perMonth matches FREQUENCY_MULTIPLIERS and perYear is %i', (frequency, perYear) => {
    const meta = PAY_FREQUENCY_META[frequency as PayFrequency];
    expect(meta.perMonth).toBe(FREQUENCY_MULTIPLIERS[frequency]);
    expect(meta.perYear).toBe(perYear);
    expect(meta.perMonth * 12).toBeCloseTo(perYear, 10);
  });

  it('uses the paycheck allocator wording', () => {
    expect(PAY_FREQUENCY_META['bi-weekly']).toMatchObject({ label: 'Bi-Weekly', option: 'Bi-Weekly', phrase: 'bi-weekly' });
    expect(PAY_FREQUENCY_META['semi-monthly']).toMatchObject({
      label: 'Semi-Monthly',
      option: 'Semi-Monthly (2x/month)',
      phrase: 'semi-monthly',
    });
    expect(PAY_FREQUENCY_OPTIONS.map((o) => o.label)).toEqual(['Weekly', 'Bi-Weekly', 'Semi-Monthly (2x/month)', 'Monthly']);
  });
});

describe('label wording', () => {
  it('spells filing statuses as the paycheck tax card does, with lower-case phrases', () => {
    expect(FILING_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'Single',
      'Married Filing Jointly',
      'Married Filing Separately',
      'Head of Household',
    ]);
    expect(FILING_STATUS_META.marriedJoint.phrase).toBe('married filing jointly');
    expect(FILING_STATUS_META.headOfHousehold.phrase).toBe('head of household');
  });

  it('names the HSA coverage tiers without the limit (the contribution help states it)', () => {
    expect(HSA_COVERAGE_OPTIONS.map((o) => o.label)).toEqual(['Individual', 'Family']);
  });

  it('adds the ordering to the risk tolerance options', () => {
    expect(RISK_TOLERANCE_OPTIONS.map((o) => o.label)).toEqual([
      'Conservative (traditional ordering)',
      'Moderate (balanced ordering)',
      'Optimizer (highest after-tax return first)',
    ]);
  });
});

describe('leverage ratio labels', () => {
  it('labels the offered ratios and falls back for any other ratio', () => {
    expect(leverageRatioLabel(2)).toBe('2x (SSO-like daily-reset fund)');
    expect(leverageRatioLabel(2.5)).toBe('2.5x daily-reset fund');
    expect(leverageRatioLabel(1.25)).toBe('1.25x daily-reset fund');
  });

  it('adds a non-preset current ratio in sorted position', () => {
    expect(leverageRatioOptions(2.5).map((o) => o.value)).toEqual([1, 2, 2.5, 3]);
    expect(leverageRatioOptions(2).map((o) => o.value)).toEqual([1, 2, 3]);
  });
});

describe('composeDisclaimer', () => {
  it.each([
    [
      'retirement calculator',
      composeDisclaimer(DISCLAIMER.base, DISCLAIMER.simulated, DISCLAIMER.advice),
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Not tax or investment advice.',
    ],
    [
      'paycheck allocator',
      composeDisclaimer(DISCLAIMER.base, DISCLAIMER.taxEstimates, DISCLAIMER.advice),
      'Educational tool only. Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter. Not tax or investment advice.',
    ],
    [
      'portfolio rebalancer',
      composeDisclaimer(DISCLAIMER.base, DISCLAIMER.prices, DISCLAIMER.advice),
      'Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice.',
    ],
    [
      'leverage comparison',
      composeDisclaimer(DISCLAIMER.base, DISCLAIMER.simulated, DISCLAIMER.leveragedEtfs, DISCLAIMER.advice),
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Leveraged ETFs can lose most of their value in a severe decline. Not tax or investment advice.',
    ],
    [
      'overview dashboard',
      composeDisclaimer(DISCLAIMER.overview, DISCLAIMER.overviewModel, DISCLAIMER.consultAdvisor),
      'This overview provides educational information only and should not be considered personalized financial advice. Every figure is a model output from the inputs and assumptions shown; the profile is stored only in this browser. Consider consulting with a qualified financial advisor before making significant financial decisions.',
    ],
    [
      'home page',
      composeDisclaimer(DISCLAIMER.siteBase, DISCLAIMER.siteAssumptions, DISCLAIMER.advice),
      'Educational tools only. Results depend on the assumptions you enter and are not predictions. Not tax or investment advice.',
    ],
  ])('reproduces the %s disclaimer shown today', (_page, composed, expected) => {
    expect(composed).toBe(expected);
  });
});
