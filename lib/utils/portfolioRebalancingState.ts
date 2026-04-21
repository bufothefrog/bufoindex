/**
 * URL hash encoding for Portfolio Rebalancing Calculator state.
 * Base64-url encoded JSON, compressed to short keys.
 *
 * Schema versions:
 *   v1 — single-account legacy shape: {ticker, shares, price, targetAllocation}.
 *        Migrated to v2/v3: one "Brokerage" taxable account, all-"other" class
 *        target.
 *   v2 — adds per-asset accountType + assetClass, and top-level
 *        allowTaxableSelling + showPlacementAdvice toggles. Single-account only.
 *        Migrated to v3: one "Brokerage" account (type from first asset),
 *        securities registry deduped by ticker, class targets bucketed by class.
 *   v3 — multi-account, securities-registry shape. Carries setupMode,
 *        securities, accounts, holdings, and classTargets explicitly.
 *
 * The decoder accepts v1, v2, and v3 hashes and always returns a
 * `RebalanceInputsV2` (the current v2 type).
 */

import {
  AccountType,
  AssetClass,
  Account,
  ClassTarget,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  Holding,
  RebalanceInputsV2,
  RebalanceMode,
  Security,
  SetupMode,
} from '@/lib/calculations/portfolioRebalancing';

// ---------------------------------------------------------------------------
// v1 / v2 legacy compressed shapes (decode-only; encoders kept for tests)
// ---------------------------------------------------------------------------

interface CompressedAssetV1V2 {
  t: string; // ticker
  s: number; // currentShares
  p: number; // price
  a: number; // targetAllocation (decimal)
  c?: AccountType; // account type (v2 only)
  k?: AssetClass; // asset class / "kind" (v2 only)
}

interface CompressedStateV1V2 {
  v: 1 | 2;
  d?: number; // deposit
  m?: RebalanceMode;
  s?: boolean; // allowTaxableSelling (v2 only)
  p?: boolean; // showPlacementAdvice (v2 only)
  a: CompressedAssetV1V2[];
}

// ---------------------------------------------------------------------------
// v3 compressed shape
// ---------------------------------------------------------------------------

interface CompressedSecurityV3 {
  i: string; // id
  t: string; // ticker
  n?: string; // optional name
  p: number; // price
  k: AssetClass;
}

interface CompressedAccountV3 {
  i: string; // id
  n: string; // name
  c: AccountType;
  d: number; // deposit
}

interface CompressedHoldingV3 {
  i: string; // id
  a: string; // accountId
  s: string; // securityId
  h: number; // shares
}

interface CompressedClassTargetV3 {
  a: string | null; // accountId (null = portfolio-wide)
  k: AssetClass;
  t: number;
}

