/**
 * Source Citations and References
 * Comprehensive database of all sources used in BufoIndex calculations
 */

export interface SourceCitation {
  id: string;
  title: string;
  authors?: string[];
  organization?: string;
  publicationDate: string;
  url?: string;
  type: 'academic' | 'government' | 'industry' | 'book' | 'report' | 'data';
  reliability: 'primary' | 'secondary' | 'tertiary';
  description: string;
  keyFindings?: string[];
  limitations?: string[];
  lastAccessed?: string;
}

/**
 * Government and Regulatory Sources
 */
export const GOVERNMENT_SOURCES: SourceCitation[] = [
  {
    id: "irs-pub-590-b",
    title: "IRS Publication 590-B: Distributions from Individual Retirement Arrangements (IRAs)",
    organization: "Internal Revenue Service",
    publicationDate: "2024-01-01",
    url: "https://www.irs.gov/publications/p590b",
    type: "government",
    reliability: "primary",
    description: "Official IRS guidance on IRA distribution rules, required minimum distributions, and tax implications",
    keyFindings: [
      "Required minimum distribution (RMD) rules for traditional IRAs",
      "Tax treatment of early distributions and exceptions",
      "Rollover rules and procedures"
    ],
    limitations: [
      "Subject to annual updates and legislative changes",
      "May not reflect pending regulatory changes"
    ]
  },
  {
    id: "ssa-life-expectancy",
    title: "Social Security Administration Life Expectancy Tables",
    organization: "Social Security Administration",
    publicationDate: "2024-01-01",
    url: "https://www.ssa.gov/oact/STATS/table4c6.html",
    type: "government",
    reliability: "primary",
    description: "Official life expectancy data used for Social Security benefit calculations and retirement planning",
    keyFindings: [
      "Average life expectancy at age 65: 84.3 years for men, 86.6 years for women",
      "Life expectancy continues to increase gradually",
      "Significant variation based on socioeconomic factors"
    ]
  },
  {
    id: "fred-inflation-data",
    title: "Consumer Price Index for All Urban Consumers: All Items",
    organization: "Federal Reserve Economic Data (FRED)",
    publicationDate: "2024-01-01",
    url: "https://fred.stlouisfed.org/series/CPIAUCSL",
    type: "data",
    reliability: "primary",
    description: "Official inflation data from the Bureau of Labor Statistics, published via Federal Reserve Economic Data",
    keyFindings: [
      "Long-term average inflation rate approximately 2-3% annually",
      "Significant variation during different economic periods",
      "Healthcare and education costs have consistently exceeded general inflation"
    ]
  },
  {
    id: "cbo-long-term-outlook",
    title: "The Budget and Economic Outlook: 2024 to 2034",
    organization: "Congressional Budget Office",
    publicationDate: "2024-02-01",
    url: "https://www.cbo.gov/publication/59710",
    type: "government",
    reliability: "primary",
    description: "CBO's analysis of economic trends and long-term fiscal projections",
    keyFindings: [
      "Long-term real GDP growth projected at 1.8-2.0% annually",
      "Aging population will affect economic growth and government finances",
      "Interest rates expected to normalize over time"
    ]
  }
];

/**
 * Academic and Research Sources
 */
