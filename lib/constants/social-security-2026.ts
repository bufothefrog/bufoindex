/**
 * Social Security 2026 figures for the benefit estimate
 * (lib/calculations/socialSecurityEstimate.ts).
 *
 * Sources, read 2026-11-13:
 *   - SSA Office of the Chief Actuary, "Benefit Formula Bend Points",
 *     https://www.ssa.gov/oact/cola/bendpoints.html
 *     Table row read: "2026 | 1,286 | 7,749 | 1,643 | 2,371 | 3,093"
 *     (the first two figures are the PIA bend points; the other three are
 *     maximum family benefit bend points, not used here).
 *   - SSA Office of the Chief Actuary, "Contribution and Benefit Base",
 *     https://www.ssa.gov/oact/cola/cbb.html
 *     Table row read: "2026 | 184,500"
 *   - SSA Office of the Chief Actuary, "Primary Insurance Amount",
 *     https://www.ssa.gov/oact/cola/piaformula.html
 *     The formula factors: "90 percent of the first $X of his/her average
 *     indexed monthly earnings, plus 32 percent ... over $X and through $Y,
 *     plus 15 percent ... over $Y". The page showed the 2027 dollar amounts
 *     when read; the factors are the same every year.
 *
 * The same pages listed 2027 figures (bend points 1,340 and 8,077; base
 * 192,300). This file stays on 2026 with the other 2026 constants
 * (irs-2026.ts, states-2026.ts); update only this file when the year moves.
 */

/** First PIA bend point, dollars of average indexed monthly earnings (2026). */
export const PIA_FIRST_BEND_POINT_2026 = 1286;

/** Second PIA bend point, dollars of average indexed monthly earnings (2026). */
export const PIA_SECOND_BEND_POINT_2026 = 7749;

/** PIA formula factors: below the first bend point, between the two, above the second. */
export const PIA_FACTORS = { first: 0.9, second: 0.32, third: 0.15 } as const;

/** Contribution and benefit base: yearly earnings above it are not taxed or counted (2026). */
export const CONTRIBUTION_AND_BENEFIT_BASE_2026 = 184500;
