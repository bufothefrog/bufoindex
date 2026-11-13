/**
 * The retirement bindings and definition: the golden test against the old
 * mapper's output for v1-shaped profiles, every RetirementInputs
 * leaf bound or engine-only, the derived income and filing-status leaves,
 * and engine errors mapped back to profile paths.
 *
 * Golden fixture. The expected inputs were captured on 2026-11-12 from the
 * former lib/profile/mappers.ts (deleted in phase 5): what its
 * toRetirementInputs returned for each profile, written as the leaves
 * that differ from its output for the v1 default (DEFAULT_INPUTS).
 */

import { describe, expect, it } from 'vitest';
import { calculateProjectedBalance, type RetirementInputs } from '@/lib/calculations/retirement';
import { yearStartInvesting } from '@/lib/profile/accounts';
import { RETIREMENT_BINDINGS, RETIREMENT_ENGINE_ONLY, filingStatusNote, retirementFilingStatus } from '@/lib/calculators/retirement/bindings';
import { RETIREMENT_CALCULATOR } from '@/lib/calculators/retirement/definition';
import { RETIREMENT_FORM } from '@/lib/calculators/retirement/form';
import { engineInputsFor, prepareRun } from '@/lib/calculators/runtime';
import { isDerivedBinding } from '@/lib/fields/binding';
import { applyProfileWrites, getDefaultFinancialProfile, isProfilePath, normalizeProfile } from '@/lib/profile/defaults';
import { resolveSocialSecurityBenefit } from '@/lib/calculators/retirement/socialSecurity';
import type { Write } from '@/lib/fields/types';
import type { FilingStatus, FinancialProfile, PayFrequency, ProfilePatch } from '@/lib/profile/types';
import { answeredAt3bb0132, answeredEverywhere, defaultProfileAt3bb0132 } from '@/test/factories/profile-3bb0132';
import { ownerRaw, ownerYearStartRaw, rawWith } from '@/test/factories/accountsFixtures';
import { retirementHeadline } from '@/lib/calculators/retirement/headline';

/**
 * A v1-shaped profile: the given sections over the 3bb0132 defaults the
 * fixture was captured on, normalized the way any stored profile is, every
 * field answered (test/factories/profile-3bb0132.ts).
 */
const v1 = (patch: ProfilePatch = {}): FinancialProfile => answeredAt3bb0132(patch);

/** The 3bb0132 default profile, all answered, with `writes` applied (each must be a valid profile write). */
const withWrites = (writes: Write[]): FinancialProfile =>
  applyProfileWrites(answeredEverywhere(defaultProfileAt3bb0132()), writes).profile;

/** Every RetirementInputs leaf; the Record type makes the compiler reject a missing or extra one. */
const LEAVES: Readonly<Record<keyof RetirementInputs, true>> = {
  startingAge: true,
  retirementAge: true,
  lifeExpectancy: true,
  targetIncome: true,
  startingBalance: true,
  currentIncome: true,
  incomeAmount: true,
  incomePeriod: true,
  monthlySavings: true,
  necessaryMonthlyExpenses: true,
  accumulationReturn: true,
  retirementReturn: true,
  inflationRate: true,
  socialSecurityAge: true,
  socialSecurityBenefit: true,
  healthcareCostMultiplier: true,
  volatility: true,
  filingStatus: true,
  state: true,
  riskProfile: true,
  effectiveTaxRate: true,
  estimatedAnnualHealthcareCost: true,
  yearStartSavings: true,
};

const CUSTOM_V1: ProfilePatch = {
  person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
  income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
  spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
  investing: { monthlyContribution: 2200, taxableMonthlyContribution: 900 },
  // The v1 invested balance of 140,000, as profile v3 keeps it: one account row.
  portfolio: {
    accounts: [{ id: 'acc-other', kind: '401k', name: 'Other investments', balance: 140000, holdsEmergencyFund: false }],
    holdings: [],
  },
};

/** The old mapper's output for the v1 default. */
const DEFAULT_INPUTS: RetirementInputs = {
  startingAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  targetIncome: 80000,
  startingBalance: 25000,
  currentIncome: 91000,
  incomeAmount: 3500,
  incomePeriod: 'biweekly',
  monthlySavings: 1500,
  necessaryMonthlyExpenses: 3000,
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
  // New in PR 5, not from the old mapper: the yearly parts of Auto monthly investing (none here).
  yearStartSavings: 0,
};

