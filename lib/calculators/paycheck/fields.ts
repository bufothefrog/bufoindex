/**
 * Field specs only the paycheck allocator asks (docs/rebuild-plan.md
 * section 2.14): bonuses and fun money, the 401(k), the HSA, IRAs, debts and
 * the allocator's assumptions. The facts other forms also ask come from
 * lib/fields/shared.ts. Pure.
 *
 * Bounds follow plan section 2.3: the match rate 0-200% and its limit 0-25%
 * of pay, the 401(k) contribution 0-100%, target months 0-24 in half
 * months, and debt rates 0-50%. The old engine-side checks (validateProfile,
 * O18) live on as these bounds and the fun-money relation.
 */

import { CONTRIBUTION_LIMITS_2026 } from '@/lib/constants/irs-2026';
import {
  BONUS_FREQUENCY_LABELS,
  BONUS_FREQUENCY_OPTIONS,
  CONTRIBUTION_TYPE_OPTIONS,
  HSA_COVERAGE_LABELS,
  HSA_COVERAGE_OPTIONS,
  OPTIMIZATION_GOAL_LABELS,
  OPTIMIZATION_GOAL_OPTIONS,
  RISK_TOLERANCE_LABELS,
  RISK_TOLERANCE_OPTIONS,
} from '@/lib/constants/labels';
import { formatCount, formatCurrency, formatPercent } from '@/lib/format';
import type { CrossFieldRule, FieldSpec, Get, ScreenNote } from '@/lib/fields/types';
import type { BonusFrequency, ContributionType, HsaCoverage, OptimizationGoal, RiskTolerance } from '@/lib/profile/types';

const isTrue = (path: string) => (get: Get) => get(path) === true;
const money = (value: unknown) => formatCurrency(value as number);
const percent = (value: unknown) => formatPercent(value as number);

/**
 * The rate above which the allocator treats a debt as high-interest
 * (calculateHighInterestDebt in lib/calculations/optimization.ts, which
 * keeps it private).
 */
export const HIGH_INTEREST_DEBT_RATE = 0.07;

// ---------------------------------------------------------------------------
// Fun money and bonuses
// ---------------------------------------------------------------------------

const HAS_BONUS_PATH = 'income.hasBonus';
const hasBonus = isTrue(HAS_BONUS_PATH);

export const HAS_BONUS: FieldSpec = {
  path: HAS_BONUS_PATH,
  kind: 'boolean',
  label: 'I receive regular bonuses',
  tier: 'details',
  summary: (value) => (value === true ? null : 'no regular bonus'),
};

export const BONUS_AMOUNT: FieldSpec = {
  path: 'income.bonusAmount',
  kind: 'money',
  label: 'Average bonus amount',
  placeholder: '2,000',
  min: 0,
  tier: 'details',
  visibleWhen: hasBonus,
  summary: (value, get) =>
    `${money(value)} ${BONUS_FREQUENCY_LABELS[get('income.bonusFrequency') as BonusFrequency].toLowerCase()} bonus`,
};

export const BONUS_FREQUENCY: FieldSpec = {
  path: 'income.bonusFrequency',
  kind: 'select',
  label: 'Bonus frequency',
  options: BONUS_FREQUENCY_OPTIONS,
  tier: 'details',
  visibleWhen: hasBonus,
};

export const FUN_MONEY_MIN: FieldSpec = {
  path: 'spending.funMoneyMin',
  kind: 'money',
  label: 'At least, per month',
  placeholder: '500',
  min: 0,
  tier: 'details',
  summary: (value, get) => `fun money ${money(value)}\u2013${money(get('spending.funMoneyMax'))}/mo`,
};

export const FUN_MONEY_MAX: FieldSpec = {
  path: 'spending.funMoneyMax',
  kind: 'money',
  label: 'At most, per month',
  placeholder: '1,000',
  min: 0,
  tier: 'details',
};

export const FUN_MONEY_RANGE: CrossFieldRule = {
  lower: FUN_MONEY_MIN.path,
  upper: FUN_MONEY_MAX.path,
  strict: false,
  checkOn: FUN_MONEY_MAX.path,
  message: 'The minimum is above the maximum. Adjust one of them.',
};

export const BONUS_NOTE: ScreenNote = {
  text: 'Bonuses are recorded for context; the per-paycheck allocation math is based on regular paychecks only.',
  visibleWhen: hasBonus,
};

// ---------------------------------------------------------------------------
// 401(k)
// ---------------------------------------------------------------------------