export const ACADEMIC_SOURCES: SourceCitation[] = [
  {
    id: "trinity-study",
    title: "Retirement Savings: Choosing a Withdrawal Rate That Is Sustainable",
    authors: ["Philip L. Cooley", "Carl M. Hubbard", "Daniel T. Walz"],
    publicationDate: "1998-01-01",
    type: "academic",
    reliability: "primary",
    description: "Seminal study on safe withdrawal rates for retirement portfolios, origin of the 4% rule",
    keyFindings: [
      "4% withdrawal rate had 95% success rate over 30-year periods (1926-1995)",
      "Stock allocation significantly impacts success rates",
      "Initial withdrawal rate more important than ongoing adjustments"
    ],
    limitations: [
      "Based on historical U.S. market data only",
      "Does not account for varying market valuations at retirement",
      "Fixed withdrawal strategy may not be optimal"
    ]
  },
  {
    id: "pfau-withdrawal-research",
    title: "The 4 Percent Rule Is Not Safe in a Low-Yield World",
    authors: ["Wade D. Pfau"],
    publicationDate: "2012-01-01",
    type: "academic",
    reliability: "primary",
    description: "Research challenging the traditional 4% rule in low interest rate environments",
    keyFindings: [
      "Safe withdrawal rates may be lower in current low-yield environment",
      "Sequence of returns risk is significant in early retirement years",
      "International diversification provides some protection but limited benefits"
    ]
  },
  {
    id: "bengen-original-study",
    title: "Determining Withdrawal Rates Using Historical Data",
    authors: ["William P. Bengen"],
    publicationDate: "1994-10-01",
    type: "academic",
    reliability: "primary",
    description: "Original research establishing the 4% safe withdrawal rate concept",
    keyFindings: [
      "Historical worst-case scenario supported 4.15% withdrawal rate",
      "Asset allocation between stocks and bonds critical for success",
      "Sequence of returns in early retirement years determines success"
    ]
  },
  {
    id: "dimson-marsh-staunton",
    title: "Triumph of the Optimists: 101 Years of Global Investment Returns",
    authors: ["Elroy Dimson", "Paul Marsh", "Mike Staunton"],
    publicationDate: "2002-01-01",
    type: "book",
    reliability: "primary",
    description: "Comprehensive analysis of global investment returns over the 20th century",
    keyFindings: [
      "Real equity returns averaged 5.8% globally over 101 years",
      "U.S. market outperformed global average",
      "Survivorship bias affects many return studies"
    ]
  }
];

/**
 * Industry and Professional Sources
 */
export const INDUSTRY_SOURCES: SourceCitation[] = [
  {
    id: "vanguard-retirement-principles",
    title: "Vanguard's Principles for Investing Success",
    organization: "The Vanguard Group",
    publicationDate: "2023-01-01",
    url: "https://investor.vanguard.com/investing/principles",
    type: "industry",
    reliability: "secondary",
    description: "Investment principles and best practices from one of the largest asset managers",
    keyFindings: [
      "Low costs and diversification are key to investment success",
      "Asset allocation drives majority of portfolio returns",
      "Time in market more important than timing the market"
    ]
  },
  {
    id: "fidelity-healthcare-costs",
    title: "Retiree Health Care Cost Estimate",
    organization: "Fidelity Investments",
    publicationDate: "2024-01-01",
    url: "https://www.fidelity.com/viewpoints/personal-finance/plan-for-rising-health-care-costs",
    type: "industry",
    reliability: "secondary",
    description: "Annual estimate of healthcare costs for retirees",
    keyFindings: [
      "Average retiree couple needs $300,000 for healthcare costs",
      "Healthcare costs growing faster than general inflation",
      "Long-term care represents significant additional risk"
    ]
  },
  {
    id: "morningstar-asset-allocation",
    title: "Asset Allocation in Retirement: A Key to Efficient Outcomes",
    organization: "Morningstar Investment Management",
    publicationDate: "2023-01-01",
    type: "industry",
    reliability: "secondary",
    description: "Research on optimal asset allocation strategies during retirement",
    keyFindings: [
      "Glide path strategies can improve retirement outcomes",
      "Bond tent approach may reduce sequence of returns risk",
      "International diversification provides modest benefits"
    ]
  },
  {
    id: "ici-retirement-facts",
    title: "The Role of IRAs in US Retirement Planning",
    organization: "Investment Company Institute",
    publicationDate: "2024-01-01",
    url: "https://www.ici.org/research/retirement",
    type: "industry",
    reliability: "secondary",
    description: "Comprehensive data on retirement account usage and trends",
    keyFindings: [
      "IRA assets represent $11.5 trillion of retirement savings",
      "Average IRA account balance varies significantly by age",
      "Target-date funds increasingly popular in workplace plans"
    ]
  }
];

/**
 * Data Sources
 */
