/**
 * Federal bracket arithmetic (lib/calculations/taxBracket.ts): taxable
 * income by hand, every bracket edge for each filing status (an income on
 * an edge is in the lower bracket, one dollar over is in the next), zero and
 * negative income, and the nearest-rate read of a free percent.
 */

import { describe, expect, it } from 'vitest';
import {
  FEDERAL_BRACKET_RATES,
  currentFederalBracket,
  federalBracketFor,
  federalBracketRate,
  nearestBracketRate,
  taxableIncome,
} from '@/lib/calculations/taxBracket';
import type { FilingStatusInput } from '@/lib/constants/irs-2026';

/**
 * Upper edges of the first six brackets per status (2026 tables, written out
 * by hand from Rev. Proc. 2025-32 section 4.01 Tables 1 to 4).
 */
const EDGES: Readonly<Record<string, readonly number[]>> = {
  single: [12400, 50400, 105700, 201775, 256225, 640600],
  marriedJoint: [24800, 100800, 211400, 403550, 512450, 768700],
  marriedSeparate: [12400, 50400, 105700, 201775, 256225, 384350],
  headOfHousehold: [17700, 67450, 105700, 201750, 256200, 640600],
};
const RATES = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

describe('taxableIncome', () => {
  it('subtracts pre-tax deductions and the 2026 standard deduction for the filing status', () => {
    // 104,000 - 8,320 - 16,100 = 79,580.
    expect(taxableIncome({ yearlyGross: 104000, preTaxDeductions: 8320, filingStatus: 'single' })).toBe(79580);
    // 150,000 - 10,000 - 32,200 = 107,800.
    expect(taxableIncome({ yearlyGross: 150000, preTaxDeductions: 10000, filingStatus: 'marriedJoint' })).toBe(107800);
    // 60,000 - 0 - 16,100 = 43,900.
    expect(taxableIncome({ yearlyGross: 60000, preTaxDeductions: 0, filingStatus: 'marriedSeparate' })).toBe(43900);
    // 70,000 - 3,600 - 24,150 = 42,250.
    expect(taxableIncome({ yearlyGross: 70000, preTaxDeductions: 3600, filingStatus: 'headOfHousehold' })).toBe(42250);
  });

  it('may be zero or negative', () => {
    expect(taxableIncome({ yearlyGross: 16100, preTaxDeductions: 0, filingStatus: 'single' })).toBe(0);
    // 10,000 - 1,000 - 16,100 = -7,100.
    expect(taxableIncome({ yearlyGross: 10000, preTaxDeductions: 1000, filingStatus: 'single' })).toBe(-7100);
  });
});

describe.each(Object.entries(EDGES))('federalBracketRate, %s', (status, edges) => {
  const filing = status as FilingStatusInput;

  it('puts an income on each edge in the lower bracket and one dollar over in the next', () => {
    edges.forEach((edge, index) => {
      expect(federalBracketRate(edge, filing), `${edge}`).toBe(RATES[index]);
      expect(federalBracketRate(edge + 1, filing), `${edge + 1}`).toBe(RATES[index + 1]);
    });
  });

  it('puts zero, negative and the first dollar in the lowest bracket, and a very large income in the top one', () => {
    expect(federalBracketRate(0, filing)).toBe(0.1);
    expect(federalBracketRate(-25000, filing)).toBe(0.1);
    expect(federalBracketRate(1, filing)).toBe(0.1);
    expect(federalBracketRate(5_000_000, filing)).toBe(0.37);
  });

  it('returns the bracket with its range', () => {
    const second = federalBracketFor(edges[0] + 1, filing);
    expect(second).toEqual({ min: edges[0], max: edges[1], rate: 0.12 });
  });
});

describe('currentFederalBracket', () => {
  it('takes the bracket of the taxable income', () => {
    // The worked example: 104,000 - 8,320 - 16,100 = 79,580, single: 22%.
    expect(currentFederalBracket({ yearlyGross: 104000, preTaxDeductions: 8320, filingStatus: 'single' })).toBe(0.22);
    // 66,500 - 0 - 16,100 = 50,400: on the 12% edge, so 12%.
    expect(currentFederalBracket({ yearlyGross: 66500, preTaxDeductions: 0, filingStatus: 'single' })).toBe(0.12);
    // 66,501 - 0 - 16,100 = 50,401: 22%.
    expect(currentFederalBracket({ yearlyGross: 66501, preTaxDeductions: 0, filingStatus: 'single' })).toBe(0.22);
    // Joint 133,000 - 0 - 32,200 = 100,800: on the 12% edge.
    expect(currentFederalBracket({ yearlyGross: 133000, preTaxDeductions: 0, filingStatus: 'marriedJoint' })).toBe(0.12);
    // All income sheltered: 20,000 - 5,000 - 16,100 = -1,100: lowest bracket.
    expect(currentFederalBracket({ yearlyGross: 20000, preTaxDeductions: 5000, filingStatus: 'single' })).toBe(0.1);
  });
});

describe('nearestBracketRate', () => {
  it('lists the seven rates', () => {
    expect(FEDERAL_BRACKET_RATES).toEqual(RATES);
  });

  it('keeps a bracket rate and reads any other value as the nearest rate', () => {
    for (const rate of RATES) expect(nearestBracketRate(rate)).toBe(rate);
    expect(nearestBracketRate(0.15)).toBe(0.12);
    expect(nearestBracketRate(0.2)).toBe(0.22);
    expect(nearestBracketRate(0.3)).toBe(0.32);
    expect(nearestBracketRate(0.0)).toBe(0.1);
    expect(nearestBracketRate(0.5)).toBe(0.37);
    // Drift from a percent input still reads as the rate.
    expect(nearestBracketRate(0.22000000000000003)).toBe(0.22);
  });

  it('breaks a tie toward the lower rate, and reads a non-number as the lowest', () => {
    // 0.17 is 5 points from both 12% and 22%; 0.11 is 1 point from 10% and 12%.
    expect(nearestBracketRate(0.17)).toBe(0.12);
    expect(nearestBracketRate(0.11)).toBe(0.1);
    expect(nearestBracketRate(Number.NaN)).toBe(0.1);
  });
});
