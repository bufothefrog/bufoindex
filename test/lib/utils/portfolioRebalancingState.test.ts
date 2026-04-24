/**
 * Codec tests for URL-hash v3 — including v1→v3 and v2→v3 migration paths.
 *
 * These tests exercise the codec in isolation (no store, no calculator). The
 * downstream v2 validator is still a stub at the time of writing; we assert
 * structural equality of the decoded `RebalanceInputsV2` rather than trying to
 * run a full rebalance.
 */

import { describe, it, expect } from 'vitest';
import {
  decodeRebalancingFromUrlHash,
  encodeRebalancingToUrlHash,
  encodeRebalancingV1ToUrlHash,
} from '@/lib/utils/portfolioRebalancingState';
import {
  Account,
  ClassTarget,
  Holding,
  RebalanceInputsV2,
  Security,
} from '@/lib/calculations/portfolioRebalancing';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fixtureMultiShared(): RebalanceInputsV2 {
  const securities: Security[] = [
    { id: 'sec-a', ticker: 'VTI', name: 'Vanguard Total US', price: 250.5, assetClass: 'us-stock' },
    { id: 'sec-b', ticker: 'VXUS', price: 60.25, assetClass: 'intl-stock' },
    { id: 'sec-c', ticker: 'BND', price: 72.1, assetClass: 'bonds' },
  ];

  const accounts: Account[] = [
    { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 500 },
    { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1500 },
  ];

  const holdings: Holding[] = [
    { id: 'hld-1', accountId: 'acc-roth', securityId: 'sec-a', shares: 10 },
    { id: 'hld-2', accountId: 'acc-roth', securityId: 'sec-c', shares: 5 },
    { id: 'hld-3', accountId: 'acc-brok', securityId: 'sec-a', shares: 20 },
    { id: 'hld-4', accountId: 'acc-brok', securityId: 'sec-b', shares: 15 },
  ];

  // Portfolio-wide targets sum to 1.0
  const classTargets: ClassTarget[] = [
    { accountId: null, assetClass: 'us-stock', target: 0.6 },
    { accountId: null, assetClass: 'intl-stock', target: 0.25 },
    { accountId: null, assetClass: 'bonds', target: 0.15 },
  ];

  return {
    setupMode: 'multi-shared',
    securities,
    accounts,
    holdings,
    classTargets,
    allowTaxableSelling: true,
    showPlacementAdvice: true,
    mode: 'fractional',
  };
}

// ---------------------------------------------------------------------------
// v3 roundtrip
// ---------------------------------------------------------------------------

