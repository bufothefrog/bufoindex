/**
 * Retirement bindings (docs/rebuild-plan.md section 2.5): which profile
 * value feeds each RetirementInputs leaf. The golden fixture in
 * test/lib/calculators/retirement/bindings.test.ts pins the result. Pure.
 *
 * Five leaves are derived:
 *
 * - Income. The engine takes an amount and a period (incomeAmount,
 *   incomePeriod) and the annual figure (currentIncome); the profile holds the
 *   gross pay per paycheck and the pay frequency (O11, ./income.ts).
 * - Filing status. The engine models single and married filing jointly; the
 *   other two statuses run as single (O10), with a note on the page
 *   (filingStatusNote).
 * - Social Security benefit. The profile leaf is null on Auto; the engine
 *   gets the estimate from pay then (./socialSecurity.ts).
 * - Starting balance: the invested total of the account list, the
 *   emergency fund left out (investedBalance in lib/profile/accounts.ts).
 * - Monthly savings: the Custom monthly investing figure, or on Auto the
 *   sum of the normal contributions (monthlyInvesting).
 */

import type { RetirementInputs } from '@/lib/calculations/retirement';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import type { Binding } from '@/lib/fields/binding';
import {
  ACCOUNTS,
  AGE,
  FILING_STATUS,
  MONTHLY_INVESTING,
  NECESSARY_MONTHLY,
  RETIREMENT_AGE,
  STATE,
} from '@/lib/fields/shared';
import { investedBalance, monthlyInvesting } from '@/lib/profile/accounts';
import type { FilingStatus } from '@/lib/profile/types';
import { GROSS_PATH, incomeEntry, yearlyGrossPay } from './income';
import { SOCIAL_SECURITY_BENEFIT_PATH, resolveSocialSecurityBenefit } from './socialSecurity';

const FILING_PATH = FILING_STATUS.path;

/** The filing status the retirement engine runs for a profile status (O10). */
export function retirementFilingStatus(status: FilingStatus): RetirementInputs['filingStatus'] {
  return status === 'marriedJoint' ? 'marriedJoint' : 'single';
}

/**
 * The note the retirement page shows when the saved filing status is one the
 * engine does not model; null for single and married filing jointly.
 */
export function filingStatusNote(status: FilingStatus): string | null {
  if (retirementFilingStatus(status) === status) return null;
  return `Retirement estimates model only single and married filing jointly, so ${FILING_STATUS_META[status].phrase} runs here as single.`;
}

export const RETIREMENT_BINDINGS: readonly Binding<RetirementInputs>[] = [
  { profile: AGE.path, engine: 'startingAge' },
  { profile: RETIREMENT_AGE.path, engine: 'retirementAge' },
  { profile: 'person.lifeExpectancy', engine: 'lifeExpectancy' },
  { profile: 'spending.targetRetirementIncome', engine: 'targetIncome' },
  { engine: 'startingBalance', read: investedBalance, errorPath: ACCOUNTS.path },
  {
    engine: 'currentIncome',
    read: yearlyGrossPay,
    errorPath: GROSS_PATH,
  },
  {
    engine: 'incomeAmount',
    read: (get) => incomeEntry(get).amount,
    errorPath: GROSS_PATH,
  },
  { engine: 'incomePeriod', read: (get) => incomeEntry(get).period },
  { engine: 'monthlySavings', read: monthlyInvesting, errorPath: MONTHLY_INVESTING.path },
  { profile: NECESSARY_MONTHLY.path, engine: 'necessaryMonthlyExpenses' },
  { profile: 'assumptions.retirement.accumulationReturn', engine: 'accumulationReturn' },
  { profile: 'assumptions.retirement.retirementReturn', engine: 'retirementReturn' },
  { profile: 'assumptions.retirement.inflationRate', engine: 'inflationRate' },
  { profile: 'retirementIncome.socialSecurityAge', engine: 'socialSecurityAge' },
  {
    engine: 'socialSecurityBenefit',
    read: resolveSocialSecurityBenefit,
    errorPath: SOCIAL_SECURITY_BENEFIT_PATH,
  },
  { profile: 'assumptions.retirement.healthcareCostMultiplier', engine: 'healthcareCostMultiplier' },
  { profile: 'assumptions.retirement.volatility', engine: 'volatility' },
  {
    engine: 'filingStatus',
    read: (get) => retirementFilingStatus(get(FILING_PATH) as FilingStatus),
    errorPath: FILING_PATH,
  },
  { profile: STATE.path, engine: 'state' },
  { profile: 'assumptions.retirement.riskProfile', engine: 'riskProfile' },
  { profile: 'assumptions.retirement.effectiveTaxRate', engine: 'effectiveTaxRate' },
  { profile: 'retirementIncome.annualHealthcareCost', engine: 'estimatedAnnualHealthcareCost' },
];

/**
 * Engine leaves with no profile home of their own, and why. Each is still
 * computed by a derived binding above, never left at the engine base.
 */
export const RETIREMENT_ENGINE_ONLY: Readonly<Record<string, string>> = {
  currentIncome: 'The annual income, derived from income.grossPerPaycheck and income.frequency.',
  incomeAmount: 'The amount for incomePeriod, derived from income.grossPerPaycheck and income.frequency.',
  incomePeriod: 'Derived from income.frequency; weekly pay enters as a yearly amount.',
  startingBalance: 'Derived: the invested total of portfolio.accounts, the emergency fund left out (investedBalance).',
  monthlySavings: 'Derived: investing.monthlyContribution when Custom, else the normal contributions (monthlyInvesting).',
};
