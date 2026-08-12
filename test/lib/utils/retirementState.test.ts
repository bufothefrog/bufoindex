/**
 * Codec tests for the retirement URL-hash state — v2 adds the display-only
 * `dm` (dollar display mode) key, elided when it equals the default ('today').
 * v1 payloads (no dm) must keep decoding, falling back to 'today'.
 *
 * These tests exercise the codec in isolation (no store, no calculator).
 */

import { describe, it, expect } from 'vitest';
import {
  decodeRetirementFromUrlHash,
  encodeRetirementToUrlHash,
} from '@/lib/utils/retirementState';
import { RetirementInputs } from '@/lib/calculations/retirement';
import { RetirementConstants } from '@/lib/constants/retirement';

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

/**
 * Round-trippable inputs. Note: necessaryMonthlyExpenses must be 5000 — the
 * codec never encodes it and always restores that default on decode.
 */
function fixtureInputs(overrides: Partial<RetirementInputs> = {}): RetirementInputs {
  return {
    startingAge: 30,
    retirementAge: 65,
    lifeExpectancy: 90,
    targetIncome: 90000,
    startingBalance: 50000,
    currentIncome: 120000,
    incomeAmount: 120000,
    incomePeriod: 'yearly',
    monthlySavings: 2500,
    necessaryMonthlyExpenses: 5000,
    accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
    retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
    inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
    socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
    socialSecurityBenefit: 30000,
    healthcareCostMultiplier: 1,
    volatility: RetirementConstants.DEFAULT_VOLATILITY,
    filingStatus: 'single',
    state: 'TX',
    riskProfile: 'tdf',
    effectiveTaxRate: null,
    estimatedAnnualHealthcareCost: null,
    ...overrides,
  };
}

/** Build a URL-safe hash from a raw compressed payload (mirrors the codec). */
function hashFromPayload(payload: Record<string, unknown>): string {
  const base64 = btoa(JSON.stringify(payload));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a hash back into its raw compressed payload for inspection. */
function payloadFromHash(hash: string): Record<string, unknown> {
  const base64 =
    hash.replace(/-/g, '+').replace(/_/g, '/') +
    '=='.substring(0, (4 - (hash.length % 4)) % 4);
  return JSON.parse(atob(base64));
}

// ---------------------------------------------------------------------------
// v2 roundtrip
// ---------------------------------------------------------------------------

describe('v2 encode/decode roundtrip', () => {
  it("roundtrips inputs with dm='nominal'", () => {
    const inputs = fixtureInputs();
    const hash = encodeRetirementToUrlHash(inputs, 'nominal');
    expect(hash).toBeTruthy();

    const decoded = decodeRetirementFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.displayMode).toBe('nominal');
    expect(decoded.inputs).toEqual(inputs);
  });

  it("roundtrips the default display mode ('today')", () => {
    const inputs = fixtureInputs();
    const decoded = decodeRetirementFromUrlHash(encodeRetirementToUrlHash(inputs, 'today'));
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.displayMode).toBe('today');
    expect(decoded.inputs).toEqual(inputs);
  });

  it('writes v2 payloads', () => {
    const payload = payloadFromHash(encodeRetirementToUrlHash(fixtureInputs()));
    expect(payload.v).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Default elision
// ---------------------------------------------------------------------------

describe('dm default elision', () => {
  it("omits dm from the payload when the mode is 'today'", () => {
    const payload = payloadFromHash(encodeRetirementToUrlHash(fixtureInputs(), 'today'));
    expect('dm' in payload).toBe(false);
  });

  it("includes dm in the payload when the mode is 'nominal'", () => {
    const payload = payloadFromHash(encodeRetirementToUrlHash(fixtureInputs(), 'nominal'));
    expect(payload.dm).toBe('nominal');
  });

  it("defaults to 'today' when the displayMode argument is omitted", () => {
    expect(encodeRetirementToUrlHash(fixtureInputs())).toBe(
      encodeRetirementToUrlHash(fixtureInputs(), 'today')
    );
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('v1 payload migration', () => {
  it("decodes an old v1 payload without dm to displayMode 'today'", () => {
    const hash = hashFromPayload({ v: 1, sa: 30, ra: 65, ti: 90000 });
    const decoded = decodeRetirementFromUrlHash(hash);

    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.displayMode).toBe('today');
    expect(decoded.inputs.startingAge).toBe(30);
    expect(decoded.inputs.retirementAge).toBe(65);
    expect(decoded.inputs.targetIncome).toBe(90000);
    // Elided fields restore their defaults
    expect(decoded.inputs.state).toBe('TX');
    expect(decoded.inputs.riskProfile).toBe('tdf');
    expect(decoded.inputs.inflationRate).toBe(RetirementConstants.DEFAULT_INFLATION_RATE);
  });

  it('rejects unsupported payload versions', () => {
    const hash = hashFromPayload({ v: 99, sa: 30, ra: 65 });
    expect(decodeRetirementFromUrlHash(hash)).toBeNull();
  });

  it('rejects garbage hashes', () => {
    expect(decodeRetirementFromUrlHash('not-valid-base64!!!')).toBeNull();
    expect(decodeRetirementFromUrlHash('')).toBeNull();
  });
});