const HAS_401K_PATH = 'workplace.has401k';
const CONTRIBUTION_TYPE_PATH = 'workplace.contributionType';
const hasPlan = isTrue(HAS_401K_PATH);
const isSplit = (get: Get) => hasPlan(get) && get(CONTRIBUTION_TYPE_PATH) === 'split';

/** The contribution type inside a summary line (the labels capitalize every word, Roth included). */
const CONTRIBUTION_TYPE_PHRASE: Readonly<Record<ContributionType, string>> = {
  traditional: 'traditional (pre-tax)',
  roth: 'Roth (after-tax)',
  split: 'split between traditional and Roth',
};

export const HAS_401K: FieldSpec = {
  path: HAS_401K_PATH,
  kind: 'boolean',
  label: 'Workplace retirement plan',
  options: [
    { value: true, label: 'Yes', description: 'Not sure? Pick Yes and check your benefits portal later.' },
    { value: false, label: 'No' },
  ],
  tier: 'details',
  summary: (value) => (value === true ? null : 'no workplace plan'),
};

export const MATCH_PERCENT: FieldSpec = {
  path: 'workplace.matchPercent',
  kind: 'percent',
  label: 'Employer match rate',
  help: 'What your employer adds per dollar you contribute. 50% means 50 cents per dollar.',
  min: 0,
  max: 2,
  tier: 'details',
  visibleWhen: hasPlan,
  summary: (value, get) => `${percent(value)} match on the first ${percent(get('workplace.matchLimit'))}`,
};

export const MATCH_LIMIT: FieldSpec = {
  path: 'workplace.matchLimit',
  kind: 'percent',
  label: 'Matched up to this share of your pay',
  help: 'In "50% of the first 6%", this is the 6%.',
  min: 0,
  max: 0.25,
  tier: 'details',
  visibleWhen: hasPlan,
};

export const CONTRIBUTION_TYPE: FieldSpec = {
  path: CONTRIBUTION_TYPE_PATH,
  kind: 'select',
  label: 'Contribution type',
  help: 'Traditional reduces taxable income now, Roth is tax-free in retirement',
  options: CONTRIBUTION_TYPE_OPTIONS,
  tier: 'details',
  visibleWhen: hasPlan,
};

export const CONTRIBUTION_PERCENT: FieldSpec = {
  path: 'workplace.contributionPercent',
  kind: 'percent',
  label: 'Your contribution',
  help: 'The share of each paycheck you put into the plan, all types together.',
  min: 0,
  max: 1,
  step: 0.01,
  slider: true,
  tier: 'details',
  visibleWhen: hasPlan,
  summary: (value, get) => `contributing ${percent(value)} ${CONTRIBUTION_TYPE_PHRASE[get(CONTRIBUTION_TYPE_PATH) as ContributionType]}`,
};

export const ROTH_CONTRIBUTION_PERCENT: FieldSpec = {
  path: 'workplace.rothContributionPercent',
  kind: 'percent',
  label: 'Roth part of your contribution',
  help: 'The rest of your contribution is traditional (pre-tax). A Roth part above the total counts as the whole contribution.',
  min: 0,
  max: 1,
  step: 0.01,
  slider: true,
  tier: 'details',
  visibleWhen: isSplit,
};

export const AFTER_TAX_AVAILABLE: FieldSpec = {
  path: 'workplace.afterTaxAvailable',
  kind: 'boolean',
  label: 'My plan accepts after-tax contributions (mega backdoor Roth)',
  tier: 'details',
  visibleWhen: hasPlan,
  summary: (value) => (value === true ? 'after-tax contributions allowed' : null),
};

// ---------------------------------------------------------------------------
// HSA
// ---------------------------------------------------------------------------

const HSA_ELIGIBLE_PATH = 'hsa.eligible';
const HSA_INVESTING_PATH = 'hsa.investing';
const hsaEligible = isTrue(HSA_ELIGIBLE_PATH);

export const HSA_ELIGIBLE: FieldSpec = {
  path: HSA_ELIGIBLE_PATH,
  kind: 'boolean',
  label: 'HSA eligible (high-deductible health plan)',
  tier: 'details',
  summary: (value) => (value === true ? null : 'no HSA'),
};

export const HSA_COVERAGE: FieldSpec = {
  path: 'hsa.coverage',
  kind: 'select',
  label: 'Coverage type',
  options: HSA_COVERAGE_OPTIONS,
  tier: 'details',
  visibleWhen: hsaEligible,
  summary: (value) => `${HSA_COVERAGE_LABELS[value as HsaCoverage].toLowerCase()} HSA`,
};

