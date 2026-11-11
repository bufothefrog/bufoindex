/**
 * Disclaimer fragments. Each page composes its footer from the base, its own
 * fragments and the advice line, so the shared sentences are written once:
 *
 *   composeDisclaimer(DISCLAIMER.base, DISCLAIMER.simulated, DISCLAIMER.advice)
 */

export const DISCLAIMER = {
  /** Opens every calculator footer. */
  base: 'Educational tool only.',
  /** Simulation-based calculators (retirement, leverage). */
  simulated: 'Results are simulated outcomes under the assumptions you enter, not predictions.',
  /** Leverage comparison. */
  leveragedEtfs: 'Leveraged ETFs can lose most of their value in a severe decline.',
  /** Paycheck allocator. */
  taxEstimates:
    'Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter.',
  /** Portfolio rebalancer. */
  prices: 'Assumes stated prices are current and executable.',
  /** Closes every calculator footer. */
  advice: 'Not tax or investment advice.',
  /** Home page: opens the site-wide note. */
  siteBase: 'Educational tools only.',
  /** Home page. */
  siteAssumptions: 'Results depend on the assumptions you enter and are not predictions.',
  /** Overview dashboard: opens its footer. */
  overview:
    'This overview provides educational information only and should not be considered personalized financial advice.',
  /** Overview dashboard. */
  overviewModel:
    'Every figure is a model output from the inputs and assumptions shown; the profile is stored only in this browser.',
  /** Overview dashboard: closes its footer. */
  consultAdvisor:
    'Consider consulting with a qualified financial advisor before making significant financial decisions.',
} as const;

export type DisclaimerFragment = (typeof DISCLAIMER)[keyof typeof DISCLAIMER];

/** Joins fragments into one footer sentence run, separated by single spaces. */
export function composeDisclaimer(...fragments: readonly DisclaimerFragment[]): string {
  return fragments.join(' ');
}