describe('golden: engineInputsFor equals the old mapper output for v1-shaped profiles', () => {
  it.each<[string, ProfilePatch, Partial<RetirementInputs>]>([
    ['the default', {}, {}],
    [
      'a custom profile (weekly pay, joint filing)',
      CUSTOM_V1,
      {
        startingAge: 38,
        retirementAge: 58,
        targetIncome: 110000,
        startingBalance: 140000,
        currentIncome: 109200,
        incomeAmount: 109200,
        incomePeriod: 'yearly',
        monthlySavings: 2200,
        necessaryMonthlyExpenses: 4200,
        filingStatus: 'marriedJoint',
        state: 'CA',
      },
    ],
    ['bi-weekly pay', { income: { frequency: 'bi-weekly', grossPerPaycheck: 3100 } }, { currentIncome: 80600, incomeAmount: 3100 }],
    [
      'semi-monthly pay',
      { income: { frequency: 'semi-monthly', grossPerPaycheck: 4000 } },
      { currentIncome: 96000, incomeAmount: 4000, incomePeriod: 'semimonthly' },
    ],
    [
      'monthly pay',
      { income: { frequency: 'monthly', grossPerPaycheck: 8000 }, person: { age: 51, retirementAge: 66 } },
      { startingAge: 51, retirementAge: 66, currentIncome: 96000, incomeAmount: 8000, incomePeriod: 'monthly' },
    ],
  ])('%s', (_name, patch, changed) => {
    expect(engineInputsFor(RETIREMENT_CALCULATOR, v1(patch))).toEqual({ ...DEFAULT_INPUTS, ...changed });
  });

  it('pins the default profile value by value (the PR 3 worked example)', () => {
    expect(engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile())).toEqual({
      startingAge: 25,
      retirementAge: 65,
      lifeExpectancy: 90,
      // Derived while unanswered: 12 x (3,000 + 450) = 41,400, to the nearest 1,000.
      targetIncome: 41000,
      // 16,225 typed in the example 401(k) + 8,775 of example brokerage holdings.
      startingBalance: 25000,
      // 4,000 every two weeks x 26.
      currentIncome: 104000,
      incomeAmount: 4000,
      incomePeriod: 'biweekly',
      // Auto: round2(693.33... own 401(k) + 346.66... match + 500 taxable); 1,500 before profile v3.
      monthlySavings: 1540,
      necessaryMonthlyExpenses: 3000,
      accumulationReturn: 0.08,
      retirementReturn: 0.06,
      inflationRate: 0.03,
      socialSecurityAge: 67,
      // Auto: the estimate from 104,000 a year, 40,358.52 to the whole dollar
      // (test/lib/calculations/socialSecurityEstimate.test.ts).
      socialSecurityBenefit: 40359,
      healthcareCostMultiplier: 1,
      volatility: 0.15,
      filingStatus: 'single',
      state: 'CA',
      riskProfile: 'tdf',
      effectiveTaxRate: null,
      estimatedAnnualHealthcareCost: null,
      // Every part monthly (the timing leaves default to 'monthly').
      yearStartSavings: 0,
    });
  });

  it('reads life expectancy, Social Security, healthcare and the assumptions from the profile (v2 leaves)', () => {
    const profile = withWrites([
      { path: 'person.lifeExpectancy', value: 92 },
      { path: 'retirementIncome.socialSecurityBenefit', value: 24000 },
      { path: 'retirementIncome.socialSecurityAge', value: 70 },
      { path: 'retirementIncome.annualHealthcareCost', value: 9000 },
      { path: 'assumptions.retirement.riskProfile', value: 'custom' },
      { path: 'assumptions.retirement.effectiveTaxRate', value: 0.18 },
      { path: 'assumptions.retirement.healthcareCostMultiplier', value: 1.5 },
    ]);
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profile);
    expect(inputs).toEqual({
      ...DEFAULT_INPUTS,
      lifeExpectancy: 92,
      socialSecurityAge: 70,
      socialSecurityBenefit: 24000,
      healthcareCostMultiplier: 1.5,
      riskProfile: 'custom',
      effectiveTaxRate: 0.18,
      estimatedAnnualHealthcareCost: 9000,
    });
    expect(inputs).toMatchObject({
      lifeExpectancy: 92,
      socialSecurityBenefit: 24000,
      socialSecurityAge: 70,
      estimatedAnnualHealthcareCost: 9000,
      riskProfile: 'custom',
      effectiveTaxRate: 0.18,
      healthcareCostMultiplier: 1.5,
    });
  });

  describe('the Social Security benefit: answered, unanswered and Auto', () => {
    const benefitIn = (profile: FinancialProfile) => engineInputsFor(RETIREMENT_CALCULATOR, profile).socialSecurityBenefit;

    it('runs an answered number as entered', () => {
      expect(benefitIn(withWrites([{ path: 'retirementIncome.socialSecurityBenefit', value: 24000 }]))).toBe(24000);
      // 0 is an answer, not Auto.
      expect(benefitIn(withWrites([{ path: 'retirementIncome.socialSecurityBenefit', value: 0 }]))).toBe(0);
    });

    it('runs the estimate from yearly gross pay on Auto (null)', () => {
      // 3,500 every two weeks = 91,000 a year; AIME 7,583.33:
      // 1,157.40 + 0.32 x (7,583.33 - 1,286) = 2,015.15 -> 3,172.55 a month, 38,070.56 a year.
      expect(benefitIn(withWrites([{ path: 'retirementIncome.socialSecurityBenefit', value: null }]))).toBe(38071);
      // Weekly pay of 2,100 = 109,200 a year; AIME 9,100:
      // 1,157.40 + 2,068.16 + 0.15 x 1,351 = 202.65 -> 3,428.21 a month, 41,138.52 a year.
      expect(
        benefitIn(
          withWrites([
            { path: 'retirementIncome.socialSecurityBenefit', value: null },
            { path: 'income.grossPerPaycheck', value: 2100 },
            { path: 'income.frequency', value: 'weekly' },
          ])
        )
      ).toBe(41139);
    });

    it('married filing jointly: still one worker\'s benefit from the household pay figure', () => {
      const single = withWrites([{ path: 'retirementIncome.socialSecurityBenefit', value: null }]);
      const joint = withWrites([
        { path: 'retirementIncome.socialSecurityBenefit', value: null },
        { path: 'person.filingStatus', value: 'marriedJoint' },
      ]);
      expect(benefitIn(joint)).toBe(benefitIn(single));
    });

    it('treats an unanswered stored benefit (the 3bb0132 default 30,000, unconfirmed) as Auto', () => {
      // A profile saved at 3bb0132 with nothing answered: normalizeProfile loads the benefit as null.
      const saved = JSON.parse(JSON.stringify({ ...defaultProfileAt3bb0132(), provided: ['person.age'] }));
      expect(saved.retirementIncome.socialSecurityBenefit).toBe(30000);
      const loaded = normalizeProfile(saved);
      expect(loaded.retirementIncome.socialSecurityBenefit).toBeNull();
      expect(benefitIn(loaded)).toBe(38071);
    });

    it('keeps an answered stored benefit from a profile saved at 3bb0132', () => {
      const saved = JSON.parse(JSON.stringify(answeredEverywhere(defaultProfileAt3bb0132())));
      const loaded = normalizeProfile(saved);
      expect(loaded.retirementIncome.socialSecurityBenefit).toBe(30000);
      expect(engineInputsFor(RETIREMENT_CALCULATOR, loaded)).toEqual(DEFAULT_INPUTS);
    });

    it('resolves the leaf through one helper', () => {
      const read = RETIREMENT_BINDINGS.filter((binding) => binding.engine === 'socialSecurityBenefit');
      expect(read).toHaveLength(1);
      expect(isDerivedBinding(read[0]) && read[0].read).toBe(resolveSocialSecurityBenefit);
    });
  });

  it.each<[FilingStatus, RetirementInputs['filingStatus']]>([
    ['single', 'single'],
    ['marriedJoint', 'marriedJoint'],
    ['marriedSeparate', 'single'],
    ['headOfHousehold', 'single'],
  ])('maps filing status %s to %s in one binding (O10)', (status, expected) => {
    const profile = withWrites([{ path: 'person.filingStatus', value: status }]);
    expect(engineInputsFor(RETIREMENT_CALCULATOR, profile).filingStatus).toBe(expected);
    expect(retirementFilingStatus(status)).toBe(expected);
    expect(RETIREMENT_BINDINGS.filter((binding) => binding.engine === 'filingStatus')).toHaveLength(1);
  });

  it.each<[PayFrequency, number, RetirementInputs['incomePeriod'], number, number]>([
    ['weekly', 1000, 'yearly', 52000, 52000],
    ['bi-weekly', 3500, 'biweekly', 3500, 91000],
    ['semi-monthly', 4000, 'semimonthly', 4000, 96000],
    ['monthly', 8000, 'monthly', 8000, 96000],
  ])('enters %s pay of %d as period %s, amount %d, annual %d (O11)', (frequency, gross, period, amount, annual) => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, v1({ income: { frequency, grossPerPaycheck: gross } }));
    expect(inputs.incomePeriod).toBe(period);
    expect(inputs.incomeAmount).toBe(amount);
    expect(inputs.currentIncome).toBe(annual);
  });
});

