import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { STATE_TAX_RATES_2026 } from '../constants/states-2026'
import {
  SS_WAGE_BASE_2026,
  FICA_RATE,
  MEDICARE_RATE,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  type FilingStatusInput,
} from '../constants/irs-2026'

/**
 * Utility function for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number with commas for real-time input formatting
 */
export function formatNumberWithCommas(value: string): string {
  if (!value) return '';
  
  // Remove any existing commas and non-digits
  const digitsOnly = value.replace(/[^\d]/g, '');
  
  // Return empty string if no digits
  if (!digitsOnly) return '';
  
  // Add commas every 3 digits from right
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Additional Medicare Tax (0.9% surtax) liability thresholds by filing status.
 * IRC 3101(b)(2): $250,000 MFJ / $125,000 MFS / $200,000 all others.
 * Statutory amounts, not inflation-indexed.
 */
function getAdditionalMedicareThreshold(filingStatus: FilingStatusInput): number {
  switch (filingStatus) {
    case 'marriedJoint':
    case 'marriedFilingJointly':
      return 250000;
    case 'marriedSeparate':
    case 'marriedFilingSeparately':
      return 125000;
    default:
      return ADDITIONAL_MEDICARE_THRESHOLD; // $200k: single, head of household
  }
}

/**
 * Get the applicable marginal FICA rate based on gross annual income and
 * filing status. Constants imported from lib/constants/irs-2026.ts
 * (single source of truth); Additional Medicare Tax thresholds per
 * IRC 3101(b)(2) above.
 */
export function getFICARate(
  grossAnnualIncome: number,
  filingStatus: FilingStatusInput = 'single'
): number {
  const surtaxApplies = grossAnnualIncome > getAdditionalMedicareThreshold(filingStatus);
  // ADDITIONAL_MEDICARE_RATE - MEDICARE_RATE isolates the 0.9% surtax so it
  // can stack on the full FICA rate when the threshold sits below the SS wage
  // base (MFS: $125k threshold < $184.5k wage base).
  if (grossAnnualIncome <= SS_WAGE_BASE_2026) {
    return surtaxApplies
      ? FICA_RATE + (ADDITIONAL_MEDICARE_RATE - MEDICARE_RATE)
      : FICA_RATE;
  }
  return surtaxApplies ? ADDITIONAL_MEDICARE_RATE : MEDICARE_RATE;
}

/**
 * Calculate income tax rate (federal + state only).
 * Use for pre-tax 401k and traditional IRA tax savings,
 * since these reduce income tax but NOT FICA.
 */
export function calculateIncomeTaxRate(federalRate: number, stateCode: string): number {
  const stateRate = stateCode && STATE_TAX_RATES_2026[stateCode as keyof typeof STATE_TAX_RATES_2026]
    ? STATE_TAX_RATES_2026[stateCode as keyof typeof STATE_TAX_RATES_2026].rate
    : 0;

  return federalRate + stateRate;
}

/**
 * Calculate HSA tax savings rate (federal + state + FICA).
 * HSA payroll deductions are exempt from FICA per IRC 3121(a)(2)(B),
 * so the full FICA rate is a genuine tax saving.
 */
export function calculateHSATaxRate(
  federalRate: number,
  stateCode: string,
  grossAnnualIncome: number,
  filingStatus: FilingStatusInput = 'single'
): number {
  return calculateIncomeTaxRate(federalRate, stateCode) + getFICARate(grossAnnualIncome, filingStatus);
}

/**
 * Calculate total marginal tax rate including federal, state, and FICA.
 * Use for display/informational purposes only. For tax savings on specific
 * contribution types, use calculateIncomeTaxRate or calculateHSATaxRate.
 */
export function calculateMarginalTaxRate(federalRate: number, stateCode: string): number {
  const stateRate = stateCode && STATE_TAX_RATES_2026[stateCode as keyof typeof STATE_TAX_RATES_2026]
    ? STATE_TAX_RATES_2026[stateCode as keyof typeof STATE_TAX_RATES_2026].rate
    : 0;

  return federalRate + stateRate + FICA_RATE;
}
