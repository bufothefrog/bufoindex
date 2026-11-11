/**
 * Retirement bindings (docs/rebuild-plan.md section 2.5): which profile
 * value feeds each RetirementInputs leaf. They reproduce
 * lib/profile/mappers.ts toRetirementInputs, which slice x1 deletes. Pure.
 *
 * Two leaves are derived:
 *
 * - Income. The engine takes an amount and a period (incomeAmount,
 *   incomePeriod) and the annual figure (currentIncome); the profile holds the
 *   gross pay per paycheck and the pay frequency (O11). Bi-weekly,
 *   semi-monthly and monthly pay keep their period; weekly pay, which the
 *   engine has no period for, enters as a yearly amount.
 * - Filing status. The engine models single and married filing jointly; the
 *   other two statuses run as single (O10), with a note on the page
 *   (filingStatusNote).
 *
 * The reverse direction (`write`) serves only the one-time import of the old
 * calculator's localStorage (O7).
 */

import { annualizeIncome, type IncomePeriod, type RetirementInputs } from '@/lib/calculations/retirement';
import { FILING_STATUS_META } from '@/lib/constants/labels';
import { PAY_FREQUENCY_META, type PayFrequency } from '@/lib/constants/frequency';
import type { Binding } from '@/lib/fields/binding';
import { FILING_STATUS, GROSS_PAY, PAY_FREQUENCY } from '@/lib/fields/shared';
import type { Get, Write } from '@/lib/fields/types';
import type { FilingStatus } from '@/lib/profile/types';

const GROSS_PATH = GROSS_PAY.path;
const FREQUENCY_PATH = PAY_FREQUENCY.path;
const FILING_PATH = FILING_STATUS.path;

/** The engine's period for each pay frequency; weekly has none and enters as yearly. */
const INCOME_PERIOD: Readonly<Record<PayFrequency, IncomePeriod | null>> = {
  weekly: null,
  'bi-weekly': 'biweekly',
  'semi-monthly': 'semimonthly',
  monthly: 'monthly',
};

/** The pay frequency for an engine period that has one (the legacy import). */
const FREQUENCY_FOR_PERIOD: Readonly<Partial<Record<IncomePeriod, PayFrequency>>> = Object.fromEntries(
  Object.entries(INCOME_PERIOD).flatMap(([frequency, period]) => (period ? [[period, frequency]] : []))
);

interface IncomeEntry {
  amount: number;
  period: IncomePeriod;
}

/** The engine's income entry for the profile's gross pay and frequency. */
function incomeEntry(get: Get): IncomeEntry {
  const gross = get(GROSS_PATH) as number;
  const frequency = get(FREQUENCY_PATH) as PayFrequency;
  const period = INCOME_PERIOD[frequency];
  return period ? { amount: gross, period } : { amount: gross * PAY_FREQUENCY_META[frequency].perYear, period: 'yearly' };
}

/**
 * Profile writes for an old income entry. A period with a pay frequency
 * keeps its amount; hourly and yearly amounts become a monthly paycheck of
 * the same annual income, rounded to the cent.
 */
function incomeWrites(amount: number, period: IncomePeriod): Write[] {
  const frequency = FREQUENCY_FOR_PERIOD[period];
  if (frequency) {
    return [
      { path: GROSS_PATH, value: amount },
      { path: FREQUENCY_PATH, value: frequency },
    ];
  }
  return [
    { path: GROSS_PATH, value: Math.round((annualizeIncome(amount, period) / 12) * 100) / 100 },
    { path: FREQUENCY_PATH, value: 'monthly' satisfies PayFrequency },
  ];
}

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
  return `Retirement estimates model two filing statuses, single and married filing jointly. Your saved status, ${FILING_STATUS_META[status].phrase}, runs here as single.`;
}

export const RETIREMENT_BINDINGS: readonly Binding<RetirementInputs>[] = [
  { profile: 'person.age', engine: 'startingAge' },
  { profile: 'person.retirementAge', engine: 'retirementAge' },
  { profile: 'person.lifeExpectancy', engine: 'lifeExpectancy' },
  { profile: 'spending.targetRetirementIncome', engine: 'targetIncome' },
  { profile: 'investing.investedBalance', engine: 'startingBalance' },
  {
    engine: 'currentIncome',
    read: (get) => {
      const { amount, period } = incomeEntry(get);
      return annualizeIncome(amount, period);
    },
    errorPath: GROSS_PATH,
  },
  {
    engine: 'incomeAmount',
    read: (get) => incomeEntry(get).amount,
    write: (_value, engine) => incomeWrites(engine.incomeAmount, engine.incomePeriod),
    errorPath: GROSS_PATH,
  },
  { engine: 'incomePeriod', read: (get) => incomeEntry(get).period },
  { profile: 'investing.monthlyContribution', engine: 'monthlySavings' },
  { profile: 'spending.necessaryMonthly', engine: 'necessaryMonthlyExpenses' },
  { profile: 'assumptions.retirement.accumulationReturn', engine: 'accumulationReturn' },
  { profile: 'assumptions.retirement.retirementReturn', engine: 'retirementReturn' },
  { profile: 'assumptions.retirement.inflationRate', engine: 'inflationRate' },
  { profile: 'retirementIncome.socialSecurityAge', engine: 'socialSecurityAge' },
  { profile: 'retirementIncome.socialSecurityBenefit', engine: 'socialSecurityBenefit' },
  { profile: 'assumptions.retirement.healthcareCostMultiplier', engine: 'healthcareCostMultiplier' },
  { profile: 'assumptions.retirement.volatility', engine: 'volatility' },
  {
    engine: 'filingStatus',
    read: (get) => retirementFilingStatus(get(FILING_PATH) as FilingStatus),
    write: (value) => [{ path: FILING_PATH, value }],
    errorPath: FILING_PATH,
  },
  { profile: 'person.state', engine: 'state' },
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
};