describe('every RetirementInputs leaf is bound or engine-only', () => {
  const bound = new Set(RETIREMENT_BINDINGS.map((binding) => binding.engine));

  it('binds each leaf exactly once', () => {
    for (const leaf of Object.keys(LEAVES)) {
      expect(RETIREMENT_BINDINGS.filter((binding) => binding.engine === leaf), leaf).toHaveLength(1);
    }
    expect([...bound].sort()).toEqual(Object.keys(LEAVES).sort());
  });

  it('lists the income leaves and the two account derivations as engine-only, each still derived by a binding', () => {
    expect(Object.keys(RETIREMENT_ENGINE_ONLY).sort()).toEqual([
      'currentIncome',
      'incomeAmount',
      'incomePeriod',
      'monthlySavings',
      'startingBalance',
      'yearStartSavings',
    ]);
    for (const [leaf, reason] of Object.entries(RETIREMENT_ENGINE_ONLY)) {
      expect(reason.length, leaf).toBeGreaterThan(0);
      const binding = RETIREMENT_BINDINGS.find((each) => each.engine === leaf)!;
      expect(isDerivedBinding(binding), leaf).toBe(true);
    }
  });

  it('reads every 1:1 leaf from a real profile path the form asks', () => {
    const asked = new Set(RETIREMENT_FORM.fields.map((spec) => spec.path));
    for (const binding of RETIREMENT_BINDINGS) {
      if (isDerivedBinding(binding)) continue;
      expect(isProfilePath(binding.profile), binding.profile).toBe(true);
      expect(asked.has(binding.profile), binding.profile).toBe(true);
    }
  });

  it('builds the engine base from the default profile, with every leaf', () => {
    const base = RETIREMENT_CALCULATOR.engineBase();
    expect(Object.keys(base).sort()).toEqual(Object.keys(LEAVES).sort());
    expect(base).toEqual(engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile()));
  });
});

