/**
 * URL hash encoding for Portfolio Rebalancing Calculator state.
 * Base64-url encoded JSON, compressed to short keys.
 */

import {
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
}

interface CompressedState {
  v: number;
  d?: number; // deposit
  m?: RebalanceMode;
  a: CompressedAsset[];
}

export function encodeRebalancingToUrlHash(inputs: RebalanceInputs): string {
  try {
    const compressed: CompressedState = {
      v: 1,
      a: inputs.assets.map(asset => ({
        t: asset.ticker,
        s: asset.currentShares,
        p: asset.price,
        a: asset.targetAllocation,
      })),
    };
    if (inputs.deposit !== 0) compressed.d = inputs.deposit;
    if (inputs.mode !== 'whole') compressed.m = inputs.mode;

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

    if (!compressed || compressed.v !== 1 || !Array.isArray(compressed.a)) {
      return null;
    }

    const assets: RebalanceAsset[] = compressed.a.map((a, idx) => ({
      id: `asset-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: typeof a.t === 'string' ? a.t : '',
      currentShares: typeof a.s === 'number' ? a.s : 0,
      price: typeof a.p === 'number' ? a.p : 0,
      targetAllocation: typeof a.a === 'number' ? a.a : 0,
      accountType: DEFAULT_ACCOUNT_TYPE,
      assetClass: DEFAULT_ASSET_CLASS,
    }));

    return {
      assets,
      deposit: typeof compressed.d === 'number' ? compressed.d : 0,
      mode: compressed.m === 'fractional' ? 'fractional' : 'whole',
      allowTaxableSelling: false,
      showPlacementAdvice: false,
    };
  } catch {
    return null;
  }
}
