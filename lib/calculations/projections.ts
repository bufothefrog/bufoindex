import {
  PaycheckProfile,
  AllocationItem,
  ProjectionData
} from '../types';
import { calculateCompoundGrowth, paycheckToMonthly } from './core';
import {
  FilingStatusInput,
  getBracketsForStatus,
  getStandardDeductionForStatus,
} from '../constants/irs-2026';
import { monthlyRateOf, scheduleFutureValue } from './contributionSchedule';

/**
 * Progressive federal income tax on annual gross income:
 * taxable income = gross - standard deduction, then walk the bracket table.
 * (State tax and FICA are out of scope here, matching the previous model.)
 */
export function calculateAnnualFederalTax(
  annualGrossIncome: number,
  filingStatus: FilingStatusInput
): number {
  const taxableIncome = Math.max(
    0,
    annualGrossIncome - getStandardDeductionForStatus(filingStatus)
  );
  let tax = 0;
  for (const bracket of getBracketsForStatus(filingStatus)) {
    if (taxableIncome <= bracket.min) break;
    tax += (Math.min(taxableIncome, bracket.max) - bracket.min) * bracket.rate;
  }
  return tax;
}

/**
 * Ten-year value of a stream of `annualContribution` dollars a year paid as 12
 * equal end-of-month deposits at the effective monthly rate monthlyRateOf(rate)
 * (the one monthly-rate convention). A non-positive or non-finite stream is 0.
 */
function annualStreamFutureValue(annualContribution: number, rate: number): number {
  if (!Number.isFinite(annualContribution) || annualContribution <= 0) return 0;
  return scheduleFutureValue(
    { monthly: annualContribution / 12, yearStart: 0 },
    rate,
    PROJECTION_YEARS * 12
  );
}

/** Number of paychecks per year for a pay frequency (26 for bi-weekly, etc.) */
function paychecksPerYear(frequency: PaycheckProfile['income']['frequency']): number {
  return paycheckToMonthly(1, frequency) * 12;
}

/** Long-run return assumed for invested dollars (equities/index funds). */
const MARKET_RETURN = 0.07;
/** Cash yield used when the profile carries no emergency-fund APY. */
const DEFAULT_CASH_APY = 0.04;
/** Horizon of the "Long-Term Impact" comparison, in years. */
export const PROJECTION_YEARS = 10;
/** Share of leftover take-home assumed to be saved without a plan. */
const BASELINE_DISCRETIONARY_SAVING_RATE = 0.1;

/**
 * Annual dollars flowing to net worth, split by where they land. Both paths are
 * built from this same shape so the two projections cover the same universe of
 * dollars — the only thing that differs is how each paycheck is directed.
 */
interface SavingsStreams {
  /** Invested at MARKET_RETURN: retirement accounts, brokerage, employer match. */
  market: number;
  /** Held as cash at the emergency-fund APY. */
  cash: number;
  /** Extra debt principal, which earns a certain return at the debt's own rate. */
  debt: number;
}

const emptyStreams = (): SavingsStreams => ({ market: 0, cash: 0, debt: 0 });

/** Total annual dollars directed to net worth across every bucket. */
function totalAnnualSavings(streams: SavingsStreams): number {
  return streams.market + streams.cash + streams.debt;
}

const finite = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/** Yield on cash savings; falls back to a typical HYSA rate. */
function cashReturn(profile: PaycheckProfile): number {
  const apy = finite(profile.preferences.emergencyFundAPY);
  return apy > 0 ? apy : DEFAULT_CASH_APY;
}

/**
 * Rate earned by extra debt principal. `calculateHighInterestDebt` always
 * targets the highest-rate debt, so that is the rate avoided interest accrues
 * at. With no debts on file the bucket is empty and the rate is unused.
 */
function debtReturn(profile: PaycheckProfile): number {
  const highest = profile.debts.reduce((max, debt) => Math.max(max, finite(debt.interestRate)), 0);
  return highest > 0 ? highest : MARKET_RETURN;
}

/** Balance of the highest-rate debt, the one calculateHighInterestDebt pays down (0 with no debts). */
function highestRateDebtBalance(profile: PaycheckProfile): number {
  let best: { rate: number; balance: number } | null = null;
  for (const debt of profile.debts) {
    const rate = finite(debt.interestRate);
    if (best === null || rate > best.rate) best = { rate, balance: Math.max(0, finite(debt.balance)) };
  }
  return best ? best.balance : 0;
}