describe('the definition', () => {
  it('runs debounced by 300 ms', () => {
    expect(RETIREMENT_CALCULATOR.id).toBe('retirement');
    expect(RETIREMENT_CALCULATOR.debounceMs).toBe(300);
    expect(RETIREMENT_CALCULATOR.form).toBe(RETIREMENT_FORM);
    expect(RETIREMENT_CALCULATOR.bindings).toBe(RETIREMENT_BINDINGS);
  });

  it('maps engine errors back to profile paths, the form message first', () => {
    const profile = withWrites([
      { path: 'person.age', value: 60 },
      { path: 'person.retirementAge', value: 60 },
    ]);
    expect(prepareRun(RETIREMENT_CALCULATOR, profile).errors).toEqual({
      'person.retirementAge': 'The retirement age needs to be above your current age.',
    });
    // An engine-only rule reaches its field: a negative healthcare override.
    const negative = withWrites([
      { path: 'retirementIncome.annualHealthcareCost', value: -1 },
    ]);
    expect(RETIREMENT_CALCULATOR.validate(engineInputsFor(RETIREMENT_CALCULATOR, negative))).toEqual({
      estimatedAnnualHealthcareCost: 'Estimated healthcare cost cannot be negative.',
    });
    expect(prepareRun(RETIREMENT_CALCULATOR, negative).errors).toEqual({
      'retirementIncome.annualHealthcareCost': 'Annual healthcare cost must be at least $0.',
    });
  });
});

