/**
 * Paycheck bindings (docs/rebuild-plan.md section 2.5): which profile value
 * feeds each PaycheckProfile leaf. They reproduce the old profile mapper
 * (toPaycheckProfile; test/lib/calculators/paycheck/bindings.test.ts keeps
 * its output as the golden fixture). Pure.
 *
 * The engine profile is nested and the profile is flat (plan risk 1), so a
 * few leaves are derived:
 *
 * - Income. updateLegacyIncomeFields fills the monthly figures from the
 *   per-paycheck ones; it runs once, in the 'income' binding, and the 1:1
 *   income bindings after it set the same values on the leaves they own.
 * - The 401(k) split (split401k): the profile holds the contribution type,
 *   the total and the Roth part of a split; the engine wants the traditional
 *   and Roth shares.
 * - hasIRA (either IRA), hasTaxableAccount (a taxable contribution above
 *   zero) and the current fun money (the midpoint of the range).
 * - The IRA balances and the emergency fund come from the account list
 *   (lib/profile/accounts.ts): the value of the traditional and Roth IRA
 *   accounts, and the accounts that hold the emergency fund (or the typed
 *   emergency fund while none does).
 * - The invested total (investedBalance): every account in effect except
 *   the emergency-fund accounts, for the net worth the projections start
 *   from.
 * - The current federal bracket (currentBracketFrom): the 2026 bracket of
 *   yearly gross pay (bonus included) minus the traditional 401(k) share
 *   and HSA payroll contributions (each capped at its 2026 limit) minus the
 *   standard deduction
 *   (lib/calculations/taxBracket.ts).
 * - The retirement bracket, read as the nearest of the seven bracket rates
 *   (a stored value from the old free percent field is not rewritten).
 *
 * Everything else the engine reads with no profile home keeps its value
 * from the engine base (getDefaultProfile); PAYCHECK_ENGINE_ONLY lists each
 * one with the reason.
 */

import { updateLegacyIncomeFields } from '@/lib/calculations/core';
import { limit401k, limitHsa } from '@/lib/calculations/contributionLimits';
import { currentFederalBracket, nearestBracketRate } from '@/lib/calculations/taxBracket';
import type { Binding } from '@/lib/fields/binding';
import {
  AGE,
  EMERGENCY_FUND_APY,
  EMERGENCY_FUND_BALANCE,
  FILING_STATUS,
  GROSS_PAY,
  NECESSARY_MONTHLY,
  NET_PAY,
  PAY_FREQUENCY,
  STATE,
  TAXABLE_MONTHLY,
} from '@/lib/fields/shared';
import type { Get } from '@/lib/fields/types';
import {
  ACCOUNT_PATHS,
  emergencyFundBalance,
  investedBalance,
  iraBalances,
  split401k,
  type Election401k,
} from '@/lib/profile/accounts';
import type { ContributionType, FilingStatus } from '@/lib/profile/types';
import type { HSABenefits, IncomeData, PaycheckProfile } from '@/lib/types';

export const CONTRIBUTION_TYPE_PATH = 'workplace.contributionType';
export const CONTRIBUTION_PATH = 'workplace.contributionPercent';
export const ROTH_PART_PATH = 'workplace.rothContributionPercent';
const GROSS_PATH = GROSS_PAY.path;
const NET_PATH = NET_PAY.path;
const FREQUENCY_PATH = PAY_FREQUENCY.path;
export const RETIREMENT_BRACKET_PATH = 'assumptions.paycheck.expectedRetirementBracket';

// The 401(k) split lives with the account model; re-exported for the importers of this module.
export { split401k, type Election401k };

function electionFrom(get: Get): Election401k {
  return split401k(
    get(CONTRIBUTION_TYPE_PATH) as ContributionType,
    get(CONTRIBUTION_PATH) as number,
    get(ROTH_PART_PATH) as number
  );
}

/** The engine's income: the per-paycheck facts plus the monthly figures updateLegacyIncomeFields derives. */
function incomeFrom(get: Get): IncomeData {
  return updateLegacyIncomeFields({
    grossPaycheck: get(GROSS_PATH) as number,
    netPaycheck: get(NET_PATH) as number,
    frequency: get(FREQUENCY_PATH) as IncomeData['frequency'],
    regularBonus: get('income.hasBonus') as boolean,
    bonusAmount: get('income.bonusAmount') as number,
    bonusFrequency: get('income.bonusFrequency') as IncomeData['bonusFrequency'],
    monthlyGross: 0,
    monthlyNet: 0,
    gross: 0,
    net: 0,
    bonusExpected: 0,
  });
}

/** Dollars to the cent, so a bracket edge is not missed by float drift. */
const toCents = (value: number) => Math.round(value * 100) / 100;

/**
 * The visitor's current federal bracket: the 2026 bracket their taxable
 * income falls in for their filing status. Taxable income is yearly gross
 * pay (paychecks plus a regular bonus) minus the pre-tax payroll
 * contributions the profile describes (the traditional share of the 401(k)
 * election on regular pay, after the whole election is capped at the 2026
 * deferral limit, and HSA payroll contributions capped at their 2026 limit) minus the standard deduction. The arithmetic is lib/calculations/taxBracket.ts.
 */
