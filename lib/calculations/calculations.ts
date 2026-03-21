/**
 * Financial Calculations Utility
 * Core mathematical functions for retirement planning
 */

// Type definitions for calculation parameters and results
export interface ScenarioParams {
  startingAge: number;
  retirementAge: number;
  targetIncome: number;
  startingBalance: number;
  inflationRate: number;
  annualReturn: number;
}

export interface ScenarioResult {
  yearsUntilRetirement: number;
  targetPortfolioSize: number;
  monthlyContribution: number;
  inflatedTargetIncome: number;
  annualContribution: number;
  valid: boolean;
  error?: string;
}

export interface NetWorthProgressionParams {
  startingAge: number;
  startingBalance: number;
  annualReturn: number;
  retirementReturn: number;
  inflationRate: number;
  endAge: number;
  retirementAge?: number;
}

export interface NetWorthProgression {
  [age: number]: number;
}

export interface WithdrawalsProgression {
  [age: number]: number;
}

export interface ProgressionResult {
  netWorthByAge: NetWorthProgression;
  withdrawalsByAge: WithdrawalsProgression;
  valid: boolean;
  error?: string;
}

export interface FinancialConstants {
  WITHDRAWAL_RATE: number;
  MIN_STARTING_AGE: number;
  MAX_RETIREMENT_AGE: number;
  MIN_RETIREMENT_AGE: number;
  MIN_INCOME: number;
  MIN_STARTING_BALANCE: number;
  MAX_INFLATION_RATE: number;
  MIN_RETURN_RATE: number;
  MAX_RETURN_RATE: number;
}

// Default constants
const DEFAULT_CONSTANTS: FinancialConstants = {
  WITHDRAWAL_RATE: 0.04,
  MIN_STARTING_AGE: 18,
  MAX_RETIREMENT_AGE: 100,
  MIN_RETIREMENT_AGE: 30,
  MIN_INCOME: 1000,
  MIN_STARTING_BALANCE: 0,
  MAX_INFLATION_RATE: 0.2,
  MIN_RETURN_RATE: -0.5,
  MAX_RETURN_RATE: 0.3,
};

export class FinancialCalculations {
  /**
   * Format number as currency without symbol (for clean display)
   */
  static formatCurrency(amount: number): string {
    return Math.round(amount).toLocaleString();
  }

  /**
   * Parse currency input (handles $ symbols and commas)
   */
  static parseCurrency(value: string | number): number {
    if (typeof value === 'string') {
      return parseFloat(value.replace(/[$,]/g, '')) || 0;
    }
    return value || 0;
  }

  /**
   * Calculate future value with compound interest
   */
  static futureValue(presentValue: number, rate: number, periods: number): number {
    return presentValue * Math.pow(1 + rate, periods);
  }

  /**
   * Calculate present value (reverse of future value)
   */
  static presentValue(futureValue: number, rate: number, periods: number): number {
    return futureValue / Math.pow(1 + rate, periods);
  }

  /**
   * Calculate required payment (PMT) using the annuity formula
   * PMT = (FV - PV * (1 + r)^n) / (((1 + r)^n - 1) / r)
   */
  static calculateRequiredPayment(
    presentValue: number,
    futureValue: number,
    rate: number,
    periods: number
  ): number {
    if (periods <= 0) return 0;
    
    if (rate === 0) {
      return (futureValue - presentValue) / periods;
    }
    
    const factor = Math.pow(1 + rate, periods);
    const numerator = futureValue - presentValue * factor;
    const denominator = (factor - 1) / rate;
    return numerator / denominator;
  }
  
  /**
   * Calculate required monthly payment with monthly compounding
   */
  static calculateRequiredMonthlyPayment(
    presentValue: number,
    futureValue: number,
    annualRate: number,
    years: number
  ): number {
    const months = years * 12;
    const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1;
    
    return this.calculateRequiredPayment(presentValue, futureValue, monthlyRate, months);
  }

  /**
   * Calculate inflation-adjusted income
   */
  static inflationAdjustedIncome(baseIncome: number, inflationRate: number, years: number): number {
    return baseIncome * Math.pow(1 + inflationRate, years);
  }

  /**
   * Calculate portfolio size needed for withdrawal rule
   */
  static portfolioSizeForWithdrawal(annualIncome: number, withdrawalRate?: number): number {
    const rate = withdrawalRate || DEFAULT_CONSTANTS.WITHDRAWAL_RATE;
    return annualIncome / rate;
  }