/**
 * Ten-year value of a stream of extra debt principal (`annualContribution` a
 * year, 12 end-of-month payments p). The payments earn the debt's rate only
 * until they have covered `balance`, which takes k = balance / p months. From
 * then on the debt is gone: the value reached at month k grows at
 * MARKET_RETURN, and the same payment p is invested at MARKET_RETURN for the
 * months left. A balance the stream does not clear within ten years keeps the
 * whole stream at the debt's rate. Exported for tests.
 */
export function debtStreamFutureValue(annualContribution: number, debtRate: number, balance: number): number {
  if (!Number.isFinite(annualContribution) || annualContribution <= 0) return 0;
  const payment = annualContribution / 12;
  const horizonMonths = PROJECTION_YEARS * 12;
  const payoffMonths = Math.max(0, finite(balance)) / payment;
  if (!(payoffMonths < horizonMonths)) return annualStreamFutureValue(annualContribution, debtRate);
  const monthsLeft = horizonMonths - payoffMonths;
  const atPayoff = scheduleFutureValue({ monthly: payment, yearStart: 0 }, debtRate, payoffMonths);
  return (
    atPayoff * Math.pow(1 + MARKET_RETURN, monthsLeft / 12) +
    scheduleFutureValue({ monthly: payment, yearStart: 0 }, MARKET_RETURN, monthsLeft)
  );
}

/**
 * Grow a set of streams for ten years on top of today's net worth. Existing net
 * worth is identical on both paths, so it cancels out of the improvement and is
 * present only to keep each headline number a full balance rather than a delta.
 */
function projectTenYearNetWorth(
  currentNetWorth: number,
  streams: SavingsStreams,
  profile: PaycheckProfile
): number {
  return (
    calculateCompoundGrowth(currentNetWorth, MARKET_RETURN, PROJECTION_YEARS) +
    annualStreamFutureValue(streams.market, MARKET_RETURN) +
    annualStreamFutureValue(streams.cash, cashReturn(profile)) +
    debtStreamFutureValue(streams.debt, debtReturn(profile), highestRateDebtBalance(profile))
  );
}

/**
 * Payroll retirement contributions already in place. These are deducted before
 * take-home pay, so they are untouched by the reallocation and continue on both
 * paths — counting them on only one side is what made the "optimized" number
 * come out below the current path.
 */
function existingAnnualDeferral(profile: PaycheckProfile): number {
  const benefits = profile.benefits.employer401k;
  const annualSalary = finite(profile.income.gross) * 12;
  if (!benefits.available || annualSalary <= 0) return 0;
  return annualSalary * Math.max(0, finite(benefits.currentContribution));
}

/** Employer match earned on a given annual employee deferral, capped at the match limit. */
function employerMatchOn(profile: PaycheckProfile, annualDeferral: number): number {
  const benefits = profile.benefits.employer401k;
  const annualSalary = finite(profile.income.gross) * 12;
  if (!benefits.available || annualSalary <= 0) return 0;
  const matchPercent = Math.max(0, finite(benefits.matchPercent));
  const matchLimit = Math.max(0, finite(benefits.matchLimit));
  const matchedDeferral = Math.min(Math.max(0, annualDeferral), annualSalary * matchLimit);
  return matchedDeferral * matchPercent;
}

/**
 * Take-home pay left after necessary expenses and the fun-money floor — the
 * pool the allocator reallocates. Both paths draw their non-payroll saving from
 * this same pool.
 */
function annualDiscretionaryIncome(profile: PaycheckProfile): number {
  const monthlyNet = finite(profile.income.net);
  const necessaryExpenses = finite(profile.preferences.necessaryExpenses);
  const funMoneyMin = finite(profile.preferences.funMoney.min);
  return Math.max(0, monthlyNet - necessaryExpenses - funMoneyMin) * 12;
}

/**
 * Calculate future projections comparing the current path with the recommended
 * allocation of the same paycheck.
 *
 * Both paths start from the same net worth and the same payroll contributions,
 * then differ only in how discretionary take-home pay is directed. A negative
 * `improvement.tenYear` therefore means the recommended split genuinely routes
 * fewer dollars (or lower-yielding dollars) to net worth than the current
 * saving rate implies; it is reported as-is rather than clamped.
 */
