/**
 * URL State Management for Retirement Calculator
 * Hash-based compression for sharing retirement scenarios
 */

import { RetirementInputs } from '@/lib/calculations/retirement';
import { RetirementConstants } from '@/lib/constants/retirement';

// Compressed data structure for URL serialization
interface CompressedRetirementData {
  v: number; // version
  sa?: number; // startingAge
  ra?: number; // retirementAge
  le?: number; // lifeExpectancy
  ti?: number; // targetIncome
  sb?: number; // startingBalance
  ci?: number; // currentIncome
  st?: string; // state
  rp?: string; // riskProfile
  [key: string]: unknown; // other compressed fields
}

/**
 * Encode retirement inputs to URL hash
 */
export function encodeRetirementToUrlHash(inputs: RetirementInputs): string {
  try {
    // Compress the data by removing default values
    const compressed = compressRetirementData(inputs);
    
    // Convert to JSON string and encode
    const jsonString = JSON.stringify(compressed);
    const base64 = btoa(jsonString);
    
    // Make URL-safe
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Failed to encode retirement data to URL hash:', error);
    return '';
  }
}

/**
 * Decode retirement inputs from URL hash
 */
export function decodeRetirementFromUrlHash(hash: string): RetirementInputs | null {
  try {
    // Remove the # if present
    const cleanHash = hash.replace(/^#/, '');
    if (!cleanHash) return null;
    
    // Check if this looks like a valid base64-encoded retirement data
    // Our data should be reasonably long and contain only valid base64 characters
    if (cleanHash.length < 10 || !/^[A-Za-z0-9_-]+$/.test(cleanHash)) {
      return null;
    }
    
    // Restore base64 padding and decode
    const base64 = cleanHash.replace(/-/g, '+').replace(/_/g, '/') + '=='.substring(0, (4 - cleanHash.length % 4) % 4);
    const jsonString = atob(base64);
    const compressed = JSON.parse(jsonString);
    
    // Verify this looks like retirement data
    if (!compressed || typeof compressed !== 'object') {
      return null;
    }
    
    // Decompress the data by restoring defaults
    return decompressRetirementData(compressed);
  } catch (error) {
    // Only log if it looks like it might have been intended to be retirement data
    const cleanHash = hash.replace(/^#/, '');
    if (cleanHash.length > 50) {
      console.warn('Failed to decode retirement data from URL hash:', error instanceof Error ? error.message : String(error));
    }
    return null;
  }
}

/**
 * Compress retirement data by removing defaults and reducing size
 */
function compressRetirementData(inputs: RetirementInputs): CompressedRetirementData {
  const compressed: CompressedRetirementData = {
    v: 1, // version
  };
  
  // Only include non-default values
  if (inputs.startingAge !== 25) compressed.sa = inputs.startingAge;
  if (inputs.retirementAge !== 60) compressed.ra = inputs.retirementAge;
  if (inputs.lifeExpectancy !== 85) compressed.le = inputs.lifeExpectancy;
  if (inputs.targetIncome !== 80000) compressed.ti = inputs.targetIncome;
  if (inputs.startingBalance !== 10000) compressed.sb = inputs.startingBalance;
  if (inputs.currentIncome !== 100000) compressed.ci = inputs.currentIncome;
  if (inputs.monthlySavings !== 2000) compressed.ms = inputs.monthlySavings;
  if (inputs.accumulationReturn !== RetirementConstants.DEFAULT_ACCUMULATION_RETURN) {
    compressed.ar = inputs.accumulationReturn;
  }
  if (inputs.retirementReturn !== RetirementConstants.DEFAULT_RETIREMENT_RETURN) {
    compressed.rr = inputs.retirementReturn;
  }
  if (inputs.inflationRate !== RetirementConstants.DEFAULT_INFLATION_RATE) {
    compressed.ir = inputs.inflationRate;
  }
  if (inputs.socialSecurityAge !== RetirementConstants.SS_FULL_RETIREMENT_AGE) {
    compressed.ssa = inputs.socialSecurityAge;
  }
  if (inputs.socialSecurityBenefit !== 30000) compressed.ssb = inputs.socialSecurityBenefit;
  if (inputs.healthcareCostMultiplier !== 1) compressed.hcm = inputs.healthcareCostMultiplier;
  if (inputs.volatility !== RetirementConstants.DEFAULT_VOLATILITY) {
    compressed.vol = inputs.volatility;
  }
  if (inputs.filingStatus !== 'single') compressed.fs = inputs.filingStatus;
  if (inputs.state !== 'TX') compressed.st = inputs.state; // Default to Texas (no state income tax)
  if (inputs.riskProfile !== 'tdf') compressed.rp = inputs.riskProfile;

  return compressed;
}

/**
 * Decompress retirement data by restoring defaults
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decompressRetirementData(compressed: any): RetirementInputs {
  if (compressed.v !== 1) {
    throw new Error('Unsupported retirement data version');
  }
  
  return {
    startingAge: compressed.sa || 25,
    retirementAge: compressed.ra || 60,
    lifeExpectancy: compressed.le || 85,
    targetIncome: compressed.ti || 80000,
    startingBalance: compressed.sb || 10000,
    currentIncome: compressed.ci || 100000,
    monthlySavings: compressed.ms || 2000,
    accumulationReturn: compressed.ar || RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
    retirementReturn: compressed.rr || RetirementConstants.DEFAULT_RETIREMENT_RETURN,
    inflationRate: compressed.ir || RetirementConstants.DEFAULT_INFLATION_RATE,
    socialSecurityAge: compressed.ssa || RetirementConstants.SS_FULL_RETIREMENT_AGE,
    socialSecurityBenefit: compressed.ssb || 30000,
    healthcareCostMultiplier: compressed.hcm || 1,
    volatility: compressed.vol || RetirementConstants.DEFAULT_VOLATILITY,
    filingStatus: compressed.fs || 'single',
    state: compressed.st || 'TX', // Default to Texas (no state income tax)
    riskProfile: compressed.rp || 'tdf',
    necessaryMonthlyExpenses: compressed.nme || 5000,
  };
}

/**
 * Update URL hash with current retirement state
 */
export function updateRetirementUrlHash(inputs: RetirementInputs): void {
  const hash = encodeRetirementToUrlHash(inputs);
  if (hash) {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }
}

/**
 * Load retirement state from URL hash on page load
 */
export function loadRetirementFromUrl(): RetirementInputs | null {
  if (typeof window === 'undefined') return null;
  
  const hash = window.location.hash;
  if (hash) {
    return decodeRetirementFromUrlHash(hash);
  }
  
  return null;
}