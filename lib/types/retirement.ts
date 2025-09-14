// Retirement Calculator Types

export interface RetirementScenario {
  id: string;
  name: string;
  startAge: number;
  retirementAge: number;
  targetIncome: number;
  startingBalance: number;
  currentIncome: number;
  socialSecurity: number;
  healthcare: number;
}

export interface RetirementInputs {
  startAge: number;
  retirementAges: number[];
  targetIncomePercent: number;
  startingBalance: number;
  currentIncome: number;
  savingsRate: number;
  returnRate: number;
  withdrawalRate: number;
  inflationRate: number;
  socialSecurityAge: number;
  socialSecurityAmount: number;
  healthcareCostMultiplier: number;
}

export interface MonteCarloSettings {
  runs: number;
  volatility: number;
  sequenceRisk: boolean;
}

export interface RetirementResults {
  scenarios: RetirementScenario[];
  projections: {
    netWorthByAge: { [age: number]: number };
    withdrawalsByAge: { [age: number]: number };
    successProbability: number;
  };
  insights: string[];
}

export interface CalculatorState {
  inputs: RetirementInputs;
  results: RetirementResults | null;
  isCalculating: boolean;
  monteCarloSettings: MonteCarloSettings;
}