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

// Constants and enums
export const TAX_BRACKETS = {
  2024: {
    single: [
      { min: 0, max: 11600, rate: 0.10 },
      { min: 11600, max: 47150, rate: 0.12 },
      { min: 47150, max: 100525, rate: 0.22 },
      { min: 100525, max: 191950, rate: 0.24 },
      { min: 191950, max: 243725, rate: 0.32 },
      { min: 243725, max: 609350, rate: 0.35 },
      { min: 609350, max: Infinity, rate: 0.37 },
    ],
    marriedJoint: [
      { min: 0, max: 23200, rate: 0.10 },
      { min: 23200, max: 94300, rate: 0.12 },
      { min: 94300, max: 201050, rate: 0.22 },
      { min: 201050, max: 383900, rate: 0.24 },
      { min: 383900, max: 487450, rate: 0.32 },
      { min: 487450, max: 731200, rate: 0.35 },
      { min: 731200, max: Infinity, rate: 0.37 },
    ],
  }
} as const;

export const CONTRIBUTION_LIMITS = {
  2024: {
    ira: 7000,
    roth401k: 23000,
    traditional401k: 23000,
    hsa: {
      individual: 4150,
      family: 8300,
    },
    catchUp: {
      ira: 1000, // Age 50+
      '401k': 7500, // Age 50+
      hsa: 1000, // Age 55+
    },
  }
} as const;

export const STATE_TAX_RATES = {
  // 2025 State Income Tax Rates - Marginal rates for middle income earners
  AL: { rate: 0.05, hasStateTax: true, name: 'Alabama' },
  AK: { rate: 0, hasStateTax: false, name: 'Alaska' },
  AZ: { rate: 0.042, hasStateTax: true, name: 'Arizona' },
  AR: { rate: 0.055, hasStateTax: true, name: 'Arkansas' },
  CA: { rate: 0.093, hasStateTax: true, name: 'California' },
  CO: { rate: 0.044, hasStateTax: true, name: 'Colorado' },
  CT: { rate: 0.06, hasStateTax: true, name: 'Connecticut' },
  DE: { rate: 0.052, hasStateTax: true, name: 'Delaware' },
  DC: { rate: 0.06, hasStateTax: true, name: 'District of Columbia' },
  FL: { rate: 0, hasStateTax: false, name: 'Florida' },
  GA: { rate: 0.0575, hasStateTax: true, name: 'Georgia' },
  HI: { rate: 0.075, hasStateTax: true, name: 'Hawaii' },
  ID: { rate: 0.058, hasStateTax: true, name: 'Idaho' },
  IL: { rate: 0.0495, hasStateTax: true, name: 'Illinois' },
  IN: { rate: 0.032, hasStateTax: true, name: 'Indiana' },
  IA: { rate: 0.0648, hasStateTax: true, name: 'Iowa' },
  KS: { rate: 0.057, hasStateTax: true, name: 'Kansas' },
  KY: { rate: 0.045, hasStateTax: true, name: 'Kentucky' },
  LA: { rate: 0.0425, hasStateTax: true, name: 'Louisiana' },
  ME: { rate: 0.0715, hasStateTax: true, name: 'Maine' },
  MD: { rate: 0.051, hasStateTax: true, name: 'Maryland' },
  MA: { rate: 0.05, hasStateTax: true, name: 'Massachusetts' },
  MI: { rate: 0.0425, hasStateTax: true, name: 'Michigan' },
  MN: { rate: 0.0785, hasStateTax: true, name: 'Minnesota' },
  MS: { rate: 0.04, hasStateTax: true, name: 'Mississippi' },
  MO: { rate: 0.054, hasStateTax: true, name: 'Missouri' },
  MT: { rate: 0.0675, hasStateTax: true, name: 'Montana' },
  NE: { rate: 0.0564, hasStateTax: true, name: 'Nebraska' },
  NV: { rate: 0, hasStateTax: false, name: 'Nevada' },
  NH: { rate: 0, hasStateTax: false, name: 'New Hampshire' },
  NJ: { rate: 0.0637, hasStateTax: true, name: 'New Jersey' },
  NM: { rate: 0.049, hasStateTax: true, name: 'New Mexico' },
  NY: { rate: 0.065, hasStateTax: true, name: 'New York' },
  NC: { rate: 0.0475, hasStateTax: true, name: 'North Carolina' },
  ND: { rate: 0.0227, hasStateTax: true, name: 'North Dakota' },
  OH: { rate: 0.0399, hasStateTax: true, name: 'Ohio' },
  OK: { rate: 0.05, hasStateTax: true, name: 'Oklahoma' },
  OR: { rate: 0.087, hasStateTax: true, name: 'Oregon' },
  PA: { rate: 0.0307, hasStateTax: true, name: 'Pennsylvania' },
  RI: { rate: 0.0475, hasStateTax: true, name: 'Rhode Island' },
  SC: { rate: 0.06, hasStateTax: true, name: 'South Carolina' },
  SD: { rate: 0, hasStateTax: false, name: 'South Dakota' },
  TN: { rate: 0, hasStateTax: false, name: 'Tennessee' },
  TX: { rate: 0, hasStateTax: false, name: 'Texas' },
  UT: { rate: 0.0495, hasStateTax: true, name: 'Utah' },
  VT: { rate: 0.066, hasStateTax: true, name: 'Vermont' },
  VA: { rate: 0.0575, hasStateTax: true, name: 'Virginia' },
  WA: { rate: 0, hasStateTax: false, name: 'Washington' },
  WV: { rate: 0.054, hasStateTax: true, name: 'West Virginia' },
  WI: { rate: 0.0627, hasStateTax: true, name: 'Wisconsin' },
  WY: { rate: 0, hasStateTax: false, name: 'Wyoming' }
} as const;