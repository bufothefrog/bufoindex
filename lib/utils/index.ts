import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { STATE_TAX_RATES } from '../types'

/**
 * Utility function for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format percentage for display
 */
export function formatPercent(decimal: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(decimal)
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[$,]/g, '')) || 0
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
 * Debounce function for input handling
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Calculate total marginal tax rate including federal, state, and FICA
 */
export function calculateMarginalTaxRate(federalRate: number, stateCode: string): number {
  // Use the imported STATE_TAX_RATES
  
  const stateRate = stateCode && STATE_TAX_RATES[stateCode as keyof typeof STATE_TAX_RATES] 
    ? STATE_TAX_RATES[stateCode as keyof typeof STATE_TAX_RATES].rate 
    : 0;
  
  const ficaRate = 0.0765; // Social Security (6.2%) + Medicare (1.45%)
  
  return federalRate + stateRate + ficaRate;
}

/**
 * Calculate state tax rate for a given state code
 */
export function getStateTaxRate(stateCode: string): number {
  // Use the imported STATE_TAX_RATES
  
  if (!stateCode || !STATE_TAX_RATES[stateCode as keyof typeof STATE_TAX_RATES]) {
    return 0;
  }
  
  return STATE_TAX_RATES[stateCode as keyof typeof STATE_TAX_RATES].rate;
}

/**
 * Format decimal years to years and months
 */
export function formatYearsAndMonths(decimalYears: number): string {
  if (decimalYears <= 0) return '0 years';
  
  const years = Math.floor(decimalYears);
  const remainingDecimal = decimalYears - years;
  const months = Math.round(remainingDecimal * 12);
  
  // Handle rounding edge case where months could be 12
  const adjustedYears = months === 12 ? years + 1 : years;
  const adjustedMonths = months === 12 ? 0 : months;
  
  if (adjustedYears === 0) {
    return `${adjustedMonths} month${adjustedMonths === 1 ? '' : 's'}`;
  } else if (adjustedMonths === 0) {
    return `${adjustedYears} year${adjustedYears === 1 ? '' : 's'}`;
  } else {
    return `${adjustedYears} year${adjustedYears === 1 ? '' : 's'} ${adjustedMonths} month${adjustedMonths === 1 ? '' : 's'}`;
  }
}

/**
 * URL State Management for sharing calculator states
 */

/**
 * Compress and encode data for URL hash
 */
