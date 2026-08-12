/**
 * State Income Tax Rates - 2026 Tax Year - Single Source of Truth
 *
 * Simplified TOP marginal (or flat) state individual income tax rates,
 * current as of January 2026 to the best of available knowledge. These are
 * single-rate approximations intended for marginal-savings estimates
 * (401k/HSA/IRA contribution math) — they are NOT filing advice and do not
 * model brackets, local/county income taxes, deductions, credits, or
 * capital-gains-only regimes (e.g. WA's 7% capital gains excise tax).
 *
 * Several states have revenue-triggered or scheduled rate reductions;
 * per-entry comments cite the vintage/statute relied on.
 *
 * IMPORTANT: When updating for a new tax year, update ONLY this file.
 */

export interface StateTaxInfo {
  rate: number;
  hasStateTax: boolean;
  name: string;
}

export const STATE_TAX_RATES_2026 = {
  AL: { rate: 0.05, hasStateTax: true, name: 'Alabama' },        // 5.0% top rate (unchanged)
  AK: { rate: 0, hasStateTax: false, name: 'Alaska' },           // no state income tax
  AZ: { rate: 0.025, hasStateTax: true, name: 'Arizona' },       // 2.5% flat (SB 1828, since 2023)
  AR: { rate: 0.039, hasStateTax: true, name: 'Arkansas' },      // 3.9% top rate (2024 special session cut)
  CA: { rate: 0.133, hasStateTax: true, name: 'California' },    // 13.3% top: 12.3% + 1% Mental Health Services Tax over $1M; 9.3% bracket covers most middle incomes
  CO: { rate: 0.044, hasStateTax: true, name: 'Colorado' },      // 4.4% statutory flat (TABOR surpluses can temporarily reduce)
  CT: { rate: 0.0699, hasStateTax: true, name: 'Connecticut' },  // 6.99% top rate
  DE: { rate: 0.066, hasStateTax: true, name: 'Delaware' },      // 6.6% top rate
  DC: { rate: 0.1075, hasStateTax: true, name: 'District of Columbia' }, // 10.75% top rate (over $1M)
  FL: { rate: 0, hasStateTax: false, name: 'Florida' },          // no state income tax
  GA: { rate: 0.0509, hasStateTax: true, name: 'Georgia' },      // 5.19% flat in 2025 (HB 111); scheduled -0.10pt/yr toward 4.99%, so 5.09% expected for 2026 (revenue-trigger contingent)
  HI: { rate: 0.11, hasStateTax: true, name: 'Hawaii' },         // 11% top rate (2024 Act 46 widens brackets but keeps 11% top)
  ID: { rate: 0.053, hasStateTax: true, name: 'Idaho' },         // 5.3% flat (2025 H40 cut from 5.695%)
  IL: { rate: 0.0495, hasStateTax: true, name: 'Illinois' },     // 4.95% flat
  IN: { rate: 0.0295, hasStateTax: true, name: 'Indiana' },      // 2.95% flat scheduled for 2026 (HEA 1001-2023: 3.00% 2025 -> 2.95% 2026 -> 2.9% 2027); counties add local income tax, not modeled
  IA: { rate: 0.038, hasStateTax: true, name: 'Iowa' },          // 3.8% flat (SF 2442, effective 2025)
  KS: { rate: 0.0558, hasStateTax: true, name: 'Kansas' },       // 5.58% top rate (2024 SB 1 two-bracket structure)
  KY: { rate: 0.035, hasStateTax: true, name: 'Kentucky' },      // 3.5% flat for 2026 (2025 HB 1 cut from 4.0%)
  LA: { rate: 0.03, hasStateTax: true, name: 'Louisiana' },      // 3.0% flat (2024 3rd Extraordinary Session, effective 2025)
  ME: { rate: 0.0715, hasStateTax: true, name: 'Maine' },        // 7.15% top rate
  MD: { rate: 0.065, hasStateTax: true, name: 'Maryland' },      // 6.5% top rate (2025 BRFA added 6.25%/6.5% brackets over $500k/$1M); counties add local income tax, not modeled
  MA: { rate: 0.09, hasStateTax: true, name: 'Massachusetts' },  // 9% top: 5% flat + 4% millionaire surtax (2022 amendment, threshold ~$1.08M indexed); 5% applies below that
  MI: { rate: 0.0425, hasStateTax: true, name: 'Michigan' },     // 4.25% flat
  MN: { rate: 0.0985, hasStateTax: true, name: 'Minnesota' },    // 9.85% top rate
  MS: { rate: 0.04, hasStateTax: true, name: 'Mississippi' },    // 4.0% flat for 2026 (2022 phase-down: 4.4% 2025 -> 4.0% 2026; 2025 HB 1 continues cuts after)
  MO: { rate: 0.047, hasStateTax: true, name: 'Missouri' },      // 4.7% top rate (2025; further trigger cuts pending)
  MT: { rate: 0.059, hasStateTax: true, name: 'Montana' },       // 5.9% top rate (2024+ two-bracket structure; 2025 session cuts may lower for 2026-27)
  NE: { rate: 0.0455, hasStateTax: true, name: 'Nebraska' },     // 4.55% top rate for 2026 (LB 754 schedule: 5.2% 2025 -> 4.55% 2026 -> 3.99% 2027)
  NV: { rate: 0, hasStateTax: false, name: 'Nevada' },           // no state income tax
  NH: { rate: 0, hasStateTax: false, name: 'New Hampshire' },    // no wage income tax; interest & dividends tax fully repealed as of 2025
  NJ: { rate: 0.1075, hasStateTax: true, name: 'New Jersey' },   // 10.75% top rate (over $1M); 6.37% applies $75k-$500k
  NM: { rate: 0.059, hasStateTax: true, name: 'New Mexico' },    // 5.9% top rate
  NY: { rate: 0.109, hasStateTax: true, name: 'New York' },      // 10.9% top rate (over $25M, temporary through 2027); 6.85% covers ~$215k-$1.08M
  NC: { rate: 0.0399, hasStateTax: true, name: 'North Carolina' }, // 3.99% flat for 2026 (statutory phase-down from 4.25% in 2025)
  ND: { rate: 0.025, hasStateTax: true, name: 'North Dakota' },  // 2.5% top rate (2023 HB 1158 restructure: 0%/1.95%/2.5%)
  OH: { rate: 0.0275, hasStateTax: true, name: 'Ohio' },         // 2.75% flat for 2026 (2025 HB 96 budget: 3.125% top in 2025, flat 2.75% in 2026)
  OK: { rate: 0.0475, hasStateTax: true, name: 'Oklahoma' },     // 4.75% top rate
  OR: { rate: 0.099, hasStateTax: true, name: 'Oregon' },        // 9.9% top rate (over $125k single)
  PA: { rate: 0.0307, hasStateTax: true, name: 'Pennsylvania' }, // 3.07% flat; local EIT not modeled
  RI: { rate: 0.0599, hasStateTax: true, name: 'Rhode Island' }, // 5.99% top rate
  SC: { rate: 0.062, hasStateTax: true, name: 'South Carolina' }, // 6.2% top rate (2025; scheduled 0.1pt trigger cuts toward 6.0%)
  SD: { rate: 0, hasStateTax: false, name: 'South Dakota' },     // no state income tax
  TN: { rate: 0, hasStateTax: false, name: 'Tennessee' },        // no state income tax (Hall tax fully repealed 2021)
  TX: { rate: 0, hasStateTax: false, name: 'Texas' },            // no state income tax
  UT: { rate: 0.045, hasStateTax: true, name: 'Utah' },          // 4.5% flat (2025 SB 71 cut from 4.55%)
  VT: { rate: 0.0875, hasStateTax: true, name: 'Vermont' },      // 8.75% top rate
  VA: { rate: 0.0575, hasStateTax: true, name: 'Virginia' },     // 5.75% top rate
  WA: { rate: 0, hasStateTax: false, name: 'Washington' },       // no wage income tax (7% capital gains excise tax not modeled)
  WV: { rate: 0.0482, hasStateTax: true, name: 'West Virginia' }, // 4.82% top rate (2023 HB 2526 cut plus 2025 trigger reduction)
  WI: { rate: 0.0765, hasStateTax: true, name: 'Wisconsin' },    // 7.65% top rate
  WY: { rate: 0, hasStateTax: false, name: 'Wyoming' }           // no state income tax
} as const satisfies Record<string, StateTaxInfo>;

export type StateCode = keyof typeof STATE_TAX_RATES_2026;

// Backward-compatible alias (previously exported from lib/types).
export const STATE_TAX_RATES = STATE_TAX_RATES_2026;
