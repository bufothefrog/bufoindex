import { describe, it, expect } from 'vitest';
import {
  LOCATION_PREFERENCE,
  placementAdvice,
} from '@/lib/calculations/assetLocation';
import {
  AccountType,
  AssetClass,
  RebalanceAsset,
} from '@/lib/calculations/portfolioRebalancing';

function asset(accountType: AccountType, assetClass: AssetClass): RebalanceAsset {
  return {
    id: 'a',
    ticker: 'T',
    currentShares: 10,
    price: 10,
    targetAllocation: 1,
    accountType,
    assetClass,
  };
}

describe('LOCATION_PREFERENCE', () => {
  it('has an entry for every asset class', () => {
    const classes: AssetClass[] = ['us-stock', 'intl-stock', 'bonds', 'reits', 'cash', 'other'];
    classes.forEach(c => {
      expect(LOCATION_PREFERENCE[c]).toBeDefined();
      expect(LOCATION_PREFERENCE[c].length).toBeGreaterThan(0);
    });
  });
});

describe('placementAdvice', () => {
  it('returns null when bonds are already in tax-deferred', () => {
    expect(placementAdvice(asset('tax-deferred', 'bonds'))).toBeNull();
  });

  it('returns null for cash regardless of account', () => {
    expect(placementAdvice(asset('taxable', 'cash'))).toBeNull();
    expect(placementAdvice(asset('tax-deferred', 'cash'))).toBeNull();
    expect(placementAdvice(asset('tax-free', 'cash'))).toBeNull();
  });

  it('returns null for other regardless of account', () => {
    expect(placementAdvice(asset('taxable', 'other'))).toBeNull();
    expect(placementAdvice(asset('tax-deferred', 'other'))).toBeNull();
    expect(placementAdvice(asset('tax-free', 'other'))).toBeNull();
  });

  it('suggests tax-deferred for bonds held in taxable', () => {
    const advice = placementAdvice(asset('taxable', 'bonds'));
    expect(advice).not.toBeNull();
    expect(advice!.preferredAccount).toBe('tax-deferred');
    expect(advice!.reason).toMatch(/ordinary.*income/i);
  });

  it('suggests taxable for intl-stock held in tax-deferred (foreign tax credit)', () => {
    const advice = placementAdvice(asset('tax-deferred', 'intl-stock'));
    expect(advice).not.toBeNull();
    expect(advice!.preferredAccount).toBe('taxable');
    expect(advice!.reason).toMatch(/foreign tax/i);
  });

  it('suggests tax-free for us-stock held in taxable', () => {
    const advice = placementAdvice(asset('taxable', 'us-stock'));
    expect(advice).not.toBeNull();
    expect(advice!.preferredAccount).toBe('tax-free');
    expect(advice!.reason.length).toBeGreaterThan(0);
  });

  it('suggests tax-deferred for REITs held in taxable', () => {
    const advice = placementAdvice(asset('taxable', 'reits'));
    expect(advice).not.toBeNull();
    expect(advice!.preferredAccount).toBe('tax-deferred');
    expect(advice!.reason.length).toBeGreaterThan(0);
  });

  it('returns null when us-stock is already in tax-free', () => {
    expect(placementAdvice(asset('tax-free', 'us-stock'))).toBeNull();
  });

  it('returns null when intl-stock is already in taxable', () => {
    expect(placementAdvice(asset('taxable', 'intl-stock'))).toBeNull();
  });

  it('returns null when REITs are already in tax-deferred', () => {
    expect(placementAdvice(asset('tax-deferred', 'reits'))).toBeNull();
  });
});
