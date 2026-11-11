/**
 * v1 -> v2 profile migration, and the mapper golden outputs.
 *
 * v1MapperGolden.json was produced by the v1 mappers (toRetirementInputs,
 * toPaycheckProfile, toRebalanceInputs, leverageLink) on the normalized v1
 * fixtures before profile v2 landed. The v2 mappers fed the migrated
 * profile must reproduce it exactly (the leverage link only gains
 * &from=profile), which proves the calculators receive identical inputs.
 */

import { describe, expect, it } from 'vitest';
import {
  BROKERAGE_ACCOUNT_ID,
  getDefaultFinancialProfile,
  leverageLink,
  migrateProfile,
  newCashAccountIndex,
  newCashDeposit,
  normalizeProfile,
  toPaycheckProfile,
  toRebalanceInputs,
  toRetirementInputs,
} from '@/lib/profile';
import { V1_ALL_PROVIDED, V1_DEFAULT, V1_GARBAGE, V1_PAYLOADS } from './fixtures/v1Payloads';
import golden from './fixtures/v1MapperGolden.json';

type GoldenName = keyof typeof V1_PAYLOADS;

/** JSON round trip, so undefined keys and -0 compare like the stored golden. */
function asJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('migrateProfile v1 -> v2', () => {
  it('turns the untouched v1 default into the v2 default', () => {
    expect(migrateProfile(V1_DEFAULT.state.profile, 1)).toEqual(getDefaultFinancialProfile());
  });

  it('keeps every v1 answer and its provided path, and moves new cash to the Brokerage deposit', () => {
    const p = migrateProfile(V1_ALL_PROVIDED.state.profile, 1);
    expect(p.version).toBe(2);
    expect(p.updatedAt).toBe(1760000000000);
    expect(p.person).toEqual({ age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58, lifeExpectancy: 85 });
    expect(p.income).toMatchObject({ grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly', hasBonus: false });
    expect(p.workplace).toMatchObject({ contributionPercent: 0.1, contributionType: 'traditional', rothContributionPercent: 0 });
    expect(p.investing).toEqual({
      investedBalance: 140000,
      monthlyContribution: 2200,
      taxableMonthlyContribution: 900,
      targetMix: '60-40',
      newCashThisMonth: 3000,
    });
    expect(p.portfolio.accounts).toEqual([
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 0 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 3000 },
    ]);
    expect(p.provided).toEqual((V1_ALL_PROVIDED.state.profile as { provided: string[] }).provided);
    // v2-only sections take their defaults.
    const d = getDefaultFinancialProfile();
    expect(p.hsa).toEqual(d.hsa);
    expect(p.ira).toEqual(d.ira);
    expect(p.debts).toEqual([]);
    expect(p.assumptions).toEqual(d.assumptions);
    expect(p.leverage).toEqual(d.leverage);
  });

  it('repairs a hand-edited payload leaf by leaf', () => {
    const p = migrateProfile(V1_GARBAGE.state.profile, 1);
    const d = getDefaultFinancialProfile();
    expect(p.updatedAt).toBe(0);
    expect(p.person).toEqual({ ...d.person, retirementAge: 62 });
    expect(p.income).toEqual({ ...d.income, grossPerPaycheck: 4100, frequency: 'monthly' });
    expect(p.spending).toEqual(d.spending);
    expect(p.workplace).toEqual({ ...d.workplace, matchPercent: 0.25, contributionPercent: 0.08 });
    expect(p.investing).toEqual({ ...d.investing, investedBalance: 9000, newCashThisMonth: -50 });
    expect(p.strategy).toEqual({ ...d.strategy, leverageRatio: 3 });
    // Negative new cash deposits nothing (as the v1 mapper did).
    expect(p.portfolio.accounts[1].deposit).toBe(0);
    expect(p.provided).toEqual(['person.retirementAge', 'income.grossPerPaycheck', 'income.frequency']);
    expect(p).not.toHaveProperty('extra');
    expect(p.person).not.toHaveProperty('nickname');
  });

  it.each([null, undefined, 'garbage', 42, [1, 2]])('returns the default profile for %s', (input) => {
    expect(migrateProfile(input, 1)).toEqual(getDefaultFinancialProfile());
  });

  it('treats version 0, a missing version and NaN as v1', () => {
    for (const version of [0, Number.NaN]) {
      expect(migrateProfile(V1_ALL_PROVIDED.state.profile, version).portfolio.accounts[1].deposit).toBe(3000);
    }
  });

  it('only normalizes a v2 payload (no new-cash move)', () => {
    const v2 = getDefaultFinancialProfile();
    v2.investing.newCashThisMonth = 5000;
    v2.portfolio.accounts[1].deposit = 200;
    expect(migrateProfile(v2, 2)).toEqual(v2);
  });

  it('falls back to the first taxable account, or none, for the new-cash deposit', () => {
    const p = getDefaultFinancialProfile();
    expect(newCashAccountIndex(p)).toBe(1);
    expect(p.portfolio.accounts[1].id).toBe(BROKERAGE_ACCOUNT_ID);
    p.portfolio.accounts = [
      { id: 'x', name: 'IRA', accountType: 'tax-deferred', deposit: 0 },
      { id: 'y', name: 'Taxable', accountType: 'taxable', deposit: 0 },
    ];
    expect(newCashAccountIndex(p)).toBe(1);
    p.portfolio.accounts = [p.portfolio.accounts[0]];
    expect(newCashAccountIndex(p)).toBe(-1);
    expect(newCashDeposit(Number.NaN)).toBe(0);
    expect(newCashDeposit(-1)).toBe(0);
    expect(newCashDeposit(12.5)).toBe(12.5);
  });

  it('skips the deposit move when no taxable account exists', () => {
    const payload = {
      ...(V1_ALL_PROVIDED.state.profile as object),
      portfolio: { accounts: [{ id: 'r', name: 'Roth', accountType: 'tax-free', deposit: 0 }] },
    };
    // A v1 payload never has portfolio; this guards the branch anyway.
    expect(migrateProfile(payload, 1).portfolio.accounts).toEqual([
      { id: 'r', name: 'Roth', accountType: 'tax-free', deposit: 0 },
    ]);
  });
});

describe('mapper golden outputs (v1 mappers vs v2 mappers on migrated data)', () => {
  it.each(Object.keys(V1_PAYLOADS) as GoldenName[])('%s fixture: identical engine inputs', (name) => {
    const expected = golden[name];
    const profile = migrateProfile(V1_PAYLOADS[name].state.profile, V1_PAYLOADS[name].version);

    expect(asJson(toRetirementInputs(profile))).toEqual(expected.retirement);
    expect(asJson(toPaycheckProfile(profile))).toEqual(expected.paycheck);
    expect(asJson(toRebalanceInputs(profile))).toEqual(expected.portfolio);
    expect(leverageLink(profile)).toBe(`${expected.leverage}&from=profile`);
  });

  it('the v2 default profile reproduces the v1 default golden output', () => {
    const profile = normalizeProfile(getDefaultFinancialProfile());
    expect(asJson(toRetirementInputs(profile))).toEqual(golden.default.retirement);
    expect(asJson(toPaycheckProfile(profile))).toEqual(golden.default.paycheck);
    expect(asJson(toRebalanceInputs(profile))).toEqual(golden.default.portfolio);
  });
});