  /**
   * Get financial constants with fallbacks
   */
  private static getConstants(): FinancialConstants {
    // In a browser environment, try to get from window.FinancialConstants
    interface WindowWithConstants extends Window {
      FinancialConstants?: Partial<FinancialConstants>;
    }
    
    if (typeof window !== 'undefined' && (window as WindowWithConstants).FinancialConstants) {
      const windowConstants = (window as WindowWithConstants).FinancialConstants!;
      return { ...DEFAULT_CONSTANTS, ...windowConstants };
    }
    return DEFAULT_CONSTANTS;
  }

  /**
   * Calculate a single retirement scenario
   */
  static calculateScenario(params: ScenarioParams): ScenarioResult {
    try {
      // Validate input parameters
      if (!params || typeof params !== 'object') {
        throw new Error('Invalid parameters object');
      }

      const {
        startingAge,
        retirementAge,
        targetIncome,
        startingBalance,
        inflationRate,
        annualReturn
      } = params;

      // Get constants (with fallbacks for safety)
      const constants = this.getConstants();

      // Validate required parameters using constants
      if (typeof startingAge !== 'number' || startingAge < constants.MIN_STARTING_AGE || startingAge > constants.MAX_RETIREMENT_AGE) {
        throw new Error(`Invalid startingAge: ${startingAge}`);
      }
      if (typeof retirementAge !== 'number' || retirementAge < constants.MIN_RETIREMENT_AGE || retirementAge > constants.MAX_RETIREMENT_AGE) {
        throw new Error(`Invalid retirementAge: ${retirementAge}`);
      }
      if (typeof targetIncome !== 'number' || targetIncome < constants.MIN_INCOME) {
        throw new Error(`Invalid targetIncome: ${targetIncome}`);
      }
      if (typeof startingBalance !== 'number' || startingBalance < constants.MIN_STARTING_BALANCE) {
        throw new Error(`Invalid startingBalance: ${startingBalance}`);
      }
      if (typeof inflationRate !== 'number' || inflationRate < 0 || inflationRate > constants.MAX_INFLATION_RATE) {
        throw new Error(`Invalid inflationRate: ${inflationRate}`);
      }
      if (typeof annualReturn !== 'number' || annualReturn < constants.MIN_RETURN_RATE || annualReturn > constants.MAX_RETURN_RATE) {
        throw new Error(`Invalid annualReturn: ${annualReturn}`);
      }

      const yearsUntilRetirement = retirementAge - startingAge;
      
      if (yearsUntilRetirement <= 0) {
        return {
          yearsUntilRetirement: 0,
          targetPortfolioSize: 0,
          monthlyContribution: 0,
          inflatedTargetIncome: targetIncome,
          annualContribution: 0,
          valid: false,
          error: 'Retirement age must be greater than starting age'
        };
      }
    
      // Calculate inflation-adjusted target income at retirement
      const inflatedTargetIncome = this.inflationAdjustedIncome(
        targetIncome, 
        inflationRate, 
        yearsUntilRetirement
      );
      
      // Portfolio size needed (using 4% withdrawal rule)
      const targetPortfolioSize = this.portfolioSizeForWithdrawal(inflatedTargetIncome);
      
      // Calculate required monthly contribution using monthly compounding
      const monthlyContribution = this.calculateRequiredMonthlyPayment(
        startingBalance, 
        targetPortfolioSize, 
        annualReturn, 
        yearsUntilRetirement
      );
      
      const annualContribution = monthlyContribution * 12;

      return {
        yearsUntilRetirement,
        targetPortfolioSize,
        monthlyContribution: monthlyContribution, // Allow negative for Coast FIRE
        inflatedTargetIncome,
        annualContribution: annualContribution, // Allow negative for Coast FIRE
        valid: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in calculateScenario:', errorMessage, params);
      return {
        yearsUntilRetirement: 0,
        targetPortfolioSize: 0,
        monthlyContribution: 0,
        inflatedTargetIncome: params?.targetIncome || 0,
        annualContribution: 0,
        valid: false,
        error: errorMessage
      };
    }
  }
}

// Export default only to avoid conflicts
export default FinancialCalculations;

// For backward compatibility with existing code
if (typeof window !== 'undefined') {
  interface WindowWithFinancialCalculations extends Window {
    FinancialCalculations?: typeof FinancialCalculations;
  }
  (window as WindowWithFinancialCalculations).FinancialCalculations = FinancialCalculations;
}