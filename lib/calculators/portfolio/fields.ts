/**
 * Field specs only the portfolio rebalancer asks: the target mix and the
 * class-targets editor, the accounts list, the holdings editor and the three
 * settings. Wording is the rebalancer's from before the rebuild (the target
 * mix keeps the intake's); option labels come from lib/constants/labels.ts.
 *
 * The holdings and class-targets editors are custom fields: their renderers
 * (components/calculators/renderers/portfolio.tsx) edit the related lists
 * through the reducers, so a field covers every list it writes.
 */

import { getAssetClassLabel, type Account, type ClassTarget, type RebalanceMode } from '@/lib/calculations/portfolioRebalancing';
import {
  ACCOUNT_TYPE_OPTIONS,
  TARGET_MIX_LABELS,
  TARGET_MIX_OPTIONS,
} from '@/lib/constants/labels';
import { listRows } from '@/lib/fields/runtime';
import type { FieldOption, FieldSpec, Get, Write } from '@/lib/fields/types';
import { formatCount, formatCurrency, formatPercent } from '@/lib/format';
import { TARGET_MIX_WEIGHTS, presetClassTargets, type PresetTargetMix } from '@/lib/profile/defaults';
import type { TargetMixPreset } from '@/lib/profile/types';
import {
  ACCOUNTS_PATH,
  ALLOW_TAXABLE_SELLING_PATH,
  CLASS_TARGETS_PATH,
  CUSTOM_ASSET_CLASSES_PATH,
  HOLDINGS_PATH,
  MODE_PATH,
  SECURITIES_PATH,
  SHOW_PLACEMENT_ADVICE_PATH,
  TARGET_MIX_PATH,
  usesCustomTargets,
} from './bindings';
import { addAccount, portfolioWrites, readPortfolio, removeAccount } from './reducers';

/** Renderer ids (FieldSpec.renderer) of the two custom editors. */
export const HOLDINGS_RENDERER = 'portfolio-holdings';
export const CLASS_TARGETS_RENDERER = 'portfolio-class-targets';

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

function accountName(account: { name?: unknown }): string | null {
  return typeof account.name === 'string' && account.name !== '' ? account.name : null;
}

/** An account's name, or its place in the list ('Account 2') while it has none. */
export function accountLabel(account: { name?: unknown }, index: number): string {
  return accountName(account) ?? `Account ${index + 1}`;
}

/** An account's name inside a sentence: its own name, else "account 2". */
function accountInText(account: { name?: unknown }, index: number): string {
  return accountName(account) ?? `account ${index + 1}`;
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
  summary: (value) => TARGET_MIX_LABELS[value as TargetMixPreset] ?? null,
};

/** The editor for each class's target, shown for the custom mix. */
export const CLASS_TARGETS: FieldSpec = {
  path: CLASS_TARGETS_PATH,
  kind: 'custom',
  label: 'Target allocation',
  renderer: CLASS_TARGETS_RENDERER,
  covers: [CUSTOM_ASSET_CLASSES_PATH],
  visibleWhen: usesCustomTargets,
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
// Accounts
// ---------------------------------------------------------------------------

export const ACCOUNT_NAME: FieldSpec = {
  path: 'name',
  kind: 'text',
  label: 'Account name',
  placeholder: 'Fidelity Roth IRA',
  maxLength: 40,
  tier: 'details',
  testId: 'account-name-{i}',
};

export const ACCOUNT_TYPE: FieldSpec = {
  path: 'accountType',
  kind: 'select',
  label: 'Type',
  options: ACCOUNT_TYPE_OPTIONS,
  tier: 'details',
};

/** The new cash going into the account: the one home of "new cash to invest this month". */
export const ACCOUNT_DEPOSIT: FieldSpec = {
  path: 'deposit',
  kind: 'money',
  label: 'New cash',
  help: 'Money you are ready to put into your accounts now.',
  placeholder: '0.00',
  min: 0,
  precision: 2,
  tier: 'details',
};

export const ACCOUNTS: FieldSpec = {
  path: ACCOUNTS_PATH,
  kind: 'list',
  label: 'Accounts',
  row: [ACCOUNT_NAME, ACCOUNT_TYPE, ACCOUNT_DEPOSIT],
  newRow: (get) => {
    const { accounts } = addAccount(readPortfolio(get));
    return { ...accounts[accounts.length - 1] };
  },
  itemLabel: (row, index) => accountLabel(row, index),
  addLabel: 'Add account',
  minRows: 1,
  confirmRemove: (row, index) => `Delete ${accountInText(row, index)}? Its holdings will be removed too.`,
  removeLabel: (row, index) => `Remove ${accountInText(row, index)}`,
  // The account's holdings go with it, and so do the securities only they held.
  removeRow: (get, index) => {
    const portfolio = readPortfolio(get);
    const account = portfolio.accounts[index];
    if (!account) return [];
    return portfolioWrites(portfolio, { ...removeAccount(portfolio, account.id), accounts: portfolio.accounts });
  },
  tier: 'details',
  summary: (value) => {
    const accounts = listRows(value) as unknown as Account[];
    const newCash = accounts.reduce((sum, account) => sum + account.deposit, 0);
    return `${plural(accounts.length, 'account', 'accounts')}, ${formatCurrency(newCash)} new cash`;
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
  tier: 'details',
  summary: (value) => plural(listRows(value).length, 'holding', 'holdings'),
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const MODE_OPTIONS: readonly (FieldOption & { value: RebalanceMode })[] = [
  { value: 'whole', label: 'Whole shares', description: 'Floor to integers; leftover kept as cash.' },
  { value: 'fractional', label: 'Fractional', description: 'Exact-to-penny splits. Requires broker support.' },
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
