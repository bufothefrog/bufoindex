/**
 * State Income Tax Rates - 2026 Tax Year - Single Source of Truth
 *
 * Simplified single-rate approximations of each state's individual income
 * tax, current as of January 2026 to the best of available knowledge. For
 * progressive states the entry is the REPRESENTATIVE MARGINAL RATE for a
 * middle-income earner (roughly $60k-$200k single) — not the statutory top
 * rate, which in states like CA/NY/NJ applies only to incomes far above the
 * bracket most users occupy and would overstate contribution tax savings.
 * Flat-tax states are exact. These feed marginal-savings estimates
 * (401k/HSA/IRA contribution math) — they are NOT filing advice and do not
 * model full bracket schedules, local/county income taxes, deductions,
 * credits, or capital-gains-only regimes (e.g. WA's capital gains excise).
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
  CA: { rate: 0.093, hasStateTax: true, name: 'California' },    // 9.3% bracket covers ~$63k-$397k single; top 13.3% (12.3% + 1% MHST) applies only over ~$1M
  CO: { rate: 0.044, hasStateTax: true, name: 'Colorado' },      // 4.4% statutory flat (TABOR surpluses can temporarily reduce)
  CT: { rate: 0.055, hasStateTax: true, name: 'Connecticut' },   // 5.5% bracket ~$10k-$50k single (6.0% to $100k); top 6.99% over $500k
  DE: { rate: 0.066, hasStateTax: true, name: 'Delaware' },      // 6.6% top rate
  DC: { rate: 0.085, hasStateTax: true, name: 'District of Columbia' }, // 8.5% bracket $60k-$250k; top 10.75% over $1M
  FL: { rate: 0, hasStateTax: false, name: 'Florida' },          // no state income tax
  GA: { rate: 0.0509, hasStateTax: true, name: 'Georgia' },      // 5.19% flat in 2025 (HB 111); scheduled -0.10pt/yr toward 4.99%, so 5.09% expected for 2026 (revenue-trigger contingent)
  HI: { rate: 0.0825, hasStateTax: true, name: 'Hawaii' },       // 8.25% middle bracket (Act 46 2024 widened brackets); top 11% at high incomes
  ID: { rate: 0.053, hasStateTax: true, name: 'Idaho' },         // 5.3% flat (2025 H40 cut from 5.695%)
  IL: { rate: 0.0495, hasStateTax: true, name: 'Illinois' },     // 4.95% flat
  IN: { rate: 0.0295, hasStateTax: true, name: 'Indiana' },      // 2.95% flat scheduled for 2026 (HEA 1001-2023: 3.00% 2025 -> 2.95% 2026 -> 2.9% 2027); counties add local income tax, not modeled
  IA: { rate: 0.038, hasStateTax: true, name: 'Iowa' },          // 3.8% flat (SF 2442, effective 2025)
  KS: { rate: 0.0558, hasStateTax: true, name: 'Kansas' },       // 5.58% top rate (2024 SB 1 two-bracket structure)
  KY: { rate: 0.035, hasStateTax: true, name: 'Kentucky' },      // 3.5% flat for 2026 (2025 HB 1 cut from 4.0%)
  LA: { rate: 0.03, hasStateTax: true, name: 'Louisiana' },      // 3.0% flat (2024 3rd Extraordinary Session, effective 2025)
  ME: { rate: 0.0715, hasStateTax: true, name: 'Maine' },        // 7.15% top rate
  MD: { rate: 0.0475, hasStateTax: true, name: 'Maryland' },     // 4.75% bracket ~$3k-$100k single; 2025 BRFA top brackets start at $500k; county income tax not modeled
  MA: { rate: 0.05, hasStateTax: true, name: 'Massachusetts' },  // 5% flat below the ~$1.08M millionaire-surtax threshold (surtax adds 4% above)
  MI: { rate: 0.0425, hasStateTax: true, name: 'Michigan' },     // 4.25% flat
  MN: { rate: 0.068, hasStateTax: true, name: 'Minnesota' },     // 6.8% bracket ~$32k-$104k single; top 9.85% over ~$193k
  MS: { rate: 0.04, hasStateTax: true, name: 'Mississippi' },    // 4.0% flat for 2026 (2022 phase-down: 4.4% 2025 -> 4.0% 2026; 2025 HB 1 continues cuts after)
  MO: { rate: 0.047, hasStateTax: true, name: 'Missouri' },      // 4.7% top rate (2025; further trigger cuts pending)
  MT: { rate: 0.059, hasStateTax: true, name: 'Montana' },       // 5.9% top rate (2024+ two-bracket structure; 2025 session cuts may lower for 2026-27)
  NE: { rate: 0.0455, hasStateTax: true, name: 'Nebraska' },     // 4.55% top rate for 2026 (LB 754 schedule: 5.2% 2025 -> 4.55% 2026 -> 3.99% 2027)
  NV: { rate: 0, hasStateTax: false, name: 'Nevada' },           // no state income tax
  NH: { rate: 0, hasStateTax: false, name: 'New Hampshire' },    // no wage income tax; interest & dividends tax fully repealed as of 2025
  NJ: { rate: 0.0637, hasStateTax: true, name: 'New Jersey' },   // 6.37% bracket $75k-$500k single; top 10.75% over $1M
  NM: { rate: 0.049, hasStateTax: true, name: 'New Mexico' },    // 4.9% bracket ~$16k-$210k single; top 5.9% above
  NY: { rate: 0.06, hasStateTax: true, name: 'New York' },       // 6.0% bracket ~$80k-$215k single; 10.9% top applies only over $25M
  NC: { rate: 0.0399, hasStateTax: true, name: 'North Carolina' }, // 3.99% flat for 2026 (statutory phase-down from 4.25% in 2025)
  ND: { rate: 0.0195, hasStateTax: true, name: 'North Dakota' }, // 1.95% bracket ~$48k-$244k single (2023 HB 1158: 0%/1.95%/2.5%)
  OH: { rate: 0.0275, hasStateTax: true, name: 'Ohio' },         // 2.75% flat for 2026 (2025 HB 96 budget: 3.125% top in 2025, flat 2.75% in 2026)
  OK: { rate: 0.0475, hasStateTax: true, name: 'Oklahoma' },     // 4.75% top rate
  OR: { rate: 0.0875, hasStateTax: true, name: 'Oregon' },       // 8.75% bracket ~$10k-$125k single; top 9.9% above $125k
  PA: { rate: 0.0307, hasStateTax: true, name: 'Pennsylvania' }, // 3.07% flat; local EIT not modeled
  RI: { rate: 0.0475, hasStateTax: true, name: 'Rhode Island' }, // 4.75% bracket ~$79k-$179k single; top 5.99% above
  SC: { rate: 0.062, hasStateTax: true, name: 'South Carolina' }, // 6.2% top rate (2025; scheduled 0.1pt trigger cuts toward 6.0%)
  SD: { rate: 0, hasStateTax: false, name: 'South Dakota' },     // no state income tax
  TN: { rate: 0, hasStateTax: false, name: 'Tennessee' },        // no state income tax (Hall tax fully repealed 2021)
  TX: { rate: 0, hasStateTax: false, name: 'Texas' },            // no state income tax
  UT: { rate: 0.045, hasStateTax: true, name: 'Utah' },          // 4.5% flat (2025 SB 71 cut from 4.55%)
  VT: { rate: 0.066, hasStateTax: true, name: 'Vermont' },       // 6.6% bracket ~$45k-$108k single; top 8.75% over ~$229k
  VA: { rate: 0.0575, hasStateTax: true, name: 'Virginia' },     // 5.75% top rate
  WA: { rate: 0, hasStateTax: false, name: 'Washington' },       // no wage income tax (7% capital gains excise tax not modeled)
  WV: { rate: 0.0482, hasStateTax: true, name: 'West Virginia' }, // 4.82% top rate (2023 HB 2526 cut plus 2025 trigger reduction)
  WI: { rate: 0.053, hasStateTax: true, name: 'Wisconsin' },     // 5.3% bracket ~$29k-$315k single; top 7.65% above
  WY: { rate: 0, hasStateTax: false, name: 'Wyoming' }           // no state income tax
} as const satisfies Record<string, StateTaxInfo>;

export type StateCode = keyof typeof STATE_TAX_RATES_2026;

// Backward-compatible alias (previously exported from lib/types).
export const STATE_TAX_RATES = STATE_TAX_RATES_2026;