export const HSA_MONTHLY_CONTRIBUTION: FieldSpec = {
  path: 'hsa.monthlyContribution',
  kind: 'money',
  label: 'Current monthly HSA contribution',
  placeholder: '0',
  min: 0,
  tier: 'details',
  visibleWhen: hsaEligible,
  summary: (value) => `${money(value)}/mo`,
};

export const HSA_EMPLOYER_CONTRIBUTION: FieldSpec = {
  path: 'hsa.employerAnnualContribution',
  kind: 'money',
  label: 'Employer HSA contribution per year',
  placeholder: '0',
  min: 0,
  tier: 'details',
  visibleWhen: hsaEligible,
};

export const HSA_INVESTING: FieldSpec = {
  path: HSA_INVESTING_PATH,
  kind: 'boolean',
  label: "I'm using HSA as an investment (saving receipts, not withdrawing)",
  tier: 'details',
  visibleWhen: hsaEligible,
  summary: (value) => (value === true ? 'invested' : null),
};

/** The 2026 annual HSA limit for the coverage in effect. */
function hsaLimit(get: Get): number {
  return CONTRIBUTION_LIMITS_2026.hsa[get(HSA_COVERAGE.path) as HsaCoverage];
}

/** The old HSA card's explanatory copy, word for word, as notes (plan section 2.13). */
export const HSA_NOTES: readonly ScreenNote[] = [
  {
    text: 'Three tax advantages: Deductible contributions + untaxed growth + untaxed withdrawals for qualified medical costs',
    visibleWhen: hsaEligible,
  },
  {
    text: (get) => `${formatCurrency(hsaLimit(get))}/year limit: ${formatCurrency(hsaLimit(get) / 12)} per month`,
    visibleWhen: hsaEligible,
  },
  {
    text: 'Reimbursement timing: There is no deadline for reimbursing a qualified expense, so a receipt kept today can be reimbursed years later. Paying medical costs out of pocket leaves the balance invested and growing untaxed; reimbursing right away keeps that cash available now. The trade-off is between current liquidity and compounding.',
    visibleWhen: hsaEligible,
  },
  {
    text: 'Held as an investment: contributions, growth, and qualified withdrawals go untaxed, where a Roth IRA taxes the contribution. That extra advantage only applies while the balance stays invested. This approach generally involves: paying medical expenses out-of-pocket, keeping receipts for later reimbursement, investing the HSA balance rather than holding cash, and reimbursing against those receipts in retirement.',
    visibleWhen: (get) => hsaEligible(get) && get(HSA_INVESTING_PATH) === true,
  },
  {
    text: 'HSA and Roth IRA compared: spending the HSA on current medical costs uses up the balance that would otherwise compound untaxed. Roth IRA contributions can be withdrawn at any time without tax or penalty, so the two accounts differ mainly in how accessible the money is until retirement.',
    visibleWhen: (get) => hsaEligible(get) && get(HSA_INVESTING_PATH) !== true,
    tone: 'caution',
  },
];

// ---------------------------------------------------------------------------
// IRAs and taxable investing
// ---------------------------------------------------------------------------

const hasTraditionalIra = isTrue('ira.traditional');
const hasRothIra = isTrue('ira.roth');

export const IRA_TRADITIONAL: FieldSpec = {
  path: 'ira.traditional',
  kind: 'boolean',
  label: 'I have a traditional IRA',
  tier: 'details',
  summary: (value, get) => (value === true || get('ira.roth') === true ? null : 'no IRA'),
};

export const IRA_TRADITIONAL_MONTHLY: FieldSpec = {
  path: 'ira.traditionalMonthly',
  kind: 'money',
  label: 'Monthly traditional IRA contributions',
  placeholder: '500',
  min: 0,
  tier: 'details',
  visibleWhen: hasTraditionalIra,
  summary: (value) => `traditional IRA ${money(value)}/mo`,
};

export const IRA_TRADITIONAL_BALANCE: FieldSpec = {
  path: 'ira.traditionalBalance',
  kind: 'money',
  label: 'Traditional IRA balance',
  min: 0,
  tier: 'details',
  visibleWhen: hasTraditionalIra,
};

export const IRA_ROTH: FieldSpec = {
  path: 'ira.roth',
  kind: 'boolean',
  label: 'I have a Roth IRA',
  tier: 'details',
};

export const IRA_ROTH_MONTHLY: FieldSpec = {
  path: 'ira.rothMonthly',
  kind: 'money',
  label: 'Monthly Roth IRA contributions',
  placeholder: '500',
  min: 0,
  tier: 'details',
  visibleWhen: hasRothIra,
  summary: (value) => `Roth IRA ${money(value)}/mo`,
};

