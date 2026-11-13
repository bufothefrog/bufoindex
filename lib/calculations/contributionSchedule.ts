/**
 * Contribution timing: one schedule shape and the shared growth helpers every
 * engine uses to grow retirement contributions. Pure, no imports.
 *
 * The simulation has no calendar. Simulated year k covers months
 * [12k, 12k + 12) counted from today, so "start of the year" is month 0 of
 * each simulated year: the first yearly amount lands today, then every 12
 * months. N whole years get N yearly amounts, the same dollars as 12N
 * monthly amounts.
 *
 * The one monthly-rate convention: i = (1 + r)^(1/12) - 1 (monthlyRateOf), so
 * twelve months compound to exactly 1 + r, the same effective annual rate
 * that grows the starting balance.
 */

/** When a contribution goes in. 'yearStart' = 12 x its monthly-equivalent amount at the start of each simulated year. */
export type ContributionTiming = 'monthly' | 'yearStart';

export interface ContributionSchedule {
  /** Dollars per month. Each engine keeps its own placement inside the month. */
  monthly: number;
  /** Dollars per YEAR landing at month index 0, 12, 24, ... (prorated in a final partial year). */
  yearStart: number;
}

/** (1 + r)^(1/12) - 1, written exactly as Math.pow(1 + annualRate, 1/12) - 1 (bit-identical to the engines). */
export function monthlyRateOf(annualRate: number): number {
  return Math.pow(1 + annualRate, 1/12) - 1;
}

/**
 * Splits a total monthly-equivalent contribution into its monthly and yearly
 * parts. y = the yearly dollars clamped to [0, 12 x max(0, monthlyTotal)]
 * (non-finite: 0). With y = 0 the total passes through untouched, a negative
 * total included. Otherwise monthly = monthlyTotal - y / 12, and a residue
 * under 1e-9 reads as exactly 0, so an all-yearly total has no floating
 * remainder.
 */
export function splitSchedule(monthlyTotal: number, yearStartPerYear: number | undefined): ContributionSchedule {
  const cap = 12 * Math.max(0, monthlyTotal);
  const y =
    typeof yearStartPerYear === 'number' && Number.isFinite(yearStartPerYear)
      ? Math.min(cap, Math.max(0, yearStartPerYear))
      : 0;
  if (!(y > 0)) return { monthly: monthlyTotal, yearStart: 0 };
  const rest = monthlyTotal - y / 12;
  return { monthly: Math.abs(rest) < 1e-9 ? 0 : rest, yearStart: y };
}

/**
 * The share of the yearly total that lands at the start of the year, 0..1:
 * yearStartPerYear / (12 x monthlyTotal), clamped. 0 when the total is not
 * positive or the yearly amount is not finite. The one place the solvers and
 * the savings-rate markers get their share.
 */
export function yearStartShareOf(monthlyTotal: number, yearStartPerYear: number | undefined): number {
  if (!(monthlyTotal > 0) || typeof yearStartPerYear !== 'number' || !Number.isFinite(yearStartPerYear)) return 0;
  return Math.min(1, Math.max(0, yearStartPerYear) / (12 * monthlyTotal));
}

/**
 * One simulated year, end-of-month placement: the yearly amount goes in at
 * the start, then 12 times the balance grows a month and the monthly amount
 * goes in.
 */
export function growOneYear(balance: number, annualRate: number, s: ContributionSchedule): number {
  let currentBalance = balance;
  if (s.yearStart > 0) currentBalance += s.yearStart;
  const monthlyRate = monthlyRateOf(annualRate);
  for (let month = 0; month < 12; month++) {
    currentBalance = currentBalance * (1 + monthlyRate);
    currentBalance += s.monthly;
  }
  return currentBalance;
}

/**
 * Future value after `months` (may be fractional) of the monthly part at the
 * END of each month plus the yearly part at the START of each year. With
 * k = floor(M / 12) whole years and q = M - 12k months left, the yearly
 * amount of the final partial year is prorated (yearStart x q / 12) and lands
 * at month 12k. 0 for M <= 0 or a non-finite M.
 */
export function scheduleFutureValue(s: ContributionSchedule, annualRate: number, months: number): number {
  if (!Number.isFinite(months) || months <= 0) return 0;
  const i = monthlyRateOf(annualRate);
  const monthlyTerm = i === 0 ? s.monthly * months : s.monthly * ((Math.pow(1 + i, months) - 1) / i);
  if (!(s.yearStart > 0)) return monthlyTerm;
  const k = Math.floor(months / 12);
  const q = months - 12 * k;
  const r = annualRate;
  const whole = r === 0 ? s.yearStart * k : s.yearStart * (1 + r) * ((Math.pow(1 + r, k) - 1) / r);
  const partial = q > 0 ? s.yearStart * (q / 12) : 0;
  return monthlyTerm + (whole + partial) * Math.pow(1 + i, q);
}

/**
 * Future value per monthly-equivalent dollar when a share f (clamped 0..1,
 * NaN read as 0) lands at the start of each year. Solvers divide by it.
 * f = 0 is the ordinary annuity factor ((1 + i)^M - 1) / i (M at i = 0),
 * in that exact operation order.
 */
export function scheduleFactor(annualRate: number, months: number, yearStartShare: number): number {
  const f = Number.isFinite(yearStartShare) ? Math.min(1, Math.max(0, yearStartShare)) : 0;
  if (f === 0) {
    if (!Number.isFinite(months) || months <= 0) return 0;
    const i = monthlyRateOf(annualRate);
    return i === 0 ? months : (Math.pow(1 + i, months) - 1) / i;
  }
  return scheduleFutureValue({ monthly: 1 - f, yearStart: 12 * f }, annualRate, months);
}

/**
 * The yearly deposit at 0-based month index m of a `months` horizon: the
 * yearly amount at m = 0, 12, 24, ..., prorated to the months left when fewer
 * than 12 remain; 0 at any other month and for a yearly amount <= 0 or NaN.
 */
export function yearStartDeposit(yearStartPerYear: number, monthIndex: number, months: number): number {
  if (!(yearStartPerYear > 0)) return 0;
  if (monthIndex % 12 !== 0 || monthIndex >= months) return 0;
  return (yearStartPerYear * Math.min(12, months - monthIndex)) / 12;
}
