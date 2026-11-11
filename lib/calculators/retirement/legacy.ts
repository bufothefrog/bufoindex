/**
 * The one-time import of the old retirement calculator's localStorage (O7,
 * plan section 0.1 item 5). The hand-written store persisted its inputs under
 * 'retirement-calculator' (zustand persist, versions 1 to 3); the profile is
 * now the only record. Storage only: there is no link decoding. Pure.
 */

import { INCOME_PERIOD_MULTIPLIERS, annualizeIncome, type RetirementInputs } from '@/lib/calculations/retirement';
import type { LegacyStorage } from '@/lib/calculators/types';

/**
 * The old store's defaults, frozen as they were (not read from the live
 * constants): an old value equal to one of these was never changed by the
 * visitor, so it is not imported.
 */
const OLD_STORE_DEFAULTS: Readonly<RetirementInputs> = Object.freeze({
  startingAge: 25,
  retirementAge: 60,
  lifeExpectancy: 85,
  targetIncome: 80000,
  startingBalance: 10000,
  currentIncome: 100000,
  incomeAmount: 100000,
  incomePeriod: 'yearly',
  monthlySavings: 2000,
  necessaryMonthlyExpenses: 4000,
  accumulationReturn: 0.08,
  retirementReturn: 0.06,
  inflationRate: 0.03,
  socialSecurityAge: 67,
  socialSecurityBenefit: 30000,
  healthcareCostMultiplier: 1,
  volatility: 0.15,
  filingStatus: 'single',
  state: 'TX',
  riskProfile: 'tdf',
  effectiveTaxRate: null,
  estimatedAnnualHealthcareCost: null,
});

type Reader = (value: unknown) => unknown;

const finite: Reader = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const finiteOrNull: Reader = (value) => (value === null ? null : finite(value));
const oneOf =
  (values: readonly string[]): Reader =>
  (value) =>
    typeof value === 'string' && values.includes(value) ? value : undefined;

/** How each stored leaf is read; undefined keeps the old default. */
const READERS: Readonly<Record<keyof RetirementInputs, Reader>> = {
  startingAge: finite,
  retirementAge: finite,
  lifeExpectancy: finite,
  targetIncome: finite,
  startingBalance: finite,
  currentIncome: finite,
  incomeAmount: finite,
  incomePeriod: oneOf(Object.keys(INCOME_PERIOD_MULTIPLIERS)),
  monthlySavings: finite,
  necessaryMonthlyExpenses: finite,
  accumulationReturn: finite,
  retirementReturn: finite,
  inflationRate: finite,
  socialSecurityAge: finite,
  socialSecurityBenefit: finite,
  healthcareCostMultiplier: finite,
  volatility: finite,
  filingStatus: oneOf(['single', 'marriedJoint']),
  state: (value) => (typeof value === 'string' ? value : undefined),
  // The old store's v2 migration: a retired risk profile becomes 'custom'.
  riskProfile: (value) => (typeof value === 'string' ? (value === 'tdf' ? 'tdf' : 'custom') : undefined),
  effectiveTaxRate: finiteOrNull,
  estimatedAnnualHealthcareCost: finiteOrNull,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The inputs in an old persist envelope (`{ state: { inputs }, version }`),
 * leaf by leaf over the old defaults, or null when `raw` is not one.
 */
export function readRetirementStorage(raw: unknown): RetirementInputs | null {
  if (!isRecord(raw) || !isRecord(raw.state) || !isRecord(raw.state.inputs)) return null;
  const stored = raw.state.inputs;
  const inputs: Record<string, unknown> = { ...OLD_STORE_DEFAULTS };
  for (const [key, read] of Object.entries(READERS)) {
    const value = read(stored[key]);
    if (value !== undefined) inputs[key] = value;
  }
  const result = inputs as unknown as RetirementInputs;
  // The old store derived the annual figure from the entry; keep them in step.
  return { ...result, currentIncome: annualizeIncome(result.incomeAmount, result.incomePeriod) };
}

export const RETIREMENT_LEGACY: LegacyStorage<RetirementInputs> = {
  storageKey: 'retirement-calculator',
  readStorage: readRetirementStorage,
  storageDefaults: () => ({ ...OLD_STORE_DEFAULTS }),
};