export function currentBracketFrom(get: Get): number {
  const income = incomeFrom(get);
  const yearlyPay = income.monthlyGross * 12;
  const yearlyGross = yearlyPay + income.bonusExpected * 12;
  const age = get(AGE.path) as number;
  // Each deduction is capped at its 2026 limit for the age, as the engine
  // applies them. The 402(g) deferral limit covers traditional and Roth
  // deferrals together: the whole election is capped first and the
  // traditional share of the capped total is pre-tax (the engine's
  // preTaxDeferralShare pro-rates a split election the same way). The HSA is
  // capped at the limit for the coverage less the employer's money.
  const election = electionFrom(get);
  const electedShare = election.traditional + election.roth;
  const deferral = Math.min(yearlyPay * electedShare, limit401k(age));
  const traditional401k =
    get('workplace.has401k') === true && electedShare > 0 ? (deferral * election.traditional) / electedShare : 0;
  const hsaRoom = Math.max(
    0,
    limitHsa(get('hsa.coverage') as HSABenefits['coverageType'], age) - (get('hsa.employerAnnualContribution') as number)
  );
  const hsa = get('hsa.eligible') === true ? Math.min((get('hsa.monthlyContribution') as number) * 12, hsaRoom) : 0;
  return currentFederalBracket({
    yearlyGross: toCents(yearlyGross),
    preTaxDeductions: toCents(traditional401k + hsa),
    filingStatus: get(FILING_STATUS.path) as FilingStatus,
  });
}

/** The retirement bracket the engine compares with: the stored value read as the nearest bracket rate. */
function retirementBracketFrom(get: Get): number {
  return nearestBracketRate(get(RETIREMENT_BRACKET_PATH) as number);
}

export const PAYCHECK_BINDINGS: readonly Binding<PaycheckProfile>[] = [
  // Income: the derived figures first, then the leaves the profile owns.
  {
    engine: 'income',
    read: incomeFrom,
    errorPath: GROSS_PATH,
  },
  { profile: GROSS_PATH, engine: 'income.grossPaycheck' },
  { profile: NET_PATH, engine: 'income.netPaycheck' },
  { profile: FREQUENCY_PATH, engine: 'income.frequency' },
  { profile: 'income.hasBonus', engine: 'income.regularBonus' },
  { profile: 'income.bonusAmount', engine: 'income.bonusAmount' },
  { profile: 'income.bonusFrequency', engine: 'income.bonusFrequency' },

  // Taxes.
  { profile: STATE.path, engine: 'taxes.state' },
  { profile: FILING_STATUS.path, engine: 'taxes.filingStatus' },
  { engine: 'taxes.federalBracket', read: currentBracketFrom, errorPath: GROSS_PATH },

  // 401(k).
  { profile: 'workplace.has401k', engine: 'benefits.employer401k.available' },
  { profile: 'workplace.matchPercent', engine: 'benefits.employer401k.matchPercent' },
  { profile: 'workplace.matchLimit', engine: 'benefits.employer401k.matchLimit' },
  { profile: CONTRIBUTION_TYPE_PATH, engine: 'benefits.employer401k.contributionType' },
  { profile: CONTRIBUTION_PATH, engine: 'benefits.employer401k.currentContribution' },
  {
    engine: 'benefits.employer401k.traditionalContribution',
    read: (get) => electionFrom(get).traditional,
    errorPath: CONTRIBUTION_PATH,
  },
  {
    engine: 'benefits.employer401k.rothContribution',
    read: (get) => electionFrom(get).roth,
    errorPath: ROTH_PART_PATH,
  },
  { profile: 'workplace.afterTaxAvailable', engine: 'benefits.employer401k.afterTaxAvailable' },

  // HSA.
  { profile: 'hsa.eligible', engine: 'benefits.hsa.eligible' },
  { profile: 'hsa.coverage', engine: 'benefits.hsa.coverageType' },
  { profile: 'hsa.monthlyContribution', engine: 'benefits.hsa.currentContribution' },
  { profile: 'hsa.employerAnnualContribution', engine: 'benefits.hsa.employerContribution' },
  { profile: 'hsa.investing', engine: 'benefits.hsa.investmentStrategy' },

  // IRAs.
  { engine: 'benefits.ira.hasIRA', read: (get) => get('ira.traditional') === true || get('ira.roth') === true },
  { profile: 'ira.traditional', engine: 'benefits.ira.accountTypes.traditional' },
  { profile: 'ira.roth', engine: 'benefits.ira.accountTypes.roth' },
  { profile: 'ira.traditionalMonthly', engine: 'benefits.ira.currentContributions.traditional' },
  { profile: 'ira.rothMonthly', engine: 'benefits.ira.currentContributions.roth' },
  {
    engine: 'benefits.ira.currentBalances.traditional',
    read: (get) => iraBalances(get).traditional,
    errorPath: ACCOUNT_PATHS.accounts,
  },
  {
    engine: 'benefits.ira.currentBalances.roth',
    read: (get) => iraBalances(get).roth,
    errorPath: ACCOUNT_PATHS.accounts,
  },

  // Debts, row for row.
  { profile: 'debts', engine: 'debts' },

  // Preferences.
  { profile: 'cash.targetMonths', engine: 'preferences.emergencyFundMonths' },
  { engine: 'preferences.currentEmergencyFund', read: emergencyFundBalance, errorPath: EMERGENCY_FUND_BALANCE.path },
  { profile: EMERGENCY_FUND_APY.path, engine: 'preferences.emergencyFundAPY' },
  { profile: NECESSARY_MONTHLY.path, engine: 'preferences.necessaryExpenses' },
  { profile: 'spending.funMoneyMin', engine: 'preferences.funMoney.min' },
  { profile: 'spending.funMoneyMax', engine: 'preferences.funMoney.max' },
  {
    engine: 'preferences.funMoney.current',
    read: (get) => ((get('spending.funMoneyMin') as number) + (get('spending.funMoneyMax') as number)) / 2,
    errorPath: 'spending.funMoneyMax',
  },
  { profile: AGE.path, engine: 'preferences.age' },
  {
    engine: 'preferences.hasTaxableAccount',
    read: (get) => (get(TAXABLE_MONTHLY.path) as number) > 0,
  },
  { profile: TAXABLE_MONTHLY.path, engine: 'preferences.taxableAccountContribution' },
  { engine: 'preferences.investedBalance', read: investedBalance, errorPath: ACCOUNT_PATHS.accounts },
  { engine: 'preferences.expectedRetirementBracket', read: retirementBracketFrom, errorPath: RETIREMENT_BRACKET_PATH },
  { profile: 'assumptions.paycheck.riskTolerance', engine: 'preferences.riskTolerance' },
  { profile: 'assumptions.paycheck.optimizationGoal', engine: 'preferences.optimizationGoal' },
];

