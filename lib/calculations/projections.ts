import {
  PaycheckProfile,
  AllocationItem,
  SkippedItem,
  ProjectionData,
  OptimizationScore
} from '../types';
import { calculateCompoundGrowth, paycheckToMonthly } from './core';
import {
  FilingStatusInput,
  getBracketsForStatus,
  getStandardDeductionForStatus,
} from '../constants/irs-2026';

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
 * Future value of a level annual contribution stream (ordinary annuity):
 * FV = payment * ((1 + r)^n - 1) / r
 */
export function calculateAnnuityFutureValue(
  annualContribution: number,
  rate: number,
  years: number
): number {
  if (!Number.isFinite(annualContribution) || annualContribution <= 0) return 0;
  const validYears = Number.isFinite(years) ? Math.max(0, years) : 0;
  if (rate === 0) return annualContribution * validYears;
  return annualContribution * ((Math.pow(1 + rate, validYears) - 1) / rate);
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
    calculateAnnuityFutureValue(streams.market, MARKET_RETURN, PROJECTION_YEARS) +
    calculateAnnuityFutureValue(streams.cash, cashReturn(profile), PROJECTION_YEARS) +
    calculateAnnuityFutureValue(streams.debt, debtReturn(profile), PROJECTION_YEARS)
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
 * Score the recommended plan, and the profile's current behaviour, on one
 * rubric.
 *
 * The recommendation is an *increment*: existing payroll deferrals, HSA/IRA
 * contributions and extra debt payments all continue underneath it (the same
 * assumption the two projection paths are built on). So the recommended
 * strategy is the union of what the profile already does and what the plan
 * adds, while the status quo is that existing behaviour on its own — and both
 * go through the same five components with the same weights.
 *
 * `comparison` previously came from a separate formula that graded the
 * *profile* (already contributing, emergency target in range) on a 40-point
 * base capped at 75, while `overall` graded only the *allocations*. A user
 * already deferring 6%+ could therefore see the tool's own recommendation score
 * 61 against a 75 "typical advice" baseline while doing strictly more.
 */
export function calculateOptimizationScore(
  profile: PaycheckProfile,
  allocations: AllocationItem[],
  skippedItems: SkippedItem[]
): OptimizationScore {
  const currentAllocations = describeCurrentBehavior(profile);

  const breakdown = scoreBreakdown(profile, [...currentAllocations, ...allocations], skippedItems);
  const currentBreakdown = scoreBreakdown(profile, currentAllocations, skippedItems);

  return {
    overall: weightedScore(breakdown),
    breakdown,
    comparison: weightedScore(currentBreakdown),
  };
}

/** The five weighted components, graded for one set of allocations. */
function scoreBreakdown(
  profile: PaycheckProfile,
  allocations: AllocationItem[],
  skippedItems: SkippedItem[]
): OptimizationScore['breakdown'] {
  return {
    taxEfficiency: calculateTaxEfficiencyScore(profile, allocations),
    employerBenefits: calculateEmployerBenefitsScore(profile, allocations),
    // Debt handling and emergency coverage are read off the profile's skipped
    // items, so they are properties of the situation rather than of either
    // allocation list: identical on both sides, and they cancel out of the gap.
    debtStrategy: calculateDebtStrategyScore(profile, skippedItems),
    emergencyFundSize: calculateEmergencyFundScore(profile, skippedItems),
    accountPrioritization: calculateAccountPrioritizationScore(allocations),
  };
}

function weightedScore(breakdown: OptimizationScore['breakdown']): number {
  return Math.round(
    (breakdown.taxEfficiency * 0.25) +
    (breakdown.employerBenefits * 0.25) +
    (breakdown.debtStrategy * 0.20) +
    (breakdown.emergencyFundSize * 0.15) +
    (breakdown.accountPrioritization * 0.15)
  );
}

/**
 * Priorities for existing contributions, mirroring the Financial Order of
 * Operations the recommendation is built in (core.ts), so both lists sort on
 * one scale.
 */
const EXISTING_PRIORITY = {
  employerMatch: 2,
  highInterestDebt: 3,
  hsa: 5,
  ira: 6,
  retirement: 7,
  otherDebt: 10,
} as const;

/**
 * What the profile already does, expressed as per-paycheck allocations so the
 * status quo can be graded by the same rubric as the recommendation. Only
 * inputs the UI collects are read; nothing is inferred from the bonus fields or
 * the `hasTaxableAccount` flag.
 */
function describeCurrentBehavior(profile: PaycheckProfile): AllocationItem[] {
  const payPeriods = paychecksPerYear(profile.income.frequency);
  const netPaycheck = finite(profile.income.netPaycheck);
  const bracket = Math.max(0, finite(profile.taxes.federalBracket));

  const perPaycheckFromAnnual = (annual: number) => (payPeriods > 0 ? annual / payPeriods : 0);
  const perPaycheckFromMonthly = (monthly: number) => perPaycheckFromAnnual(monthly * 12);

  const items: AllocationItem[] = [];
  const add = (
    id: string,
    account: string,
    amount: number,
    preTaxAmount: number,
    category: AllocationItem['category'],
    priority: number
  ) => {
    if (!(amount > 0)) return;
    // Pre-tax dollars only; Roth contributions carry no deduction. Kept as a
    // positive-then-negated value so a zero saving stays 0 rather than -0.
    const taxSaving = Math.max(0, Math.min(preTaxAmount, amount)) * bracket;
    items.push({
      id,
      account,
      amount,
      percentage: netPaycheck > 0 ? amount / netPaycheck : 0,
      priority,
      reasoning: 'Already in place on the current path',
      taxImpact: taxSaving > 0 ? -taxSaving : 0,
      category,
      implementation: 'No change required',
    });
  };

  // Existing 401k deferral, tagged as capturing the match when it reaches the
  // matched share of salary — that is the "match captured" the comparison is
  // really about.
  const benefits = profile.benefits.employer401k;
  const annualSalary = finite(profile.income.gross) * 12;
  if (benefits.available && annualSalary > 0) {
    const deferralRate = Math.max(0, finite(benefits.currentContribution));
    const preTaxRate = Math.min(deferralRate, Math.max(0, finite(benefits.traditionalContribution)));
    const matchLimit = Math.max(0, finite(benefits.matchLimit));
    const capturesMatch =
      matchLimit > 0 && Math.max(0, finite(benefits.matchPercent)) > 0 && deferralRate >= matchLimit;

    add(
      'existing-401k',
      '401k (current deferral)',
      perPaycheckFromAnnual(annualSalary * deferralRate),
      perPaycheckFromAnnual(annualSalary * preTaxRate),
      capturesMatch ? 'employer_match' : 'tax_advantaged',
      capturesMatch ? EXISTING_PRIORITY.employerMatch : EXISTING_PRIORITY.retirement
    );
  }

  // Existing HSA payroll contributions (pre-tax).
  const hsa = profile.benefits.hsa;
  if (hsa.eligible) {
    const hsaPerPaycheck = perPaycheckFromMonthly(Math.max(0, finite(hsa.currentContribution)));
    add(
      'existing-hsa-contribution',
      'HSA (current contribution)',
      hsaPerPaycheck,
      hsaPerPaycheck,
      'tax_advantaged',
      EXISTING_PRIORITY.hsa
    );
  }

  // Existing IRA contributions; only the traditional side carries a deduction.
  const iraContributions = profile.benefits.ira?.currentContributions;
  const traditionalIRA = Math.max(0, finite(iraContributions?.traditional));
  const rothIRA = Math.max(0, finite(iraContributions?.roth));
  add(
    'existing-ira',
    'IRA (current contributions)',
    perPaycheckFromMonthly(traditionalIRA + rothIRA),
    perPaycheckFromMonthly(traditionalIRA),
    'tax_advantaged',
    EXISTING_PRIORITY.ira
  );

  // Extra principal already going to debt, split at the same 7% line the
  // allocator uses.
  profile.debts.forEach((debt, index) => {
    const highInterest = finite(debt.interestRate) > 0.07;
    add(
      `existing-debt-${debt.id || index}`,
      `${debt.name} (extra payment)`,
      perPaycheckFromMonthly(Math.max(0, finite(debt.extraPayment))),
      0,
      highInterest ? 'high_interest_debt' : 'debt_payoff',
      highInterest ? EXISTING_PRIORITY.highInterestDebt : EXISTING_PRIORITY.otherDebt
    );
  });

  return items;
}

/**
 * Starting net worth, built only from balances the profile actually collects:
 * the emergency fund, IRA balances if the user entered any, less debt
 * balances.
 *
 * There is no 401k-balance input, so no term stands in for one. The previous
 * model added `gross * 12 * 0.5` as "estimated existing retirement savings",
 * which put six months of gross pay — $150,000 for a $300k earner, $295,073 of
 * the ten-year figure once compounded — into both headline balances before a
 * single contribution. The term was identical on both paths, so `improvement`
 * is unaffected either way; the headline levels drop to what the inputs
 * support.
 */
function estimateCurrentNetWorth(profile: PaycheckProfile): number {
  const emergencyFund = Math.max(0, finite(profile.preferences.currentEmergencyFund));

  const balances = profile.benefits.ira?.currentBalances;
  const iraBalances =
    Math.max(0, finite(balances?.traditional)) + Math.max(0, finite(balances?.roth));

  const liabilities = profile.debts.reduce(
    (sum, debt) => sum + Math.max(0, finite(debt.balance)),
    0
  );

  return Math.max(0, emergencyFund + iraBalances - liabilities);
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
 */
function calculateFIAge(
  annualInvestment: number,
  fiTarget: number,
  currentNetWorth: number,
  currentAge: number
): number {
  const age = Math.min(99, Math.max(0, finite(currentAge)));
  if (currentNetWorth >= fiTarget) return age; // Already at/past FI today
  if (annualInvestment <= 0) return 99; // Never reach FI

  const yearsToFI =
    Math.log(((fiTarget - currentNetWorth) * MARKET_RETURN) / annualInvestment + 1) /
    Math.log(1 + MARKET_RETURN);

  if (!Number.isFinite(yearsToFI)) return 99;

  return Math.min(99, age + Math.max(0, yearsToFI));
}

// Optimization score calculation helpers

function calculateTaxEfficiencyScore(profile: PaycheckProfile, allocations: AllocationItem[]): number {
  const taxSavingAllocations = allocations.filter(allocation => allocation.taxImpact < 0);
  const totalTaxSavings = taxSavingAllocations.reduce((sum, allocation) => 
    sum + Math.abs(allocation.taxImpact), 0
  );
  
  // Score based on tax savings as percentage of income
  const taxSavingsRate = totalTaxSavings / profile.income.gross;
  
  if (taxSavingsRate > 0.15) return 100;
  if (taxSavingsRate > 0.10) return 85;
  if (taxSavingsRate > 0.05) return 70;
  if (taxSavingsRate > 0.02) return 55;
  return 30;
}

function calculateEmployerBenefitsScore(profile: PaycheckProfile, allocations: AllocationItem[]): number {
  const hasEmployerMatch = allocations.some(allocation => allocation.category === 'employer_match');
  // Matches both the recommended `hsa-contribution` and the existing
  // `existing-hsa-contribution` entry the current-behaviour list carries.
  const hasHSA = allocations.some(allocation => allocation.id.includes('hsa'));
  
  if (!profile.benefits.employer401k.available && !profile.benefits.hsa.eligible) return 100; // N/A
  
  let score = 0;
  if (hasEmployerMatch || !profile.benefits.employer401k.available) score += 70;
  if (hasHSA || !profile.benefits.hsa.eligible) score += 30;
  
  return score;
}

function calculateDebtStrategyScore(profile: PaycheckProfile, skippedItems: SkippedItem[]): number {
  if (profile.debts.length === 0) return 100; // No debt = perfect score
  
  const highInterestDebt = profile.debts.filter(debt => debt.interestRate > 0.07);
  const suboptimalDebtStrategy = skippedItems.filter(item => item.item.includes('Payment'));
  
  let score = 60; // Base score
  
  // Penalty for high-interest debt
  if (highInterestDebt.length > 0) score -= 30;
  
  // Bonus for optimizing low-interest debt strategy
  if (suboptimalDebtStrategy.length > 0) score += 25;
  
  return Math.max(0, Math.min(100, score));
}

function calculateEmergencyFundScore(profile: PaycheckProfile, skippedItems: SkippedItem[]): number {
  const emergencyFundIssues = skippedItems.filter(item => 
    item.item.includes('Emergency Fund')
  );
  
  if (emergencyFundIssues.length === 0) return 90; // Good emergency fund strategy
  
  const months = profile.preferences.emergencyFundMonths;
  
  if (months === 0) return 70; // Risky but can be optimal
  if (months <= 3) return 95; // Optimal range
  if (months <= 6) return 80; // Acceptable
  return 40; // Too large
}

/**
 * Ordering score. The tests are relative — does the match come before
 * discretionary saving, does high-rate debt — rather than "is it first in the
 * list". Absolute positions are not a fair test once the same rubric grades a
 * short current-behaviour list against a longer recommended one, and a 1-month
 * emergency allocation legitimately sits ahead of the match in the ordering.
 */
function calculateAccountPrioritizationScore(allocations: AllocationItem[]): number {
  let score = 70; // Base score

  const ordered = [...allocations].sort((a, b) => a.priority - b.priority);
  const firstIndexOf = (category: AllocationItem['category']) =>
    ordered.findIndex(allocation => allocation.category === category);

  /** Destinations the Financial Order of Operations places after match and high-rate debt. */
  const discretionary: AllocationItem['category'][] = [
    'tax_advantaged',
    'tax_optimization',
    'investment',
    'debt_payoff',
  ];
  const comesFirst = (index: number) =>
    index !== -1 &&
    discretionary.every(category => {
      const other = firstIndexOf(category);
      return other === -1 || index < other;
    });

  // Employer match ahead of every discretionary destination
  if (comesFirst(firstIndexOf('employer_match'))) {
    score += 15;
  }

  // High-interest debt ahead of every discretionary destination
  if (comesFirst(firstIndexOf('high_interest_debt'))) {
    score += 10;
  }

  // Tax-advantaged space used before taxable investing (or no taxable leg at all)
  const taxAdvantagedIndex = firstIndexOf('tax_advantaged');
  const investmentIndex = firstIndexOf('investment');
  if (taxAdvantagedIndex !== -1 && (investmentIndex === -1 || taxAdvantagedIndex < investmentIndex)) {
    score += 5;
  }

  return Math.min(100, score);
}