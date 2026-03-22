/**
 * Financial Constants for Retirement Calculator
 * Centralized constants for retirement planning calculations
 */

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
  
  // Tax Related (2026 - Rev. Proc. 2025-32, as amended by OBBBA)
  static readonly FEDERAL_TAX_BRACKETS = {
    2026: {
      single: [
        { min: 0, max: 12400, rate: 0.10 },
        { min: 12400, max: 50400, rate: 0.12 },
        { min: 50400, max: 105700, rate: 0.22 },
        { min: 105700, max: 201775, rate: 0.24 },
        { min: 201775, max: 256225, rate: 0.32 },
        { min: 256225, max: 640600, rate: 0.35 },
        { min: 640600, max: Infinity, rate: 0.37 },
      ],
      marriedJoint: [
        { min: 0, max: 24800, rate: 0.10 },
        { min: 24800, max: 100800, rate: 0.12 },
        { min: 100800, max: 211400, rate: 0.22 },
        { min: 211400, max: 403550, rate: 0.24 },
        { min: 403550, max: 512450, rate: 0.32 },
        { min: 512450, max: 768700, rate: 0.35 },
        { min: 768700, max: Infinity, rate: 0.37 },
      ],
    }
  } as const;

  // Tax Defaults
  static readonly DEFAULT_EFFECTIVE_TAX_RATE = 0.15;
  static readonly STANDARD_DEDUCTION_SINGLE_2026 = 16100;
  static readonly STANDARD_DEDUCTION_MFJ_2026 = 32200;

  // Form Validation
  static readonly MAX_INCOME = 10000000;                   // $10M max income
  static readonly MAX_BALANCE = 100000000;                 // $100M max balance
  static readonly MIN_INCOME = 0;                          // $0 min income
  static readonly MIN_BALANCE = 0;                         // $0 min balance
}