export function calculateProjections(
  profile: PaycheckProfile,
  allocations: AllocationItem[]
): ProjectionData {
  const currentStrategy = calculateCurrentPathProjection(profile);
  const optimizedStrategy = calculateOptimizedPathProjection(profile, allocations);

  return {
    currentPath: currentStrategy,
    optimizedPath: optimizedStrategy,
    improvement: {
      tenYear: optimizedStrategy.tenYear - currentStrategy.tenYear,
      annualTaxSavings: currentStrategy.taxesOwed - optimizedStrategy.taxesOwed,
      fiYearsEarlier: Math.max(0, currentStrategy.fiAge - optimizedStrategy.fiAge),
    },
  };
}

/**
 * Current path: existing payroll contributions (plus the match they already
 * earn) continue, and a share of leftover take-home pay is assumed to be saved
 * without a plan.
 */
function calculateCurrentPathProjection(profile: PaycheckProfile) {
  const currentNetWorth = estimateCurrentNetWorth(profile);
  const grossIncome = finite(profile.income.gross);
  const netIncome = finite(profile.income.net);

  const deferral = existingAnnualDeferral(profile);
  // Saved out of take-home pay today. This is an estimate, not an input — it is
  // the same pool the optimized path reallocates, so the two stay comparable.
  const discretionarySaving =
    annualDiscretionaryIncome(profile) * BASELINE_DISCRETIONARY_SAVING_RATE;

  const streams = emptyStreams();
  streams.market = deferral + employerMatchOn(profile, deferral) + discretionarySaving;

  const tenYearNetWorth = projectTenYearNetWorth(currentNetWorth, streams, profile);

  // Current tax burden: progressive tax on taxable income, not marginal rate on every dollar
  const annualTaxes = calculateAnnualFederalTax(grossIncome * 12, profile.taxes.filingStatus);

  // Financial independence (4% rule). Only saving that comes out of take-home
  // pay reduces spending; the payroll deferral is already excluded from net pay.
  const currentAnnualExpenses = Math.max(1, netIncome * 12 - discretionarySaving);
  const fiTarget = currentAnnualExpenses / 0.04;
  const fiAge = calculateFIAge(
    totalAnnualSavings(streams),
    fiTarget,
    currentNetWorth,
    profileAge(profile)
  );

  return {
    tenYear: tenYearNetWorth,
    taxesOwed: annualTaxes,
    fiAge: fiAge,
  };
}

/**
 * Optimized path: the same existing payroll contributions, plus the recommended
 * split of the same take-home pool. Every allocation that builds net worth
 * counts — cash savings and debt principal included — each at the rate its
 * destination actually earns.
 */
function calculateOptimizedPathProjection(
  profile: PaycheckProfile,
  allocations: AllocationItem[]
) {
  // Allocation amounts are per-paycheck; annualize with the pay frequency (26 for bi-weekly)
  const payPeriods = paychecksPerYear(profile.income.frequency);
  const annualize = (perPaycheck: number) => Math.max(0, finite(perPaycheck)) * payPeriods;

  const currentNetWorth = estimateCurrentNetWorth(profile);
  const deferral = existingAnnualDeferral(profile);

  // The employer-match line is the top-up needed to reach the match limit, so
  // it raises the deferral the employer matches against.
  const extraDeferral = allocations.reduce(
    (sum, allocation) =>
      allocation.category === 'employer_match' ? sum + annualize(allocation.amount) : sum,
    0
  );

  // Tax savings are cash freed up each pay period — model them as additional
  // invested principal, not as a boost to the market return. Only a negative
  // taxImpact is a saving; a positive one is a cost and must not be counted.
  const annualTaxSavings = allocations.reduce(
    (sum, allocation) => sum + annualize(Math.max(0, -finite(allocation.taxImpact))),
    0
  );

  const streams = emptyStreams();
  streams.market =
    deferral + employerMatchOn(profile, deferral + extraDeferral) + annualTaxSavings;

  for (const allocation of allocations) {
    const annualAmount = annualize(allocation.amount);
    switch (allocation.category) {
      case 'emergency_fund':
        streams.cash += annualAmount;
        break;
      case 'debt_payoff':
        streams.debt += annualAmount;
        break;
      // employer_match, tax_advantaged, tax_optimization, investment, high_interest_debt
      default:
        streams.market += annualAmount;
        break;
    }
  }

  const tenYearNetWorth = projectTenYearNetWorth(currentNetWorth, streams, profile);

  // Optimized tax burden: progressive tax on taxable income, less the tax
  // savings generated by the recommended pre-tax contributions
  const optimizedAnnualTaxes =
    calculateAnnualFederalTax(finite(profile.income.gross) * 12, profile.taxes.filingStatus) -
    annualTaxSavings;

  // Every allocation is carved out of take-home pay, so the whole recommended
  // total reduces spending — mirroring the current path's treatment.
  const allocatedFromTakeHome = allocations.reduce(
    (sum, allocation) => sum + annualize(allocation.amount),
    0
  );
  const optimizedAnnualExpenses = Math.max(
    1,
    finite(profile.income.net) * 12 - allocatedFromTakeHome
  );
  const fiTarget = optimizedAnnualExpenses / 0.04;
  const fiAge = calculateFIAge(
    totalAnnualSavings(streams),
    fiTarget,
    currentNetWorth,
    profileAge(profile)
  );

  return {
    tenYear: tenYearNetWorth,
    taxesOwed: Math.max(0, optimizedAnnualTaxes),
    fiAge: fiAge,
  };
}

