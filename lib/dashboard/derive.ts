/**
 * Pure, display-oriented derivations for the /overview dashboard.
 *
 * The cards run each calculator through its definition (engineInputsFor and
 * the calculator's headline function); what is here is only what the
 * dashboard shows and no calculator page does: the strategy summary, the cash
 * buffer under both presets, the automation checklist and the retirement
 * "save more" lever. Nothing here feeds back into a calculation or a store.
 * No React or DOM imports.
 */

import {
  calculateProjectedBalance,
  RetirementInputValidationError,
  runMonteCarloSimulation,
  type RetirementInputs,
  type RetirementResults,
} from '@/lib/calculations/retirement';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RetirementConstants } from '@/lib/constants/retirement';
import { formatMultiple, formatPercent } from '@/lib/format';
import { PRESET_EMERGENCY_MONTHS, STRATEGY_PRESETS } from '@/lib/profile/defaults';
import type { FinancialProfile, StrategyPreset } from '@/lib/profile/types';
import type { AllocationItem } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Strategy                                                           */
/* ------------------------------------------------------------------ */

export function strategyDescription(preset: StrategyPreset, leverageRatio: number): string {
  if (preset === 'standard') {
    return `${PRESET_EMERGENCY_MONTHS.standard} months of necessary expenses in cash and unleveraged index funds for every contribution.`;
  }
  return `${PRESET_EMERGENCY_MONTHS['cashflow-investor']} month of necessary expenses in cash, with steady income as the backstop, and a ${formatMultiple(leverageRatio)} daily-reset fund compared for taxable contributions.`;
}

/* ------------------------------------------------------------------ */
/* Cash buffer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Expected long-run portfolio return used to price cash held above the
 * target (O16: the paycheck allocator's 7%). An assumption for illustration,
 * shown next to the figure it drives.
 */
export const ASSUMED_PORTFOLIO_RETURN = 0.07;

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
   * follows the preset (see intakeDerivedWrites and the strategy control).
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
    presets: STRATEGY_PRESETS.map((preset) => ({
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
/* Retirement                                                         */
/* ------------------------------------------------------------------ */

/** Extra monthly savings used for the one-line "biggest lever" hint. */
export const LEVER_EXTRA_MONTHLY = 500;

export interface RetirementLever {
  extraMonthly: number;
  successProbability: number;
  /**
   * Projected balance at retirement with the extra savings, in nominal
   * dollars of the retirement year. The card converts it for display with
   * the shared dollar mode over `yearsToRetirement`.
   */
  projectedBalance: number;
  /** Years from now to retirement (never negative). */
  yearsToRetirement: number;
}

export type RetirementOutcome =
  | {
      status: 'ok';
      /** The calculator's own analysis; retirementHeadline reads the plan figures from it. */
      results: RetirementResults;
      lever: RetirementLever;
    }
  | { status: 'invalid'; messages: string[] };

/**
 * Runs the retirement calculator's analysis (several 1,000-path Monte Carlo
 * runs) plus one extra seeded run with LEVER_EXTRA_MONTHLY more savings. The
 * extra run uses the same seed and path count, so the two success rates are
 * compared on the same simulated markets.
 */
export function summarizeRetirement(inputs: RetirementInputs): RetirementOutcome {
  let results: RetirementResults;
  try {
    results = RETIREMENT_CALCULATOR.calculate(inputs);
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
  const runs = RetirementConstants.DEFAULT_MONTE_CARLO_RUNS;
  const leverInputs: RetirementInputs = {
    ...inputs,
    monthlySavings: inputs.monthlySavings + LEVER_EXTRA_MONTHLY,
  };

  return {
    status: 'ok',
    results,
    lever: {
      extraMonthly: LEVER_EXTRA_MONTHLY,
      successProbability: runMonteCarloSimulation(leverInputs, runs),
      projectedBalance: calculateProjectedBalance(leverInputs),
      yearsToRetirement: years,
    },
  };
}
