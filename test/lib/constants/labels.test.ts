import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_META,
  ACCOUNT_TYPE_OPTIONS,
  BONUS_FREQUENCIES,
  BONUS_FREQUENCY_META,
  BONUS_FREQUENCY_OPTIONS,
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_META,
  CONTRIBUTION_TYPE_OPTIONS,
  FILING_STATUSES,
  FILING_STATUS_META,
  FILING_STATUS_OPTIONS,
  HSA_COVERAGES,
  HSA_COVERAGE_META,
  HSA_COVERAGE_OPTIONS,
  LEVERAGE_RATIO_CHOICES,
  OPTIMIZATION_GOALS,
  OPTIMIZATION_GOAL_META,
  OPTIMIZATION_GOAL_OPTIONS,
  RISK_TOLERANCES,
  RISK_TOLERANCE_META,
  RISK_TOLERANCE_OPTIONS,
  STRATEGY_PRESETS,
  STRATEGY_PRESET_META,
  STRATEGY_PRESET_OPTIONS,
  TARGET_MIXES,
  TARGET_MIX_META,
  TARGET_MIX_OPTIONS,
  leverageRatioLabel,
  type AccountTypeValue,
  type BonusFrequency,
  type ContributionType,
  type FilingStatus,
  type HsaCoverage,
  type OptimizationGoal,
  type RiskTolerance,
  type StrategyPresetValue,
  type TargetMix,
} from '@/lib/constants/labels';
import {
  FREQUENCY_MULTIPLIERS,
  PAY_FREQUENCIES,
  PAY_FREQUENCY_META,
  PAY_FREQUENCY_OPTIONS,
  type PayFrequency,
} from '@/lib/constants/frequency';
import { DISCLAIMER, DISCLAIMERS, composeDisclaimer } from '@/lib/constants/disclaimers';
import { CONTRIBUTION_LIMITS_2026 } from '@/lib/constants/irs-2026';
import { LEVERAGE_RATIO_OPTIONS } from '@/lib/constants/leverage';
import type { AccountType } from '@/lib/calculations/portfolioRebalancing';
import type { BenefitsData, IncomeData, TaxData, UserPreferences } from '@/lib/types';
import type { StrategyPreset, TargetMixPreset } from '@/lib/profile/types';

// Compile-time: each label vocabulary covers exactly the engine / profile union.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const typeChecks: [
  Same<FilingStatus, TaxData['filingStatus']>,
  Same<BonusFrequency, IncomeData['bonusFrequency']>,
  Same<AccountTypeValue, AccountType>,
  Same<StrategyPresetValue, StrategyPreset>,
  // The profile adds 'custom' (portfolio.classTargets) to the three presets.
  Same<TargetMix, Exclude<TargetMixPreset, 'custom'>>,
  Same<RiskTolerance, UserPreferences['riskTolerance']>,
  Same<OptimizationGoal, UserPreferences['optimizationGoal']>,
  Same<HsaCoverage, BenefitsData['hsa']['coverageType']>,
  Same<ContributionType, BenefitsData['employer401k']['contributionType']>,
  Same<PayFrequency, IncomeData['frequency']>,
] = [true, true, true, true, true, true, true, true, true, true];

interface Vocabulary {
  values: readonly (string | number)[];
  meta: Record<string, { label: string; description?: string }>;
  options: ReadonlyArray<{ value: string | number; label: string; description?: string }>;
}

const VOCABULARIES: Record<string, Vocabulary> = {
  filingStatus: { values: FILING_STATUSES, meta: FILING_STATUS_META, options: FILING_STATUS_OPTIONS },
  bonusFrequency: { values: BONUS_FREQUENCIES, meta: BONUS_FREQUENCY_META, options: BONUS_FREQUENCY_OPTIONS },
  accountType: { values: ACCOUNT_TYPES, meta: ACCOUNT_TYPE_META, options: ACCOUNT_TYPE_OPTIONS },
  strategyPreset: { values: STRATEGY_PRESETS, meta: STRATEGY_PRESET_META, options: STRATEGY_PRESET_OPTIONS },
  targetMix: { values: TARGET_MIXES, meta: TARGET_MIX_META, options: TARGET_MIX_OPTIONS },
  riskTolerance: { values: RISK_TOLERANCES, meta: RISK_TOLERANCE_META, options: RISK_TOLERANCE_OPTIONS },
  optimizationGoal: { values: OPTIMIZATION_GOALS, meta: OPTIMIZATION_GOAL_META, options: OPTIMIZATION_GOAL_OPTIONS },
  hsaCoverage: { values: HSA_COVERAGES, meta: HSA_COVERAGE_META, options: HSA_COVERAGE_OPTIONS },
  contributionType: { values: CONTRIBUTION_TYPES, meta: CONTRIBUTION_TYPE_META, options: CONTRIBUTION_TYPE_OPTIONS },
  payFrequency: {
    values: PAY_FREQUENCIES,
    meta: PAY_FREQUENCY_META,
    options: PAY_FREQUENCY_OPTIONS,
  },
};

