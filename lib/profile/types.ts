/**
 * Shared financial profile (v2).
 *
 * One client-side record (persisted by lib/store/profileStore.ts under the
 * localStorage key 'bufo-profile') that holds every input of every
 * calculator. Nothing here leaves the browser. See docs/rebuild-plan.md
 * section 2.3 for the home of each calculator input.
 *
 * Layout:
 * - Facts about the person live in topic sections (person, income, ...).
 * - Model assumptions live under assumptions.<calculator>.
 * - Nullable leaves are overrides: null means "derive from the profile".
 * - Lists (debts and the portfolio lists) are first-class; their rows reuse
 *   the engine row types so the bindings copy them without reshaping.
 *
 * Units: money is US dollars; every rate or percentage is a decimal
 * (0.5 = 50%, 0.04 = 4% APY), matching PercentInput and the calculator
 * models it feeds.
 */

import type {
  Account,
  ClassTarget,
  CustomAssetClass,
  Holding,
  RebalanceMode,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import type {
  DebtData,
  EmployerBenefits,
  HSABenefits,
  IncomeData,
  UserPreferences,
} from '@/lib/types';

export type PayFrequency = 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';

export type FilingStatus = 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold';

/**
 * Strategy presets. Both are presented side by side; neither is a default
 * "right answer". 'standard' follows the conventional sequence (3-month cash
 * cushion, unleveraged index funds); 'cashflow-investor' holds a smaller cash
 * buffer and compares a leveraged fund for taxable contributions.
 */
export type StrategyPreset = 'standard' | 'cashflow-investor';

/**
 * Stock/bond split, e.g. '80-20' = 80% stocks, 20% bonds. 'custom' uses the
 * per-class targets in portfolio.classTargets.
 */
export type TargetMixPreset = '100-0' | '80-20' | '60-40' | 'custom';

export type BonusFrequency = IncomeData['bonusFrequency'];
export type ContributionType = EmployerBenefits['contributionType'];
export type HsaCoverage = HSABenefits['coverageType'];
export type RiskProfile = RetirementInputs['riskProfile'];
export type RiskTolerance = UserPreferences['riskTolerance'];
export type OptimizationGoal = UserPreferences['optimizationGoal'];

/** One debt (paycheck allocator). Rates are decimals. */
export type DebtRow = DebtData;
/** One portfolio account; `deposit` is the new cash going into it. */
export type AccountRow = Account;
/** One entry of the securities registry shared by every account. */
export type SecurityRow = Security;
/** Shares of one security held in one account. */
export type HoldingRow = Holding;
/** Target for one asset class; accountId null means portfolio-wide. */
export type ClassTargetRow = ClassTarget;
/** A user-defined asset class. */
export type CustomAssetClassRow = CustomAssetClass;

export interface FinancialProfile {
  version: 2;
  /** Epoch milliseconds of the last edit; 0 for an untouched default profile. */
  updatedAt: number;
  person: {
    age: number;
    /** Two-letter state code (lib/constants/states-2026.ts). */
    state: string;
    filingStatus: FilingStatus;
    retirementAge: number;
    /** Age the retirement projection runs to. */
    lifeExpectancy: number;
  };
  income: {
    grossPerPaycheck: number;
    netPerPaycheck: number;
    frequency: PayFrequency;
    hasBonus: boolean;
    /** Average amount per bonus. */
    bonusAmount: number;
    bonusFrequency: BonusFrequency;
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
    contributionType: ContributionType;
    /** Total employee contribution as a decimal share of salary. */
    contributionPercent: number;
    /** Roth part of the total, used only when contributionType is 'split'. */
    rothContributionPercent: number;
    /** The plan accepts after-tax contributions (mega backdoor Roth). */
    afterTaxAvailable: boolean;
  };
  hsa: {
    eligible: boolean;
    coverage: HsaCoverage;
    /** Your own contribution per month. */
    monthlyContribution: number;
    /** Employer contribution per year. */
    employerAnnualContribution: number;
    /** Invests the HSA instead of spending from it. */
    investing: boolean;
  };
  ira: {
    traditional: boolean;
    roth: boolean;
    traditionalMonthly: number;
    rothMonthly: number;
    traditionalBalance: number;
    rothBalance: number;
  };
  investing: {
    /** Invested balance across accounts, excluding the emergency fund. */
    investedBalance: number;
    /** Total monthly investing contribution (all accounts). */
    monthlyContribution: number;
    /** Portion of the monthly contribution going to a taxable brokerage. */
    taxableMonthlyContribution: number;
    targetMix: TargetMixPreset;
    /**
     * @deprecated The rebalancer reads the Brokerage account's deposit in
     * portfolio.accounts. A write here also sets that deposit (see
     * newCashDepositWrites). Kept while the v1 profileCompleteness counts it
     * (lib/profile/mappers.ts): a v1 answer is recorded in `provided` by
     * this path.
     */
    newCashThisMonth: number;
  };
  retirementIncome: {
    /** Annual benefit in today's dollars. */
    socialSecurityBenefit: number;
    socialSecurityAge: number;
    /** Annual healthcare cost; null derives it from the retirement model. */
    annualHealthcareCost: number | null;
  };
  debts: DebtRow[];
  portfolio: {
    accounts: AccountRow[];
    securities: SecurityRow[];
    holdings: HoldingRow[];
    /** Used when investing.targetMix is 'custom'. */
    classTargets: ClassTargetRow[];
    customAssetClasses: CustomAssetClassRow[];
  };
  strategy: {
    preset: StrategyPreset;
    /** Daily-reset leverage multiple used by the leverage comparison, e.g. 2. */
    leverageRatio: number;
  };
  /** Leverage comparison overrides; null derives each one from the profile. */
  leverage: {
    monthlyContribution: number | null;
    years: number | null;
    startingBalance: number | null;
  };
  assumptions: {
    retirement: {
      riskProfile: RiskProfile;
      accumulationReturn: number;
      retirementReturn: number;
      inflationRate: number;
      volatility: number;
      /** null derives the rate from income and filing status. */
      effectiveTaxRate: number | null;
      healthcareCostMultiplier: number;
    };
    paycheck: {
      riskTolerance: RiskTolerance;
      optimizationGoal: OptimizationGoal;
      expectedRetirementBracket: number;
    };
    portfolio: {
      mode: RebalanceMode;
      allowTaxableSelling: boolean;
      showPlacementAdvice: boolean;
    };
    leverage: {
      indexMeanReturn: number;
      indexVolatility: number;
      financingRate: number;
      expenseRatio: number;
      indexExpenseRatio: number;
    };
  };
  /**
   * Dot paths the user actually answered, e.g. 'person.age'. A list is
   * recorded by its list path, e.g. 'debts' or 'portfolio.accounts'.
   */
  provided: string[];
}

/** The top-level keys that hold user data (sections and lists). */
export type ProfileSection = Exclude<keyof FinancialProfile, 'version' | 'updatedAt' | 'provided'>;

/** The list paths. */
export type ProfileListPath =
  | 'debts'
  | 'portfolio.accounts'
  | 'portfolio.securities'
  | 'portfolio.holdings'
  | 'portfolio.classTargets'
  | 'portfolio.customAssetClasses';

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * A partial update for setFields. Objects merge leaf by leaf at any depth; a
 * list is replaced whole. 'provided', 'version' and 'updatedAt' entries are
 * ignored (setFields takes the provided paths as its own argument).
 */
export type ProfilePatch = {
  [K in keyof FinancialProfile]?: DeepPartial<FinancialProfile[K]>;
};

/** Metadata for one v1 leaf field (PROFILE_FIELDS). */
export interface ProfileFieldMeta {
  /** Dot path, e.g. 'person.age'. */
  path: string;
  /** Human-readable label. */
  label: string;
  /** The FinancialProfile section key the field lives in, e.g. 'person'. */
  section: string;
}
