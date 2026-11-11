/**
 * Type-Safe Test Data Factory
 * 
 * Generates complete, valid test data that matches production interfaces.
 * Root cause solution: Ensures all required fields are included and properly typed.
 */

import type { 
  PaycheckProfile, 
  IncomeData, 
  TaxData, 
  BenefitsData, 
  DebtData, 
  UserPreferences,
  EmployerBenefits,
  HSABenefits,
  IRAData
} from '@/lib/types'

/**
 * Complete DebtData factory with all required fields
 */
export function createDebtData(overrides: Partial<DebtData> = {}): DebtData {
  return {
    id: `debt-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Credit Card',
    balance: 5000,
    interestRate: 0.18, // 18%
    minimumPayment: 150,
    extraPayment: 0,
    taxDeductible: false,
    ...overrides
  }
}

/**
 * Complete IncomeData factory
 */
export function createIncomeData(overrides: Partial<IncomeData> = {}): IncomeData {
  return {
    net: 4500,
    grossPaycheck: 3000,
    netPaycheck: 2250,
    frequency: 'bi-weekly',
    regularBonus: false,
    bonusAmount: 0,
    bonusFrequency: 'annual',
    monthlyGross: 6500,
    monthlyNet: 4500,
    gross: 78000,
    bonusExpected: 0,
    ...overrides
  }
}

/**
 * Complete TaxData factory
 */
export function createTaxData(overrides: Partial<TaxData> = {}): TaxData {
  return {
    federalBracket: 0.12, // 12% tax bracket
    state: 'CA',
    filingStatus: 'single',
    currentWithholding: {
      federal: 850,
      state: 300,
      fica: 497.25 // Social Security + Medicare
    },
    ...overrides
  }
}

/**
 * Complete EmployerBenefits factory
 */
export function createEmployerBenefits(overrides: Partial<EmployerBenefits> = {}): EmployerBenefits {
  return {
    available: true,
    matchPercent: 0.50, // 50% match
    matchLimit: 0.06, // Up to 6% of salary
    currentContribution: 0.06, // Contributing 6%
    contributionType: 'traditional', // Default to traditional
    traditionalContribution: 0.06, // Contributing 6% traditional
    rothContribution: 0.00, // No Roth contribution by default
    afterTaxAvailable: false, // Mega backdoor Roth
    currentYTD: 3600, // Year-to-date contributions
    ...overrides
  }
}

/**
 * Complete HSABenefits factory
 */
export function createHSABenefits(overrides: Partial<HSABenefits> = {}): HSABenefits {
  return {
    eligible: true,
    employerContribution: 500, // Annual employer contribution
    currentContribution: 200, // Monthly personal contribution
    currentYTD: 1200, // Year-to-date contributions
    coverageType: 'individual',
    investmentStrategy: false,
    ...overrides
  }
}

/**
 * Complete IRAData factory
 */
export function createIRAData(overrides: Partial<IRAData> = {}): IRAData {
  return {
    hasIRA: true,
    accountTypes: {
      traditional: true,
      roth: true
    },
    currentContributions: {
      traditional: 0, // Monthly contribution
      roth: 500 // Monthly contribution
    },
    currentBalances: {
      traditional: 12000,
      roth: 8000
    },
    ...overrides
  }
}

/**
 * Complete BenefitsData factory
 */
export function createBenefitsData(overrides: Partial<BenefitsData> = {}): BenefitsData {
  return {
    employer401k: createEmployerBenefits(overrides.employer401k),
    hsa: createHSABenefits(overrides.hsa),
    ira: createIRAData(overrides.ira),
    other: {
      fsaElection: 0,
      transitBenefits: 0,
      lifeInsurance: 25,
      ...(overrides.other || {})
    },
    ...overrides
  }
}

/**
 * Complete UserPreferences factory
 */
export function createUserPreferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    emergencyFundMonths: 3,
    currentEmergencyFund: 9000,
    emergencyFundAPY: 0.045, // 4.5% HYSA
    necessaryExpenses: 3000,
    funMoney: {
      min: 200,
      max: 500,
      current: 350
    },
    age: 28,
    isPeakEarnings: false,
    expectedRetirementBracket: 0.12, // 12% tax bracket in retirement
    riskTolerance: 'moderate',
    optimizationGoal: 'wealth_maximization',
    hasTaxableAccount: false,
    taxableAccountContribution: 0,
    ...(overrides.funMoney && { funMoney: { ...createUserPreferences().funMoney, ...overrides.funMoney } }),
    ...overrides
  }
}

/**
 * Complete PaycheckProfile factory with all required fields
 */
export function createPaycheckProfile(overrides: Partial<PaycheckProfile> = {}): PaycheckProfile {
  return {
    income: createIncomeData(overrides.income),
    taxes: createTaxData(overrides.taxes),
    benefits: createBenefitsData(overrides.benefits),
    debts: overrides.debts || [createDebtData()],
    preferences: createUserPreferences(overrides.preferences),
    version: '2.0',
    lastUpdated: Date.now(),
    source: 'user_input',
    ...overrides
  }
}