describe('label tables', () => {
  it('type-checks every vocabulary against its engine union', () => {
    expect(typeChecks.every(Boolean)).toBe(true);
  });

  it.each(Object.entries(VOCABULARIES))('%s: every value has a non-empty label and one option, in order', (_, vocab) => {
    expect(Object.keys(vocab.meta).sort()).toEqual([...vocab.values].map(String).sort());
    for (const value of vocab.values) {
      expect(vocab.meta[String(value)].label.trim()).not.toBe('');
    }
    expect(vocab.options.map((option) => option.value)).toEqual([...vocab.values]);
    for (const option of vocab.options) {
      expect(option.label.trim()).not.toBe('');
    }
    expect(new Set(vocab.options.map((option) => option.label)).size).toBe(vocab.options.length);
  });

  it('copies descriptions into options only when present', () => {
    expect(OPTIMIZATION_GOAL_OPTIONS[0]).toEqual({ value: 'balanced', label: 'Balanced' });
    expect(TARGET_MIX_OPTIONS[0]).toEqual({
      value: '100-0',
      label: '100% stocks',
      description: 'The highest expected growth and the deepest drawdowns.',
    });
  });

  it('spells the cash-flow preset once, as "Cash-flow investor"', () => {
    expect(STRATEGY_PRESET_META['cashflow-investor'].label).toBe('Cash-flow investor');
  });

  it('has four filing statuses with lowercase phrases', () => {
    expect(FILING_STATUSES).toHaveLength(4);
    for (const status of FILING_STATUSES) {
      expect(FILING_STATUS_META[status].phrase).toBe(FILING_STATUS_META[status].label.toLowerCase());
    }
  });

  it('carries the 2026 HSA limits', () => {
    expect(HSA_COVERAGE_META.individual.limit).toBe(CONTRIBUTION_LIMITS_2026.hsa.individual);
    expect(HSA_COVERAGE_META.family.description).toBe('$8,750 annual limit.');
  });

  it('labels every leverage ratio option', () => {
    expect(LEVERAGE_RATIO_CHOICES.map((choice) => choice.value)).toEqual([...LEVERAGE_RATIO_OPTIONS]);
    expect(LEVERAGE_RATIO_CHOICES.map((choice) => choice.label)).toEqual(['1x', '2x', '3x']);
    for (const choice of LEVERAGE_RATIO_CHOICES) expect(choice.description).toBeTruthy();
    expect(leverageRatioLabel(1.5)).toBe('1.5x');
  });
});

describe('pay frequency meta', () => {
  it.each(PAY_FREQUENCIES)('%s: perMonth matches the multipliers and perYear is perMonth x 12', (frequency) => {
    const meta = PAY_FREQUENCY_META[frequency];
    expect(meta.perMonth).toBe(FREQUENCY_MULTIPLIERS[frequency]);
    expect(meta.perYear).toBe(Math.round(FREQUENCY_MULTIPLIERS[frequency] * 12));
    expect(meta.adjective).toBe(meta.label.toLowerCase());
  });

  it('keeps the intake option text and summary phrases', () => {
    expect(PAY_FREQUENCY_OPTIONS.map((option) => option.label)).toEqual([
      'Every week',
      'Every two weeks',
      'Twice a month',
      'Once a month',
    ]);
    expect(PAY_FREQUENCY_META['bi-weekly'].phrase).toBe('every 2 weeks');
  });
});

describe('disclaimers', () => {
  it('composes byte-identical page disclaimers', () => {
    expect(DISCLAIMERS.retirement).toBe(
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Not tax or investment advice.'
    );
    expect(DISCLAIMERS.leverage).toBe(
      'Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Leveraged ETFs can lose most of their value in a severe decline. Not tax or investment advice.'
    );
    expect(DISCLAIMERS.portfolio).toBe(
      'Educational tool only. Assumes stated prices are current and executable. Not tax or investment advice.'
    );
    expect(DISCLAIMERS.paycheck).toBe(
      'Educational tool only. Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter. Not tax or investment advice.'
    );
    expect(DISCLAIMERS.overview).toBe(
      'This overview provides educational information only and should not be considered personalized financial advice. Every figure is a model output from the inputs and assumptions shown; the profile is stored only in this browser. Consider consulting with a qualified financial advisor before making significant financial decisions.'
    );
  });

  it('accepts literal sentences and skips empty fragments', () => {
    expect(composeDisclaimer('educational', 'Custom sentence.', '', 'notAdvice')).toBe(
      `${DISCLAIMER.educational} Custom sentence. ${DISCLAIMER.notAdvice}`
    );
    expect(composeDisclaimer()).toBe('');
    expect(composeDisclaimer('toString')).toBe('toString');
  });
});