export function encodeToUrlHash(data: unknown): string {
  try {
    // Compress the data by removing default values and unnecessary fields
    const compressed = compressCalculatorData(data)
    
    // Convert to JSON string and encode
    const jsonString = JSON.stringify(compressed)
    const base64 = btoa(jsonString)
    
    // Make URL-safe
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch (error) {
    console.error('Failed to encode data to URL hash:', error)
    return ''
  }
}

/**
 * Decode data from URL hash
 */
export function decodeFromUrlHash(hash: string): unknown | null {
  try {
    // Remove the # if present
    const cleanHash = hash.replace(/^#/, '')
    if (!cleanHash) return null
    
    // Restore base64 padding and decode
    const base64 = cleanHash.replace(/-/g, '+').replace(/_/g, '/') + '=='.substring(0, (4 - cleanHash.length % 4) % 4)
    const jsonString = atob(base64)
    const compressed = JSON.parse(jsonString)
    
    // Decompress the data by restoring defaults
    return decompressCalculatorData(compressed)
  } catch (error) {
    console.error('Failed to decode data from URL hash:', error)
    return null
  }
}

/**
 * Compress calculator data by removing defaults and reducing size
 */
function compressCalculatorData(data: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { profile, result } = data as { profile?: Record<string, any>; result?: unknown; }
  
  // Only include non-default values
  const compressed: Record<string, unknown> = {
    v: 1, // version
    p: {}, // profile
  }
  const p = compressed.p as Record<string, unknown>
  
  if (!profile) return compressed
  
  // Income (only if different from defaults)
  if (profile.income?.gross !== 0) p.ig = profile.income?.gross
  if (profile.income?.net !== 0) p.in = profile.income.net
  if (profile.income?.frequency !== 'monthly') p.if = profile.income.frequency
  if (profile.income.bonusExpected !== 0) p.ib = profile.income.bonusExpected
  
  // Taxes
  if (profile.taxes.state) p.ts = profile.taxes.state
  if (profile.taxes.filingStatus !== 'single') p.tf = profile.taxes.filingStatus
  
  // Benefits
  if (profile.benefits.employer401k.available) {
    p.b401 = {
      a: profile.benefits.employer401k.available,
      mp: profile.benefits.employer401k.matchPercent,
      ml: profile.benefits.employer401k.matchLimit,
      cc: profile.benefits.employer401k.currentContribution,
      ct: profile.benefits.employer401k.contributionType !== 'traditional' ? profile.benefits.employer401k.contributionType : undefined,
      tc: profile.benefits.employer401k.traditionalContribution !== 0 ? profile.benefits.employer401k.traditionalContribution : undefined,
      rc: profile.benefits.employer401k.rothContribution !== 0 ? profile.benefits.employer401k.rothContribution : undefined
    }
  }
  
  if (profile.benefits.hsa.eligible) {
    p.hsa = {
      e: profile.benefits.hsa.eligible,
      ct: profile.benefits.hsa.coverageType,
      cc: profile.benefits.hsa.currentContribution
    }
  }
  
  // Preferences
  const prefs: Record<string, unknown> = {}
  if (profile.preferences.necessaryExpenses !== 0) prefs.ne = profile.preferences.necessaryExpenses
  if (profile.preferences.currentEmergencyFund !== 0) prefs.ef = profile.preferences.currentEmergencyFund
  if (profile.preferences.emergencyFundAPY !== 0.04) prefs.apy = profile.preferences.emergencyFundAPY
  if (profile.preferences.funMoney.min !== 0) prefs.fmn = profile.preferences.funMoney.min
  if (profile.preferences.funMoney.max !== 0) prefs.fmx = profile.preferences.funMoney.max
  if (profile.preferences.age) prefs.age = profile.preferences.age
  if (profile.preferences.hasTaxableAccount) prefs.hta = profile.preferences.hasTaxableAccount
  if (profile.preferences.taxableAccountContribution !== 0) prefs.tac = profile.preferences.taxableAccountContribution
  if (profile.preferences.isPeakEarnings) prefs.peak = profile.preferences.isPeakEarnings
  if (profile.preferences.riskTolerance !== 'moderate') prefs.risk = profile.preferences.riskTolerance
  if (profile.preferences.optimizationGoal !== 'balanced') prefs.goal = profile.preferences.optimizationGoal
  
  if (Object.keys(prefs).length > 0) p.pr = prefs
  
  // Include debts if any
  if (profile.debts && profile.debts.length > 0) {
    p.debts = profile.debts.map((debt: { name?: string; balance?: number; interestRate?: number; minimumPayment?: number; }) => ({
      n: debt.name,
      b: debt.balance,
      r: debt.interestRate,
      mp: debt.minimumPayment
    }))
  }
  
  return compressed
}

/**
 * Decompress calculator data by restoring defaults
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decompressCalculatorData(compressed: any): any {
  if (compressed.v !== 1) {
    throw new Error('Unsupported data version')
  }
  
  const p = compressed.p || {}
  
  return {
    profile: {
      income: {
        gross: p.ig || 0,
        net: p.in || 0,
        frequency: p.if || 'monthly',
        bonusExpected: p.ib || 0
      },
      taxes: {
        federalBracket: 0.22, // Default bracket
        state: p.ts || '',
        filingStatus: p.tf || 'single',
        currentWithholding: {
          federal: 0,
          state: 0,
          fica: 0
        }
      },
      benefits: {
        employer401k: {
          available: p.b401?.a || false,
          matchPercent: p.b401?.mp || 0,
          matchLimit: p.b401?.ml || 0,
          currentContribution: p.b401?.cc || 0,
          contributionType: p.b401?.ct || 'traditional',
          traditionalContribution: p.b401?.tc || (p.b401?.ct === 'traditional' ? p.b401?.cc || 0 : 0),
          rothContribution: p.b401?.rc || (p.b401?.ct === 'roth' ? p.b401?.cc || 0 : 0),
          afterTaxAvailable: false,
          currentYTD: 0
        },
        hsa: {
          eligible: p.hsa?.e || false,
          employerContribution: 0,
          currentContribution: p.hsa?.cc || 0,
          currentYTD: 0,
          coverageType: p.hsa?.ct || 'individual'
        },
        other: {
          fsaElection: 0,
          transitBenefits: 0,
          lifeInsurance: 0
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debts: ((p.debts as any[] || [])).map((debt: any, index: number) => ({
        id: `debt-${index}`,
        name: debt.n || 'Debt',
        balance: debt.b || 0,
        interestRate: debt.r || 0,
        minimumPayment: debt.mp || 0,
        extraPayment: 0,
        taxDeductible: false
      })),
      preferences: {
        emergencyFundMonths: 6,
        currentEmergencyFund: p.pr?.ef || 0,
        emergencyFundAPY: p.pr?.apy || 0.04,
        necessaryExpenses: p.pr?.ne || 0,
        funMoney: {
          min: p.pr?.fmn || 0,
          max: p.pr?.fmx || 0,
          current: 0
        },
        age: p.pr?.age || 30,
        hasTaxableAccount: p.pr?.hta || false,
        taxableAccountContribution: p.pr?.tac || 0,
        isPeakEarnings: p.pr?.peak || false,
        expectedRetirementBracket: undefined,
        riskTolerance: p.pr?.risk || 'moderate',
        optimizationGoal: p.pr?.goal || 'balanced'
      },
      version: '1.0',
      lastUpdated: Date.now(),
      source: 'shared' as const
    }
  }
}