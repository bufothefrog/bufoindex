// Core data models for paycheck allocation calculator

export interface IncomeData {
  // Per-paycheck amounts (what users actually see)
  grossPaycheck: number;
  netPaycheck: number;
  frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  
  // Bonus tracking
  regularBonus: boolean;
  bonusAmount: number; // Average per bonus
  bonusFrequency: 'quarterly' | 'annual' | 'irregular';
  
  // Calculated monthly values for backend calculations
  monthlyGross: number;
  monthlyNet: number;
  
  // Legacy fields for backward compatibility (computed from paycheck values)
  gross: number;
  net: number;
  bonusExpected: number; // Converted to monthly equivalent
}

export interface TaxData {
  federalBracket: number; // 0.10, 0.12, 0.22, etc.
  state: string; // State code for tax calculations
  filingStatus: 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold';
  currentWithholding: {
    federal: number;
    state: number;
    fica: number;
  };
}

export interface EmployerBenefits {
  available: boolean;
  matchPercent: number; // 0.50 for 50% match
  matchLimit: number; // 0.06 for up to 6% of salary
  currentContribution: number; // Total current percentage (for backward compatibility)
  contributionType: 'traditional' | 'roth' | 'split'; // Type of employee contribution
  traditionalContribution: number; // Traditional (pre-tax) percentage
  rothContribution: number; // Roth (after-tax) percentage
  afterTaxAvailable: boolean; // Mega backdoor Roth
  currentYTD: number; // Year-to-date contributions
}

export interface HSABenefits {
  eligible: boolean;
  employerContribution: number; // Annual employer contribution
  currentContribution: number; // Monthly personal contribution
  currentYTD: number; // Year-to-date contributions
  coverageType: 'individual' | 'family';
  investmentStrategy: boolean; // True if using HSA as investment (saving receipts)
}

export interface IRAData {
  hasIRA: boolean;
  accountTypes: {
    traditional: boolean;
    roth: boolean;
  };
  currentContributions: {
    traditional: number; // Monthly amount
    roth: number;        // Monthly amount
  };
  currentBalances: {
    traditional: number;
    roth: number;
  };
}

export interface BenefitsData {
  employer401k: EmployerBenefits;
  hsa: HSABenefits;
  ira: IRAData;
  other: {
    fsaElection: number;
    transitBenefits: number;
    lifeInsurance: number;
  };
}

export interface DebtData {
  id: string;
  name: string;
  balance: number;
  interestRate: number; // 0.035 for 3.5%
  minimumPayment: number;
  extraPayment: number;
  taxDeductible: boolean;
}

export interface UserPreferences {
  emergencyFundMonths: number; // 0-12
  currentEmergencyFund: number;
  emergencyFundAPY: number; // 0.04 for 4.0% HYSA
  necessaryExpenses: number; // Monthly necessary expenses
  funMoney: {
    min: number;
    max: number;
    current: number;
  };
  age: number; // 18-100
  hasTaxableAccount: boolean; // Has brokerage/investment account
  taxableAccountContribution: number; // Monthly contribution to taxable accounts
  isPeakEarnings: boolean; // Are they in/approaching peak earning years?
  expectedRetirementBracket?: number; // Optional expected retirement tax bracket
  riskTolerance: 'conservative' | 'moderate' | 'optimizer';
  optimizationGoal: 'tax_minimization' | 'wealth_maximization' | 'balanced';
}

export interface PaycheckProfile {
  // Core financial data
  income: IncomeData;
  taxes: TaxData;
  benefits: BenefitsData;
  debts: DebtData[];
  preferences: UserPreferences;
  
  // Metadata
  version: string;
  lastUpdated: number;
  source: 'user_input' | 'imported' | 'shared';
}

// Calculation results

export interface AllocationItem {
  id: string;
  account: string;
  amount: number; // Per-paycheck amount
  percentage: number; // Percentage of net paycheck
  priority: number;
  reasoning: string;
  taxImpact: number; // Per-paycheck tax impact
  category: 'employer_match' | 'high_interest_debt' | 'tax_advantaged' | 'tax_optimization' | 'investment' | 'emergency_fund' | 'debt_payoff';
  implementation: string; // How to implement this recommendation (in per-paycheck terms)
  monthlyEquivalent?: number; // Monthly amount for reference
  annualEquivalent?: number; // Annual amount for reference
}

export interface SkippedItem {
  id: string;
  item: string;
  reason: string;
  opportunityCost: {
    monthly: number;
    annual: number;
    tenYear?: number;
    twentyYear?: number;
  };
  alternative: string;
  riskLevel: 'low' | 'medium' | 'high';
  education?: string;
}

export interface ProjectionData {
  currentPath: {
    tenYear: number;
    taxesOwed: number;
    fiAge: number;
  };
  optimizedPath: {
    tenYear: number;
    taxesOwed: number;
    fiAge: number;
  };
  improvement: {
    tenYear: number;
    annualTaxSavings: number;
    fiYearsEarlier: number;
  };
}

export interface OptimizationScore {
  overall: number; // 0-100
  breakdown: {
    taxEfficiency: number;
    employerBenefits: number;
    debtStrategy: number;
    emergencyFundSize: number;
    accountPrioritization: number;
  };
  comparison: number; // Score with current strategy
}

export interface AllocationResult {
  allocations: AllocationItem[];
  skippedItems: SkippedItem[];
  projections: ProjectionData;
  optimizationScore: OptimizationScore;
  funMoneyAllocated: number; // Monthly amount for compatibility
  funMoneyRange: {
    min: number;
    max: number;
    difference: number;
  };
  remainingAmount: number; // Now per-paycheck amount
  paycheckContext?: {
    netPaycheck: number;
    frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
    necessaryExpensesPerPaycheck: number;
    funMoneyPerPaycheck: number;
    availablePerPaycheck: number;
  };
}

// UI State interfaces

export interface CalculatorState {
  profile: PaycheckProfile;
  result: AllocationResult | null;
  isCalculating: boolean;
  activeSection: string;
  showAdvanced: boolean;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

// Export data structure for future cross-calculator integration
export interface ExportableData {
  version: string;
  timestamp: number;
  profile: PaycheckProfile;
  result?: AllocationResult;
  metadata: {
    source: string;
    calculatorVersion: string;
  };
}

// Constants - imported from single source of truth
import {
  FEDERAL_TAX_BRACKETS_2026,
  CONTRIBUTION_LIMITS_2026,
} from '../constants/irs-2026';

// Re-export with legacy keyed structure for backward compatibility
export const TAX_BRACKETS = {
  2026: {
    single: FEDERAL_TAX_BRACKETS_2026.single,
    marriedJoint: FEDERAL_TAX_BRACKETS_2026.marriedFilingJointly,
  }
} as const;

export const CONTRIBUTION_LIMITS = {
  2026: CONTRIBUTION_LIMITS_2026,
} as const;

// State income tax rates moved to lib/constants/states-2026.ts
// (single source of truth). Import STATE_TAX_RATES from there.