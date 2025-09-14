/**
 * Constants and Assumptions Documentation
 * Comprehensive documentation of all constants, assumptions, and data sources
 * used in BufoIndex calculations
 */

export interface ConstantDefinition {
  name: string;
  value: number | string;
  unit?: string;
  description: string;
  source: string;
  lastUpdated: string;
  assumptions: string[];
  limitations: string[];
  category: 'tax' | 'economic' | 'regulatory' | 'demographic' | 'market';
}

export interface AssumptionCategory {
  name: string;
  description: string;
  constants: ConstantDefinition[];
}

/**
 * Federal Tax Constants
 */
export const TAX_CONSTANTS: AssumptionCategory = {
  name: "Federal Tax Rates and Brackets",
  description: "Current federal income tax rates, standard deductions, and related tax parameters",
  constants: [
    {
      name: "Standard Deduction (Single)",
      value: 14600,
      unit: "$",
      description: "2024 standard deduction amount for single filers",
      source: "IRS Publication 15 (2024)",
      lastUpdated: "2024-01-01",
      assumptions: [
        "No changes to tax law during the year",
        "Taxpayer does not itemize deductions",
        "No additional standard deductions for age or blindness"
      ],
      limitations: [
        "Subject to annual inflation adjustments",
        "May not apply to high-income earners subject to phase-outs",
        "Does not account for state tax implications"
      ],
      category: "tax"
    },
    {
      name: "Standard Deduction (Married Filing Jointly)",
      value: 29200,
      unit: "$",
      description: "2024 standard deduction amount for married couples filing jointly",
      source: "IRS Publication 15 (2024)",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Both spouses are under age 65",
        "No additional standard deductions apply",
        "No separate state filing requirements"
      ],
      limitations: [
        "Subject to annual inflation adjustments",
        "May be reduced for high-income earners",
        "Does not include state-specific deductions"
      ],
      category: "tax"
    }
  ]
};

/**
 * Economic Assumptions
 */
export const ECONOMIC_CONSTANTS: AssumptionCategory = {
  name: "Economic Assumptions",
  description: "Default economic parameters used in long-term financial projections",
  constants: [
    {
      name: "Long-term Inflation Rate",
      value: 0.025,
      unit: "decimal",
      description: "Long-term average annual inflation rate used in retirement projections",
      source: "Federal Reserve long-term inflation target and historical CPI data",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Federal Reserve maintains 2% inflation target",
        "No major economic disruptions or policy changes",
        "Historical relationship between monetary policy and inflation continues"
      ],
      limitations: [
        "Short-term inflation may vary significantly from long-term average",
        "Does not account for sector-specific inflation (e.g., healthcare, education)",
        "Assumes stable monetary and fiscal policy over projection period"
      ],
      category: "economic"
    },
    {
      name: "Real GDP Growth Rate",
      value: 0.02,
      unit: "decimal",
      description: "Long-term real economic growth rate assumption",
      source: "Congressional Budget Office Long-Term Economic Outlook",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Continued productivity improvements",
        "Stable demographic trends",
        "No major economic disruptions"
      ],
      limitations: [
        "Subject to significant variation during economic cycles",
        "Demographic changes may reduce future growth rates",
        "Technology disruptions could alter growth patterns"
      ],
      category: "economic"
    }
  ]
};

/**
 * Market Return Assumptions
 */
export const MARKET_CONSTANTS: AssumptionCategory = {
  name: "Market Return Assumptions",
  description: "Expected returns and volatility for different asset classes used in portfolio modeling",
  constants: [
    {
      name: "Stock Market Real Return",
      value: 0.07,
      unit: "decimal",
      description: "Long-term real (inflation-adjusted) annual return for U.S. stock market",
      source: "Historical S&P 500 returns (1926-2023), adjusted for inflation",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Market structure remains fundamentally similar to historical periods",
        "No permanent changes to risk premiums",
        "Continued economic growth and corporate profitability"
      ],
      limitations: [
        "Past performance does not guarantee future results",
        "Actual returns will vary significantly from year to year",
        "Market conditions may change due to regulatory or structural factors"
      ],
      category: "market"
    },
    {
      name: "Stock Market Volatility",
      value: 0.16,
      unit: "decimal",
      description: "Annual volatility (standard deviation) of stock market returns",
      source: "Historical S&P 500 volatility analysis (1926-2023)",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Volatility remains within historical ranges",
        "Market structure continues to provide similar risk characteristics",
        "No fundamental changes to market volatility regime"
      ],
      limitations: [
        "Volatility itself is volatile and changes over time",
        "Extreme market events may exceed historical volatility measures",
        "Does not account for correlation changes during market stress"
      ],
      category: "market"
    },
    {
      name: "Bond Market Real Return",
      value: 0.02,
      unit: "decimal",
      description: "Long-term real return assumption for intermediate-term government bonds",
      source: "Historical 10-year Treasury returns adjusted for inflation",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Interest rates normalize to historical averages over time",
        "No major changes to credit risk or monetary policy",
        "Continued liquid markets for government securities"
      ],
      limitations: [
        "Interest rate changes create significant short-term volatility",
        "Current low interest rate environment may persist longer than expected",
        "Inflation risk affects real returns on nominal bonds"
      ],
      category: "market"
    }
  ]
};

/**
 * Retirement Planning Constants
 */
