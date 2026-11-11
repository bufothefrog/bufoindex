/**
 * Pure, display-oriented derivations for the /overview dashboard.
 *
 * Everything here is computed from the shared FinancialProfile through the
 * existing calculation modules; nothing here feeds back into a calculation
 * or a store. No React or DOM imports.
 */

import {
  calculateProjectedBalance,
  calculateRetirementAnalysis,
  RetirementInputValidationError,
  runMonteCarloSimulation,
  type RetirementInputs,
  type RetirementResults,
} from '@/lib/calculations/retirement';
import { formatPercent } from '@/lib/calculations/core';
import { RetirementConstants } from '@/lib/constants/retirement';
import { PRESET_EMERGENCY_MONTHS, STRATEGY_PRESETS } from '@/lib/profile/defaults';
import type { FinancialProfile, PayFrequency, StrategyPreset } from '@/lib/profile/types';
import type { AllocationItem } from '@/lib/types';
import { toTodaysDollars } from '@/lib/utils/displayDollars';

/* ------------------------------------------------------------------ */
/* Labels                                                             */
/* ------------------------------------------------------------------ */

export const STRATEGY_LABELS: Record<StrategyPreset, string> = {
  'cashflow-investor': 'Cashflow investor',
  standard: 'Standard',
};

/** Display order for the strategy control: the site's preset, then the alternative. */
export const STRATEGY_ORDER: readonly StrategyPreset[] = ['cashflow-investor', 'standard'];

export function strategyDescription(preset: StrategyPreset, leverageRatio: number): string {
  if (preset === 'standard') {
    return `${PRESET_EMERGENCY_MONTHS.standard} months of necessary expenses in cash and unleveraged index funds for every contribution.`;
  }
  return `${PRESET_EMERGENCY_MONTHS['cashflow-investor']} month of necessary expenses in cash, with steady income as the backstop, and a ${formatMultiple(leverageRatio)} daily-reset fund compared for taxable contributions.`;
}

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'weekly',
  'bi-weekly': 'bi-weekly',
  'semi-monthly': 'semi-monthly',
  monthly: 'monthly',
};

/** 2 -> "2x", 1.5 -> "1.5x" */
export function formatMultiple(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}x`;
}

/** 1 -> "1 month", 2.5 -> "2.5 months" */
export function formatMonths(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'month' : 'months'}`;
}

/* ------------------------------------------------------------------ */
/* Cash buffer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Expected long-run portfolio return used to price cash held above the
 * target. An assumption for illustration, shown next to the figure it drives.
 */
export const ASSUMED_PORTFOLIO_RETURN = 0.08;

export interface PresetTarget {
  preset: StrategyPreset;
  months: number;
  target: number;
}

export interface CashBufferSummary {
  balance: number;
  necessaryMonthly: number;
  /** null when necessary expenses are not set (months on hand is undefined). */
  monthsOnHand: number | null;
  presets: PresetTarget[];
  activePreset: StrategyPreset;
  /** The months target the excess is measured against (profile.cash.targetMonths). */
  activeMonths: number;
  activeTarget: number;
  /**
   * True only when the user entered cash.targetMonths themselves and it
   * differs from the active preset's months. A target the user never entered
   * follows the preset (see buildIntakeSubmission and the strategy toggle).
   */
  usesCustomTarget: boolean;
  excess: number;
  shortfall: number;
  /** Assumed return minus the cash APY, floored at 0. */
  costSpread: number;
  annualCostOfExcess: number;
}

export function summarizeCashBuffer(profile: FinancialProfile): CashBufferSummary {
  const necessaryMonthly = Math.max(0, profile.spending.necessaryMonthly);
  const balance = Math.max(0, profile.cash.emergencyFundBalance);
  const activePreset = profile.strategy.preset;
  const activeMonths = Math.max(0, profile.cash.targetMonths);
  const activeTarget = activeMonths * necessaryMonthly;
  const excess = Math.max(0, balance - activeTarget);
  const shortfall = Math.max(0, activeTarget - balance);
  const costSpread = Math.max(0, ASSUMED_PORTFOLIO_RETURN - profile.cash.emergencyFundApy);

  return {
    balance,
    necessaryMonthly,
    monthsOnHand: necessaryMonthly > 0 ? balance / necessaryMonthly : null,
    presets: STRATEGY_ORDER.filter((p) => STRATEGY_PRESETS.includes(p)).map((preset) => ({
      preset,
      months: PRESET_EMERGENCY_MONTHS[preset],
      target: PRESET_EMERGENCY_MONTHS[preset] * necessaryMonthly,
    })),
    activePreset,
    activeMonths,
    activeTarget,
    usesCustomTarget:
      profile.provided.includes('cash.targetMonths') && activeMonths !== PRESET_EMERGENCY_MONTHS[activePreset],
    excess,
    shortfall,
    costSpread,
    annualCostOfExcess: excess * costSpread,
  };
}

/* ------------------------------------------------------------------ */
/* Leverage comparison inputs                                         */
/* ------------------------------------------------------------------ */

