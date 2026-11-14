/**
 * Field specs only the portfolio rebalancer asks: the target mix and the
 * class-targets editor, the holdings editor, this run's new cash and the
 * three settings. The account list itself is the shared ACCOUNTS field
 * (lib/fields/shared.ts). Wording is the rebalancer's from before the
 * rebuild (the target mix keeps the intake's); option labels come from
 * lib/constants/labels.ts.
 *
 * The holdings, class-targets and new cash editors are custom fields: their
 * renderers (components/calculators/renderers/portfolio.tsx) edit the
 * related lists through the reducers, so a field covers every list it
 * writes.
 */

import { getAssetClassLabel, type ClassTarget, type RebalanceMode } from '@/lib/calculations/portfolioRebalancing';
import { TARGET_MIX_LABELS, TARGET_MIX_OPTIONS } from '@/lib/constants/labels';
import { listRows } from '@/lib/fields/runtime';
import type { FieldOption, FieldSpec, Get, Write } from '@/lib/fields/types';
import { formatCount, formatCurrency, formatPercent } from '@/lib/format';
import {
  accountDisplayName,
  accountLabels,
  accountsInEffect,
  hasHoldings,
  newCashFor,
  normalNewCash,
  rebalanceCandidates,
} from '@/lib/profile/accounts';
import { TARGET_MIX_WEIGHTS, presetClassTargets, type PresetTargetMix } from '@/lib/profile/defaults';
import type { TargetMixPreset } from '@/lib/profile/types';
import {
  ALLOW_TAXABLE_SELLING_PATH,
  CLASS_TARGETS_PATH,
  CUSTOM_ASSET_CLASSES_PATH,
  HOLDINGS_PATH,
  MODE_PATH,
  NEW_CASH_PATH,
  SECURITIES_PATH,
  SHOW_PLACEMENT_ADVICE_PATH,
  TARGET_MIX_PATH,
  usesCustomTargets,
} from './bindings';
import { readPortfolio } from './reducers';

/** Renderer ids (FieldSpec.renderer) of the custom editors. */
export const HOLDINGS_RENDERER = 'portfolio-holdings';
export const CLASS_TARGETS_RENDERER = 'portfolio-class-targets';
export const NEW_CASH_RENDERER = 'portfolio-new-cash';

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/**
 * True while an account could be rebalanced (the targets then matter): a
 * candidate with holdings, normal contributions above 0, or this run's new
 * cash above 0. Where calculator-only values read as unset (the profile
 * screens, intakeScreens in lib/calculators/forms.ts) the new cash is the
 * normal contributions, so the targets screen follows the holdings and the
 * normal contributions only; the calculator page also follows a Custom new
 * cash. Every account rebalancedAccounts returns meets it, so it holds
 * whenever the rebalancer works on an account.
 */
function hasTargetsInEffect(get: Get): boolean {
  return rebalanceCandidates(get).some(
    (account) => hasHoldings(get, account.id) || normalNewCash(get, account.id) > 0 || newCashFor(get, account.id) > 0
  );
}

/** True while an account in effect, other than a cash account, has a holding (the holdings screen shows). */
function hasHoldingsInEffect(get: Get): boolean {
  return accountsInEffect(get).rows.some((account) => account.kind !== 'cash' && hasHoldings(get, account.id));
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

function isPresetMix(value: unknown): value is PresetTargetMix {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGET_MIX_WEIGHTS, value);
}

/**
 * The editable targets when the mix changes from a preset to Custom: the
 * preset's weights, so the visitor starts from the targets in use rather
 * than from whatever classTargets last held. Rows of the visitor's own asset
 * classes stay, at 0% (the preset gave them nothing); account-level rows stay
 * as they are.
 */
function targetsFromPreset(value: unknown, get: Get, before?: Get): Write[] {
  const previous = before?.(TARGET_MIX_PATH);
  if (value !== 'custom' || !isPresetMix(previous)) return [];
  const preset = presetClassTargets(previous);
  const standard = new Set(preset.map((target) => target.assetClass));
  const kept = readPortfolio(get)
    .classTargets.filter((target) => target.accountId !== null || !standard.has(target.assetClass))
    .map((target) => (target.accountId === null ? { ...target, target: 0 } : target));
  return [{ path: CLASS_TARGETS_PATH, value: [...preset, ...kept] }];
}

