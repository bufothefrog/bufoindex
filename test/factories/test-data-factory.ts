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

/**
 * Specialized factories for common test scenarios
 */
export const TestDataFactories = {
  /**
   * High-income profile for testing mega backdoor scenarios
   */
  highIncomeProfile: (): PaycheckProfile => createPaycheckProfile({
    income: createIncomeData({
      gross: 180000,
      monthlyGross: 15000,
      monthlyNet: 10000
    }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({
        afterTaxAvailable: true,
        currentContribution: 0.23 // Contributing 23% annually
      })
    })
  }),

  /**
   * Profile with high-interest debt for testing debt payoff scenarios
   */
  profileWithHighInterestDebt: (): PaycheckProfile => createPaycheckProfile({
    debts: [
      createDebtData({ 
        name: 'Credit Card 1', 
        balance: 8000, 
        interestRate: 0.24, // 24% APR
        minimumPayment: 240 
      }),
      createDebtData({ 
        name: 'Credit Card 2', 
        balance: 3000, 
        interestRate: 0.19, // 19% APR
        minimumPayment: 90 
      })
    ]
  }),

  /**
   * Profile with no debt for testing investment scenarios
   */
  noDebtProfile: (): PaycheckProfile => createPaycheckProfile({
    debts: []
  }),

  /**
   * Profile with tax-deductible debt (mortgage)
   */
  profileWithMortgage: (): PaycheckProfile => createPaycheckProfile({
    debts: [
      createDebtData({
        name: 'Mortgage',
        balance: 350000,
        interestRate: 0.065, // 6.5% APR
        minimumPayment: 2100,
        taxDeductible: true
      })
    ]
  }),

  /**
   * Minimal profile for basic testing
   */
  minimalProfile: (): PaycheckProfile => createPaycheckProfile({
    income: createIncomeData({
      gross: 50000,
      monthlyGross: 4167,
      monthlyNet: 3000
    }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({ available: false }),
      hsa: createHSABenefits({ eligible: false })
    }),
    debts: []
  })
} as const

/**
 * Validation utilities to ensure test data matches production schemas
 */
export function validateTestData(profile: PaycheckProfile): boolean {
  try {
    // Type-level validation through TypeScript
    const validationTests = [
      // Required fields exist
      profile.income !== undefined,
      profile.taxes !== undefined,
      profile.benefits !== undefined,
      profile.debts !== undefined,
      profile.preferences !== undefined,
      profile.version !== undefined,
      profile.lastUpdated !== undefined,
      profile.source !== undefined,
      
      // Debt data has all required fields
      profile.debts.every(debt => 
        debt.id !== undefined &&
        debt.name !== undefined &&
        debt.balance !== undefined &&
        debt.interestRate !== undefined &&
        debt.minimumPayment !== undefined &&
        debt.extraPayment !== undefined &&
        debt.taxDeductible !== undefined
      ),
      
      // UserPreferences has all required fields
      profile.preferences.emergencyFundMonths !== undefined &&
      profile.preferences.currentEmergencyFund !== undefined &&
      profile.preferences.emergencyFundAPY !== undefined &&
      profile.preferences.necessaryExpenses !== undefined &&
      profile.preferences.funMoney !== undefined &&
      profile.preferences.age !== undefined &&
      profile.preferences.isPeakEarnings !== undefined &&
      profile.preferences.riskTolerance !== undefined &&
      profile.preferences.optimizationGoal !== undefined
    ]
    
    return validationTests.every(test => test)
  } catch (error) {
    console.error('Test data validation failed:', error)
    return false
  }
}