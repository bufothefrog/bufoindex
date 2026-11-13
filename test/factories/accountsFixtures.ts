/**
 * Raw profile fixtures for the account model (lib/profile/accounts.ts) and
 * its write actions (lib/calculators/portfolio/accountWrites.ts).
 *
 * The v3 default is written from the 90ef4ed default leaves
 * (./profile-90ef4ed-v2.ts) with the v3 example lists, the three removed
 * leaves absent and monthlyContribution null. It does not call the default
 * profile builder, the normalizer or the migration, whose output changes
 * when the profile moves to version 3. Every fixture is a plain object.
 */

import { makeGet, setAt } from '@/lib/fields/paths';
import type { Get, Write } from '@/lib/fields/types';
import { exampleAccountLists } from '@/lib/profile/accounts';
import { defaultPayloadAt90ef4ed, type RawPayload } from './profile-90ef4ed-v2';

export type { RawPayload } from './profile-90ef4ed-v2';

/** A Get over a raw fixture (makeGet). */
export function getOf(raw: unknown): Get {
  return makeGet(raw);
}

/** setAt for each write in order. */
export function applyWrites(raw: RawPayload, writes: readonly Write[]): RawPayload {
  return writes.reduce<RawPayload>((out, write) => setAt(out, write.path, write.value), raw);
}

/** The v3 default profile as a raw object, nothing answered. */
export function v3DefaultRaw(): RawPayload {
  const v2 = defaultPayloadAt90ef4ed() as Record<string, Record<string, unknown>> & RawPayload;
  const ira = { ...v2.ira };
  delete ira.traditionalBalance;
  delete ira.rothBalance;
  const investing: Record<string, unknown> = { ...v2.investing, monthlyContribution: null };
  delete investing.investedBalance;
  return {
    ...v2,
    version: 3,
    ira,
    investing,
    portfolio: {
      ...exampleAccountLists(),
      newCash: [],
      classTargets: [
        { accountId: null, assetClass: 'us-stock', target: 0.6 },
        { accountId: null, assetClass: 'intl-stock', target: 0.2 },
        { accountId: null, assetClass: 'bonds', target: 0.2 },
        { accountId: null, assetClass: 'cash', target: 0 },
      ],
      customAssetClasses: [],
    },
    provided: [],
  };
}

/**
 * `base` with `values` set by path, and `answered` added to provided (each
 * value path is answered unless `answered` is given).
 */
export function rawWith(
  values: Readonly<Record<string, unknown>>,
  answered: readonly string[] = Object.keys(values),
  base: RawPayload = v3DefaultRaw()
): RawPayload {
  let out = base;
  for (const [path, value] of Object.entries(values)) out = setAt(out, path, value);
  const provided = Array.isArray(out.provided) ? (out.provided as string[]) : [];
  return { ...out, provided: [...new Set([...provided, ...answered])] };
}

/** BOXX at 115 a share, asset class cash. */
export const BOXX_SECURITY = { id: 'sec-boxx', ticker: 'BOXX', price: 115, assetClass: 'cash' };

/**
 * The owner fixture (contract section 7): $6,000 every two weeks, age 25,
 * 401(k) traditional 10% with 100% match up to 4%, HSA individual 250 a
 * month plus 1,200 a year from the employer, Roth IRA 625 a month, taxable
 * 400, a typed emergency fund of 10,000, and five accounts with the
 * Robinhood brokerage holding the emergency fund in BOXX.
 */
export function ownerRaw(): RawPayload {
  const { securities } = exampleAccountLists();
  return rawWith({
    'person.age': 25,
    'person.filingStatus': 'single',
    'income.grossPerPaycheck': 6000,
    'income.frequency': 'bi-weekly',
    'workplace.has401k': true,
    'workplace.contributionType': 'traditional',
    'workplace.contributionPercent': 0.1,
    'workplace.matchPercent': 1,
    'workplace.matchLimit': 0.04,
    'hsa.eligible': true,
    'hsa.coverage': 'individual',
    'hsa.monthlyContribution': 250,
    'hsa.employerAnnualContribution': 1200,
    'ira.roth': true,
    'ira.rothMonthly': 625,
    'investing.taxableMonthlyContribution': 400,
    'cash.emergencyFundBalance': 10000,
    'portfolio.accounts': [
      { id: 'acc-401k', kind: '401k', name: '', balance: 80000, holdsEmergencyFund: false },
      { id: 'acc-hsa', kind: 'hsa', name: '', balance: 12000, holdsEmergencyFund: false },
      { id: 'acc-roth', kind: 'roth-ira', name: 'Roth IRA', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-brok', kind: 'brokerage', name: 'Brokerage', balance: 0, holdsEmergencyFund: false },
      { id: 'acc-rh', kind: 'brokerage', name: 'Robinhood', balance: 0, holdsEmergencyFund: true },
    ],
    'portfolio.securities': [...securities, { ...BOXX_SECURITY }],
    'portfolio.holdings': [
      { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 20 },
      { id: 'hld-roth-vxus', accountId: 'acc-roth', securityId: 'sec-vxus', shares: 30 },
      { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 10 },
      { id: 'hld-rh-boxx', accountId: 'acc-rh', securityId: 'sec-boxx', shares: 90 },
    ],
  });
}

/**
 * The caps fixture: age 25, $9,500 every two weeks (247,000 a year), 15%
 * traditional with 100% match up to 4%; HSA individual, 400 a month, 600 a
 * year from the employer.
 */
export function capsRaw(): RawPayload {
  return rawWith({
    'person.age': 25,
    'income.grossPerPaycheck': 9500,
    'income.frequency': 'bi-weekly',
    'workplace.has401k': true,
    'workplace.contributionType': 'traditional',
    'workplace.contributionPercent': 0.15,
    'workplace.matchPercent': 1,
    'workplace.matchLimit': 0.04,
    'hsa.eligible': true,
    'hsa.coverage': 'individual',
    'hsa.monthlyContribution': 400,
    'hsa.employerAnnualContribution': 600,
  });
}

/**
 * The beginner fixture (contract section 10): one 401(k), savings, no HSA,
 * no IRA, taxable answered 0, no bonus, no debts; the account list itself
 * unanswered.
 */
export function beginnerRaw(): RawPayload {
  return rawWith({
    'workplace.has401k': true,
    'hsa.eligible': false,
    'ira.traditional': false,
    'ira.roth': false,
    'investing.taxableMonthlyContribution': 0,
    'income.hasBonus': false,
    debts: [],
  });
}
