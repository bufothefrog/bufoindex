/**
 * The retirement engine's income entry from the profile (O11), shared by the
 * bindings and the Social Security estimate so both read the same yearly
 * pay. Pure.
 *
 * The engine takes an amount and a period (incomeAmount, incomePeriod) and
 * the annual figure (currentIncome); the profile holds the gross pay per
 * paycheck and the pay frequency. Bi-weekly, semi-monthly and monthly pay
 * keep their period; weekly pay, which the engine has no period for, enters
 * as a yearly amount.
 */

import { annualizeIncome, type IncomePeriod } from '@/lib/calculations/retirement';
import { PAY_FREQUENCY_META, type PayFrequency } from '@/lib/constants/frequency';
import { GROSS_PAY, PAY_FREQUENCY } from '@/lib/fields/shared';
import type { Get } from '@/lib/fields/types';

export const GROSS_PATH = GROSS_PAY.path;
const FREQUENCY_PATH = PAY_FREQUENCY.path;

/** The engine's period for each pay frequency; weekly has none and enters as yearly. */
const INCOME_PERIOD: Readonly<Record<PayFrequency, IncomePeriod | null>> = {
  weekly: null,
  'bi-weekly': 'biweekly',
  'semi-monthly': 'semimonthly',
  monthly: 'monthly',
};

export interface IncomeEntry {
  amount: number;
  period: IncomePeriod;
}

/** The engine's income entry for the profile's gross pay and frequency. */
export function incomeEntry(get: Get): IncomeEntry {
  const gross = get(GROSS_PATH) as number;
  const frequency = get(FREQUENCY_PATH) as PayFrequency;
  const period = INCOME_PERIOD[frequency];
  return period ? { amount: gross, period } : { amount: gross * PAY_FREQUENCY_META[frequency].perYear, period: 'yearly' };
}

/** Yearly gross pay, as the engine's currentIncome reads it. */
export function yearlyGrossPay(get: Get): number {
  const { amount, period } = incomeEntry(get);
  return annualizeIncome(amount, period);
}