/**
 * PaycheckProfile leaves with no profile home of their own, and why. The
 * derived ones are still computed by a binding above; the others keep the
 * engine base value (getDefaultProfile), as the old mapper did.
 */
export const PAYCHECK_ENGINE_ONLY: Readonly<Record<string, string>> = {
  'income.monthlyGross': 'Derived by updateLegacyIncomeFields in the income binding.',
  'income.monthlyNet': 'Derived by updateLegacyIncomeFields in the income binding.',
  'income.gross': 'Derived by updateLegacyIncomeFields in the income binding (legacy alias of monthlyGross).',
  'income.net': 'Derived by updateLegacyIncomeFields in the income binding (legacy alias of monthlyNet).',
  'income.bonusExpected': 'Derived by updateLegacyIncomeFields in the income binding (monthly bonus equivalent).',
  'taxes.federalBracket': 'Derived: the 2026 bracket of taxable pay (currentBracketFrom).',
  'taxes.currentWithholding.federal': 'Read only by the core.ts estimates; withholding stays internal (O12).',
  'taxes.currentWithholding.state': 'Read only by the core.ts estimates; withholding stays internal (O12).',
  'taxes.currentWithholding.fica': 'Read only by the core.ts estimates; withholding stays internal (O12).',
  'benefits.employer401k.traditionalContribution': 'Derived from the contribution type, total and Roth part (split401k).',
  'benefits.employer401k.rothContribution': 'Derived from the contribution type, total and Roth part (split401k).',
  'benefits.employer401k.currentYTD': 'Year-to-date 401(k) contributions; no input, base value 0.',
  'benefits.hsa.currentYTD': 'Year-to-date HSA contributions; no input, base value 0.',
  'benefits.ira.hasIRA': 'Derived: true when either IRA is held.',
  'benefits.ira.currentBalances.traditional': 'Derived: the value of the traditional IRA accounts (iraBalances).',
  'benefits.ira.currentBalances.roth': 'Derived: the value of the Roth IRA accounts (iraBalances).',
  'preferences.currentEmergencyFund':
    'Derived: the accounts that hold the emergency fund, or the typed balance while none does (emergencyFundBalance).',
  'benefits.other.fsaElection': 'Other benefits have no input; base value 0.',
  'benefits.other.transitBenefits': 'Other benefits have no input; base value 0.',
  'benefits.other.lifeInsurance': 'Other benefits have no input; base value 0.',
  'preferences.funMoney.current': 'Derived: the midpoint of the fun-money range.',
  'preferences.hasTaxableAccount': 'Derived: true when the taxable monthly contribution is above zero.',
  'preferences.investedBalance':
    'Derived: the invested total of portfolio.accounts, the emergency fund left out (investedBalance).',
  'preferences.isPeakEarnings': 'Stays internal (O12); base value false.',
  version: 'Engine metadata, not an input.',
  lastUpdated: 'Engine metadata, not an input.',
  source: 'Engine metadata, not an input.',
};