/** Taxable monthly contribution, falling back to the total monthly contribution. */
export function leverageMonthlyContribution(profile: FinancialProfile): number {
  const taxable = Number.isFinite(profile.investing.taxableMonthlyContribution)
    ? profile.investing.taxableMonthlyContribution
    : 0;
  if (taxable > 0) return taxable;
  const total = profile.investing.monthlyContribution;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/** Years to retirement, rounded and clamped to 1..60 (same rule as leverageLink). */
export function leverageHorizonYears(profile: FinancialProfile): number {
  const raw = Math.round(profile.person.retirementAge - profile.person.age);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(60, Math.max(1, raw));
}

/* ------------------------------------------------------------------ */
/* Automation checklist                                               */
/* ------------------------------------------------------------------ */

export interface ChecklistRow {
  id: string;
  account: string;
  perPaycheck: number;
  /** Share of gross pay, shown for 401(k) rows. */
  percentOfGross?: number;
  /** True when percentOfGross is an increase on top of the current election. */
  percentIsIncrease?: boolean;
  implementation: string;
}

function is401kAccount(account: string): boolean {
  return account.toLowerCase().includes('401k') || account.toLowerCase().includes('401(k)');
}

/** Allocation rows in plan order (lowest priority number first). */
export function sortAllocations(allocations: AllocationItem[]): AllocationItem[] {
  return [...allocations].sort((a, b) => a.priority - b.priority);
}

/**
 * One row for the current 401(k) payroll election (when a plan is available),
 * then one row per allocation in plan order.
 */
export function buildChecklistRows(
  profile: FinancialProfile,
  allocations: AllocationItem[]
): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  const gross = Math.max(0, profile.income.grossPerPaycheck);
  const { workplace } = profile;

  if (workplace.has401k && workplace.contributionPercent > 0) {
    rows.push({
      id: 'current-401k-deferral',
      account: '401(k) payroll deferral',
      perPaycheck: gross * workplace.contributionPercent,
      percentOfGross: workplace.contributionPercent,
      implementation: `Payroll election at ${formatPercent(workplace.contributionPercent)} of gross pay, set once in the benefits portal; it comes out before take-home pay.`,
    });
  }

  for (const allocation of sortAllocations(allocations)) {
    rows.push({
      id: allocation.id,
      account: allocation.account,
      perPaycheck: allocation.amount,
      percentOfGross:
        is401kAccount(allocation.account) && gross > 0 ? allocation.amount / gross : undefined,
      percentIsIncrease: is401kAccount(allocation.account),
      implementation: allocation.implementation,
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/* Retirement summary                                                 */
/* ------------------------------------------------------------------ */

/** Extra monthly savings used for the one-line "biggest lever" hint. */
export const LEVER_EXTRA_MONTHLY = 500;

export interface RetirementSummary {
  successProbability: number;
  /** Projected balance at retirement, in today's dollars. */
  projectedBalanceToday: number;
  /** Balance the 4% guideline implies for the target income, in today's dollars. */
  requiredBalanceToday: number;
  yearsToRetirement: number;
  retirementAge: number;
  lifeExpectancy: number;
  runs: number;
  lever: {
    extraMonthly: number;
    successProbability: number;
    projectedBalanceToday: number;
  };
}

export type RetirementOutcome =
  | { status: 'ok'; summary: RetirementSummary }
  | { status: 'invalid'; messages: string[] };

/**
 * Runs the full retirement analysis (several 1,000-path Monte Carlo runs)
 * plus one extra seeded run with LEVER_EXTRA_MONTHLY more savings. The extra
 * run uses the same seed and path count, so the two success rates are
 * compared on the same simulated markets.
 */
export function summarizeRetirement(inputs: RetirementInputs): RetirementOutcome {
  let analysis: RetirementResults;
  try {
    analysis = calculateRetirementAnalysis(inputs);
  } catch (error) {
    if (error instanceof RetirementInputValidationError) {
      return { status: 'invalid', messages: Object.values(error.fieldErrors) };
    }
    return {
      status: 'invalid',
      messages: [error instanceof Error ? error.message : 'The retirement analysis could not run.'],
    };
  }

  const years = Math.max(0, inputs.retirementAge - inputs.startingAge);
  const base =
    analysis.scenarios.find((s) => s.name === 'Your Current Plan') ??
    analysis.scenarios.find((s) => s.id.startsWith('current-plan')) ??
    analysis.scenarios[0];

  const runs = RetirementConstants.DEFAULT_MONTE_CARLO_RUNS;
  const leverInputs: RetirementInputs = {
    ...inputs,
    monthlySavings: inputs.monthlySavings + LEVER_EXTRA_MONTHLY,
  };
  const leverSuccess = runMonteCarloSimulation(leverInputs, runs);
  const leverProjected = calculateProjectedBalance(leverInputs);

  const projected = base ? base.projectedBalance : calculateProjectedBalance(inputs);
  const required = base
    ? base.requiredBalance
    : (inputs.targetIncome * Math.pow(1 + inputs.inflationRate, years)) /
      RetirementConstants.WITHDRAWAL_RATE;
  const success = base ? base.successProbability : runMonteCarloSimulation(inputs, runs);

  return {
    status: 'ok',
    summary: {
      successProbability: success,
      projectedBalanceToday: toTodaysDollars(projected, inputs.inflationRate, years),
      requiredBalanceToday: toTodaysDollars(required, inputs.inflationRate, years),
      yearsToRetirement: years,
      retirementAge: inputs.retirementAge,
      lifeExpectancy: inputs.lifeExpectancy,
      runs,
      lever: {
        extraMonthly: LEVER_EXTRA_MONTHLY,
        successProbability: leverSuccess,
        projectedBalanceToday: toTodaysDollars(leverProjected, inputs.inflationRate, years),
      },
    },
  };
}
