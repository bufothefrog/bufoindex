/**
 * IRS 2026 Tax Constants - Single Source of Truth
 *
 * All IRS-published values for tax year 2026.
 * Sources:
 *   - IRS Notice 2025-67 (retirement plan limits, IRA limits, Roth phase-outs)
 *   - IRS Rev. Proc. 2025-19 (HSA/HDHP limits)
 *   - IRS Rev. Proc. 2025-32, as amended by OBBBA (tax brackets, standard deductions)
 *   - SSA announcement Oct 2025 (Social Security wage base)
 *
 * IMPORTANT: When updating for a new tax year, update ONLY this file.
 * All other files import from here.
 */

// ── Tax Brackets ────────────────────────────────────────────────────────────

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export const FEDERAL_TAX_BRACKETS_2026 = {
  single: [
    { min: 0, max: 12400, rate: 0.10 },
    { min: 12400, max: 50400, rate: 0.12 },
    { min: 50400, max: 105700, rate: 0.22 },
    { min: 105700, max: 201775, rate: 0.24 },
    { min: 201775, max: 256225, rate: 0.32 },
    { min: 256225, max: 640600, rate: 0.35 },
    { min: 640600, max: Infinity, rate: 0.37 },
  ],
  marriedFilingJointly: [
    { min: 0, max: 24800, rate: 0.10 },
    { min: 24800, max: 100800, rate: 0.12 },
    { min: 100800, max: 211400, rate: 0.22 },
    { min: 211400, max: 403550, rate: 0.24 },
    { min: 403550, max: 512450, rate: 0.32 },
    { min: 512450, max: 768700, rate: 0.35 },
    { min: 768700, max: Infinity, rate: 0.37 },
  ],
} as const;

// ── Standard Deductions ─────────────────────────────────────────────────────

export const STANDARD_DEDUCTIONS_2026 = {
  single: 16100,
  marriedFilingJointly: 32200,
  marriedFilingSeparately: 16100,
  headOfHousehold: 24150,
} as const;

// ── Retirement Contribution Limits ──────────────────────────────────────────

export const CONTRIBUTION_LIMITS_2026 = {
  ira: 7500,
  roth401k: 24500,
  traditional401k: 24500,
  hsa: {
    individual: 4400,
    family: 8750,
  },
  catchUp: {
    ira: 1100,           // Age 50+
    '401k': 8000,        // Age 50+
    superCatchUp401k: 11250, // Ages 60-63 (SECURE 2.0)
    hsa: 1000,           // Age 55+ (statutory, not indexed)
  },
  total415c: 72000,      // Total annual additions limit (415(c))
} as const;

// ── Roth IRA Phase-Out Limits ───────────────────────────────────────────────

export const ROTH_IRA_PHASEOUT_2026 = {
  single: { start: 153000, end: 168000 },
  marriedFilingJointly: { start: 242000, end: 252000 },
} as const;

// ── FICA / Social Security ──────────────────────────────────────────────────

export const SS_WAGE_BASE_2026 = 184500;
export const FICA_RATE = 0.0765;           // 6.2% SS + 1.45% Medicare
export const MEDICARE_RATE = 0.0145;       // Medicare only (above SS cap)
export const ADDITIONAL_MEDICARE_RATE = 0.0235; // Medicare + 0.9% surtax (above $200k)
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000;

// ── 415(c) Limits by Age ────────────────────────────────────────────────────

export const TOTAL_415C_BY_AGE = {
  standard: 72000,
  catchUp50: 80000,      // 72,000 + 8,000
  superCatchUp60to63: 83250, // 72,000 + 11,250
} as const;
