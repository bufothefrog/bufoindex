/**
 * Retirement Formula Registrations
 * Manual registration of retirement calculation formulas
 */

import { formulaRegistry } from './registry';
import { FormulaRegistryEntry } from './types';

// Define the retirement formulas metadata
const retirementFormulas: Omit<FormulaRegistryEntry, 'id' | 'functionName' | 'filePath' | 'validated' | 'lastUpdated'>[] = [
  {
    name: "Future Value of Investment",
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
      "No major unexpected expenses (healthcare, long-term care)",
      "Retirement period of 25-30 years"
    ],
    limitations: [
      "Does not account for Social Security or other income sources",
      "Ignores healthcare cost inflation which exceeds general inflation",
      "Assumes constant withdrawal needs (may increase with age/health)",
      "Does not consider tax implications of different account types"
    ]
  }
];

/**
 * Register all retirement formulas with the global registry
 */
export function registerRetirementFormulas() {
  retirementFormulas.forEach((formulaMeta, index) => {
    const formulaId = `retirement-${formulaMeta.name.toLowerCase().replace(/\s+/g, '-')}`;
    const functionName = ['futureValue', 'presentValue', 'futureValueOfAnnuity', 'calculateRequiredBalance'][index] || 'unknownFunction';
    
    formulaRegistry.registerFormula(
      formulaId,
      functionName,
      {
        ...formulaMeta,
        lastUpdated: '2026-08-12'
      },
      'retirement'
    );
  });
}

// Auto-register formulas when this module is imported
registerRetirementFormulas();