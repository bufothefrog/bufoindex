/**
 * The one-time import of the old paycheck allocator's localStorage (O7,
 * plan section 0.1 item 5). The hand-written store persisted its profile
 * under 'paycheck-allocator-storage' (zustand persist, unversioned); the
 * profile is now the only record. Storage only: there is no link decoding.
 * Pure.
 */

import { updateLegacyIncomeFields } from '@/lib/calculations/core';
import type { LegacyStorage } from '@/lib/calculators/types';
import { isDerivedBinding } from '@/lib/fields/binding';
import { getAt, setAt } from '@/lib/fields/paths';
import { PROFILE_ENUM_VALUES, PROFILE_LIST_ROW_DEFAULTS } from '@/lib/profile/defaults';
import type { DebtData, PaycheckProfile } from '@/lib/types';
import { PAYCHECK_BINDINGS } from './bindings';

/**
 * The old store's defaults (getDefaultProfile as it was), frozen here
 * rather than read from core.ts: an old value equal to one of these was
 * never changed by the visitor, so it is not imported. lastUpdated is fixed
 * where the old one stamped Date.now().
 */
const OLD_STORE_DEFAULTS: Readonly<PaycheckProfile> = Object.freeze({
  income: {
    grossPaycheck: 2500,
    netPaycheck: 1900,
    frequency: 'bi-weekly',
    regularBonus: false,
    bonusAmount: 0,
    bonusFrequency: 'annual',
    monthlyGross: 5417,
    monthlyNet: 4123,
    gross: 5417,
    net: 4123,
    bonusExpected: 0,
  },
  taxes: {
    federalBracket: 0.22,
    state: 'CA',
    filingStatus: 'single',
    currentWithholding: { federal: 800, state: 200, fica: 382 },
  },
  benefits: {
    employer401k: {
      available: true,
      matchPercent: 0.5,
      matchLimit: 0.06,
      currentContribution: 0.03,
      contributionType: 'traditional',
      traditionalContribution: 0.03,
      rothContribution: 0,
      afterTaxAvailable: false,
      currentYTD: 0,
    },
    hsa: {
      eligible: false,
      employerContribution: 0,
      currentContribution: 0,
      currentYTD: 0,
      coverageType: 'individual',
      investmentStrategy: false,
    },
    ira: {
      hasIRA: false,
      accountTypes: { traditional: false, roth: false },
      currentContributions: { traditional: 0, roth: 0 },
      currentBalances: { traditional: 0, roth: 0 },
    },
    other: { fsaElection: 0, transitBenefits: 0, lifeInsurance: 0 },
  },
  debts: [],
  preferences: {
    emergencyFundMonths: 3,
    currentEmergencyFund: 0,
    emergencyFundAPY: 0.04,
    necessaryExpenses: 2500,
    funMoney: { min: 300, max: 600, current: 450 },
    age: 30,
    hasTaxableAccount: false,
    taxableAccountContribution: 0,
    isPeakEarnings: false,
    expectedRetirementBracket: 0.12,
    riskTolerance: 'moderate',
    optimizationGoal: 'balanced',
  },
  version: '1.0',
  lastUpdated: 0,
  source: 'user_input',
} satisfies PaycheckProfile);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A deep copy of the frozen defaults (plain data, so JSON round-trips it). */
function oldDefaults(): PaycheckProfile {
  return JSON.parse(JSON.stringify(OLD_STORE_DEFAULTS)) as PaycheckProfile;
}

/**
 * True when `value` can stand in for `fallback` at a leaf bound to
 * `profilePath`: the same type (a finite number for numbers) and, for an
 * enum, one of the profile's values.
 */
function readable(value: unknown, fallback: unknown, profilePath: string): boolean {
  if (typeof value !== typeof fallback) return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  const options = PROFILE_ENUM_VALUES[profilePath];
  return !options || options.includes(value as string);
}

/** Old debt rows that have an id, each field read over the row defaults. */
function readDebts(value: unknown): DebtData[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const defaults = PROFILE_LIST_ROW_DEFAULTS.debts;
  return value.flatMap((row): DebtData[] => {
    if (!isRecord(row) || typeof row.id !== 'string' || row.id === '') return [];
    const debt = { ...defaults, id: row.id };
    for (const key of Object.keys(defaults) as (keyof DebtData)[]) {
      if (key !== 'id' && readable(row[key], defaults[key], '')) Object.assign(debt, { [key]: row[key] });
    }
    return [debt];
  });
}

/**
 * The profile in an old persist envelope (`{ state: { profile } }`), leaf
 * by leaf over the old defaults, or null when `raw` is not one. Each leaf a
 * 1:1 binding reads, and the Roth share of a split 401(k) election (the one
 * derived leaf the import writes back), is taken when it has the right type;
 * the other derived leaves are recomputed as the old store kept them, or
 * left at the old default where nothing reads them. Two old flags hid their
 * values, and the profile has no such flag, so a hidden value is read as
 * none: IRA types without "I have an IRA", and a taxable contribution
 * without "I have a taxable brokerage account".
 */
export function readPaycheckStorage(raw: unknown): PaycheckProfile | null {
  if (!isRecord(raw) || !isRecord(raw.state) || !isRecord(raw.state.profile)) return null;
  const stored = raw.state.profile;
  let profile = oldDefaults();
  for (const binding of PAYCHECK_BINDINGS) {
    // A derived leaf is read only when its binding writes it back (the Roth share of a split).
    if (isDerivedBinding(binding) && !binding.write) continue;
    const value = getAt(stored, binding.engine);
    if (binding.engine === 'debts') {
      const debts = readDebts(value);
      if (debts) profile = { ...profile, debts };
    } else if (readable(value, getAt(profile, binding.engine), isDerivedBinding(binding) ? '' : binding.profile)) {
      profile = setAt(profile, binding.engine, value);
    }
  }

  const ira = getAt(stored, 'benefits.ira.hasIRA') === true;
  if (!ira) {
    profile = setAt(profile, 'benefits.ira.accountTypes', { traditional: false, roth: false });
  }
  if (getAt(stored, 'preferences.hasTaxableAccount') !== true) {
    profile = setAt(profile, 'preferences.taxableAccountContribution', 0);
  }

  const { funMoney } = profile.preferences;
  const types = profile.benefits.ira.accountTypes;
  return {
    ...profile,
    income: updateLegacyIncomeFields(profile.income),
    benefits: { ...profile.benefits, ira: { ...profile.benefits.ira, hasIRA: types.traditional || types.roth } },
    preferences: {
      ...profile.preferences,
      funMoney: { ...funMoney, current: (funMoney.min + funMoney.max) / 2 },
      hasTaxableAccount: profile.preferences.taxableAccountContribution > 0,
    },
  };
}

export const PAYCHECK_LEGACY: LegacyStorage<PaycheckProfile> = {
  storageKey: 'paycheck-allocator-storage',
  readStorage: readPaycheckStorage,
  storageDefaults: oldDefaults,
};
