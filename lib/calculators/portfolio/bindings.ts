/**
 * Portfolio rebalancer bindings (docs/rebuild-plan.md section 2.5): how the
 * profile feeds RebalanceInputsV2. Pure.
 *
 * - Accounts (with their deposits, the new cash), securities, holdings and
 *   custom asset classes come from the profile's portfolio lists.
 * - Class targets: a preset target mix gives its TARGET_MIX_WEIGHTS; 'custom'
 *   uses portfolio.classTargets.
 * - The three settings come from assumptions.portfolio.
 *
 * Engine errors land where the page can show them: account rows on the
 * accounts list (1:1, so the row is kept), securities and holdings on the
 * holdings editor, which covers both, and target errors (the 100% sum) on
 * the class-targets editor.
 */

import { validateRebalanceInputsV2, type ClassTarget, type RebalanceInputsV2 } from '@/lib/calculations/portfolioRebalancing';
import type { Binding } from '@/lib/fields/binding';
import type { Get } from '@/lib/fields/types';
import { TARGET_MIX_WEIGHTS, presetClassTargets, type PresetTargetMix } from '@/lib/profile/defaults';
import { PORTFOLIO_LIST_PATHS } from './reducers';

export const TARGET_MIX_PATH = 'investing.targetMix';
export const ACCOUNTS_PATH = PORTFOLIO_LIST_PATHS.accounts;
export const SECURITIES_PATH = PORTFOLIO_LIST_PATHS.securities;
export const HOLDINGS_PATH = PORTFOLIO_LIST_PATHS.holdings;
export const CLASS_TARGETS_PATH = PORTFOLIO_LIST_PATHS.classTargets;
export const CUSTOM_ASSET_CLASSES_PATH = PORTFOLIO_LIST_PATHS.customAssetClasses;
export const MODE_PATH = 'assumptions.portfolio.mode';
export const ALLOW_TAXABLE_SELLING_PATH = 'assumptions.portfolio.allowTaxableSelling';
export const SHOW_PLACEMENT_ADVICE_PATH = 'assumptions.portfolio.showPlacementAdvice';

function isPresetMix(value: unknown): value is PresetTargetMix {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGET_MIX_WEIGHTS, value);
}

/** True when the visitor sets each class's target (the 'custom' mix). */
export function usesCustomTargets(get: Get): boolean {
  return get(TARGET_MIX_PATH) === 'custom';
}

/** The portfolio-wide targets the rebalance aims at: the preset's weights, or the visitor's own. */
export function classTargetsFor(get: Get): ClassTarget[] | undefined {
  const mix = get(TARGET_MIX_PATH);
  if (mix === 'custom') return get(CLASS_TARGETS_PATH) as ClassTarget[] | undefined;
  return isPresetMix(mix) ? presetClassTargets(mix) : undefined;
}

/**
 * The engine's own check on the portfolio-wide targets (their scope, then
 * their 100% sum), the message the calculator page shows on the
 * class-targets field; undefined when they pass. The intake runs it on the
 * screen that edits the custom targets, so Next stops there too.
 */
export function classTargetsError(get: Get): string | undefined {
  const errors = validateRebalanceInputsV2({
    setupMode: 'multi-shared',
    securities: [],
    accounts: [],
    holdings: [],
    classTargets: classTargetsFor(get) ?? [],
    customAssetClasses: [],
    allowTaxableSelling: false,
    showPlacementAdvice: false,
    mode: 'whole',
  });
  return errors.find(({ field }) => field === 'classTargets' || field.startsWith('classTargets.'))?.message;
}

export const PORTFOLIO_BINDINGS: readonly Binding<RebalanceInputsV2>[] = [
  { engine: 'securities', read: (get) => get(SECURITIES_PATH), errorPath: HOLDINGS_PATH },
  { profile: ACCOUNTS_PATH, engine: 'accounts' },
  { engine: 'holdings', read: (get) => get(HOLDINGS_PATH), errorPath: HOLDINGS_PATH },
  { engine: 'classTargets', read: classTargetsFor, errorPath: CLASS_TARGETS_PATH },
  { profile: CUSTOM_ASSET_CLASSES_PATH, engine: 'customAssetClasses' },
  { profile: ALLOW_TAXABLE_SELLING_PATH, engine: 'allowTaxableSelling' },
  { profile: SHOW_PLACEMENT_ADVICE_PATH, engine: 'showPlacementAdvice' },
  { profile: MODE_PATH, engine: 'mode' },
];

/** Engine inputs with no profile home, on purpose (plan section 2.3). */
export const PORTFOLIO_ENGINE_ONLY: Readonly<Record<string, string>> = {
  setupMode:
    "Fixed at 'multi-shared': one set of portfolio-wide targets across every account, the only setup the page offers.",
};
