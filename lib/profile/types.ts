/**
 * Shared financial profile.
 *
 * One client-side record (persisted by lib/store/profileStore.ts under the
 * localStorage key 'bufo-profile') that feeds every calculator through the
 * pure mappers in lib/profile/mappers.ts. Nothing here leaves the browser.
 *
 * Units: money is US dollars; every rate or percentage is a decimal
 * (0.5 = 50%, 0.04 = 4% APY), matching PercentInput and the calculator
 * models it feeds.
 */

export type PayFrequency = 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';

export type ProfileFilingStatus = 'single' | 'marriedJoint';

/**
 * Strategy presets. Both are presented side by side; neither is a default
 * "right answer". 'standard' follows the conventional sequence (3-month cash
 * cushion, unleveraged index funds); 'cashflow-investor' holds a smaller cash
 * buffer and compares a leveraged fund for taxable contributions.
 */
export type StrategyPreset = 'standard' | 'cashflow-investor';

/** Stock/bond split, e.g. '80-20' = 80% stocks, 20% bonds. */
export type TargetMixPreset = '100-0' | '80-20' | '60-40';

export interface FinancialProfile {
  version: 1;
  /** Epoch milliseconds of the last edit; 0 for an untouched default profile. */
  updatedAt: number;
  person: {
    age: number;
    /** Two-letter state code (lib/constants/states-2026.ts). */
    state: string;
    filingStatus: ProfileFilingStatus;
    retirementAge: number;
  };
  income: {
    grossPerPaycheck: number;
    netPerPaycheck: number;
    frequency: PayFrequency;
  };
  spending: {
    /** Monthly. */
    necessaryMonthly: number;
    /** Monthly. */
    funMoneyMin: number;
    /** Monthly. */
    funMoneyMax: number;
    /** Annual, in today's dollars. */
    targetRetirementIncome: number;
  };
  cash: {
    emergencyFundBalance: number;
    /** Decimal, 0.04 = 4%. */
    emergencyFundApy: number;
    /** Months of necessary expenses to hold in cash. */
    targetMonths: number;
  };
  workplace: {
    has401k: boolean;
    /** Employer match rate as a decimal, 0.5 = 50 cents per dollar. */
    matchPercent: number;
    /** Match cap as a decimal share of salary, 0.06 = 6%. */
    matchLimit: number;
    /** Employee contribution as a decimal share of salary. */
    contributionPercent: number;
  };
  investing: {
    /** Invested balance across accounts, excluding the emergency fund. */
    investedBalance: number;
    /** Total monthly investing contribution (all accounts). */
    monthlyContribution: number;
    /** Portion of the monthly contribution going to a taxable brokerage. */
    taxableMonthlyContribution: number;
    targetMix: TargetMixPreset;
    /** One-off cash to deploy this month (rebalancer deposit). */
    newCashThisMonth: number;
  };
  strategy: {
    preset: StrategyPreset;
    /** Daily-reset leverage multiple used by the leverage comparison, e.g. 2. */
    leverageRatio: number;
  };
  /** Dot paths the user actually answered, e.g. 'person.age'. */
  provided: string[];
}

/** The section keys that hold user-editable leaf fields. */
export type ProfileSection = Exclude<keyof FinancialProfile, 'version' | 'updatedAt' | 'provided'>;

/**
 * A partial update. Sections are shallow-merged into the current profile;
 * 'provided' is handled separately (setFields takes the provided paths as
 * its own argument), so any 'provided' entry in a patch is ignored.
 */
export type ProfilePatch = {
  [K in keyof FinancialProfile]?: FinancialProfile[K] extends object
    ? Partial<FinancialProfile[K]>
    : FinancialProfile[K];
};

/** Metadata for one user-editable leaf field. */
export interface ProfileFieldMeta {
  /** Dot path, e.g. 'person.age'. */
  path: string;
  /** Human-readable label. */
  label: string;
  /** The FinancialProfile section key the field lives in, e.g. 'person'. */
  section: string;
}
