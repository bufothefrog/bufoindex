/**
 * Financial Constants for Retirement Calculator
 * Centralized constants for retirement planning calculations
 */

import {
  FEDERAL_TAX_BRACKETS_2026,
  STANDARD_DEDUCTIONS_2026,
} from './irs-2026';

export class RetirementConstants {
  // Core Financial Rules
  static readonly WITHDRAWAL_RATE = 0.04;                  // 4% withdrawal rule
  static readonly SAFE_WITHDRAWAL_RATE = 0.035;            // Conservative 3.5% withdrawal rate
  
  // Age Limits
  static readonly MIN_STARTING_AGE = 18;
  static readonly MAX_RETIREMENT_AGE = 100;
  static readonly MIN_RETIREMENT_AGE = 30;
  static readonly DEFAULT_LIFE_EXPECTANCY = 85;
  static readonly MAX_LIFE_EXPECTANCY = 110;
  
  // Savings Rates
  static readonly MAX_SAVINGS_RATE = 0.80;                 // 80% maximum realistic savings rate
  static readonly DEFAULT_SAVINGS_RATE = 0.15;             // 15% default savings rate
  static readonly MIN_SAVINGS_RATE = 0.01;                 // 1% minimum savings rate
  
  // Return Rates (annual)
  static readonly MIN_RETURN_RATE = -0.50;                 // -50% minimum return (market crash)
  static readonly MAX_RETURN_RATE = 0.30;                  // 30% maximum return
  static readonly DEFAULT_ACCUMULATION_RETURN = 0.08;      // 8% default accumulation return
  static readonly DEFAULT_RETIREMENT_RETURN = 0.06;        // 6% default retirement return
  
  // Inflation
  static readonly MIN_INFLATION_RATE = 0.00;               // 0% minimum inflation
  static readonly MAX_INFLATION_RATE = 0.15;               // 15% maximum inflation
  static readonly DEFAULT_INFLATION_RATE = 0.03;           // 3% default inflation rate
  static readonly HEALTHCARE_INFLATION_RATE = 0.055;       // 5.5% healthcare inflation
  
  // Volatility for Monte Carlo
  static readonly MIN_VOLATILITY = 0.05;                   // 5% minimum volatility
  static readonly MAX_VOLATILITY = 0.30;                   // 30% maximum volatility
  static readonly DEFAULT_VOLATILITY = 0.15;               // 15% default volatility
  
  // Social Security
  static readonly SS_FULL_RETIREMENT_AGE = 67;             // Full retirement age for SS
  static readonly SS_MIN_AGE = 62;                         // Minimum SS claiming age
  static readonly SS_MAX_AGE = 70;                         // Maximum SS claiming age
  static readonly SS_REDUCTION_RATE = 0.0667;              // 6.67% reduction per year before FRA
  static readonly SS_CREDIT_RATE = 0.08;                   // 8% credit per year after FRA
  
  // Healthcare Costs
  static readonly HEALTHCARE_BASE_COST = 7500;             // Base annual healthcare cost
  static readonly HEALTHCARE_AGE_MULTIPLIER = 1.5;         // Multiplier for older ages
  
  // Monte Carlo Simulation
  static readonly DEFAULT_MONTE_CARLO_RUNS = 1000;         // Default simulation runs
  static readonly MIN_MONTE_CARLO_RUNS = 100;              // Minimum simulation runs
  static readonly MAX_MONTE_CARLO_RUNS = 10000;            // Maximum simulation runs
  
  // Tax Related - imported from single source of truth (lib/constants/irs-2026.ts)
  static readonly FEDERAL_TAX_BRACKETS = {
    2026: {
      single: FEDERAL_TAX_BRACKETS_2026.single,
      marriedJoint: FEDERAL_TAX_BRACKETS_2026.marriedFilingJointly,
    }
  };

  // Tax Defaults
  static readonly DEFAULT_EFFECTIVE_TAX_RATE = 0.15;
  static readonly STANDARD_DEDUCTION_SINGLE_2026 = STANDARD_DEDUCTIONS_2026.single;
  static readonly STANDARD_DEDUCTION_MFJ_2026 = STANDARD_DEDUCTIONS_2026.marriedFilingJointly;

  // Form Validation
  static readonly MAX_INCOME = 10000000;                   // $10M max income
  static readonly MAX_BALANCE = 100000000;                 // $100M max balance
  static readonly MIN_INCOME = 0;                          // $0 min income
  static readonly MIN_BALANCE = 0;                         // $0 min balance
}