export const RETIREMENT_CONSTANTS: AssumptionCategory = {
  name: "Retirement Planning Parameters",
  description: "Standard assumptions used in retirement planning calculations",
  constants: [
    {
      name: "Safe Withdrawal Rate",
      value: 0.04,
      unit: "decimal",
      description: "Traditional 4% rule for retirement portfolio withdrawals",
      source: "Trinity Study (1998) and subsequent research by Wade Pfau",
      lastUpdated: "2024-01-01",
      assumptions: [
        "30-year retirement period",
        "50/50 stock/bond portfolio allocation",
        "Withdrawals adjusted annually for inflation",
        "No additional income sources during retirement"
      ],
      limitations: [
        "May be too aggressive for early retirees with longer time horizons",
        "Does not account for sequence of returns risk in early retirement",
        "Market valuations at retirement significantly impact success rates",
        "Healthcare costs may exceed general inflation rate"
      ],
      category: "demographic"
    },
    {
      name: "Life Expectancy",
      value: 85,
      unit: "years",
      description: "Planning assumption for retirement duration",
      source: "Social Security Administration Life Expectancy Tables",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Average health and lifestyle factors",
        "Access to standard healthcare",
        "No major medical breakthroughs or setbacks"
      ],
      limitations: [
        "Individual health factors may significantly affect actual life expectancy",
        "Medical advances could extend lifespans beyond current projections",
        "Does not account for long-term care needs"
      ],
      category: "demographic"
    }
  ]
};

/**
 * Social Security Constants
 */
export const SOCIAL_SECURITY_CONSTANTS: AssumptionCategory = {
  name: "Social Security Parameters",
  description: "Current Social Security benefit calculation parameters and assumptions",
  constants: [
    {
      name: "Full Retirement Age",
      value: 67,
      unit: "years",
      description: "Full retirement age for people born in 1960 or later",
      source: "Social Security Administration",
      lastUpdated: "2024-01-01",
      assumptions: [
        "No changes to Social Security full retirement age",
        "Individual born in 1960 or later"
      ],
      limitations: [
        "Full retirement age varies by birth year",
        "Future legislative changes could modify retirement age",
        "Does not account for disability or survivor benefits"
      ],
      category: "regulatory"
    },
    {
      name: "Early Claim Reduction Rate",
      value: 0.0555,
      unit: "decimal per year",
      description: "Annual reduction in benefits for each year before full retirement age",
      source: "Social Security Administration benefit calculation rules",
      lastUpdated: "2024-01-01",
      assumptions: [
        "No changes to early retirement reduction factors",
        "Benefits claimed before full retirement age"
      ],
      limitations: [
        "Different reduction rates apply for different years before FRA",
        "Reduction is permanent for lifetime of benefit",
        "Spouse benefits may have different reduction schedules"
      ],
      category: "regulatory"
    },
    {
      name: "Delayed Retirement Credit",
      value: 0.08,
      unit: "decimal per year",
      description: "Annual increase in benefits for each year past full retirement age until age 70",
      source: "Social Security Administration benefit calculation rules",
      lastUpdated: "2024-01-01",
      assumptions: [
        "No changes to delayed retirement credit rates",
        "Benefits claimed after full retirement age but before age 70"
      ],
      limitations: [
        "Credits stop accruing at age 70",
        "No benefit to delaying past age 70",
        "Does not apply to spouse benefits"
      ],
      category: "regulatory"
    }
  ]
};

/**
 * Healthcare Cost Constants
 */
export const HEALTHCARE_CONSTANTS: AssumptionCategory = {
  name: "Healthcare Cost Projections",
  description: "Healthcare cost assumptions for retirement planning",
  constants: [
    {
      name: "Healthcare Inflation Rate",
      value: 0.05,
      unit: "decimal",
      description: "Annual healthcare cost inflation rate, typically higher than general inflation",
      source: "Centers for Medicare & Medicaid Services National Health Expenditure projections",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Healthcare costs continue to grow faster than general inflation",
        "No major healthcare policy reforms",
        "Continued medical technology advancement"
      ],
      limitations: [
        "Individual health conditions may result in much higher costs",
        "Long-term care costs may grow even faster",
        "Policy changes could dramatically alter cost structure"
      ],
      category: "economic"
    },
    {
      name: "Annual Healthcare Cost (Retiree)",
      value: 6000,
      unit: "$",
      description: "Estimated annual out-of-pocket healthcare costs for retirees",
      source: "Fidelity Retiree Health Care Cost Estimate",
      lastUpdated: "2024-01-01",
      assumptions: [
        "Medicare enrollment with typical supplemental coverage",
        "Average health status",
        "No major chronic conditions"
      ],
      limitations: [
        "Costs vary dramatically by health status and location",
        "Long-term care costs not included in base estimate",
        "Prescription drug costs subject to significant variation"
      ],
      category: "economic"
    }
  ]
};

/**
 * Complete constants registry
 */
export const ALL_CONSTANTS: AssumptionCategory[] = [
  TAX_CONSTANTS,
  ECONOMIC_CONSTANTS,
  MARKET_CONSTANTS,
  RETIREMENT_CONSTANTS,
  SOCIAL_SECURITY_CONSTANTS,
  HEALTHCARE_CONSTANTS
];

/**
 * Get all constants flattened into a single array
 */
export function getAllConstants(): ConstantDefinition[] {
  return ALL_CONSTANTS.flatMap(category => category.constants);
}

/**
 * Get constants by category
 */
export function getConstantsByCategory(category: ConstantDefinition['category']): ConstantDefinition[] {
  return getAllConstants().filter(constant => constant.category === category);
}

/**
 * Search constants by name or description
 */
export function searchConstants(query: string): ConstantDefinition[] {
  const lowercaseQuery = query.toLowerCase();
  return getAllConstants().filter(constant =>
    constant.name.toLowerCase().includes(lowercaseQuery) ||
    constant.description.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get outdated constants (over 1 year old)
 */
export function getOutdatedConstants(): ConstantDefinition[] {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return getAllConstants().filter(constant => {
    const lastUpdate = new Date(constant.lastUpdated);
    return lastUpdate < oneYearAgo;
  });
}