/**
 * Starting net worth, built only from balances the profile actually collects:
 * the emergency fund plus the invested total of the account list
 * (preferences.investedBalance, emergency-fund accounts excluded; it already
 * holds the IRAs, so nothing counts twice), less debt balances. Without an
 * investedBalance the IRA balances stand in for it (the earlier model).
 * Exported for tests.
 *
 * Only reported balances count: an earlier model added `gross * 12 * 0.5` as
 * "estimated existing retirement savings", six months of gross pay that no
 * input supported. The term is identical on both paths, so `improvement` does
 * not depend on it.
 */
export function estimateCurrentNetWorth(profile: PaycheckProfile): number {
  const emergencyFund = Math.max(0, finite(profile.preferences.currentEmergencyFund));

  const invested = profile.preferences.investedBalance;
  const balances = profile.benefits.ira?.currentBalances;
  const investedTotal =
    typeof invested === 'number' && Number.isFinite(invested)
      ? invested
      : Math.max(0, finite(balances?.traditional)) + Math.max(0, finite(balances?.roth));

  const liabilities = profile.debts.reduce(
    (sum, debt) => sum + Math.max(0, finite(debt.balance)),
    0
  );

  return Math.max(0, emergencyFund + investedTotal - liabilities);
}

/** Age this profile is projected from; `preferences.age` is collected by the UI. */
function profileAge(profile: PaycheckProfile): number {
  return Math.min(99, Math.max(0, finite(profile.preferences.age)));
}

/**
 * Age at which invested savings reach the 4% target, anchored to the profile's
 * own age rather than a hardcoded 30 (which reported an FI date 25 years in the
 * past for a 55-year-old, and made `fiYearsEarlier` wrong for everyone who is
 * not exactly 30). 99 is the sentinel for "not reached in this model".
 *
 * The yearly saving is paid as 12 end-of-month deposits at the effective
 * monthly rate i = monthlyRateOf(r), so solving
 * W + (A / 12) ((1 + i)^(12n) - 1) / i = T for n gives
 * n = ln((T - W) * 12 * i / A + 1) / ln(1 + r). The growth of today's net worth
 * W is left out of the solve, as before. Exported for tests.
 */
export function calculateFIAge(
  annualInvestment: number,
  fiTarget: number,
  currentNetWorth: number,
  currentAge: number
): number {
  const age = Math.min(99, Math.max(0, finite(currentAge)));
  if (currentNetWorth >= fiTarget) return age; // Already at/past FI today
  if (annualInvestment <= 0) return 99; // Never reach FI

  const yearsToFI =
    Math.log(((fiTarget - currentNetWorth) * 12 * monthlyRateOf(MARKET_RETURN)) / annualInvestment + 1) /
    Math.log(1 + MARKET_RETURN);

  if (!Number.isFinite(yearsToFI)) return 99;

  return Math.min(99, age + Math.max(0, yearsToFI));
}
