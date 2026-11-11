/**
 * Persisted 'bufo-profile' v1 payloads (the zustand persist envelope as it
 * sits in localStorage), used by the v1 -> v2 migration and mapper golden
 * tests. Shapes are copied from real v1 writes: the untouched default, a
 * fully answered profile, and a hand-edited / partly corrupt one.
 */

export interface PersistEnvelope {
  state: { profile: unknown };
  version: number;
}

/** Untouched v1 default profile (what a first visit persisted). */
export const V1_DEFAULT: PersistEnvelope = {
  state: {
    profile: {
      version: 1,
      updatedAt: 0,
      person: { age: 30, state: 'TX', filingStatus: 'single', retirementAge: 60 },
      income: { grossPerPaycheck: 3500, netPerPaycheck: 2600, frequency: 'bi-weekly' },
      spending: { necessaryMonthly: 3000, funMoneyMin: 300, funMoneyMax: 600, targetRetirementIncome: 80000 },
      cash: { emergencyFundBalance: 5000, emergencyFundApy: 0.04, targetMonths: 3 },
      workplace: { has401k: true, matchPercent: 0.5, matchLimit: 0.06, contributionPercent: 0.06 },
      investing: {
        investedBalance: 25000,
        monthlyContribution: 1500,
        taxableMonthlyContribution: 500,
        targetMix: '80-20',
        newCashThisMonth: 1000,
      },
      strategy: { preset: 'cashflow-investor', leverageRatio: 2 },
      provided: [],
    },
  },
  version: 1,
};

/** Every v1 leaf answered, every section different from the defaults. */
export const V1_ALL_PROVIDED: PersistEnvelope = {
  state: {
    profile: {
      version: 1,
      updatedAt: 1760000000000,
      person: { age: 38, state: 'CA', filingStatus: 'marriedJoint', retirementAge: 58 },
      income: { grossPerPaycheck: 2100, netPerPaycheck: 1550, frequency: 'weekly' },
      spending: { necessaryMonthly: 4200, funMoneyMin: 250, funMoneyMax: 900, targetRetirementIncome: 110000 },
      cash: { emergencyFundBalance: 12000, emergencyFundApy: 0.045, targetMonths: 1 },
      workplace: { has401k: true, matchPercent: 1, matchLimit: 0.04, contributionPercent: 0.1 },
      investing: {
        investedBalance: 140000,
        monthlyContribution: 2200,
        taxableMonthlyContribution: 900,
        targetMix: '60-40',
        newCashThisMonth: 3000,
      },
      strategy: { preset: 'standard', leverageRatio: 1.5 },
      provided: [
        'person.age',
        'person.state',
        'person.filingStatus',
        'person.retirementAge',
        'income.grossPerPaycheck',
        'income.netPerPaycheck',
        'income.frequency',
        'spending.necessaryMonthly',
        'spending.funMoneyMin',
        'spending.funMoneyMax',
        'spending.targetRetirementIncome',
        'cash.emergencyFundBalance',
        'cash.emergencyFundApy',
        'cash.targetMonths',
        'workplace.has401k',
        'workplace.matchPercent',
        'workplace.matchLimit',
        'workplace.contributionPercent',
        'investing.investedBalance',
        'investing.monthlyContribution',
        'investing.taxableMonthlyContribution',
        'investing.targetMix',
        'investing.newCashThisMonth',
        'strategy.preset',
        'strategy.leverageRatio',
      ],
    },
  },
  version: 1,
};

/**
 * Hand-edited in devtools: wrong types, an unknown enum, a missing section,
 * a negative new-cash amount, junk keys and junk provided entries.
 */
export const V1_GARBAGE: PersistEnvelope = {
  state: {
    profile: {
      version: 1,
      updatedAt: 'yesterday',
      person: { age: '41', state: '', filingStatus: 'married', retirementAge: 62, nickname: 'Bufo' },
      income: { grossPerPaycheck: 4100, netPerPaycheck: null, frequency: 'monthly' },
      spending: 'lots',
      workplace: { has401k: 'yes', matchPercent: 0.25, matchLimit: Number.NaN, contributionPercent: 0.08 },
      investing: { investedBalance: 9000, targetMix: '90-10', newCashThisMonth: -50 },
      strategy: { preset: 'yolo', leverageRatio: 3 },
      extra: { anything: true },
      provided: ['person.retirementAge', 'income.grossPerPaycheck', 42, 'person.nickname', 'income.frequency'],
    },
  },
  version: 1,
};

export const V1_PAYLOADS = {
  default: V1_DEFAULT,
  allProvided: V1_ALL_PROVIDED,
  garbage: V1_GARBAGE,
} as const;