export const IRA_ROTH_BALANCE: FieldSpec = {
  path: 'ira.rothBalance',
  kind: 'money',
  label: 'Roth IRA balance',
  min: 0,
  tier: 'details',
  visibleWhen: hasRothIra,
};

export const TAXABLE_NOTE: ScreenNote = {
  text: 'Taxable accounts: No contribution limits or withdrawal restrictions, but gains and dividends are taxed in the year they occur.',
  visibleWhen: (get) => (get('investing.taxableMonthlyContribution') as number) > 0,
};

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

/** Renderer ids (components/calculators/renderers/paycheck.tsx). */
export const DEBT_RATE_RENDERER = 'debtRate';
export const DEBT_TOTALS_RENDERER = 'debtTotals';

const DEBT_ROW: readonly FieldSpec[] = [
  {
    path: 'name',
    kind: 'text',
    label: 'Debt name',
    placeholder: 'e.g., Credit Card, Student Loan',
    maxLength: 60,
    tier: 'details',
  },
  { path: 'balance', kind: 'money', label: 'Balance', placeholder: '10,000', min: 0, tier: 'details' },
  {
    path: 'interestRate',
    kind: 'percent',
    label: 'Interest rate',
    placeholder: '15.99',
    min: 0,
    max: 0.5,
    precision: 2,
    tier: 'details',
  },
  { path: 'minimumPayment', kind: 'money', label: 'Minimum payment', placeholder: '200', min: 0, tier: 'details' },
  { path: 'extraPayment', kind: 'money', label: 'Extra payment (optional)', placeholder: '0', min: 0, tier: 'details' },
  { path: 'taxDeductible', kind: 'boolean', label: 'Interest is tax-deductible', tier: 'details' },
];

export const DEBTS: FieldSpec = {
  path: 'debts',
  kind: 'list',
  label: 'Debts',
  tier: 'details',
  row: DEBT_ROW,
  itemLabel: (row, index) => (typeof row.name === 'string' && row.name.trim() !== '' ? row.name : `Debt ${index + 1}`),
  addLabel: 'Add a debt',
  emptyText: 'No debts added yet',
  rowAdornment: DEBT_RATE_RENDERER,
  footer: DEBT_TOTALS_RENDERER,
  summary: (value) => {
    const rows = Array.isArray(value) ? value : [];
    if (rows.length === 0) return 'no debts';
    return `${formatCount(rows.length)} ${rows.length === 1 ? 'debt' : 'debts'}`;
  },
};

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export const TARGET_MONTHS: FieldSpec = {
  path: 'cash.targetMonths',
  kind: 'number',
  label: 'Emergency fund target',
  help: 'Months of expenses to save (typically 3-6)',
  min: 0,
  max: 24,
  step: 0.5,
  precision: 1,
  unit: { suffix: ' months' },
  tier: 'assumption',
  summary: (value) => `${value as number}-month emergency fund`,
};

export const RISK_TOLERANCE: FieldSpec = {
  path: 'assumptions.paycheck.riskTolerance',
  kind: 'select',
  label: 'Risk tolerance',
  options: RISK_TOLERANCE_OPTIONS,
  tier: 'assumption',
  summary: (value) => `${RISK_TOLERANCE_LABELS[value as RiskTolerance].toLowerCase()} risk`,
};

export const OPTIMIZATION_GOAL: FieldSpec = {
  path: 'assumptions.paycheck.optimizationGoal',
  kind: 'select',
  label: 'Optimization goal',
  options: OPTIMIZATION_GOAL_OPTIONS,
  tier: 'assumption',
  summary: (value) => `${OPTIMIZATION_GOAL_LABELS[value as OptimizationGoal].toLowerCase()} goal`,
};

export const EXPECTED_RETIREMENT_BRACKET: FieldSpec = {
  path: 'assumptions.paycheck.expectedRetirementBracket',
  kind: 'percent',
  label: 'Expected tax bracket in retirement',
  help: 'The federal bracket you expect when you withdraw, weighed against the 22% bracket the allocator uses today.',
  min: 0,
  max: 0.37,
  step: 0.01,
  tier: 'assumption',
  summary: (value) => `${percent(value)} retirement bracket`,
};

/** O9: the allocator keeps a fixed 22% federal bracket; the copy says so instead of claiming automatic brackets. */
export const TAX_NOTE: ScreenNote = {
  text: 'Tax savings in this allocator use a fixed 22% federal bracket plus one 2026 rate for your state. Brackets are not calculated from your income.',
};
