/**
 * Asset-Location Preferences
 *
 * Given an asset's class + account type, suggest whether it would be more
 * tax-efficient in a different account. Preferences are tax-driven, not
 * return-driven — the suggestion is "where does this asset generate the
 * least tax drag?", not "where will it grow fastest?".
 */

import { AccountType, AssetClass, RebalanceAsset } from './portfolioRebalancing';

/**
 * Lower index = stronger preference. Accounts within the same preference
 * position are substitutable — the suggestion always returns the top pick.
 *
 * Only built-in asset classes have an opinion here. Custom (user-defined)
 * classes return `undefined` and bypass placement advice.
 */
export const LOCATION_PREFERENCE: Partial<Record<AssetClass, AccountType[]>> = {
  'bonds':       ['tax-deferred', 'tax-free', 'taxable'],
  'reits':       ['tax-deferred', 'tax-free', 'taxable'],
  'us-stock':    ['tax-free', 'taxable', 'tax-deferred'],
  'intl-stock':  ['taxable', 'tax-free', 'tax-deferred'], // foreign tax credit
  'cash':        ['taxable', 'tax-free', 'tax-deferred'],
  'other':       ['tax-deferred', 'tax-free', 'taxable'],
};

export interface PlacementSuggestion {
  preferredAccount: AccountType;
  reason: string;
}

/**
 * Plain-English reasons keyed by (assetClass -> preferredAccount).
 * Only the combinations we actually surface have entries.
 */
const REASONS: Partial<Record<AssetClass, Partial<Record<AccountType, string>>>> = {
  'bonds': {
    'tax-deferred': 'Bonds generate ordinary-income distributions — shelter them in a tax-deferred account.',
  },
  'reits': {
    'tax-deferred': 'REIT dividends are taxed as ordinary income — shelter them in a tax-deferred account.',
  },
  'us-stock': {
    'tax-free': 'US stocks grow best in a tax-free account where qualified gains and growth are untaxed.',
  },
  'intl-stock': {
    'taxable': 'International funds pay foreign tax — holding them in taxable preserves the foreign tax credit.',
  },
};

/**
 * Return a placement suggestion, or `null` when the asset is already in its
 * top-preferred account, or when the asset class has no strong opinion
 * (cash and other).
 */
export function placementAdvice(asset: RebalanceAsset): PlacementSuggestion | null {
  // No strong opinion for these classes.
  if (asset.assetClass === 'cash' || asset.assetClass === 'other') {
    return null;
  }

  const preference = LOCATION_PREFERENCE[asset.assetClass];
  if (!preference || preference.length === 0) return null;

  const preferredAccount = preference[0];
  if (asset.accountType === preferredAccount) return null;

  const reason = REASONS[asset.assetClass]?.[preferredAccount];
  if (!reason) return null;

  return { preferredAccount, reason };
}