export const TARGET_MIX: FieldSpec = {
  path: TARGET_MIX_PATH,
  kind: 'choice',
  label: 'Target mix',
  options: TARGET_MIX_OPTIONS,
  tier: 'details',
  onChange: targetsFromPreset,
  visibleWhen: hasTargetsInEffect,
  summary: (value) => TARGET_MIX_LABELS[value as TargetMixPreset] ?? null,
};

/** The editor for each class's target, shown for the custom mix. */
export const CLASS_TARGETS: FieldSpec = {
  path: CLASS_TARGETS_PATH,
  kind: 'custom',
  label: 'Target allocation',
  renderer: CLASS_TARGETS_RENDERER,
  covers: [CUSTOM_ASSET_CLASSES_PATH],
  visibleWhen: (get) => usesCustomTargets(get) && hasTargetsInEffect(get),
  tier: 'details',
  summary: (value, get) => {
    const customs = readPortfolio(get).customAssetClasses;
    const parts = (listRows(value) as unknown as ClassTarget[])
      .filter((target) => target.accountId === null && target.target > 0)
      .map((target) => `${getAssetClassLabel(target.assetClass, customs)} ${formatPercent(target.target)}`);
    return parts.length > 0 ? parts.join(', ') : null;
  },
};

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

/** The holdings of every account, grouped by account; edits the securities registry too. */
export const HOLDINGS: FieldSpec = {
  path: HOLDINGS_PATH,
  kind: 'custom',
  label: 'Holdings',
  renderer: HOLDINGS_RENDERER,
  covers: [SECURITIES_PATH],
  visibleWhen: hasHoldingsInEffect,
  tier: 'details',
  summary: (value) => plural(listRows(value).length, 'holding', 'holdings'),
};

// ---------------------------------------------------------------------------
// New cash (calculator-only)
// ---------------------------------------------------------------------------

/**
 * This run's new cash per account that can be rebalanced: Auto is the
 * account's normal contributions (normalNewCash), Custom the visitor's own
 * figure for this run (a portfolio.newCash row).
 */
export const NEW_CASH: FieldSpec = {
  path: NEW_CASH_PATH,
  kind: 'custom',
  label: 'New cash this month',
  renderer: NEW_CASH_RENDERER,
  tier: 'details',
  summary: (_value, get) => {
    const labels = accountLabels(get);
    const parts = rebalanceCandidates(get).map(
      (account) => `${labels.get(account.id) ?? accountDisplayName(account)} ${formatCurrency(newCashFor(get, account.id))}`
    );
    return parts.length > 0 ? parts.join(', ') : null;
  },
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const MODE_OPTIONS: readonly (FieldOption & { value: RebalanceMode })[] = [
  { value: 'whole', label: 'Whole shares', description: 'Rounds down; leftover stays as cash.' },
  { value: 'fractional', label: 'Fractional', description: 'Exact amounts; your broker must allow fractions.' },
];

export const MODE: FieldSpec = {
  path: MODE_PATH,
  kind: 'choice',
  label: 'Purchase mode',
  options: MODE_OPTIONS,
  tier: 'assumption',
  summary: (value) => MODE_OPTIONS.find((option) => option.value === value)?.label ?? null,
};

export const ALLOW_TAXABLE_SELLING: FieldSpec = {
  path: ALLOW_TAXABLE_SELLING_PATH,
  kind: 'boolean',
  label: 'Allow selling in taxable accounts',
  tier: 'assumption',
  summary: (value) => (value === true ? 'selling in taxable allowed' : 'no selling in taxable'),
};

export const SHOW_PLACEMENT_ADVICE: FieldSpec = {
  path: SHOW_PLACEMENT_ADVICE_PATH,
  kind: 'boolean',
  label: 'Show tax-efficient placement advice',
  tier: 'assumption',
  summary: (value) => (value === true ? 'placement advice shown' : 'placement advice hidden'),
};

export const SETTINGS_FIELDS: readonly FieldSpec[] = [MODE, ALLOW_TAXABLE_SELLING, SHOW_PLACEMENT_ADVICE];
