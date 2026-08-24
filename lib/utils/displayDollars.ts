/**
 * Display-layer dollar conversion.
 *
 * Most simulations and projections run in nominal (future) dollars, and a few
 * figures (the scenario cards' monthly withdrawal) are already expressed in
 * today's dollars. These helpers convert either kind into whichever basis the
 * reader has selected. They must never feed back into calculations — display
 * only.
 */

export type DollarDisplayMode = 'today' | 'nominal';

export const DEFAULT_DOLLAR_DISPLAY_MODE: DollarDisplayMode = 'today';

/**
 * Inflation assumption used to deflate paycheck-allocator projections,
 * which have no user-supplied inflation input. Approximates the long-run
 * US CPI average (~3%/yr). The retirement calculator uses the user's own
 * inflationRate input instead.
 */
export const DISPLAY_INFLATION_ASSUMPTION = 0.03;

/**
 * Convert a nominal amount `yearsFromNow` in the future into today's
 * dollars at the given annual inflation rate.
 */
export function toTodaysDollars(
  nominalAmount: number,
  annualInflationRate: number,
  yearsFromNow: number
): number {
  if (yearsFromNow <= 0) return nominalAmount;
  return nominalAmount / Math.pow(1 + annualInflationRate, yearsFromNow);
}

/**
 * Convert a today's-dollars amount into the nominal dollars of a year
 * `yearsFromNow` in the future at the given annual inflation rate. The inverse
 * of toTodaysDollars.
 */
export function toNominalDollars(
  realAmount: number,
  annualInflationRate: number,
  yearsFromNow: number
): number {
  if (yearsFromNow <= 0) return realAmount;
  return realAmount * Math.pow(1 + annualInflationRate, yearsFromNow);
}

/**
 * Convert a nominal amount for display according to the active mode.
 * In 'nominal' mode the value passes through unchanged.
 */
export function displayDollars(
  nominalAmount: number,
  mode: DollarDisplayMode,
  annualInflationRate: number,
  yearsFromNow: number
): number {
  return mode === 'today'
    ? toTodaysDollars(nominalAmount, annualInflationRate, yearsFromNow)
    : nominalAmount;
}

/**
 * Convert an amount that is already in today's dollars for display according
 * to the active mode — the mirror of displayDollars. In 'today' mode the value
 * passes through unchanged; in 'nominal' mode it is inflated to the year it
 * occurs, so both bases stay internally consistent on screen.
 */
export function displayRealDollars(
  realAmount: number,
  mode: DollarDisplayMode,
  annualInflationRate: number,
  yearsFromNow: number
): number {
  return mode === 'nominal'
    ? toNominalDollars(realAmount, annualInflationRate, yearsFromNow)
    : realAmount;
}