describe('filingStatusNote', () => {
  it('names the saved status when the model runs it as single', () => {
    expect(filingStatusNote('headOfHousehold')).toBe(
      'Retirement estimates model only single and married filing jointly, so head of household runs here as single.'
    );
    expect(filingStatusNote('marriedSeparate')).toBe(
      'Retirement estimates model only single and married filing jointly, so married filing separately runs here as single.'
    );
  });

  it('is null for the two statuses the model has', () => {
    expect(filingStatusNote('single')).toBeNull();
    expect(filingStatusNote('marriedJoint')).toBeNull();
  });
});

describe('profile v3: the account list and monthly investing feed the projection', () => {
  it('runs Custom monthly investing as typed, and Auto from the contribution answers', () => {
    const custom = applyProfileWrites(getDefaultFinancialProfile(), [{ path: 'investing.monthlyContribution', value: 1500 }]).profile;
    expect(engineInputsFor(RETIREMENT_CALCULATOR, custom).monthlySavings).toBe(1500);
    expect(engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile()).monthlySavings).toBe(1540);
  });

  it('runs the owner fixture: 105,800 invested (the emergency fund left out) and 3,195 a month', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, normalizeProfile(ownerRaw()));
    // 401(k) 80,000 + HSA 12,000 + Roth IRA (20 x 375 + 30 x 85 = 10,050) + Brokerage (10 x 375 = 3,750);
    // Robinhood (BOXX 90 x 115 = 10,350) holds the emergency fund.
    expect(inputs.startingBalance).toBe(105800);
    // 6,000 x 26 / 12 = 13,000 a month: 1,300 own 401(k) (10%) + 520 match (4%) + 250 HSA
    // + 100 employer HSA (1,200 / 12) + 625 Roth IRA + 400 taxable.
    expect(inputs.monthlySavings).toBe(3195);
  });

  it('pins the default projection (measured on the v3 inputs: 25,000 invested, 1,540 a month)', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile());
    const results = RETIREMENT_CALCULATOR.calculate(inputs);
    const headline = Object.fromEntries(retirementHeadline(results, inputs, 'nominal').map((stat) => [stat.id, stat.value]));
    // Before profile v3 (1,500 a month): projected 5,662,079.84, withdrawal rate 2.362%.
    expect(headline.success).toBe(1);
    expect(headline.projected).toBeCloseTo(5796147.137288305, 4);
    expect(headline.required).toBeCloseTo(3343588.7367990543, 4);
    expect(headline['withdrawal-rate']).toBeCloseTo(0.023074560790831363, 10);
    const scenario = (id: string) => results.scenarios.find((each) => each.id === id)!;
    expect(scenario('early-retirement').name).toBe('Retire 5 years early at 60');
    expect(scenario('early-retirement').projectedBalance).toBeCloseTo(4100839.6963539924, 4);
    expect(scenario('early-retirement').successProbability).toBeCloseTo(0.994, 10);
    // Half of 1,540 is 770 (750 before).
    expect(scenario('coast-mode').name).toBe('Coast: Save only $770/month (enjoy extra $770/month now)');
    expect(scenario('coast-mode').projectedBalance).toBeCloseTo(3215351.5697522396, 4);
    expect(scenario('coast-mode').successProbability).toBeCloseTo(0.973, 10);
  });
});

