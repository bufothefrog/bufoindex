/**
 * Advanced Financial Modeling Module
 * Comprehensive tax, Social Security, and healthcare cost calculations
 * for real-world retirement planning scenarios
 */

import {
  FEDERAL_TAX_BRACKETS_2026,
  STANDARD_DEDUCTIONS_2026,
} from '../constants/irs-2026';

// Type definitions
export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxBrackets {
  single: TaxBracket[];
  marriedFilingJointly: TaxBracket[];
  marriedFilingSeparately?: TaxBracket[];
  headOfHousehold?: TaxBracket[];
}

export interface StandardDeductions {
  single: number;
  marriedFilingJointly: number;
  marriedFilingSeparately: number;
  headOfHousehold: number;
}

export type FilingStatus = 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold';

export interface TaxCalculationResult {
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  afterTaxIncome: number;
}

export interface SocialSecurityBenefitResult {
  monthlyBenefit: number;
  annualBenefit: number;
  totalLifetimeBenefit: number;
  breakEvenAge: number;
  optimized: boolean;
}

export interface HealthcareCostProjection {
  annualCost: number;
  totalLifetimeCost: number;
  medicalInflationAdjusted: number;
  ltcInsuranceNeeded: boolean;
}

export class FinancialModeling {
  // Imported from single source of truth (lib/constants/irs-2026.ts)
  static readonly FEDERAL_TAX_BRACKETS: TaxBrackets = {
    single: [...FEDERAL_TAX_BRACKETS_2026.single],
    marriedFilingJointly: [...FEDERAL_TAX_BRACKETS_2026.marriedFilingJointly],
  };

  static readonly STANDARD_DEDUCTIONS: StandardDeductions = { ...STANDARD_DEDUCTIONS_2026 };

  /**
   * 2024 California State Tax Brackets
   */
  static readonly CA_TAX_BRACKETS: TaxBrackets = {
    single: [
      { min: 0, max: 10099, rate: 0.01 },
      { min: 10099, max: 23942, rate: 0.02 },
      { min: 23942, max: 37788, rate: 0.04 },
      { min: 37788, max: 52455, rate: 0.06 },
      { min: 52455, max: 66295, rate: 0.08 },
      { min: 66295, max: 338639, rate: 0.093 },
      { min: 338639, max: 406364, rate: 0.103 },
      { min: 406364, max: 677278, rate: 0.113 },
      { min: 677278, max: Infinity, rate: 0.133 }
    ],
    marriedFilingJointly: [
      { min: 0, max: 20198, rate: 0.01 },
      { min: 20198, max: 47884, rate: 0.02 },
      { min: 47884, max: 75576, rate: 0.04 },
      { min: 75576, max: 104910, rate: 0.06 },
      { min: 104910, max: 132590, rate: 0.08 },
      { min: 132590, max: 677278, rate: 0.093 },
      { min: 677278, max: 812728, rate: 0.103 },
      { min: 812728, max: 1354556, rate: 0.113 },
      { min: 1354556, max: Infinity, rate: 0.133 }
    ]
  };

  /**
   * California Standard Deductions (2025 - estimated from 2024 base with inflation adjustment)
   */
  static readonly CA_STANDARD_DEDUCTIONS: StandardDeductions = {
    single: 5202,
    marriedFilingJointly: 10404,
    marriedFilingSeparately: 5202,
    headOfHousehold: 10726
  };

  /**
   * Calculate tax using progressive tax brackets
   */
  static calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
    if (income <= 0) return 0;
    
    let tax = 0;
    
    for (const bracket of brackets) {
      if (income <= bracket.min) break;
      
      const taxableInThisBracket = Math.min(income, bracket.max) - bracket.min;
      tax += taxableInThisBracket * bracket.rate;
    }
    