interface CompressedStateV3 {
  v: 3;
  sm: SetupMode;
  se: CompressedSecurityV3[];
  ac: CompressedAccountV3[];
  ho: CompressedHoldingV3[];
  ct: CompressedClassTargetV3[];
  s?: boolean; // allowTaxableSelling (omitted when false)
  p?: boolean; // showPlacementAdvice (omitted when false)
  m?: RebalanceMode; // omitted when 'whole'
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
const VALID_SETUP_MODES: ReadonlyArray<SetupMode> = ['single', 'multi-shared', 'multi-unique'];

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

function isValidSetupMode(value: unknown): value is SetupMode {
  return VALID_SETUP_MODES.includes(value as SetupMode);
}

// ---------------------------------------------------------------------------
// base64-url helpers
// ---------------------------------------------------------------------------

function toBase64Url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64Url(hash: string): string | null {
  const cleanHash = hash.replace(/^#/, '');
  if (!cleanHash || cleanHash.length < 4 || !/^[A-Za-z0-9_-]+$/.test(cleanHash)) {
    return null;
  }
  const base64 =
    cleanHash.replace(/-/g, '+').replace(/_/g, '/') +
    '=='.substring(0, (4 - (cleanHash.length % 4)) % 4);
  try {
    return atob(base64);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Encoders
// ---------------------------------------------------------------------------

/**
 * Primary encoder. Always emits v3 for the current `RebalanceInputsV2` shape.
 */
export function encodeRebalancingToUrlHash(inputs: RebalanceInputsV2): string {
  try {
    const compressed: CompressedStateV3 = {
      v: 3,
      sm: inputs.setupMode,
      se: inputs.securities.map(sec => {
        const c: CompressedSecurityV3 = {
          i: sec.id,
          t: sec.ticker,
          p: sec.price,
          k: sec.assetClass,
        };
        if (sec.name) c.n = sec.name;
        return c;
      }),
      ac: inputs.accounts.map(acc => ({
        i: acc.id,
        n: acc.name,
        c: acc.accountType,
        d: acc.deposit,
      })),
      ho: inputs.holdings.map(h => ({
        i: h.id,
        a: h.accountId,
        s: h.securityId,
        h: h.shares,
      })),
      ct: inputs.classTargets.map(t => ({
        a: t.accountId,
        k: t.assetClass,
        t: t.target,
      })),
    };
    if (inputs.allowTaxableSelling) compressed.s = true;
    if (inputs.showPlacementAdvice) compressed.p = true;
    if (inputs.mode !== 'whole') compressed.m = inputs.mode;

    const json = JSON.stringify(compressed);
    const base64 = btoa(json);
    return toBase64Url(base64);
  } catch {
    return '';
  }
}

/**
 * Legacy v1/v2 encoder. Preserved for test fixtures that construct legacy
 * hashes to verify migration. Not called by the store.
 */
export function encodeRebalancingV1ToUrlHash(params: {
  version: 1 | 2;
  assets: Array<{
    ticker: string;
    currentShares: number;
    price: number;
    targetAllocation: number;
    accountType?: AccountType;
    assetClass?: AssetClass;
  }>;
  deposit?: number;
  mode?: RebalanceMode;
  allowTaxableSelling?: boolean;
  showPlacementAdvice?: boolean;
}): string {
  try {
    const compressed: CompressedStateV1V2 = {
      v: params.version,
      a: params.assets.map(asset => {
        const ca: CompressedAssetV1V2 = {
          t: asset.ticker,
          s: asset.currentShares,
          p: asset.price,
          a: asset.targetAllocation,
        };
        if (params.version === 2) {
          if (asset.accountType && asset.accountType !== DEFAULT_ACCOUNT_TYPE) {
            ca.c = asset.accountType;
          }
          if (asset.assetClass && asset.assetClass !== DEFAULT_ASSET_CLASS) {
            ca.k = asset.assetClass;
          }
        }
        return ca;
      }),
    };
    if (params.deposit && params.deposit !== 0) compressed.d = params.deposit;
    if (params.mode && params.mode !== 'whole') compressed.m = params.mode;
    if (params.version === 2) {
      if (params.allowTaxableSelling) compressed.s = true;
      if (params.showPlacementAdvice) compressed.p = true;
    }

    const json = JSON.stringify(compressed);
    const base64 = btoa(json);
    return toBase64Url(base64);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// v1 / v2 → v3 migration
// ---------------------------------------------------------------------------

/**
 * Simple deterministic id generator for migration. Uses a counter so the same
 * input always produces the same ids (predictable for tests).
 */
function idFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(++n).toString(36)}`;
}

function migrateV1OrV2(state: CompressedStateV1V2): RebalanceInputsV2 {
  const version = state.v;
  const rawAssets = Array.isArray(state.a) ? state.a : [];

  const nextAccountId = idFactory('acc');
  const nextSecurityId = idFactory('sec');
  const nextHoldingId = idFactory('hld');

  // All v1/v2 hashes represent a single account.
  const firstAccountType: AccountType =
    version === 2 && rawAssets.length > 0
      ? coerceAccountType(rawAssets[0].c)
      : DEFAULT_ACCOUNT_TYPE;

  const account: Account = {
    id: nextAccountId(),
    name: 'Brokerage',
    accountType: firstAccountType,
    deposit: typeof state.d === 'number' && isFinite(state.d) ? state.d : 0,
  };

  // Build securities registry deduped by uppercase ticker. Price and asset
  // class come from the first occurrence.
  const securitiesByTicker = new Map<string, Security>();
  const holdings: Holding[] = [];
  const classSums = new Map<AssetClass, number>();

  rawAssets.forEach(a => {
    const ticker = typeof a.t === 'string' ? a.t : '';
    const upperTicker = ticker.trim().toUpperCase();
    const price = typeof a.p === 'number' && isFinite(a.p) ? a.p : 0;
    const shares = typeof a.s === 'number' && isFinite(a.s) ? a.s : 0;
    const targetAlloc = typeof a.a === 'number' && isFinite(a.a) ? a.a : 0;
    const assetClass: AssetClass =
      version === 2 ? coerceAssetClass(a.k) : DEFAULT_ASSET_CLASS;

    let security = securitiesByTicker.get(upperTicker);
    if (!security) {
      security = {
        id: nextSecurityId(),
        ticker,
        price,
        assetClass,
      };
      securitiesByTicker.set(upperTicker, security);
    }

    holdings.push({
      id: nextHoldingId(),
      accountId: account.id,
      securityId: security.id,
      shares,
    });

    classSums.set(assetClass, (classSums.get(assetClass) ?? 0) + targetAlloc);
  });

  const classTargets: ClassTarget[] = Array.from(classSums.entries()).map(([ac, target]) => ({
    accountId: null,
    assetClass: ac,
    target,
  }));

  // Deterministic ordering (largest target first) for stable tests.
  classTargets.sort((x, y) => y.target - x.target);

  return {
    setupMode: 'single',
    securities: Array.from(securitiesByTicker.values()),
    classTargets,
    accounts: [account],
    holdings,
    allowTaxableSelling: version === 2 ? state.s === true : false,
    showPlacementAdvice: version === 2 ? state.p === true : false,
    mode: state.m === 'fractional' ? 'fractional' : 'whole',
  };
}

// ---------------------------------------------------------------------------
// v3 decode
// ---------------------------------------------------------------------------

function decodeV3(raw: unknown): RebalanceInputsV2 | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CompressedStateV3>;
  if (r.v !== 3) return null;
  if (!isValidSetupMode(r.sm)) return null;
  if (!Array.isArray(r.se) || !Array.isArray(r.ac) || !Array.isArray(r.ho) || !Array.isArray(r.ct)) {
    return null;
  }

  const securities: Security[] = r.se.map((s, idx) => {
    const sec = s as Partial<CompressedSecurityV3>;
    return {
      id: typeof sec.i === 'string' && sec.i.length > 0 ? sec.i : `sec-${idx}`,
      ticker: typeof sec.t === 'string' ? sec.t : '',
      ...(typeof sec.n === 'string' ? { name: sec.n } : {}),
      price: typeof sec.p === 'number' && isFinite(sec.p) ? sec.p : 0,
      assetClass: coerceAssetClass(sec.k),
    };
  });

  const accounts: Account[] = r.ac.map((a, idx) => {
    const acc = a as Partial<CompressedAccountV3>;
    return {
      id: typeof acc.i === 'string' && acc.i.length > 0 ? acc.i : `acc-${idx}`,
      name: typeof acc.n === 'string' ? acc.n : `Account ${idx + 1}`,
      accountType: coerceAccountType(acc.c),
      deposit: typeof acc.d === 'number' && isFinite(acc.d) ? acc.d : 0,
    };
  });

  const holdings: Holding[] = r.ho.map((h, idx) => {
    const hd = h as Partial<CompressedHoldingV3>;
    return {
      id: typeof hd.i === 'string' && hd.i.length > 0 ? hd.i : `hld-${idx}`,
      accountId: typeof hd.a === 'string' ? hd.a : '',
      securityId: typeof hd.s === 'string' ? hd.s : '',
      shares: typeof hd.h === 'number' && isFinite(hd.h) ? hd.h : 0,
    };
  });

  const classTargets: ClassTarget[] = r.ct.map(t => {
    const ct = t as Partial<CompressedClassTargetV3>;
    return {
      accountId: typeof ct.a === 'string' ? ct.a : null,
      assetClass: coerceAssetClass(ct.k),
      target: typeof ct.t === 'number' && isFinite(ct.t) ? ct.t : 0,
    };
  });

  return {
    setupMode: r.sm,
    securities,
    accounts,
    holdings,
    classTargets,
    allowTaxableSelling: r.s === true,
    showPlacementAdvice: r.p === true,
    mode: r.m === 'fractional' ? 'fractional' : 'whole',
  };
}

// ---------------------------------------------------------------------------
// Primary decode (accepts v1 / v2 / v3)
// ---------------------------------------------------------------------------

export function decodeRebalancingFromUrlHash(hash: string): RebalanceInputsV2 | null {
  const json = fromBase64Url(hash);
  if (json == null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { v?: unknown };

  if (obj.v === 1 || obj.v === 2) {
    // Legacy shape: must have an assets array.
    const legacy = parsed as CompressedStateV1V2;
    if (!Array.isArray(legacy.a)) return null;
    return migrateV1OrV2(legacy);
  }

  if (obj.v === 3) {
    return decodeV3(parsed);
  }

  return null;
}