export const DATA_SOURCES: SourceCitation[] = [
  {
    id: "sp500-historical-returns",
    title: "S&P 500 Historical Returns Database",
    organization: "Standard & Poor's / Various Academic Sources",
    publicationDate: "2024-01-01",
    type: "data",
    reliability: "primary",
    description: "Comprehensive historical return data for U.S. stock market",
    keyFindings: [
      "Average annual return approximately 10% nominal, 7% real (1926-2023)",
      "Standard deviation of annual returns approximately 20%",
      "Significant variation in returns across different time periods"
    ]
  },
  {
    id: "treasury-yield-data",
    title: "Daily Treasury Yield Curve Rates",
    organization: "U.S. Department of Treasury",
    publicationDate: "2024-01-01",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve",
    type: "data",
    reliability: "primary",
    description: "Official daily interest rates on U.S. Treasury securities",
    keyFindings: [
      "Interest rates vary significantly over economic cycles",
      "Yield curve shape provides information about economic expectations",
      "Real yields affected by inflation expectations"
    ]
  }
];

/**
 * Complete sources database
 */
export const ALL_SOURCES: SourceCitation[] = [
  ...GOVERNMENT_SOURCES,
  ...ACADEMIC_SOURCES,
  ...INDUSTRY_SOURCES,
  ...DATA_SOURCES
];

/**
 * Search sources by title, description, or organization
 */
export function searchSources(query: string): SourceCitation[] {
  const lowercaseQuery = query.toLowerCase();
  return ALL_SOURCES.filter(source =>
    source.title.toLowerCase().includes(lowercaseQuery) ||
    source.description.toLowerCase().includes(lowercaseQuery) ||
    (source.organization && source.organization.toLowerCase().includes(lowercaseQuery)) ||
    (source.authors && source.authors.some(author => author.toLowerCase().includes(lowercaseQuery)))
  );
}

/**
 * Get sources by type
 */
export function getSourcesByType(type: SourceCitation['type']): SourceCitation[] {
  return ALL_SOURCES.filter(source => source.type === type);
}

/**
 * Get sources by reliability
 */
export function getSourcesByReliability(reliability: SourceCitation['reliability']): SourceCitation[] {
  return ALL_SOURCES.filter(source => source.reliability === reliability);
}

/**
 * Get source by ID
 */
export function getSourceById(id: string): SourceCitation | undefined {
  return ALL_SOURCES.find(source => source.id === id);
}

/**
 * Get most recent sources (published within last 2 years)
 */
export function getRecentSources(): SourceCitation[] {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  return ALL_SOURCES.filter(source => {
    const pubDate = new Date(source.publicationDate);
    return pubDate >= twoYearsAgo;
  });
}

/**
 * Generate formatted citation
 */
export function formatCitation(source: SourceCitation, style: 'apa' | 'mla' | 'chicago' = 'apa'): string {
  switch (style) {
    case 'apa':
      return formatAPACitation(source);
    case 'mla':
      return formatMLACitation(source);
    case 'chicago':
      return formatChicagoCitation(source);
    default:
      return formatAPACitation(source);
  }
}

function formatAPACitation(source: SourceCitation): string {
  const authors = source.authors?.join(', ') || source.organization || 'Unknown';
  const year = new Date(source.publicationDate).getFullYear();
  const url = source.url ? ` Retrieved from ${source.url}` : '';
  
  return `${authors} (${year}). ${source.title}.${url}`;
}

function formatMLACitation(source: SourceCitation): string {
  const authors = source.authors?.join(', ') || source.organization || 'Unknown';
  const url = source.url ? ` Web. ${new Date().toLocaleDateString()}.` : '';
  
  return `${authors}. "${source.title}." ${new Date(source.publicationDate).getFullYear()}.${url}`;
}

function formatChicagoCitation(source: SourceCitation): string {
  const authors = source.authors?.join(', ') || source.organization || 'Unknown';
  const url = source.url ? ` Accessed ${new Date().toLocaleDateString()}. ${source.url}.` : '';
  
  return `${authors}. "${source.title}." ${new Date(source.publicationDate).getFullYear()}.${url}`;
}