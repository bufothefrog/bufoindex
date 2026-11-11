/**
 * Disclaimer text, kept as fragments so each page composes the sentences
 * that apply to it and every shared sentence is spelled once.
 *
 * The composed DISCLAIMERS below are byte-identical to the strings the pages
 * passed inline before this module existed (test/lib/constants/labels.test.ts
 * checks them). Do not drop a fragment from a page without a reason: every
 * existing disclaimer is kept.
 */

export const DISCLAIMER = {
  educational: 'Educational tool only.',
  simulated: 'Results are simulated outcomes under the assumptions you enter, not predictions.',
  leveragedEtfLoss: 'Leveraged ETFs can lose most of their value in a severe decline.',
  pricesExecutable: 'Assumes stated prices are current and executable.',
  taxEstimates:
    'Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter.',
  notAdvice: 'Not tax or investment advice.',
  overviewEducational:
    'This overview provides educational information only and should not be considered personalized financial advice.',
  overviewModelOutputs:
    'Every figure is a model output from the inputs and assumptions shown; the profile is stored only in this browser.',
  consultAdvisor:
    'Consider consulting with a qualified financial advisor before making significant financial decisions.',
} as const;

export type DisclaimerFragment = keyof typeof DISCLAIMER;

/** Joins fragments (by key, or literal sentences) into one disclaimer paragraph. */
export function composeDisclaimer(...fragments: ReadonlyArray<DisclaimerFragment | (string & {})>): string {
  return fragments
    .map((fragment) => (Object.prototype.hasOwnProperty.call(DISCLAIMER, fragment) ? DISCLAIMER[fragment as DisclaimerFragment] : fragment))
    .filter((text) => text.length > 0)
    .join(' ');
}

/** Page disclaimers: one per calculator id (lib/calculators/registry.ts) plus the overview. */
export const DISCLAIMERS = {
  paycheck: composeDisclaimer('educational', 'taxEstimates', 'notAdvice'),
  retirement: composeDisclaimer('educational', 'simulated', 'notAdvice'),
  portfolio: composeDisclaimer('educational', 'pricesExecutable', 'notAdvice'),
  leverage: composeDisclaimer('educational', 'simulated', 'leveragedEtfLoss', 'notAdvice'),
  overview: composeDisclaimer('overviewEducational', 'overviewModelOutputs', 'consultAdvisor'),
} as const;
