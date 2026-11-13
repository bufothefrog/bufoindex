/**
 * The default profile as it was at 3bb0132 (the head of PR 2, before PR 3
 * changed the worked example), for the golden fixtures and the saved-profile
 * tests.
 *
 * The golden fixtures in the bindings tests pin engine inputs for explicit
 * answers. PR 3 changed the defaults those fixtures were built over, so they
 * now build over this profile with every leaf and list marked answered
 * (answeredEverywhere): the expected engine inputs stay exactly as captured,
 * and a stored profile in which every field is answered runs the same
 * numbers as at 3bb0132.
 */

import {
  PROFILE_LEAF_PATHS,
  PROFILE_LIST_PATHS,
  getDefaultFinancialProfile,
  normalizeProfile,
} from '@/lib/profile/defaults';
import type { FinancialProfile, ProfilePatch } from '@/lib/profile/types';

/** The default profile of 3bb0132: same shape as today's, the old example values. */
export function defaultProfileAt3bb0132(): FinancialProfile {
  const p = getDefaultFinancialProfile();
  return {
    ...p,
    person: { ...p.person, age: 30, state: 'TX', filingStatus: 'single', retirementAge: 60, lifeExpectancy: 85 },
    income: { ...p.income, grossPerPaycheck: 3500, netPerPaycheck: 2600 },
    spending: { ...p.spending, targetRetirementIncome: 80000 },
    cash: { ...p.cash, emergencyFundBalance: 5000 },
    workplace: { ...p.workplace, matchPercent: 0.5, matchLimit: 0.06, contributionPercent: 0.06 },
    portfolio: {
      ...p.portfolio,
      securities: p.portfolio.securities.map((security) => ({
        ...security,
        price: ({ VTI: 250, VXUS: 60, BND: 75 } as Record<string, number>)[security.ticker] ?? security.price,
      })),
    },
  };
}

/** Every leaf and list path of the profile. */
export const EVERY_PROFILE_PATH: readonly string[] = [...PROFILE_LEAF_PATHS, ...PROFILE_LIST_PATHS];

/** The profile with every leaf and list marked answered. */
export function answeredEverywhere(profile: FinancialProfile): FinancialProfile {
  return { ...profile, provided: [...EVERY_PROFILE_PATH] };
}

/**
 * A v1-shaped profile as the golden fixtures describe it: the given sections
 * over the 3bb0132 defaults, normalized the way any stored profile is, with
 * every field answered.
 */
export function answeredAt3bb0132(patch: ProfilePatch = {}): FinancialProfile {
  return answeredEverywhere(normalizeProfile(patch, defaultProfileAt3bb0132()));
}
