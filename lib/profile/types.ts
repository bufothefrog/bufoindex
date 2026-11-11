/**
 * Shared financial profile, v2 (docs/rebuild-plan.md section 2.3).
 *
 * One client-side record (persisted by lib/store/profileStore.ts under the
 * localStorage key 'bufo-profile') holds every user input of every
 * calculator: facts about the person in topic sections, model assumptions
 * under `assumptions.<calculator>`, and lists (debts, portfolio accounts,
 * securities, holdings, class targets) as first-class arrays. Nothing here
 * leaves the browser.
 *
 * Units: money is US dollars; every rate or percentage is a decimal
 * (0.5 = 50%, 0.04 = 4% APY), matching PercentInput and the engines it feeds.
 *
 * Nullable leaves (effectiveTaxRate, annualHealthcareCost, the leverage
 * overrides) mean "derive this from the rest of the profile" when null.
 */

import type {
  Account,
  ClassTarget,
  CustomAssetClass,
  Holding,
  RebalanceMode,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import type {
  BonusFrequency,
  ContributionType,
  FilingStatus,
  HsaCoverage,
  OptimizationGoal,
  RiskTolerance,
  StrategyPresetValue,
  TargetMix,
} from '@/lib/constants/labels';
import type { PayFrequency } from '@/lib/constants/frequency';

export type { PayFrequency } from '@/lib/constants/frequency';
export type {
  BonusFrequency,
  ContributionType,
  FilingStatus,
  HsaCoverage,
  OptimizationGoal,
  RiskTolerance,
} from '@/lib/constants/labels';

/** @deprecated Use FilingStatus (4 values since profile v2). Removed in x1. */
export type ProfileFilingStatus = FilingStatus;

/**
 * Strategy presets. Both are presented side by side; neither is a default
 * "right answer". 'standard' follows the conventional sequence (3-month cash
 * cushion, unleveraged index funds); 'cashflow-investor' holds a smaller cash
 * buffer and compares a leveraged fund for taxable contributions.
 */
export type StrategyPreset = StrategyPresetValue;

/**
 * Stock/bond split, e.g. '80-20' = 80% stocks, 20% bonds. 'custom' means the
 * rebalancer uses portfolio.classTargets instead of a preset.
 */
export type TargetMixPreset = TargetMix | 'custom';

/** Retirement return model: target-date glide path or fixed custom returns. */
export type RetirementRiskProfile = 'tdf' | 'custom';

/** One debt (same shape as the paycheck engine's DebtData). */
export interface ProfileDebt {
  id: string;
  name: string;
  balance: number;
  /** Decimal APR, 0.035 = 3.5%. */
  interestRate: number;
  /** Monthly. */
  minimumPayment: number;
  /** Monthly. */
  extraPayment: number;
  taxDeductible: boolean;
}

export type ProfileAccount = Account;
export type ProfileSecurity = Security;
export type ProfileHolding = Holding;
export type ProfileClassTarget = ClassTarget;
export type ProfileCustomAssetClass = CustomAssetClass;

export interface RetirementAssumptions {
  riskProfile: RetirementRiskProfile;
  accumulationReturn: number;
  retirementReturn: number;
  inflationRate: number;
  volatility: number;
  /** null = derive from the 2026 brackets. */
  effectiveTaxRate: number | null;
  healthcareCostMultiplier: number;
}

export interface PaycheckAssumptions {
  riskTolerance: RiskTolerance;
  optimizationGoal: OptimizationGoal;
  /** Expected marginal federal bracket in retirement, decimal. */
  expectedRetirementBracket: number;
}

export interface PortfolioAssumptions {
  mode: RebalanceMode;
  allowTaxableSelling: boolean;
  showPlacementAdvice: boolean;
}

export interface LeverageAssumptions {
  indexMeanReturn: number;
  indexVolatility: number;
  financingRate: number;
  expenseRatio: number;
  indexExpenseRatio: number;
}

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
    lifeExpectancy: number;
  };
  income: {
    grossPerPaycheck: number;
    netPerPaycheck: number;
    frequency: PayFrequency;
    hasBonus: boolean;
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
    /** Roth share of the total when contributionType is 'split'. */
    rothContributionPercent: number;
    /** After-tax (mega backdoor Roth) contributions available. */
    afterTaxAvailable: boolean;
  };
  hsa: {
    eligible: boolean;
    coverage: HsaCoverage;
    /** Monthly personal contribution. */
    monthlyContribution: number;
    /** Annual employer contribution. */
    employerAnnualContribution: number;
    /** Invests the HSA rather than spending from it. */
    investing: boolean;
  };
  ira: {
    traditional: boolean;
    roth: boolean;
    /** Monthly. */
    traditionalMonthly: number;
    /** Monthly. */
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
     * @deprecated Since v2 the rebalancer deposit lives on
     * portfolio.accounts[].deposit; v1 values migrate into the Brokerage
     * account and writes here are mirrored there. Deleted in x1.
     */
    newCashThisMonth: number;
  };
  retirementIncome: {
    /** Annual, in today's dollars. */
    socialSecurityBenefit: number;
    socialSecurityAge: number;
    /** Annual, in today's dollars; null = derive from age and state. */
    annualHealthcareCost: number | null;
  };
  debts: ProfileDebt[];
  portfolio: {
    accounts: ProfileAccount[];
    securities: ProfileSecurity[];
    holdings: ProfileHolding[];
    /** Portfolio-wide class weights, used when investing.targetMix is 'custom'. */
    classTargets: ProfileClassTarget[];
    customAssetClasses: ProfileCustomAssetClass[];
  };
  strategy: {
    preset: StrategyPreset;
    /** Daily-reset leverage multiple used by the leverage comparison, e.g. 2. */
    leverageRatio: number;
  };
  /** Leverage comparison overrides; null = derive from the profile. */
  leverage: {
    monthlyContribution: number | null;
    years: number | null;
    startingBalance: number | null;
  };
  assumptions: {
    retirement: RetirementAssumptions;
    paycheck: PaycheckAssumptions;
    portfolio: PortfolioAssumptions;
    leverage: LeverageAssumptions;
  };
  /**
   * Dot paths the user actually answered, e.g. 'person.age'. A list counts
   * as one path (e.g. 'debts', 'portfolio.accounts').
   */
  provided: string[];
}

/** The top-level keys that hold user-editable data. */
export type ProfileSection = Exclude<keyof FinancialProfile, 'version' | 'updatedAt' | 'provided'>;

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * A partial update, merged path by path into the current profile (any
 * depth; arrays are replaced whole). 'provided', 'version' and 'updatedAt'
 * entries in a patch are ignored.
 */
export type ProfilePatch = DeepPartial<FinancialProfile>;

/** Metadata for one user-editable v1 leaf field. */
export interface ProfileFieldMeta {
  /** Dot path, e.g. 'person.age'. */
  path: string;
  /** Human-readable label. */
  label: string;
  /** The FinancialProfile section key the field lives in, e.g. 'person'. */
  section: string;
}