    return Math.round(tax);
  }

  /**
   * Calculate federal income tax
   */
  static calculateFederalTax(income: number, filingStatus: FilingStatus, year: number = 2026): number {
    if (year !== 2026) {
      console.warn(`Tax calculation only supports 2026 tax year, got ${year}`);
    }
    
    const standardDeduction = this.STANDARD_DEDUCTIONS[filingStatus];
    const taxableIncome = Math.max(0, income - standardDeduction);
    
    const brackets = filingStatus === 'marriedFilingJointly' 
      ? this.FEDERAL_TAX_BRACKETS.marriedFilingJointly
      : this.FEDERAL_TAX_BRACKETS.single;
    
    return this.calculateProgressiveTax(taxableIncome, brackets);
  }

  /**
   * Calculate California state income tax
   */
  static calculateCaliforniaTax(income: number, filingStatus: FilingStatus): number {
    const standardDeduction = this.CA_STANDARD_DEDUCTIONS[filingStatus];
    const taxableIncome = Math.max(0, income - standardDeduction);
    
    const brackets = filingStatus === 'marriedFilingJointly' 
      ? this.CA_TAX_BRACKETS.marriedFilingJointly
      : this.CA_TAX_BRACKETS.single;
    
    return this.calculateProgressiveTax(taxableIncome, brackets);
  }

  /**
   * Calculate comprehensive tax analysis
   */
  static calculateTaxAnalysis(
    income: number, 
    filingStatus: FilingStatus, 
    state: string = 'CA'
  ): TaxCalculationResult {
    const federalTax = this.calculateFederalTax(income, filingStatus);
    let stateTax = 0;
    
    // Only California implemented for now
    if (state.toUpperCase() === 'CA') {
      stateTax = this.calculateCaliforniaTax(income, filingStatus);
    }
    
    const totalTax = federalTax + stateTax;
    const afterTaxIncome = income - totalTax;
    const effectiveRate = income > 0 ? totalTax / income : 0;
    
    // Calculate marginal rate
    const marginalRate = this.calculateMarginalTaxRate(income, filingStatus, state);
    
    return {
      federalTax,
      stateTax,
      totalTax,
      effectiveRate,
      marginalRate,
      afterTaxIncome
    };
  }

  /**
   * Calculate marginal tax rate
   */
  static calculateMarginalTaxRate(
    income: number, 
    filingStatus: FilingStatus, 
    state: string = 'CA'
  ): number {
    // Find the marginal bracket for federal tax
    const federalBrackets = filingStatus === 'marriedFilingJointly' 
      ? this.FEDERAL_TAX_BRACKETS.marriedFilingJointly
      : this.FEDERAL_TAX_BRACKETS.single;
    
    let federalMarginalRate = 0;
    const federalTaxableIncome = Math.max(0, income - this.STANDARD_DEDUCTIONS[filingStatus]);
    
    for (const bracket of federalBrackets) {
      if (federalTaxableIncome > bracket.min) {
        federalMarginalRate = bracket.rate;
      } else {
        break;
      }
    }
    
    // Find the marginal bracket for state tax
    let stateMarginalRate = 0;
    if (state.toUpperCase() === 'CA') {
      const stateBrackets = filingStatus === 'marriedFilingJointly' 
        ? this.CA_TAX_BRACKETS.marriedFilingJointly
        : this.CA_TAX_BRACKETS.single;
      
      const stateTaxableIncome = Math.max(0, income - this.CA_STANDARD_DEDUCTIONS[filingStatus]);
      
      for (const bracket of stateBrackets) {
        if (stateTaxableIncome > bracket.min) {
          stateMarginalRate = bracket.rate;
        } else {
          break;
        }
      }
    }
    
    return federalMarginalRate + stateMarginalRate;
  }

  /**
   * Validate BufoIndex contrarian tax philosophy
   * Returns true if tax situation supports aggressive investment over conservative approach
   */
  static validateTaxOptimizationStrategy(income: number, filingStatus: FilingStatus): {
    shouldMaxTaxAdvantaged: boolean;
    marginalRate: number;
    taxSavingsOpportunity: number;
    reasoning: string;
  } {
    const marginalRate = this.calculateMarginalTaxRate(income, filingStatus);
    
    // BufoIndex philosophy: If marginal rate > 22%, prioritize tax-advantaged accounts
    const shouldMaxTaxAdvantaged = marginalRate > 0.22;
    
    // Calculate tax savings on $1000 contribution
    const taxSavingsOpportunity = 1000 * marginalRate;
    
    let reasoning = '';
    if (shouldMaxTaxAdvantaged) {
      reasoning = `At ${(marginalRate * 100).toFixed(1)}% marginal rate, every $1000 in tax-advantaged savings provides $${taxSavingsOpportunity.toFixed(0)} immediate tax benefit. Prioritize 401k/IRA over taxable investing.`;
    } else {
      reasoning = `At ${(marginalRate * 100).toFixed(1)}% marginal rate, tax advantages are moderate. Focus on flexibility and diversification across account types.`;
    }
    
    return {
      shouldMaxTaxAdvantaged,
      marginalRate,
      taxSavingsOpportunity,
      reasoning
    };
  }

  /**
   * Calculate opportunity cost of emergency fund vs investment
   * Core BufoIndex contrarian principle: Emergency fund should be minimal
   */
  static calculateEmergencyFundOpportunityCost(
    monthlyExpenses: number,
    emergencyMonths: number,
    expectedReturn: number = 0.07,
    timeHorizon: number = 30
  ): {
    emergencyFundSize: number;
    opportunityCost: number;
    recommendedMonths: number;
    reasoning: string;
  } {
    const emergencyFundSize = monthlyExpenses * emergencyMonths;
    
    // Calculate what this money would grow to if invested
    const futureValueIfInvested = emergencyFundSize * Math.pow(1 + expectedReturn, timeHorizon);
    const opportunityCost = futureValueIfInvested - emergencyFundSize;
    
    // BufoIndex recommendation: Maximum 3 months emergency fund
    const recommendedMonths = Math.min(emergencyMonths, 3);
    
    const reasoning = emergencyMonths > 3 
      ? `Emergency fund of ${emergencyMonths} months (${this.formatCurrency(emergencyFundSize)}) costs ${this.formatCurrency(opportunityCost)} in opportunity cost over ${timeHorizon} years. BufoIndex recommends max 3 months emergency fund.`
      : `Emergency fund of ${emergencyMonths} months aligns with BufoIndex philosophy of maximizing investment returns.`;
    
    return {
      emergencyFundSize,
      opportunityCost,
      recommendedMonths,
      reasoning
    };
  }

  /**
   * Helper function to format currency
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

// Export default only to avoid conflicts
export default FinancialModeling;

// For backward compatibility with existing code
if (typeof window !== 'undefined') {
  interface WindowWithFinancialModeling extends Window {
    FinancialModeling?: typeof FinancialModeling;
  }
  (window as WindowWithFinancialModeling).FinancialModeling = FinancialModeling;
}