describe('v3 encode/decode roundtrip', () => {
  it('losslessly roundtrips a multi-shared fixture', () => {
    const input = fixtureMultiShared();
    const hash = encodeRebalancingToUrlHash(input);
    expect(hash).toBeTruthy();

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    // The codec preserves ids verbatim — so we can compare the whole object.
    expect(decoded).toEqual(input);
  });

  it('omits default flags from the compressed payload but still decodes them', () => {
    const minimal: RebalanceInputsV2 = {
      setupMode: 'multi-shared',
      securities: [],
      accounts: [],
      holdings: [],
      classTargets: [],
      allowTaxableSelling: false,
      showPlacementAdvice: false,
      mode: 'whole',
    };
    const hash = encodeRebalancingToUrlHash(minimal);
    expect(hash).toBeTruthy();

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).toEqual(minimal);
  });

  it('flattens a legacy multi-unique hash to portfolio-wide targets', () => {
    const legacy: RebalanceInputsV2 = {
      setupMode: 'multi-unique',
      securities: [
        { id: 'sec-1', ticker: 'VTI', price: 200, assetClass: 'us-stock' },
      ],
      accounts: [
        { id: 'acc-1', name: 'Roth', accountType: 'tax-free', deposit: 0 },
        { id: 'acc-2', name: 'Taxable', accountType: 'taxable', deposit: 1000 },
      ],
      holdings: [
        { id: 'hld-1', accountId: 'acc-1', securityId: 'sec-1', shares: 3 },
      ],
      classTargets: [
        { accountId: 'acc-1', assetClass: 'us-stock', target: 1.0 },
        { accountId: 'acc-2', assetClass: 'us-stock', target: 0.5 },
        { accountId: 'acc-2', assetClass: 'bonds', target: 0.5 },
      ],
      allowTaxableSelling: false,
      showPlacementAdvice: false,
      mode: 'whole',
    };

    const decoded = decodeRebalancingFromUrlHash(encodeRebalancingToUrlHash(legacy));
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.setupMode).toBe('multi-shared');
    expect(decoded.accounts).toEqual(legacy.accounts);
    expect(decoded.holdings).toEqual(legacy.holdings);

    // Per-account targets are averaged per asset class into portfolio-wide
    // targets: us-stock across two accounts averages to (1.0 + 0.5) / 2 = 0.75,
    // bonds only appears in one account so averages to 0.5 / 1 = 0.5.
    const map = new Map(decoded.classTargets.map(t => [t.assetClass, t.target]));
    expect(map.get('us-stock')).toBeCloseTo(0.75, 6);
    expect(map.get('bonds')).toBeCloseTo(0.5, 6);
    decoded.classTargets.forEach(t => {
      expect(t.accountId).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// v1 → v3 migration
// ---------------------------------------------------------------------------

describe('v1 → v3 migration', () => {
  it('migrates a simple two-asset v1 hash to a single account with "other" class', () => {
    const hash = encodeRebalancingV1ToUrlHash({
      version: 1,
      assets: [
        { ticker: 'VTI', currentShares: 10, price: 200, targetAllocation: 0.6 },
        { ticker: 'BND', currentShares: 5, price: 80, targetAllocation: 0.4 },
      ],
      deposit: 1000,
      mode: 'whole',
    });

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.setupMode).toBe('multi-shared');

    // One "Brokerage" taxable account with the v1 deposit.
    expect(decoded.accounts).toHaveLength(1);
    expect(decoded.accounts[0].name).toBe('Brokerage');
    expect(decoded.accounts[0].accountType).toBe('taxable');
    expect(decoded.accounts[0].deposit).toBe(1000);

    // Two securities, each a deduped ticker, all 'other' class.
    expect(decoded.securities).toHaveLength(2);
    const tickers = decoded.securities.map(s => s.ticker).sort();
    expect(tickers).toEqual(['BND', 'VTI']);
    decoded.securities.forEach(sec => {
      expect(sec.assetClass).toBe('other');
    });

    // Two holdings, each in the one account, pointing at the registry entries.
    expect(decoded.holdings).toHaveLength(2);
    decoded.holdings.forEach(h => {
      expect(h.accountId).toBe(decoded.accounts[0].id);
      expect(decoded.securities.some(s => s.id === h.securityId)).toBe(true);
    });

    // Targets collapse to one 'other' bucket summing to ~1.0.
    expect(decoded.classTargets).toHaveLength(1);
    expect(decoded.classTargets[0]).toMatchObject({
      accountId: null,
      assetClass: 'other',
    });
    expect(decoded.classTargets[0].target).toBeCloseTo(1.0, 6);

    // v1 hashes never carry v2 toggles.
    expect(decoded.allowTaxableSelling).toBe(false);
    expect(decoded.showPlacementAdvice).toBe(false);
  });

  it('dedupes v1 assets with the same ticker (case-insensitive) into a single security', () => {
    const hash = encodeRebalancingV1ToUrlHash({
      version: 1,
      assets: [
        { ticker: 'vti', currentShares: 1, price: 200, targetAllocation: 0.5 },
        { ticker: 'VTI', currentShares: 2, price: 200, targetAllocation: 0.5 },
      ],
    });

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.securities).toHaveLength(1);
    // Two holdings reference the same security.
    expect(decoded.holdings).toHaveLength(2);
    expect(new Set(decoded.holdings.map(h => h.securityId)).size).toBe(1);
  });

  it('defaults v1 deposit to 0 when omitted', () => {
    const hash = encodeRebalancingV1ToUrlHash({
      version: 1,
      assets: [{ ticker: 'A', currentShares: 1, price: 10, targetAllocation: 1 }],
    });
    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded?.accounts[0].deposit).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// v2 → v3 migration
// ---------------------------------------------------------------------------

describe('v2 → v3 migration', () => {
  it('carries over account type, asset classes, and toggles', () => {
    const hash = encodeRebalancingV1ToUrlHash({
      version: 2,
      assets: [
        {
          ticker: 'VTI',
          currentShares: 10,
          price: 200,
          targetAllocation: 0.6,
          accountType: 'tax-free',
          assetClass: 'us-stock',
        },
        {
          ticker: 'BND',
          currentShares: 5,
          price: 80,
          targetAllocation: 0.4,
          accountType: 'tax-free',
          assetClass: 'bonds',
        },
      ],
      deposit: 500,
      mode: 'fractional',
      allowTaxableSelling: true,
      showPlacementAdvice: true,
    });

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.setupMode).toBe('multi-shared');
    // Single "Brokerage" account; type taken from the first asset.
    expect(decoded.accounts).toHaveLength(1);
    expect(decoded.accounts[0].name).toBe('Brokerage');
    expect(decoded.accounts[0].accountType).toBe('tax-free');
    expect(decoded.accounts[0].deposit).toBe(500);

    // Securities carry their assetClass.
    const vti = decoded.securities.find(s => s.ticker === 'VTI');
    const bnd = decoded.securities.find(s => s.ticker === 'BND');
    expect(vti?.assetClass).toBe('us-stock');
    expect(bnd?.assetClass).toBe('bonds');

    // One holding per v2 asset.
    expect(decoded.holdings).toHaveLength(2);

    // classTargets bucketed per class, summing to ~1 total.
    const buckets = new Map(decoded.classTargets.map(t => [t.assetClass, t.target]));
    expect(buckets.get('us-stock')).toBeCloseTo(0.6, 6);
    expect(buckets.get('bonds')).toBeCloseTo(0.4, 6);
    decoded.classTargets.forEach(t => {
      expect(t.accountId).toBeNull();
    });

    expect(decoded.allowTaxableSelling).toBe(true);
    expect(decoded.showPlacementAdvice).toBe(true);
    expect(decoded.mode).toBe('fractional');
  });

  it('buckets multiple v2 assets sharing the same class into one target', () => {
    const hash = encodeRebalancingV1ToUrlHash({
      version: 2,
      assets: [
        {
          ticker: 'VTI',
          currentShares: 1,
          price: 100,
          targetAllocation: 0.3,
          accountType: 'taxable',
          assetClass: 'us-stock',
        },
        {
          ticker: 'VOO',
          currentShares: 1,
          price: 100,
          targetAllocation: 0.3,
          accountType: 'taxable',
          assetClass: 'us-stock',
        },
        {
          ticker: 'BND',
          currentShares: 1,
          price: 100,
          targetAllocation: 0.4,
          accountType: 'taxable',
          assetClass: 'bonds',
        },
      ],
    });

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.classTargets).toHaveLength(2);
    const map = new Map(decoded.classTargets.map(t => [t.assetClass, t.target]));
    expect(map.get('us-stock')).toBeCloseTo(0.6, 6);
    expect(map.get('bonds')).toBeCloseTo(0.4, 6);
  });

  it('defaults v2 account type to taxable when the first asset omits one', () => {
    // No accountType set on the only asset — encoder drops the `c` field, so
    // the decoder sees `undefined` and coerces to the default (taxable).
    const hash = encodeRebalancingV1ToUrlHash({
      version: 2,
      assets: [
        {
          ticker: 'VTI',
          currentShares: 1,
          price: 100,
          targetAllocation: 1,
          assetClass: 'us-stock',
        },
      ],
    });

    const decoded = decodeRebalancingFromUrlHash(hash);
    expect(decoded?.accounts[0].accountType).toBe('taxable');
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('decode error handling', () => {
  it('returns null for a malformed hash', () => {
    expect(decodeRebalancingFromUrlHash('#!!!!not-base64!!!!')).toBeNull();
    expect(decodeRebalancingFromUrlHash('#abc')).toBeNull();
    expect(decodeRebalancingFromUrlHash('#')).toBeNull();
    expect(decodeRebalancingFromUrlHash('')).toBeNull();
  });

  it('returns null when the v3 payload is missing a setupMode', () => {
    // Hand-craft a v3 payload without `sm`.
    const badPayload = {
      v: 3,
      se: [],
      ac: [],
      ho: [],
      ct: [],
    };
    const base64 = btoa(JSON.stringify(badPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(decodeRebalancingFromUrlHash('#' + base64)).toBeNull();
  });

  it('returns null when the v3 payload has a non-enum setupMode', () => {
    const badPayload = {
      v: 3,
      sm: 'multi-everything',
      se: [],
      ac: [],
      ho: [],
      ct: [],
    };
    const base64 = btoa(JSON.stringify(badPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(decodeRebalancingFromUrlHash('#' + base64)).toBeNull();
  });

  it('returns null when required arrays are missing', () => {
    const badPayload = {
      v: 3,
      sm: 'single',
      // se missing
      ac: [],
      ho: [],
      ct: [],
    };
    const base64 = btoa(JSON.stringify(badPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(decodeRebalancingFromUrlHash('#' + base64)).toBeNull();
  });

  it('returns null for an unknown schema version', () => {
    const badPayload = { v: 99, foo: 'bar' };
    const base64 = btoa(JSON.stringify(badPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(decodeRebalancingFromUrlHash('#' + base64)).toBeNull();
  });

  it('returns null when v1/v2 payload lacks the assets array', () => {
    const badPayload = { v: 1 /* no a */ };
    const base64 = btoa(JSON.stringify(badPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(decodeRebalancingFromUrlHash('#' + base64)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty-but-valid v3 payload
// ---------------------------------------------------------------------------

describe('empty v3 payload', () => {
  it('decodes a portfolio-wide payload with empty arrays without throwing', () => {
    const empty: RebalanceInputsV2 = {
      setupMode: 'multi-shared',
      securities: [],
      accounts: [],
      holdings: [],
      classTargets: [],
      allowTaxableSelling: false,
      showPlacementAdvice: false,
      mode: 'whole',
    };
    const decoded = decodeRebalancingFromUrlHash(encodeRebalancingToUrlHash(empty));
    expect(decoded).toEqual(empty);
  });
});
