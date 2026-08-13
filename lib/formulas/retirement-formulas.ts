/**
 * Retirement Formula Registrations
 * Manual registration of retirement calculation formulas
 *
 * Every entry names the exported engine function it documents (`functionName`),
 * and every worked example is re-derived from that function in
 * test/lib/formulas/registry.test.ts. Entries describe what the code does
 * today — when the engine changes, the entry and its example change with it.
 */

import { formulaRegistry } from './registry';
import { FormulaRegistryEntry } from './types';

// Define the retirement formulas metadata. `functionName` is the exported
// function in lib/calculations/retirement.ts (or lib/utils/random.ts) that
// implements the entry.
const retirementFormulas: Omit<FormulaRegistryEntry, 'id' | 'filePath' | 'validated' | 'lastUpdated'>[] = [
  {
    name: "Future Value of Investment",
    functionName: "futureValue",
    category: "core",
    latex: "FV = PV \\times (1 + r)^t",
    variables: {
      PV: {
        symbol: "PV",
        description: "Present Value",
        unit: "$",
        constraints: "Must be ≥ 0"
      },
      r: {
        symbol: "r",
        description: "Annual Return Rate",
        unit: "decimal",
        constraints: "Typically 0.01 to 0.15 (1% to 15%)"
      },
      t: {
        symbol: "t",
        description: "Time Period",
        unit: "years",
        constraints: "Must be > 0"
      }
    },
    description: "Calculates the future value of a lump sum investment using compound interest",
    purpose: "Determine how much money invested today will be worth in the future, accounting for compound growth over time",
    example: {
      inputs: { PV: 10000, r: 0.07, t: 30 },
      output: 76122.55,
      explanation: "A $10,000 investment at 7% annual return grows to $76,123 over 30 years through compound interest",
      stepByStep: [
        "Identify given values: PV = $10,000, r = 7% (0.07), t = 30 years",
        "Apply compound interest formula: FV = PV × (1 + r)^t",
        "Calculate: FV = $10,000 × (1.07)^30 = $10,000 × 7.612255 = $76,122.55"
      ]
    },
    sources: [
      "Federal Reserve Economic Data (FRED)",
      "Investment Company Institute Annual Fact Book",
      "Principles of Corporate Finance by Brealey, Myers & Allen"
    ],
    assumptions: [
      "Constant annual return rate throughout the investment period",
      "No additional contributions during the investment period",
      "Returns are compounded annually",
      "No taxes, fees, or inflation adjustments considered"
    ],
    limitations: [
      "Does not account for market volatility or varying returns",
      "Ignores the impact of taxes on investment gains",
      "Does not consider inflation's effect on purchasing power",
      "Assumes reinvestment of all returns"
    ]
  },
  {
    name: "Present Value Calculation",
    functionName: "presentValue",
    category: "core",
    latex: "PV = \\frac{FV}{(1 + r)^t}",
    variables: {
      FV: {
        symbol: "FV",
        description: "Future Value",
        unit: "$",
        constraints: "Must be ≥ 0"
      },
      r: {
        symbol: "r",
        description: "Discount Rate",
        unit: "decimal",
        constraints: "Typically 0.01 to 0.15 (1% to 15%)"
      },
      t: {
        symbol: "t",
        description: "Time Period",
        unit: "years",
        constraints: "Must be > 0"
      }
    },
    description: "Calculates the present value of a future sum of money, discounted at a specified rate",
    purpose: "Determine what a future amount of money is worth in today's dollars, accounting for the time value of money",
    example: {
      inputs: { FV: 76122.55, r: 0.07, t: 30 },
      output: 10000,
      explanation: "$76,123 received 30 years from now is worth $10,000 in today's dollars at a 7% discount rate",
      stepByStep: [
        "Identify given values: FV = $76,122.55, r = 7% (0.07), t = 30 years",
        "Apply present value formula: PV = FV ÷ (1 + r)^t",
        "Calculate: PV = $76,122.55 ÷ (1.07)^30 = $76,122.55 ÷ 7.612255 = $10,000"
      ]
    },
    sources: [
      "Federal Reserve Economic Data (FRED)",
      "CFA Institute curriculum on Time Value of Money",
      "Financial Management: Theory & Practice by Brigham & Ehrhardt"
    ],
    assumptions: [
      "Constant discount rate throughout the time period",
      "Single lump sum payment at the end of the period",
      "No intermediate cash flows",
      "Certainty of receiving the future value"
    ],
    limitations: [
      "Does not account for risk or uncertainty in receiving future payments",
      "Assumes constant discount rate over time",
      "Does not consider inflation separately from the discount rate",
      "Ignores liquidity preferences and other market factors"
    ]
  },
  {
    name: "Future Value of Ordinary Annuity",
    functionName: "futureValueOfAnnuity",
    category: "core",
    latex: "FVA = PMT \\times \\frac{(1 + r)^t - 1}{r}",
    variables: {
      PMT: {
        symbol: "PMT",
        description: "Payment Amount",
        unit: "$",
        constraints: "Must be > 0 for positive savings"
      },
      r: {
        symbol: "r",
        description: "Interest Rate per Period",
        unit: "decimal",
        constraints: "Typically 0.005 to 0.012 for monthly rates"
      },
      t: {
        symbol: "t",
        description: "Number of Payments",
        unit: "periods",
        constraints: "Must be > 0"
      }
    },
    description: "Calculates the future value of a series of equal payments made at regular intervals",
    purpose: "Determine how much regular savings contributions will accumulate to over time with compound interest",
    example: {
      inputs: { PMT: 1000, r: 0.06, t: 20 },
      output: 36785.59,
      explanation: "Making $1,000 annual payments for 20 years at 6% interest accumulates to $36,786",
      stepByStep: [
        "Identify given values: PMT = $1,000, r = 6% (0.06), t = 20 years",
        "Apply annuity formula: FVA = PMT × [(1 + r)^t - 1] ÷ r",
        "Calculate compound factor: (1.06)^20 - 1 = 2.207135",
        "Divide by rate: 2.207135 ÷ 0.06 = 36.7856",
        "Multiply by payment: $1,000 × 36.7856 = $36,785.59"
      ]
    },
    sources: [
      "Investment Company Institute Research on Retirement Savings",
      "Employee Benefit Research Institute data",
      "Financial Planning textbooks on annuity calculations"
    ],
    assumptions: [
      "Equal payments made at the end of each period (ordinary annuity)",
      "Constant interest rate throughout all periods",
      "All payments are made as scheduled without interruption",
      "Interest is compounded at the same frequency as payments"
    ],
    limitations: [
      "Does not account for payment increases due to inflation",
      "Assumes perfect investment conditions with no losses",
      "Does not consider varying interest rates over time",
      "Ignores taxes on investment gains and fees"
    ]
  },
  {
    name: "Required Retirement Balance",
    functionName: "calculateRequiredBalance",
    category: "intermediate",
    latex: "Required\\,Balance = \\frac{Target\\,Annual\\,Income}{Safe\\,Withdrawal\\,Rate}",
    variables: {
      targetIncome: {
        symbol: "I",
        description: "Target Annual Income",
        unit: "$",
        constraints: "Must be > 0, typically $30k-$200k"
      },
      withdrawalRate: {
        symbol: "SWR",
        description: "Safe Withdrawal Rate",
        unit: "decimal",
        constraints: "Typically 0.03 to 0.05 (3% to 5%)"
      }
    },
    description: "Calculates the total retirement savings needed to support a desired annual income using the safe withdrawal rate approach",
    purpose: "Determine how much money you need to save by retirement to maintain your desired lifestyle without depleting your savings",
    example: {
      inputs: { targetIncome: 50000, withdrawalRate: 0.04 },
      output: 1250000,
      explanation: "To withdraw $50,000 annually at a 4% safe withdrawal rate, you need $1.25 million saved",
      stepByStep: [
        "Identify target annual income: $50,000",
        "Determine safe withdrawal rate: 4% (0.04) - the classic '4% rule'",
        "Apply formula: Required Balance = Income ÷ Withdrawal Rate",
        "Calculate: $50,000 ÷ 0.04 = $1,250,000"
      ]
    },
    sources: [
      "Trinity Study on Safe Withdrawal Rates",
      "Wade Pfau's research on retirement withdrawal strategies",
      "Vanguard Principles for Investing: Retirement Planning"
    ],
    assumptions: [
      "Safe withdrawal rate remains constant throughout retirement",
      "Portfolio maintains purchasing power against inflation",
      "Target income is the whole of the spending need for this formula: no healthcare cost is added and no Social Security is subtracted here",
      "Retirement period of 25-30 years"
    ],
    limitations: [
      "Covers target income only — Social Security and healthcare enter the model through the Monte Carlo net withdrawal, not through this formula, so the required balance and the success probability come from different models",
      "Applies one general inflation rate to the target income, while the simulation inflates healthcare at a separate, higher rate",
      "Assumes constant withdrawal needs (may increase with age/health)",
      "Does not consider tax implications of different account types"
    ]
  },
  {
    name: "Social Security Benefit at Claiming Age",
    functionName: "calculateSocialSecurityBenefit",
    category: "intermediate",
    latex: "B(a) = \\begin{cases} 0 & a < 62 \\\\ B_{\\text{FRA}}\\left(1 - \\tfrac{5}{900}\\min(m, 36) - \\tfrac{5}{1200}\\max(m - 36, 0)\\right) & 62 \\le a < 67 \\\\ B_{\\text{FRA}}\\left(1 + 0.08\\,(\\min(a, 70) - 67)\\right) & a \\ge 67 \\end{cases} \\qquad m = 12\\,(67 - a)",
    variables: {
      baseBenefit: {
        symbol: "B_{\\text{FRA}}",
        description: "Annual benefit at full retirement age, as entered",
        unit: "$/year",
        constraints: "Must be ≥ 0"
      },
      claimingAge: {
        symbol: "a",
        description: "Age at which benefits are claimed",
        unit: "years",
        constraints: "Below 62 returns 0; above 70 is treated as 70"
      },
      m: {
        symbol: "m",
        description: "Months claimed before full retirement age",
        unit: "months",
        constraints: "Only used when claiming before 67"
      }
    },
    description: "Adjusts the entered annual Social Security benefit for claiming age, using the SSA's two-tier early-claiming reduction (5/9 of 1% per month for the first 36 months, 5/12 of 1% thereafter) and 8% per year of delayed retirement credits",
    purpose: "Convert a full-retirement-age benefit estimate into the annual benefit the simulation credits against retirement spending, given the claiming age entered",
    example: {
      inputs: { baseBenefit: 30000, claimingAge: 62 },
      output: 21000,
      explanation: "A $30,000 full-retirement-age benefit claimed at 62 is reduced 30%, to $21,000 per year",
      stepByStep: [
        "Months claimed early: (67 − 62) × 12 = 60 months",
        "First 36 months: 36 × 5/9 of 1% = 20.0%",
        "Remaining 24 months: 24 × 5/12 of 1% = 10.0%",
        "Total reduction: 30.0%",
        "Benefit: $30,000 × (1 − 0.30) = $21,000 per year"
      ]
    },
    sources: [
      "Social Security Administration — Early or Late Retirement (benefit reduction factors)",
      "Social Security Administration — Delayed Retirement Credits (8% per year after full retirement age)",
      "BufoIndex constants: RetirementConstants.SS_FULL_RETIREMENT_AGE, SS_MIN_AGE, SS_MAX_AGE, SS_CREDIT_RATE (lib/constants/retirement.ts)"
    ],
    assumptions: [
      "Full retirement age is fixed at 67 for every user",
      "The benefit you enter is an annual amount stated in today's dollars",
      "Claiming before 62 produces no benefit; claiming after 70 is treated as claiming at 70",
      "Payments begin in the first simulated year in which your age reaches the claiming age, and grow with the general inflation rate you enter"
    ],
    limitations: [
      "Real full retirement age varies by birth year (66–67); this model uses 67 for everyone",
      "No earnings test, spousal, survivor, or WEP/GPO adjustments",
      "Benefits are grown at the general inflation rate you enter rather than an SSA cost-of-living adjustment",
      "Benefits are treated as untaxed income in the simulation",
      "Assumes the program pays scheduled benefits in full for the whole retirement"
    ]
  },
  {
    name: "Annual Healthcare Cost in Retirement",
    functionName: "calculateHealthcareCosts",
    category: "intermediate",
    latex: "H = C_{\\text{base}} \\times m \\times (1 + i_h)^{n} \\times \\begin{cases} 1 + 0.02\\,(\\text{age} - 65) & \\text{age} \\ge 65 \\\\ 1 & \\text{age} < 65 \\end{cases}",
    variables: {
      baseAnnualCost: {
        symbol: "C_{\\text{base}}",
        description: "Base annual healthcare cost in today's dollars — your estimate, or $7,500 if you leave it blank",
        unit: "$/year",
        constraints: "Must be ≥ 0"
      },
      multiplier: {
        symbol: "m",
        description: "Healthcare cost multiplier for household size or expected health",
        unit: "×",
        constraints: "Slider input; 1.0 is the unadjusted base cost"
      },
      yearsOfInflation: {
        symbol: "n",
        description: "Years of healthcare inflation applied, counted from today to the simulated year",
        unit: "years",
        constraints: "Must be ≥ 0"
      },
      age: {
        symbol: "\\text{age}",
        description: "Age during the simulated year",
        unit: "years",
        constraints: "The 2%/year uplift applies from 65 onward"
      },
      i_h: {
        symbol: "i_h",
        description: "Healthcare inflation rate — 5.5%/year, separate from the general inflation rate you enter",
        unit: "decimal"
      }
    },
    description: "Healthcare cost charged against the portfolio in a simulated retirement year: a base annual cost compounded at a healthcare-specific inflation rate, with a 2% per year uplift from age 65",
    purpose: "Produce the healthcare component of each year's portfolio withdrawal, so healthcare grows faster than the rest of the spending plan",
    example: {
      inputs: { baseAnnualCost: 7500, multiplier: 1, yearsOfInflation: 5, age: 75 },
      output: 11762.64,
      explanation: "A $7,500 base cost, five years of 5.5% healthcare inflation, and the age-75 uplift give $11,762.64 for that year",
      stepByStep: [
        "Base cost × multiplier: $7,500 × 1 = $7,500",
        "Healthcare inflation: (1.055)^5 = 1.306960",
        "Inflated cost: $7,500 × 1.306960 = $9,802.20",
        "Age uplift at 75: 1 + 0.02 × (75 − 65) = 1.20",
        "Annual cost: $9,802.20 × 1.20 = $11,762.64"
      ]
    },
    sources: [
      "BufoIndex constant: RetirementConstants.HEALTHCARE_BASE_COST — $7,500/year baseline (lib/constants/retirement.ts)",
      "BufoIndex constant: RetirementConstants.HEALTHCARE_INFLATION_RATE — 5.5%/year (lib/constants/retirement.ts)",
      "Centers for Medicare & Medicaid Services — National Health Expenditure data, for the general observation that health spending grows faster than the overall price level"
    ],
    assumptions: [
      "Healthcare inflates at 5.5% per year, compounded from today rather than from your retirement date",
      "The base cost is a single national figure, not a plan-, state-, or income-specific premium",
      "Costs continue in every retirement year; Medicare eligibility is not modelled as a step down at 65",
      "After 65 the cost rises 2% per year of age on top of healthcare inflation"
    ],
    limitations: [
      "The $7,500 base and 5.5% rate are project defaults, not a quote for your situation — replace them with your own estimate if you have one",
      "No long-term care, catastrophic events, or year-to-year variability",
      "The 2%/year age uplift is a linear approximation of age-related cost growth",
      "Premium subsidies, employer retiree coverage, and Medicare parts are not modelled separately"
    ]
  },
  {
    name: "Simulated Annual Return Draw",
    functionName: "boxMullerRandom",
    category: "advanced",
    latex: "\\begin{aligned} s_{k+1} &= (1664525\\,s_k + 1013904223) \\bmod 2^{32}, \\qquad u_k = \\frac{s_{k+1}}{2^{32} - 1} \\\\ r &= \\mu + \\sigma\\,\\sqrt{-2\\ln u_1}\\;\\sin(2\\pi u_2) \\end{aligned}",
    variables: {
      mean: {
        symbol: "\\mu",
        description: "Expected annual return for the year being simulated",
        unit: "decimal"
      },
      stdDev: {
        symbol: "\\sigma",
        description: "Annual volatility (standard deviation of the return)",
        unit: "decimal",
        constraints: "0 makes every draw equal to the mean"
      },
      u1: {
        symbol: "u_1",
        description: "Second uniform draw from the seeded generator; redrawn if it is exactly 0, which would make ln u₁ undefined",
        unit: "0 to 1"
      },
      u2: {
        symbol: "u_2",
        description: "First uniform draw from the seeded generator",
        unit: "0 to 1"
      },
      s: {
        symbol: "s_k",
        description: "Generator state; the starting state is the simulation seed (20260812 unless overridden)",
        unit: "integer"
      }
    },
    description: "Turns two uniform draws from a seeded linear congruential generator into one normally distributed annual return via the Box-Muller transform",
    purpose: "Give each simulated year a random return around the expected return, while keeping results reproducible: the same inputs and seed always produce the same set of paths",
    example: {
      inputs: { mean: 0.06, stdDev: 0.15, u1: 0.5, u2: 0.25 },
      output: 0.2366115,
      explanation: "Uniform draws of u₁ = 0.50 and u₂ = 0.25 turn a 6% expected return with 15% volatility into a 23.66% return for that year — about 1.18 standard deviations above the mean",
      stepByStep: [
        "The generator is called twice: the first value is u₂, the second is u₁",
        "√(−2 ln 0.50) = √1.386294 = 1.177410",
        "sin(2π × 0.25) = sin(π/2) = 1",
        "r = 0.06 + 0.15 × 1.177410 × 1 = 0.2366115"
      ]
    },
    sources: [
      "Box, G. E. P. & Muller, M. E. (1958), 'A Note on the Generation of Random Normal Deviates', Annals of Mathematical Statistics",
      "Numerical Recipes — linear congruential generator constants a = 1664525, c = 1013904223",
      "BufoIndex source: createSeededRng and boxMullerRandom (lib/utils/random.ts)"
    ],
    assumptions: [
      "Annual returns are normally distributed around the expected return",
      "Draws are independent from year to year and from path to path",
      "The generator is seeded with a fixed value, so repeating a calculation reproduces the same probability",
      "Volatility is the annual standard deviation of the return, held constant within a year"
    ],
    limitations: [
      "Normal draws have thinner tails than historical equity returns, so severe crashes are underrepresented",
      "No serial correlation, mean reversion, or regime changes — sequence-of-returns risk is only what independent draws produce",
      "A draw below −100% is possible and is not truncated; such a path simply fails",
      "A 2^32-period linear congruential generator is adequate for illustration, not for cryptographic use"
    ]
  },
  {
    name: "Monte Carlo Success Probability",
    functionName: "runMonteCarloSimulation",
    category: "advanced",
    latex: "\\begin{aligned} B^{(k)}_{t+1} &= B^{(k)}_t\\,(1 + r^{(k)}_t) - W_t, \\qquad r^{(k)}_t \\sim \\mathcal{N}(\\mu_t, \\sigma_t^2) \\\\ W_t &= \\max\\left(0,\\; I\\,(1 + i)^{n + t} + H_t - S_t\\right) \\\\ p &= \\frac{1}{N}\\sum_{k=1}^{N} \\mathbf{1}\\left[\\min_{1 \\le t \\le T} B^{(k)}_t > 0\\right] \\end{aligned}",
    variables: {
      B0: {
        symbol: "B_0",
        description: "Portfolio balance at retirement, from the projected-balance calculation",
        unit: "$"
      },
      mu: {
        symbol: "\\mu_t",
        description: "Expected return for simulated year t — the retirement return you enter, or the glide-path return for that age under the target-date profile",
        unit: "decimal"
      },
      sigma: {
        symbol: "\\sigma_t",
        description: "Volatility for simulated year t — your input, or the glide-path volatility for that age",
        unit: "decimal"
      },
      W: {
        symbol: "W_t",
        description: "Net portfolio withdrawal in year t; identical across all paths because it does not depend on the drawn returns",
        unit: "$"
      },
      I: {
        symbol: "I",
        description: "Target annual income in today's dollars",
        unit: "$"
      },
      i: {
        symbol: "i",
        description: "General inflation rate",
        unit: "decimal"
      },
      n: {
        symbol: "n",
        description: "Years from today to retirement (retirement age − current age)",
        unit: "years"
      },
      H: {
        symbol: "H_t",
        description: "Healthcare cost for year t, from the healthcare formula (inflated at 5.5%)",
        unit: "$"
      },
      S: {
        symbol: "S_t",
        description: "Claiming-age-adjusted Social Security benefit grown at general inflation; 0 until your age reaches the claiming age",
        unit: "$"
      },
      T: {
        symbol: "T",
        description: "Retirement years simulated (life expectancy − retirement age)",
        unit: "years"
      },
      N: {
        symbol: "N",
        description: "Number of simulated paths (1,000 by default)",
        unit: "paths"
      },
      p: {
        symbol: "p",
        description: "Success probability: the share of paths whose balance stays above zero through the final year",
        unit: "0 to 1"
      }
    },
    description: "Runs N independent paths through retirement — each year applying a randomly drawn return, then subtracting that year's net withdrawal — and reports the share of paths whose balance never reaches zero",
    purpose: "Express the plan as a probability rather than a single line: how often a portfolio of this size, with these withdrawals, survives to the end age under randomly drawn returns",
    example: {
      inputs: { B0: 1000000, mu: 0.05, sigma: 0, W: 40000, T: 25, N: 100 },
      output: 1,
      explanation: "With volatility set to zero, every drawn return is exactly 5%, so all 100 paths are identical and the probability can only be 0 or 1. Here $1,000,000 earns $50,000 against a $40,000 withdrawal, so the balance rises every year and p = 1. Restore volatility and the paths diverge, so p reports how many of them survive.",
      stepByStep: [
        "Balance at retirement: B₀ = $1,000,000",
        "Each simulated year: B → B × (1 + 0.05) − $40,000",
        "Year 1: $1,000,000 × 1.05 − $40,000 = $1,010,000",
        "Growth exceeds the withdrawal for any balance above $800,000, so the balance rises through all 25 retirement years",
        "All 100 paths end above zero: p = 100 ÷ 100 = 1"
      ]
    },
    sources: [
      "BufoIndex source: runMonteCarloSimulation and calculateNetAnnualWithdrawal (lib/calculations/retirement.ts)",
      "Metropolis, N. & Ulam, S. (1949), 'The Monte Carlo Method', Journal of the American Statistical Association",
      "Trinity Study on Safe Withdrawal Rates, for the survival framing this probability replaces"
    ],
    assumptions: [
      "Returns are drawn independently each year from a normal distribution (see the return-draw entry)",
      "The return is applied first and the whole year's withdrawal comes out at year end",
      "Withdrawals are computed once and reused across paths: they depend on your inputs, not on how a path performed",
      "Social Security in excess of the year's spending does not add to the portfolio — the net withdrawal is floored at zero",
      "The worked example zeroes volatility, accumulation return, monthly savings, inflation, healthcare, and Social Security so the path is checkable by hand",
      "Success means the balance stays above zero to the end age; it says nothing about what is left over"
    ],
    limitations: [
      "No taxes on withdrawals, no required minimum distributions, and no spending flexibility when markets fall",
      "The withdrawal path is fixed in advance, so a retiree who cuts spending after a bad year is not modelled",
      "A path that ends at $1 counts as a success, exactly like one that ends at $5 million",
      "Probability is only as good as the return and volatility assumptions fed into it",
      "1,000 paths estimate the probability to within roughly a percentage point; the fixed seed makes that error repeatable rather than random"
    ]
  },
  {
    name: "Target-Date Glide Path Return",
    functionName: "calculateTDFReturnForAge",
    category: "assumptions",
    latex: "\\begin{aligned} w(\\text{age}) &= \\begin{cases} 0.90 & \\text{age} \\le 35 \\\\ 0.90 - \\frac{\\text{age} - 35}{15}(0.20) & 35 < \\text{age} \\le 50 \\\\ 0.70 - \\frac{\\text{age} - 50}{15}(0.30) & 50 < \\text{age} \\le 65 \\\\ 0.40 - \\frac{\\min(\\text{age} - 65,\\, 20)}{20}(0.10) & \\text{age} > 65 \\end{cases} \\\\ E[r] &= w\\,(0.10) + (1 - w)\\,(0.04) \\\\ \\sigma &= \\sqrt{(0.18\\,w)^2 + (0.06\\,(1 - w))^2} \\end{aligned}",
    variables: {
      age: {
        symbol: "\\text{age}",
        description: "Age whose allocation is being priced; clamped to the 18–100 range",
        unit: "years"
      },
      w: {
        symbol: "w",
        description: "Share of the portfolio in stocks at that age; the remainder is bonds",
        unit: "decimal"
      },
      stockReturn: {
        symbol: "r_s",
        description: "Assumed long-run stock return (10%)",
        unit: "decimal"
      },
      bondReturn: {
        symbol: "r_b",
        description: "Assumed long-run bond return (4%)",
        unit: "decimal"
      },
      stockVolatility: {
        symbol: "\\sigma_s",
        description: "Assumed stock volatility (18%)",
        unit: "decimal"
      },
      bondVolatility: {
        symbol: "\\sigma_b",
        description: "Assumed bond volatility (6%)",
        unit: "decimal"
      }
    },
    description: "The target-date glide path: a stock weight that steps down with age, blended with fixed stock and bond assumptions into the expected return and volatility used for that year",
    purpose: "Supply the per-year return and volatility for plans on the target-date profile, so the simulation gets more conservative as the retiree ages instead of using one rate for life",
    example: {
      inputs: { age: 45 },
      output: 0.086,
      explanation: "At 45 the glide path holds 76.7% stocks, giving a blended expected return of 8.6% for that year",
      stepByStep: [
        "Age 45 falls in the 35–50 segment: w = 0.90 − ((45 − 35) ÷ 15) × 0.20",
        "w = 0.90 − 0.1333 = 0.7667 stocks, 0.2333 bonds",
        "E[r] = 0.7667 × 0.10 + 0.2333 × 0.04",
        "E[r] = 0.07667 + 0.00933 = 0.086"
      ]
    },
    sources: [
      "BufoIndex source: calculateTDFAllocation, calculateTDFReturnForAge, calculateTDFVolatilityForAge (lib/calculations/retirement.ts)",
      "Long-run capital market assumptions of the kind published annually by major asset managers, rounded to whole percentages"
    ],
    assumptions: [
      "Two asset classes only: stocks at 10% return / 18% volatility, bonds at 4% / 6%",
      "The glide path is a piecewise-linear stand-in for a target-date fund, not any specific fund's prospectus",
      "Allocation is re-read once per year of age, with no rebalancing cost, fees, or tax drag",
      "The same capital market assumptions apply in every year and at every valuation level"
    ],
    limitations: [
      "Blended volatility is computed as if stocks and bonds were uncorrelated; real correlations are not zero and move over time",
      "Fixed expected returns ignore starting valuations, mean reversion, and inflation regimes",
      "No international, real-asset, or cash sleeve, and no fund expense ratio",
      "Real target-date funds differ widely from this path, especially after the retirement date"
    ]
  }
];

/**
 * Register all retirement formulas with the global registry
 */
export function registerRetirementFormulas() {
  retirementFormulas.forEach((formula) => {
    const { functionName, ...metadata } = formula;
    const formulaId = `retirement-${metadata.name.toLowerCase().replace(/\s+/g, '-')}`;

    formulaRegistry.registerFormula(
      formulaId,
      functionName,
      {
        ...metadata,
        lastUpdated: '2026-08-12'
      },
      'retirement'
    );
  });
}

// Auto-register formulas when this module is imported
registerRetirementFormulas();