describe('PR 5: contribution timing reaches the engine through yearStartSavings', () => {
  const ownerYearly = () => engineInputsFor(RETIREMENT_CALCULATOR, normalizeProfile(ownerYearStartRaw()));

  it('binds yearStartSavings once, from yearStartInvesting', () => {
    const read = RETIREMENT_BINDINGS.filter((binding) => binding.engine === 'yearStartSavings');
    expect(read).toHaveLength(1);
    expect(isDerivedBinding(read[0]) && read[0].read).toBe(yearStartInvesting);
  });

  it('the owner with the Roth IRA once a year: 3,195 a month in total, 7,500 of it at the start of each year', () => {
    const inputs = ownerYearly();
    expect(inputs.monthlySavings).toBe(3195);
    expect(inputs.yearStartSavings).toBe(7500);
    // Untouched timing: 0, as for the default.
    expect(engineInputsFor(RETIREMENT_CALCULATOR, normalizeProfile(ownerRaw())).yearStartSavings).toBe(0);
  });

  it('pins the owner yearly figures (13,394,066.77 and 0.9985% with every part monthly)', () => {
    const inputs = ownerYearly();
    const results = RETIREMENT_CALCULATOR.calculate(inputs);
    const headline = Object.fromEntries(retirementHeadline(results, inputs, 'nominal').map((stat) => [stat.id, stat.value]));
    expect(headline.success).toBe(1);
    expect(headline.projected).toBeCloseTo(13494440.92, 1);
    expect(results.initialWithdrawalRate).toBeCloseTo(0.009911010780006283, 10);
    const scenario = (id: string) => results.scenarios.find((each) => each.id === id)!;
    expect(scenario('early-retirement').projectedBalance).toBeCloseTo(9566204.34, 1);
    // Half of 3,195 is 1,597.50; the yearly part keeps its share: 7,500 x 1,597.5 / 3,195 = 3,750.
    expect(scenario('coast-mode').name).toBe('Coast: Save only $1,598/month (enjoy extra $1,598/month now)');
    expect(scenario('coast-mode').projectedBalance).toBeCloseTo(8089940.96, 1);
    const conservative = scenario('conservative-wealth-building');
    expect(conservative.name).toBe('Conservative: $2,700/month, leave $25,126,000 legacy');
    expect(conservative.title).toHaveLength(5);
    const [lead, income, middle, legacy, tail] = conservative.title!;
    expect([lead, middle, tail]).toEqual(['Conservative: ', '/month, leave ', ' legacy']);
    expect(income).toMatchObject({ basis: 'today', yearsFromNow: 40, roundTo: 100 });
    // 41,000 x 0.8 / 12.
    expect((income as { amount: number }).amount).toBeCloseTo(2733.3333333333335, 9);
    expect(legacy).toMatchObject({ basis: 'nominal', yearsFromNow: 65, roundTo: 1000 });
    expect((legacy as { amount: number }).amount).toBeCloseTo(25126020.89, 1);
  });

  it('the default with a Roth IRA of 625 once a year (2,165 a month in total, 7,500 yearly)', () => {
    const profile = normalizeProfile(
      rawWith({ 'ira.roth': true, 'ira.rothMonthly': 625, 'ira.rothTiming': 'yearStart' })
    );
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, profile);
    expect(inputs.monthlySavings).toBe(2165);
    expect(inputs.yearStartSavings).toBe(7500);
    expect(calculateProjectedBalance(inputs)).toBeCloseTo(7991322.893346089, 6);
    // Age 25 to 26 at 9.4%: (25,000 + 7,500) x 1.094 + 1,540 x (1.094 - 1) / (1.094^(1/12) - 1).
    expect(RETIREMENT_CALCULATOR.calculate(inputs).netWorthByAge[26]).toBeCloseTo(54818.27, 1);
    // The same plan paid monthly (measured at ec300fd): 7,890,948.734314326.
    expect(calculateProjectedBalance({ ...inputs, yearStartSavings: 0 })).toBeCloseTo(7890948.734314326, 6);
  });

  it('the default projection stays bit-identical', () => {
    const inputs = engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile());
    expect(inputs.yearStartSavings).toBe(0);
    expect(calculateProjectedBalance(inputs)).toBe(5796147.137288305);
  });

  it('falling short (default inputs, no balance, 300 a month, 60,000 target): the full solution is unchanged', () => {
    const base = engineInputsFor(RETIREMENT_CALCULATOR, getDefaultFinancialProfile());
    const inputs = { ...base, startingBalance: 0, monthlySavings: 300, targetIncome: 60000 };
    const scenarios = RETIREMENT_CALCULATOR.calculate(inputs).scenarios;
    expect(scenarios.find((each) => each.id === 'full-solution')?.name).toBe('Save extra $1,219/month \u2192 Meet goal');
    const without: RetirementInputs = { ...inputs };
    delete without.yearStartSavings;
    expect(RETIREMENT_CALCULATOR.calculate(without).scenarios).toEqual(scenarios);
  });
});
