/**
 * URL hash encoding for Portfolio Rebalancing Calculator state.
 * Base64-url encoded JSON, compressed to short keys.
 *
 * Schema versions:
 *   v1 — ticker, shares, price, targetAllocation only. Decodes to defaults for
 *        accountType / assetClass and false for the sell/placement toggles.
 *   v2 — adds per-asset accountType + assetClass, and top-level
 *        allowTaxableSelling + showPlacementAdvice toggles.
 *
 * The decoder accepts both v1 and v2.
 */

import {
  AccountType,
  AssetClass,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  RebalanceAsset,
  RebalanceInputs,
  RebalanceMode,
} from '@/lib/calculations/portfolioRebalancing';

interface CompressedAsset {
  t: string; // ticker
  s: number; // currentShares
  p: number; // price
  a: number; // targetAllocation (decimal)
  c?: AccountType; // account type (omitted when DEFAULT_ACCOUNT_TYPE)
  k?: AssetClass;  // asset class / "kind" (omitted when DEFAULT_ASSET_CLASS)
}

interface CompressedState {
  v: number;
  d?: number; // deposit
  m?: RebalanceMode;
  s?: boolean; // allowTaxableSelling (omitted when false)
  p?: boolean; // showPlacementAdvice (omitted when false)
  a: CompressedAsset[];
}

const VALID_ACCOUNT_TYPES: ReadonlyArray<AccountType> = ['taxable', 'tax-deferred', 'tax-free'];
const VALID_ASSET_CLASSES: ReadonlyArray<AssetClass> = [
  'us-stock',
  'intl-stock',
  'bonds',
  'reits',
  'cash',
  'other',
];

function coerceAccountType(value: unknown): AccountType {
  return VALID_ACCOUNT_TYPES.includes(value as AccountType)
    ? (value as AccountType)
    : DEFAULT_ACCOUNT_TYPE;
}

function coerceAssetClass(value: unknown): AssetClass {
  return VALID_ASSET_CLASSES.includes(value as AssetClass)
    ? (value as AssetClass)
    : DEFAULT_ASSET_CLASS;
}

export function encodeRebalancingToUrlHash(inputs: RebalanceInputs): string {
  try {
    const compressed: CompressedState = {
      v: 2,
      a: inputs.assets.map(asset => {
        const compressedAsset: CompressedAsset = {
          t: asset.ticker,
          s: asset.currentShares,
          p: asset.price,
          a: asset.targetAllocation,
        };
        if (asset.accountType !== DEFAULT_ACCOUNT_TYPE) {
          compressedAsset.c = asset.accountType;
        }
        if (asset.assetClass !== DEFAULT_ASSET_CLASS) {
          compressedAsset.k = asset.assetClass;
        }
        return compressedAsset;
      }),
    };
    if (inputs.deposit !== 0) compressed.d = inputs.deposit;
    if (inputs.mode !== 'whole') compressed.m = inputs.mode;
    if (inputs.allowTaxableSelling) compressed.s = true;
    if (inputs.showPlacementAdvice) compressed.p = true;

    const json = JSON.stringify(compressed);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch {
    return '';
  }
}

export function decodeRebalancingFromUrlHash(hash: string): RebalanceInputs | null {
  try {
    const cleanHash = hash.replace(/^#/, '');
    if (!cleanHash || cleanHash.length < 4 || !/^[A-Za-z0-9_-]+$/.test(cleanHash)) {
      return null;
    }

    const base64 = cleanHash.replace(/-/g, '+').replace(/_/g, '/') +
      '=='.substring(0, (4 - (cleanHash.length % 4)) % 4);
    const json = atob(base64);
    const compressed = JSON.parse(json) as CompressedState;

    if (!compressed || (compressed.v !== 1 && compressed.v !== 2) || !Array.isArray(compressed.a)) {
      return null;
    }

    const assets: RebalanceAsset[] = compressed.a.map((a, idx) => ({
      id: `asset-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: typeof a.t === 'string' ? a.t : '',
      currentShares: typeof a.s === 'number' ? a.s : 0,
      price: typeof a.p === 'number' ? a.p : 0,
      targetAllocation: typeof a.a === 'number' ? a.a : 0,
      accountType: coerceAccountType(a.c),
      assetClass: coerceAssetClass(a.k),
    }));

    return {
      assets,
      deposit: typeof compressed.d === 'number' ? compressed.d : 0,
      mode: compressed.m === 'fractional' ? 'fractional' : 'whole',
      allowTaxableSelling: compressed.s === true,
      showPlacementAdvice: compressed.p === true,
    };
  } catch {
    return null;
  }
}
