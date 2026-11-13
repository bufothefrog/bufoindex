/**
 * Pure, display-oriented derivations for the /overview dashboard.
 *
 * The cards run each calculator through its definition (engineInputsFor and
 * the calculator's headline function); what is here is only what the
 * dashboard shows and no calculator page does: the cash buffer against the
 * emergency fund target, the account list, the automation checklist and the
 * retirement "save more" lever. Nothing here feeds back into a calculation or a store.
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
import { allocationDisplayText } from '@/lib/constants/financialSteps';
import { RetirementConstants } from '@/lib/constants/retirement';
import { makeGet } from '@/lib/fields/paths';
import { formatPercent } from '@/lib/format';
import {
  accountLabel,
  accountLines,
  emergencyFundAccounts,
  emergencyFundBalance,
  investedBalance,
} from '@/lib/profile/accounts';
import { withDerivedValues } from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import type { AllocationItem } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Cash buffer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Expected long-run portfolio return used to price cash held above the
 * target (O16: the paycheck allocator's 7%). An assumption for illustration,
 * shown next to the figure it drives.
 */
export const ASSUMED_PORTFOLIO_RETURN = 0.07;

export interface CashBufferSummary {
  balance: number;
  /** Display names of the accounts that hold the emergency fund; [] when the typed balance is used. */
  heldIn: string[];
  necessaryMonthly: number;
  /** null when necessary expenses are not set (months on hand is undefined). */
  monthsOnHand: number | null;
  /** The months target the excess is measured against (profile.cash.targetMonths, floored at 0). */
  targetMonths: number;
  /** targetMonths times the necessary monthly expenses. */
  target: number;
  excess: number;
  shortfall: number;
  /** Assumed return minus the cash APY, floored at 0. */
  costSpread: number;
  annualCostOfExcess: number;
}

/**
 * The cash buffer of `profile`. While accounts hold the emergency fund (a
 * cash account, or a brokerage with the tick), the balance is their value;
 * otherwise it is the typed emergency fund, whose unanswered value is its
 * derived typical value, three months of must-pay costs (withDerivedValues;
 * a no-op when the caller already applied it).
 */
export function summarizeCashBuffer(stored: FinancialProfile): CashBufferSummary {
  const profile = withDerivedValues(stored);
  const get = makeGet(profile);
  const necessaryMonthly = Math.max(0, profile.spending.necessaryMonthly);
  const balance = Math.max(0, emergencyFundBalance(get));
  const heldIn = emergencyFundAccounts(get).map((a) => accountLabel(get, a));
  const targetMonths = Math.max(0, profile.cash.targetMonths);
  const target = targetMonths * necessaryMonthly;
  const excess = Math.max(0, balance - target);
  const shortfall = Math.max(0, target - balance);
  const costSpread = Math.max(0, ASSUMED_PORTFOLIO_RETURN - profile.cash.emergencyFundApy);

  return {
    balance,
    heldIn,
    necessaryMonthly,
    monthsOnHand: necessaryMonthly > 0 ? balance / necessaryMonthly : null,
    targetMonths,
    target,
    excess,
    shortfall,
    costSpread,
    annualCostOfExcess: excess * costSpread,
  };
}

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

export interface AccountsSummary {
  /** One line per account in effect, then one per suggested account (accountLines). */
  lines: string[];
  /** The invested total: every account but those holding the emergency fund. */
  invested: number;
  emergencyFund: {
    /** The emergency fund balance (the accounts that hold it, or the typed balance). */
    balance: number;
    /** Display names of the accounts that hold it; [] when the typed balance is used. */
    heldIn: string[];
  };
}

/** The account list of `stored` for the overview, read with its derived leaves filled (withDerivedValues). */
export function summarizeAccounts(stored: FinancialProfile): AccountsSummary {
  const get = makeGet(withDerivedValues(stored));
  return {
    lines: accountLines(get),
    invested: investedBalance(get),
    emergencyFund: {
      balance: emergencyFundBalance(get),
      heldIn: emergencyFundAccounts(get).map((a) => accountLabel(get, a)),
    },
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
    const text = allocationDisplayText(allocation);
    rows.push({
      id: allocation.id,
      account: text.account,
      perPaycheck: allocation.amount,
      percentOfGross:
        is401kAccount(allocation.account) && gross > 0 ? allocation.amount / gross : undefined,
      percentIsIncrease: is401kAccount(allocation.account),
      implementation: text.implementation,
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
