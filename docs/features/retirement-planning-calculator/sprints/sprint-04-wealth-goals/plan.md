# Sprint 04: Wealth Goals System - Technical Implementation Plan

## Overview

This document provides detailed technical specifications for implementing the wealth goals system outlined in the PRD. The implementation focuses on three distinct retirement philosophies: Maximize Wealth, Balanced Preservation, and Die with Zero.

## 1. Data Models & Type System

### Core Type Definitions

```typescript
// Wealth goal enumeration
export type WealthGoal = 'maximize' | 'balanced' | 'zero';

// Retirement status based on current trajectory
export type RetirementStatus = 'exceeding' | 'on-track' | 'falling-short';

// Scenario types for each status/goal combination
export type ScenarioType = 
  | 'current-plan'
  | 'early-retirement'
  | 'ultra-conservative'
  | 'conservative'
  | 'coast-mode'
  | 'maximum-lifestyle'
  | 'enhanced-lifestyle'
  | 'reality-check-age'
  | 'reality-check-income'
  | 'reality-check-savings'
  | 'compromise'
  | 'modest-fix'
  | 'aggressive-save';
```

### Wealth Goal Configuration Interface

```typescript
interface WealthGoalConfig {
  // Base withdrawal rate in first year of retirement
  baseWithdrawalRate: number;
  
  // Annual escalation rate (inflation + real growth)
  annualEscalationRate: number;
  
  // Multiplier for conservative spending scenarios
  conservativeMultiplier: number;
  
  // Multiplier for aggressive spending scenarios  
  aggressiveMultiplier: number;
  
  // Minimum success rate threshold for acceptable scenarios
  successThreshold: number;
  
  // Target portfolio value at end of retirement (as % of initial)
  targetEndingValue: number;
  
  // Chart styling
  chartColor: string;
  chartGradient: [string, string];
}
```

### Scenario Data Structure

```typescript
interface RetirementScenario {
  // Identification
  id: string;
  type: ScenarioType;
  wealthGoal: WealthGoal;
  name: string;
  description: string;
  icon: string;
  
  // Core parameters
  retirementAge: number;
  monthlyIncome: number;
  monthlySavings: number;
  
  // Calculated results
  successRate: number;
  endingPortfolioValue: number;
  totalWithdrawals: number;
  inflationAdjustedIncome: number;
  
  // Projections
  portfolioProjection: YearlyProjection[];
  withdrawalProjection: YearlyWithdrawal[];
  
  // Metadata
  calculatedAt: Date;
  assumptions: CalculationAssumptions;
}

interface YearlyProjection {
  year: number;
  age: number;
  portfolioValue: number;
  withdrawal: number;
  realValue: number; // Inflation-adjusted
}

interface YearlyWithdrawal {
  year: number;
  age: number;
  nominalWithdrawal: number;
  realWithdrawal: number;
  withdrawalRate: number;
}
```

### Configuration Constants

```typescript
const WEALTH_GOAL_CONFIGS: Record<WealthGoal, WealthGoalConfig> = {
  maximize: {
    baseWithdrawalRate: 0.03,          // 3.0% conservative withdrawal
    annualEscalationRate: 0.03,        // Inflation only (no real growth)
    conservativeMultiplier: 0.70,      // 70% of target for ultra-conservative
    aggressiveMultiplier: 0.90,        // 90% still conservative for this goal
    successThreshold: 0.90,            // 90% success rate required
    targetEndingValue: 1.20,           // 120% of initial (wealth growth)
    chartColor: '#1e40af',             // Deep blue
    chartGradient: ['#1e40af', '#3b82f6']
  },
  
  balanced: {
    baseWithdrawalRate: 0.04,          // 4.0% standard withdrawal
    annualEscalationRate: 0.03,        // Inflation only
    conservativeMultiplier: 0.80,      // 80% of target for buffer
    aggressiveMultiplier: 1.10,        // 110% of target for higher lifestyle
    successThreshold: 0.75,            // 75% success rate acceptable
    targetEndingValue: 1.00,           // 100% maintain real value
    chartColor: '#059669',             // Green
    chartGradient: ['#059669', '#10b981']
  },
  
  zero: {
    baseWithdrawalRate: 0.055,         // 5.5% aggressive initial withdrawal
    annualEscalationRate: 0.052,       // Inflation + 2% real growth
    conservativeMultiplier: 1.10,      // 110% still aggressive
    aggressiveMultiplier: 1.40,        // 140% maximum lifestyle
    successThreshold: 0.60,            // 60% success acceptable
    targetEndingValue: 0.08,           // 8% ending value (near zero)
    chartColor: '#dc2626',             // Red/orange
    chartGradient: ['#dc2626', '#f97316']
  }
};
```

### User Input Interface

```typescript
interface RetirementInputs {
  // Demographics
  currentAge: number;
  targetRetirementAge: number;
  lifeExpectancy: number;
  
  // Financial position
  currentPortfolio: number;
  monthlyContributions: number;
  targetMonthlyIncome: number;
  
  // Preferences
  selectedWealthGoal: WealthGoal;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  inflationRate: number;
  
  // Market assumptions
  expectedAnnualReturn: number;
  marketVolatility: number;
}
```

## 2. Core Calculation Algorithms

### Portfolio Projection Algorithm

```typescript
function calculatePortfolioProjection(
  inputs: RetirementInputs,
  wealthGoal: WealthGoal,
  scenario: ScenarioType
): YearlyProjection[] {
  const config = WEALTH_GOAL_CONFIGS[wealthGoal];
  const projections: YearlyProjection[] = [];
  
  let portfolioValue = inputs.currentPortfolio;
  const yearsToRetirement = inputs.targetRetirementAge - inputs.currentAge;
  const yearsInRetirement = inputs.lifeExpectancy - inputs.targetRetirementAge;
  
  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    portfolioValue = portfolioValue * (1 + inputs.expectedAnnualReturn) + 
                    (inputs.monthlyContributions * 12);
    
    projections.push({
      year: year + 1,
      age: inputs.currentAge + year + 1,
      portfolioValue,
      withdrawal: 0,
      realValue: portfolioValue / Math.pow(1 + inputs.inflationRate, year + 1)
    });
  }
  
  // Retirement phase
  let currentWithdrawalRate = config.baseWithdrawalRate;
  
  for (let year = 0; year < yearsInRetirement; year++) {
    const withdrawal = portfolioValue * currentWithdrawalRate;
    portfolioValue = (portfolioValue - withdrawal) * (1 + inputs.expectedAnnualReturn);
    
    projections.push({
      year: yearsToRetirement + year + 1,
      age: inputs.targetRetirementAge + year + 1,
      portfolioValue,
      withdrawal,
      realValue: portfolioValue / Math.pow(1 + inputs.inflationRate, yearsToRetirement + year + 1)
    });
    
    // Update withdrawal rate based on wealth goal
    currentWithdrawalRate *= (1 + config.annualEscalationRate);
  }
  
  return projections;
}
```

### Die-with-Zero Optimization Algorithm

```typescript
function optimizeForDieWithZero(
  inputs: RetirementInputs,
  targetEndingValue: number = 0.08
): { initialWithdrawalRate: number; escalationRate: number } {
  const yearsInRetirement = inputs.lifeExpectancy - inputs.targetRetirementAge;
  const portfolioAtRetirement = calculatePortfolioAtRetirement(inputs);
  
  // Binary search for optimal initial withdrawal rate
  let minRate = 0.03;
  let maxRate = 0.15;
  let optimalRate = 0.055;
  
  for (let iteration = 0; iteration < 50; iteration++) {
    const testRate = (minRate + maxRate) / 2;
    const endingValue = simulateEndingValue(
      portfolioAtRetirement,
      testRate,
      0.052, // inflation + 2% real growth
      yearsInRetirement,
      inputs.expectedAnnualReturn
    );
    
    const endingRatio = endingValue / portfolioAtRetirement;
    
    if (Math.abs(endingRatio - targetEndingValue) < 0.005) {
      optimalRate = testRate;
      break;
    }
    
    if (endingRatio > targetEndingValue) {
      minRate = testRate;
    } else {
      maxRate = testRate;
    }
  }
  
  return {
    initialWithdrawalRate: optimalRate,
    escalationRate: 0.052
  };
}

function simulateEndingValue(
  initialPortfolio: number,
  initialWithdrawalRate: number,
  escalationRate: number,
  years: number,
  returnRate: number
): number {
  let portfolio = initialPortfolio;
  let withdrawalRate = initialWithdrawalRate;
  
  for (let year = 0; year < years; year++) {
    const withdrawal = portfolio * withdrawalRate;
    portfolio = (portfolio - withdrawal) * (1 + returnRate);
    withdrawalRate *= (1 + escalationRate);
  }
  
  return Math.max(0, portfolio);
}
```

### Monte Carlo Success Rate Calculation

```typescript
function calculateSuccessRate(
  inputs: RetirementInputs,
  wealthGoal: WealthGoal,
  scenario: RetirementScenario,
  iterations: number = 10000
): number {
  const config = WEALTH_GOAL_CONFIGS[wealthGoal];
  let successfulRuns = 0;
  
  for (let i = 0; i < iterations; i++) {
    const success = runMonteCarloSimulation(inputs, config, scenario);
    if (success) successfulRuns++;
  }
  
  return successfulRuns / iterations;
}

function runMonteCarloSimulation(
  inputs: RetirementInputs,
  config: WealthGoalConfig,
  scenario: RetirementScenario
): boolean {
  let portfolio = scenario.portfolioProjection[0].portfolioValue;
  const yearsInRetirement = inputs.lifeExpectancy - inputs.targetRetirementAge;
  let withdrawalRate = config.baseWithdrawalRate;
  
  for (let year = 0; year < yearsInRetirement; year++) {
    // Generate random annual return using normal distribution
    const annualReturn = generateNormalRandom(
      inputs.expectedAnnualReturn,
      inputs.marketVolatility
    );
    
    const withdrawal = portfolio * withdrawalRate;
    portfolio = (portfolio - withdrawal) * (1 + annualReturn);
    
    // Check success criteria based on wealth goal
    if (wealthGoal === 'maximize' && portfolio < 0.8 * scenario.portfolioProjection[0].portfolioValue) {
      return false; // Wealth preservation failed
    }
    
    if (portfolio <= 0 && year < yearsInRetirement - 1) {
      return false; // Portfolio depleted too early
    }
    
    withdrawalRate *= (1 + config.annualEscalationRate);
  }
  
  return true;
}

function generateNormalRandom(mean: number, stdDev: number): number {
  // Box-Muller transformation for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}
```

## 3. Scenario Generation System

### Main Scenario Generator

```typescript
function generateScenarios(
  inputs: RetirementInputs,
  retirementStatus: RetirementStatus
): RetirementScenario[] {
  const scenarios: RetirementScenario[] = [];
  
  // Always include current plan
  scenarios.push(generateCurrentPlanScenario(inputs));
  
  // Generate scenarios based on status and wealth goal
  switch (retirementStatus) {
    case 'exceeding':
      scenarios.push(...generateExceedingScenarios(inputs));
      break;
    case 'on-track':
      scenarios.push(...generateOnTrackScenarios(inputs));
      break;
    case 'falling-short':
      scenarios.push(...generateFallingShortScenarios(inputs));
      break;
  }
  
  return scenarios;
}
```

### Exceeding Goals Scenario Generation

```typescript
function generateExceedingScenarios(inputs: RetirementInputs): RetirementScenario[] {
  const scenarios: RetirementScenario[] = [];
  const wealthGoal = inputs.selectedWealthGoal;
  
  switch (wealthGoal) {
    case 'maximize':
      // Early retirement: 2 years later, same spending, more wealth
      scenarios.push(generateEarlyRetirementScenario(inputs, -2));
      
      // Ultra conservative: 70% spending, maximum legacy
      scenarios.push(generateConservativeScenario(inputs, 0.70));
      break;
      
    case 'balanced':
      // Early retirement: X years early with 80% survival rate
      const earlyYears = calculateOptimalEarlyRetirement(inputs, 0.80);
      scenarios.push(generateEarlyRetirementScenario(inputs, earlyYears));
      
      // Conservative: Higher spending with 80% survival rate
      const conservativeSpending = calculateOptimalSpending(inputs, 0.80);
      scenarios.push(generateHigherSpendingScenario(inputs, conservativeSpending));
      
      // Coast mode: Reduce savings, maintain balance
      scenarios.push(generateCoastModeScenario(inputs));
      break;
      
    case 'zero':
      // Early retirement: Optimize for 5-10% ending value
      const zeroEarlyYears = calculateEarlyRetirementForTarget(inputs, 0.08);
      scenarios.push(generateEarlyRetirementScenario(inputs, zeroEarlyYears));
      
      // Maximum lifestyle: Optimize spending for 5-10% ending
      const maxLifestyle = calculateMaxLifestyleSpending(inputs, 0.08);
      scenarios.push(generateMaxLifestyleScenario(inputs, maxLifestyle));
      
      // Coast mode for die with zero
      scenarios.push(generateZeroCoastModeScenario(inputs));
      break;
  }
  
  return scenarios;
}
```

### Smart Parameter Optimization

```typescript
function calculateOptimalEarlyRetirement(
  inputs: RetirementInputs,
  targetSuccessRate: number
): number {
  let bestEarlyYears = 0;
  let bestSuccessRate = 0;
  
  // Test retirement 1-8 years early
  for (let earlyYears = 1; earlyYears <= 8; earlyYears++) {
    const testInputs = {
      ...inputs,
      targetRetirementAge: inputs.targetRetirementAge - earlyYears
    };
    
    const projection = calculatePortfolioProjection(testInputs, inputs.selectedWealthGoal, 'early-retirement');
    const successRate = calculateSuccessRate(testInputs, inputs.selectedWealthGoal, {
      portfolioProjection: projection
    } as RetirementScenario);
    
    if (successRate >= targetSuccessRate && successRate > bestSuccessRate) {
      bestEarlyYears = earlyYears;
      bestSuccessRate = successRate;
    }
  }
  
  return bestEarlyYears;
}

function calculateOptimalSpending(
  inputs: RetirementInputs,
  targetSuccessRate: number
): number {
  let bestSpendingMultiplier = 1.0;
  let bestSuccessRate = 0;
  
  // Test spending increases from 105% to 150%
  for (let multiplier = 1.05; multiplier <= 1.50; multiplier += 0.05) {
    const testInputs = {
      ...inputs,
      targetMonthlyIncome: inputs.targetMonthlyIncome * multiplier
    };
    
    const projection = calculatePortfolioProjection(testInputs, inputs.selectedWealthGoal, 'conservative');
    const successRate = calculateSuccessRate(testInputs, inputs.selectedWealthGoal, {
      portfolioProjection: projection
    } as RetirementScenario);
    
    if (successRate >= targetSuccessRate && multiplier > bestSpendingMultiplier) {
      bestSpendingMultiplier = multiplier;
      bestSuccessRate = successRate;
    }
  }
  
  return bestSpendingMultiplier;
}
```

## 4. React Component Architecture

### WealthGoalSelector Component

```typescript
interface WealthGoalSelectorProps {
  selectedGoal: WealthGoal;
  onGoalChange: (goal: WealthGoal) => void;
  disabled?: boolean;
}

const WealthGoalSelector: React.FC<WealthGoalSelectorProps> = ({
  selectedGoal,
  onGoalChange,
  disabled = false
}) => {
  const goals: Array<{
    id: WealthGoal;
    icon: string;
    title: string;
    description: string;
    approach: string;
  }> = [
    {
      id: 'maximize',
      icon: '🔹',
      title: 'Maximize Wealth',
      description: 'Build largest estate value',
      approach: 'Conservative spending, maximum inheritance'
    },
    {
      id: 'balanced',
      icon: '⚖️',
      title: 'Balanced Preservation',
      description: 'Maintain purchasing power',
      approach: '4% rule, balanced approach'
    },
    {
      id: 'zero',
      icon: '⚡',
      title: 'Die with Zero',
      description: 'Optimize lifetime spending',
      approach: 'Spend more, leave less behind'
    }
  ];

  return (
    <div className="wealth-goal-selector">
      <h3 className="text-lg font-semibold mb-4">Choose Your Retirement Philosophy</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {goals.map(goal => (
          <button
            key={goal.id}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${selectedGoal === goal.id 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onClick={() => !disabled && onGoalChange(goal.id)}
            disabled={disabled}
          >
            <div className="text-2xl mb-2">{goal.icon}</div>
            <div className="font-medium text-gray-900 mb-1">{goal.title}</div>
            <div className="text-sm text-gray-600 mb-2">{goal.description}</div>
            <div className="text-xs text-gray-500">{goal.approach}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
```

### ScenarioCard Component

```typescript
interface ScenarioCardProps {
  scenario: RetirementScenario;
  isSelected?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  isSelected = false,
  onClick,
  showDetails = false
}) => {
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.90) return 'text-green-700 bg-green-100';
    if (rate >= 0.75) return 'text-green-600 bg-green-50';
    if (rate >= 0.60) return 'text-yellow-600 bg-yellow-50';
    if (rate >= 0.45) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div 
      className={`
        border rounded-lg p-4 cursor-pointer transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:shadow-sm'}
      `}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{scenario.icon}</span>
          <span className="font-medium text-gray-900">{scenario.name}</span>
        </div>
        <div className="text-right">
          <div className="font-semibold text-lg">
            {formatCurrency(scenario.monthlyIncome)}
          </div>
          <div className="text-sm text-gray-500">monthly</div>
        </div>
      </div>
      
      <div className="text-sm text-gray-600 mb-3">{scenario.description}</div>
      
      <div className={`
        inline-flex items-center px-2 py-1 rounded text-xs font-medium
        ${getSuccessRateColor(scenario.successRate)}
      `}>
        Success rate: {(scenario.successRate * 100).toFixed(1)}%
      </div>
      
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Retirement Age:</span>
              <span className="ml-2 font-medium">{scenario.retirementAge}</span>
            </div>
            <div>
              <span className="text-gray-500">Ending Value:</span>
              <span className="ml-2 font-medium">{formatCurrency(scenario.endingPortfolioValue)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### PortfolioProjectionChart Component

```typescript
interface PortfolioProjectionChartProps {
  projections: YearlyProjection[];
  wealthGoal: WealthGoal;
  height?: number;
  showRetirementLine?: boolean;
}

const PortfolioProjectionChart: React.FC<PortfolioProjectionChartProps> = ({
  projections,
  wealthGoal,
  height = 400,
  showRetirementLine = true
}) => {
  const config = WEALTH_GOAL_CONFIGS[wealthGoal];
  
  // Find retirement start point
  const retirementStartIndex = projections.findIndex(p => p.withdrawal > 0);
  
  const chartData = projections.map(projection => ({
    age: projection.age,
    portfolio: projection.portfolioValue,
    realValue: projection.realValue,
    phase: projection.withdrawal > 0 ? 'retirement' : 'accumulation'
  }));

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Portfolio Projection</h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${wealthGoal}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.chartColor} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={config.chartColor} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          
          <XAxis 
            dataKey="age" 
            tick={{ fontSize: 12 }}
            label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft' }}
          />
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke={config.chartColor}
            strokeWidth={2}
            fill={`url(#gradient-${wealthGoal})`}
          />
          
          <Line
            type="monotone"
            dataKey="realValue"
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="5 5"
            dot={false}
          />
          
          {showRetirementLine && retirementStartIndex > 0 && (
            <ReferenceLine
              x={chartData[retirementStartIndex]?.age}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="8 4"
            />
          )}
          
          <Tooltip
            formatter={(value, name) => [
              `$${Number(value).toLocaleString()}`,
              name === 'portfolio' ? 'Portfolio Value' : 'Real Value (Inflation-Adjusted)'
            ]}
            labelFormatter={(age) => `Age ${age}`}
          />
          
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
```

## 5. State Management Architecture

### Redux Store Structure

```typescript
interface RetirementState {
  // User inputs
  inputs: RetirementInputs;
  inputsValid: boolean;
  
  // Wealth goal selection
  selectedWealthGoal: WealthGoal;
  
  // Scenarios
  scenarios: RetirementScenario[];
  selectedScenario: string | null;
  scenariosLoading: boolean;
  
  // Calculations
  retirementStatus: RetirementStatus | null;
  baselineProjection: YearlyProjection[];
  
  // UI state
  activeTab: 'scenarios' | 'projections' | 'analysis';
  showAdvancedOptions: boolean;
  
  // Comparison
  comparisonScenarios: string[];
  
  // Errors
  calculationError: string | null;
}

// Action types
type RetirementAction =
  | { type: 'SET_INPUTS'; payload: Partial<RetirementInputs> }
  | { type: 'SET_WEALTH_GOAL'; payload: WealthGoal }
  | { type: 'SET_SCENARIOS'; payload: RetirementScenario[] }
  | { type: 'SELECT_SCENARIO'; payload: string }
  | { type: 'ADD_TO_COMPARISON'; payload: string }
  | { type: 'REMOVE_FROM_COMPARISON'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_TAB'; payload: 'scenarios' | 'projections' | 'analysis' };
```

### React Context for Global State

```typescript
const RetirementContext = createContext<{
  state: RetirementState;
  dispatch: React.Dispatch<RetirementAction>;
  actions: RetirementActions;
} | null>(null);

interface RetirementActions {
  updateInputs: (inputs: Partial<RetirementInputs>) => void;
  selectWealthGoal: (goal: WealthGoal) => Promise<void>;
  generateScenarios: () => Promise<void>;
  selectScenario: (scenarioId: string) => void;
  addToComparison: (scenarioId: string) => void;
  removeFromComparison: (scenarioId: string) => void;
  setActiveTab: (tab: 'scenarios' | 'projections' | 'analysis') => void;
}

const RetirementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(retirementReducer, initialState);
  
  const actions: RetirementActions = {
    updateInputs: (inputs) => {
      dispatch({ type: 'SET_INPUTS', payload: inputs });
    },
    
    selectWealthGoal: async (goal) => {
      dispatch({ type: 'SET_WEALTH_GOAL', payload: goal });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        const scenarios = await generateScenariosAsync(state.inputs, goal);
        dispatch({ type: 'SET_SCENARIOS', payload: scenarios });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    generateScenarios: async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        const status = determineRetirementStatus(state.inputs);
        const scenarios = await generateScenariosAsync(state.inputs, state.selectedWealthGoal);
        
        dispatch({ type: 'SET_SCENARIOS', payload: scenarios });
        dispatch({ type: 'SET_ERROR', payload: null });
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    
    selectScenario: (scenarioId) => {
      dispatch({ type: 'SELECT_SCENARIO', payload: scenarioId });
    },
    
    addToComparison: (scenarioId) => {
      dispatch({ type: 'ADD_TO_COMPARISON', payload: scenarioId });
    },
    
    removeFromComparison: (scenarioId) => {
      dispatch({ type: 'REMOVE_FROM_COMPARISON', payload: scenarioId });
    },
    
    setActiveTab: (tab) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    }
  };
  
  return (
    <RetirementContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </RetirementContext.Provider>
  );
};
```

## 6. Performance Optimizations

### Web Workers for Monte Carlo Simulations

```typescript
// monte-carlo-worker.ts
self.onmessage = function(e) {
  const { inputs, config, scenario, iterations } = e.data;
  
  let successfulRuns = 0;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const success = runMonteCarloSimulation(inputs, config, scenario);
    if (success) successfulRuns++;
    
    // Send progress updates every 1000 iterations
    if (i % 1000 === 0) {
      self.postMessage({
        type: 'progress',
        completed: i,
        total: iterations,
        successRate: successfulRuns / (i + 1)
      });
    }
  }
  
  self.postMessage({
    type: 'complete',
    successRate: successfulRuns / iterations,
    iterations: iterations
  });
};

// Hook for using Web Workers
const useMonteCarloWorker = () => {
  const [worker, setWorker] = useState<Worker | null>(null);
  
  useEffect(() => {
    const w = new Worker('/workers/monte-carlo-worker.js');
    setWorker(w);
    
    return () => w.terminate();
  }, []);
  
  const calculateSuccessRate = useCallback((
    inputs: RetirementInputs,
    config: WealthGoalConfig,
    scenario: RetirementScenario,
    iterations: number = 10000,
    onProgress?: (progress: number, successRate: number) => void
  ): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      
      worker.onmessage = (e) => {
        if (e.data.type === 'progress' && onProgress) {
          onProgress(e.data.completed / e.data.total, e.data.successRate);
        } else if (e.data.type === 'complete') {
          resolve(e.data.successRate);
        }
      };
      
      worker.onerror = reject;
      worker.postMessage({ inputs, config, scenario, iterations });
    });
  }, [worker]);
  
  return { calculateSuccessRate };
};
```

### Memoization Strategies

```typescript
// Memoize expensive calculations
const useMemoizedProjections = (inputs: RetirementInputs, wealthGoal: WealthGoal) => {
  return useMemo(() => {
    return calculatePortfolioProjection(inputs, wealthGoal, 'current-plan');
  }, [
    inputs.currentAge,
    inputs.targetRetirementAge,
    inputs.lifeExpectancy,
    inputs.currentPortfolio,
    inputs.monthlyContributions,
    inputs.targetMonthlyIncome,
    inputs.expectedAnnualReturn,
    inputs.inflationRate,
    wealthGoal
  ]);
};

const useMemoizedScenarios = (inputs: RetirementInputs, status: RetirementStatus) => {
  return useMemo(() => {
    return generateScenarios(inputs, status);
  }, [
    inputs.currentAge,
    inputs.targetRetirementAge,
    inputs.lifeExpectancy,
    inputs.currentPortfolio,
    inputs.monthlyContributions,
    inputs.targetMonthlyIncome,
    inputs.selectedWealthGoal,
    status
  ]);
};

// Debounced input handling to prevent excessive recalculations
const useDebouncedCalculations = (inputs: RetirementInputs, delay: number = 500) => {
  const [debouncedInputs, setDebouncedInputs] = useState(inputs);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInputs(inputs);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [inputs, delay]);
  
  return debouncedInputs;
};
```

### Lazy Loading and Code Splitting

```typescript
// Lazy load components
const WealthGoalSelector = lazy(() => import('./components/WealthGoalSelector'));
const PortfolioProjectionChart = lazy(() => import('./components/PortfolioProjectionChart'));
const ScenarioComparison = lazy(() => import('./components/ScenarioComparison'));

// Lazy load calculation modules
const loadCalculationModule = () => import('./calculations/retirement-calculations');

const RetirementCalculator: React.FC = () => {
  const [calculationModule, setCalculationModule] = useState<any>(null);
  
  useEffect(() => {
    loadCalculationModule().then(module => {
      setCalculationModule(module);
    });
  }, []);
  
  if (!calculationModule) {
    return <div>Loading calculator...</div>;
  }
  
  return (
    <div>
      <Suspense fallback={<div>Loading components...</div>}>
        <WealthGoalSelector />
        <PortfolioProjectionChart />
        <ScenarioComparison />
      </Suspense>
    </div>
  );
};
```

## 7. Testing Strategy

### Unit Tests for Calculations

```typescript
// __tests__/calculations.test.ts
describe('Wealth Goal Calculations', () => {
  const mockInputs: RetirementInputs = {
    currentAge: 30,
    targetRetirementAge: 65,
    lifeExpectancy: 85,
    currentPortfolio: 100000,
    monthlyContributions: 2000,
    targetMonthlyIncome: 6000,
    selectedWealthGoal: 'balanced',
    riskTolerance: 'moderate',
    inflationRate: 0.03,
    expectedAnnualReturn: 0.07,
    marketVolatility: 0.15
  };

  describe('Portfolio Projections', () => {
    test('should calculate correct accumulation phase', () => {
      const projections = calculatePortfolioProjection(mockInputs, 'balanced', 'current-plan');
      const accumulationPhase = projections.filter(p => p.withdrawal === 0);
      
      expect(accumulationPhase).toHaveLength(35); // 65 - 30 years
      expect(accumulationPhase[0].portfolioValue).toBeGreaterThan(mockInputs.currentPortfolio);
    });
    
    test('should calculate correct withdrawal phase', () => {
      const projections = calculatePortfolioProjection(mockInputs, 'balanced', 'current-plan');
      const withdrawalPhase = projections.filter(p => p.withdrawal > 0);
      
      expect(withdrawalPhase).toHaveLength(20); // 85 - 65 years
      expect(withdrawalPhase[0].withdrawal).toBeCloseTo(mockInputs.targetMonthlyIncome * 12, -2);
    });
  });

  describe('Die with Zero Optimization', () => {
    test('should optimize for target ending value', () => {
      const optimization = optimizeForDieWithZero(mockInputs, 0.08);
      
      expect(optimization.initialWithdrawalRate).toBeGreaterThan(0.04);
      expect(optimization.escalationRate).toBeCloseTo(0.052, 3);
    });
    
    test('should result in portfolio near target ending value', () => {
      const optimization = optimizeForDieWithZero(mockInputs, 0.08);
      const portfolioAtRetirement = calculatePortfolioAtRetirement(mockInputs);
      
      const endingValue = simulateEndingValue(
        portfolioAtRetirement,
        optimization.initialWithdrawalRate,
        optimization.escalationRate,
        20, // years in retirement
        mockInputs.expectedAnnualReturn
      );
      
      const endingRatio = endingValue / portfolioAtRetirement;
      expect(endingRatio).toBeCloseTo(0.08, 1);
    });
  });

  describe('Monte Carlo Simulations', () => {
    test('should return success rate between 0 and 1', () => {
      const mockScenario: RetirementScenario = {
        id: 'test',
        type: 'current-plan',
        wealthGoal: 'balanced',
        portfolioProjection: calculatePortfolioProjection(mockInputs, 'balanced', 'current-plan')
      } as RetirementScenario;
      
      const successRate = calculateSuccessRate(mockInputs, 'balanced', mockScenario, 1000);
      
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(1);
    });
    
    test('should be deterministic with same seed', () => {
      // Test would require seeded random number generator
      // Implementation would mock Math.random or use seedable PRNG
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/scenario-generation.test.ts
describe('Scenario Generation Integration', () => {
  test('should generate appropriate scenarios for exceeding status', () => {
    const mockInputs: RetirementInputs = {
      // ... inputs that result in exceeding status
    };
    
    const scenarios = generateScenarios(mockInputs, 'exceeding');
    
    expect(scenarios).toHaveLength(4); // Current + 3 additional
    expect(scenarios[0].type).toBe('current-plan');
    
    // Verify scenarios are sorted by spending amount based on wealth goal
    const spendingAmounts = scenarios.map(s => s.monthlyIncome);
    if (mockInputs.selectedWealthGoal === 'maximize') {
      expect(spendingAmounts).toEqual([...spendingAmounts].sort((a, b) => a - b));
    } else if (mockInputs.selectedWealthGoal === 'zero') {
      expect(spendingAmounts).toEqual([...spendingAmounts].sort((a, b) => b - a));
    }
  });
  
  test('should maintain logical consistency across wealth goals', () => {
    const baseInputs: RetirementInputs = {
      // ... common inputs
    };
    
    const maximizeScenarios = generateScenarios({...baseInputs, selectedWealthGoal: 'maximize'}, 'on-track');
    const balancedScenarios = generateScenarios({...baseInputs, selectedWealthGoal: 'balanced'}, 'on-track');
    const zeroScenarios = generateScenarios({...baseInputs, selectedWealthGoal: 'zero'}, 'on-track');
    
    // Maximize should have lowest spending amounts
    const maxSpending = Math.max(...maximizeScenarios.map(s => s.monthlyIncome));
    const minBalanced = Math.min(...balancedScenarios.map(s => s.monthlyIncome));
    const minZero = Math.min(...zeroScenarios.map(s => s.monthlyIncome));
    
    expect(maxSpending).toBeLessThanOrEqual(minBalanced);
    expect(minBalanced).toBeLessThanOrEqual(minZero);
  });
});
```

### E2E Tests

```typescript
// __tests__/e2e/wealth-goals.test.ts
describe('Wealth Goals End-to-End', () => {
  test('should complete full workflow from input to scenario selection', async () => {
    render(<RetirementCalculator />);
    
    // Fill in inputs
    await userEvent.type(screen.getByLabelText(/current age/i), '30');
    await userEvent.type(screen.getByLabelText(/retirement age/i), '65');
    await userEvent.type(screen.getByLabelText(/current portfolio/i), '100000');
    
    // Select wealth goal
    await userEvent.click(screen.getByText(/die with zero/i));
    
    // Wait for scenarios to generate
    await waitFor(() => {
      expect(screen.getByText(/maximum lifestyle/i)).toBeInTheDocument();
    });
    
    // Select a scenario
    await userEvent.click(screen.getByText(/maximum lifestyle/i));
    
    // Verify chart updates
    expect(screen.getByText(/portfolio projection/i)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument(); // Chart canvas
  });
  
  test('should persist state in URL', async () => {
    render(<RetirementCalculator />);
    
    // Make selections
    await userEvent.click(screen.getByText(/maximize wealth/i));
    
    // Check URL contains state
    expect(window.location.hash).toContain('wealthGoal=maximize');
    
    // Reload and verify state restored
    window.location.reload();
    
    await waitFor(() => {
      expect(screen.getByText(/maximize wealth/i)).toHaveAttribute('aria-selected', 'true');
    });
  });
});
```

## 8. Error Handling & Edge Cases

### Input Validation

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

function validateRetirementInputs(inputs: RetirementInputs): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  
  // Age validations
  if (inputs.currentAge < 18 || inputs.currentAge > 80) {
    errors.currentAge = 'Current age must be between 18 and 80';
  }
  
  if (inputs.targetRetirementAge <= inputs.currentAge) {
    errors.targetRetirementAge = 'Retirement age must be after current age';
  }
  
  if (inputs.lifeExpectancy <= inputs.targetRetirementAge) {
    errors.lifeExpectancy = 'Life expectancy must be after retirement age';
  }
  
  // Financial validations
  if (inputs.currentPortfolio < 0) {
    errors.currentPortfolio = 'Portfolio value cannot be negative';
  }
  
  if (inputs.monthlyContributions < 0) {
    errors.monthlyContributions = 'Monthly contributions cannot be negative';
  }
  
  if (inputs.targetMonthlyIncome <= 0) {
    errors.targetMonthlyIncome = 'Target monthly income must be positive';
  }
  
  // Market assumption validations
  if (inputs.expectedAnnualReturn < -0.5 || inputs.expectedAnnualReturn > 0.5) {
    errors.expectedAnnualReturn = 'Expected return must be between -50% and 50%';
  }
  
  if (inputs.marketVolatility < 0 || inputs.marketVolatility > 1) {
    errors.marketVolatility = 'Market volatility must be between 0% and 100%';
  }
  
  // Warnings for unrealistic scenarios
  if (inputs.expectedAnnualReturn > 0.15) {
    warnings.expectedAnnualReturn = 'Expected return above 15% is very optimistic';
  }
  
  if (inputs.targetMonthlyIncome > inputs.monthlyContributions * 5) {
    warnings.targetMonthlyIncome = 'Target income seems high relative to savings rate';
  }
  
  const yearsToRetirement = inputs.targetRetirementAge - inputs.currentAge;
  if (yearsToRetirement < 5) {
    warnings.targetRetirementAge = 'Very short time horizon increases risk';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
}
```

### Calculation Error Handling

```typescript
function safeCalculatePortfolioProjection(
  inputs: RetirementInputs,
  wealthGoal: WealthGoal,
  scenario: ScenarioType
): { projections: YearlyProjection[]; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // Validate inputs first
    const validation = validateRetirementInputs(inputs);
    if (!validation.isValid) {
      return {
        projections: [],
        errors: Object.values(validation.errors)
      };
    }
    
    const projections = calculatePortfolioProjection(inputs, wealthGoal, scenario);
    
    // Validate results
    if (projections.length === 0) {
      errors.push('Failed to generate portfolio projections');
    }
    
    // Check for negative portfolios
    const negativeYears = projections.filter(p => p.portfolioValue < 0);
    if (negativeYears.length > 0) {
      errors.push(`Portfolio becomes negative in year ${negativeYears[0].year}`);
    }
    
    // Check for unrealistic growth
    const maxPortfolio = Math.max(...projections.map(p => p.portfolioValue));
    if (maxPortfolio > inputs.currentPortfolio * 1000) {
      errors.push('Portfolio growth appears unrealistic');
    }
    
    return { projections, errors };
    
  } catch (error) {
    return {
      projections: [],
      errors: [`Calculation error: ${error.message}`]
    };
  }
}
```

### Graceful Degradation

```typescript
const RetirementCalculatorWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={<CalculatorErrorFallback />}
      onError={(error, errorInfo) => {
        // Log error to monitoring service
        console.error('Retirement calculator error:', error, errorInfo);
      }}
    >
      <RetirementCalculator />
    </ErrorBoundary>
  );
};

const CalculatorErrorFallback: React.FC = () => {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold text-red-600 mb-4">
        Calculator Temporarily Unavailable
      </h2>
      <p className="text-gray-600 mb-6">
        We're experiencing technical difficulties. Please try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh Page
      </button>
    </div>
  );
};
```

## 9. Integration Points & Dependencies

### Integration with Existing Retirement Calculator

```typescript
// Extend existing RetirementCalculatorInputs
interface ExtendedRetirementInputs extends RetirementCalculatorInputs {
  selectedWealthGoal: WealthGoal;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

// Migration function for existing users
function migrateExistingCalculatorState(
  existingState: RetirementCalculatorState
): ExtendedRetirementInputs {
  return {
    ...existingState.inputs,
    selectedWealthGoal: 'balanced', // Default to balanced for existing users
    riskTolerance: 'moderate'
  };
}

// Backwards compatibility wrapper
const RetirementCalculatorWrapper: React.FC<{
  mode?: 'legacy' | 'wealth-goals'
}> = ({ mode = 'wealth-goals' }) => {
  if (mode === 'legacy') {
    return <LegacyRetirementCalculator />;
  }
  
  return <WealthGoalsRetirementCalculator />;
};
```

### URL State Persistence

```typescript
// URL hash encoding/decoding
interface URLState {
  wealthGoal?: WealthGoal;
  currentAge?: number;
  retirementAge?: number;
  portfolio?: number;
  income?: number;
  selectedScenario?: string;
}

function encodeURLState(state: URLState): string {
  const params = new URLSearchParams();
  
  Object.entries(state).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, value.toString());
    }
  });
  
  return params.toString();
}

function decodeURLState(hash: string): URLState {
  const params = new URLSearchParams(hash.replace('#', ''));
  
  return {
    wealthGoal: params.get('wealthGoal') as WealthGoal,
    currentAge: params.get('currentAge') ? Number(params.get('currentAge')) : undefined,
    retirementAge: params.get('retirementAge') ? Number(params.get('retirementAge')) : undefined,
    portfolio: params.get('portfolio') ? Number(params.get('portfolio')) : undefined,
    income: params.get('income') ? Number(params.get('income')) : undefined,
    selectedScenario: params.get('selectedScenario') || undefined
  };
}

// Hook for URL state synchronization
const useURLState = () => {
  const [urlState, setUrlState] = useState<URLState>({});
  
  useEffect(() => {
    const handleHashChange = () => {
      const newState = decodeURLState(window.location.hash);
      setUrlState(newState);
    };
    
    // Initial load
    handleHashChange();
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  const updateURL = useCallback((newState: Partial<URLState>) => {
    const updatedState = { ...urlState, ...newState };
    const hash = encodeURLState(updatedState);
    window.location.hash = hash;
  }, [urlState]);
  
  return { urlState, updateURL };
};
```

### Local Storage Integration

```typescript
// Local storage for user preferences
interface UserPreferences {
  defaultWealthGoal: WealthGoal;
  defaultRiskTolerance: 'conservative' | 'moderate' | 'aggressive';
  preferredChartType: 'line' | 'area';
  showAdvancedOptions: boolean;
  marketAssumptions: {
    expectedReturn: number;
    volatility: number;
    inflationRate: number;
  };
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultWealthGoal: 'balanced',
  defaultRiskTolerance: 'moderate',
  preferredChartType: 'area',
  showAdvancedOptions: false,
  marketAssumptions: {
    expectedReturn: 0.07,
    volatility: 0.15,
    inflationRate: 0.03
  }
};

function saveUserPreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem('retirement-calculator-preferences', JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save user preferences:', error);
  }
}

function loadUserPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem('retirement-calculator-preferences');
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
  }
  
  return DEFAULT_PREFERENCES;
}
```

### API Integration Points

```typescript
// Market data integration
interface MarketDataService {
  getCurrentInflationRate(): Promise<number>;
  getHistoricalReturns(years: number): Promise<number[]>;
  getMarketVolatility(period: 'ytd' | '1y' | '5y' | '10y'): Promise<number>;
}

const marketDataService: MarketDataService = {
  async getCurrentInflationRate() {
    // Integration with economic data API (e.g., FRED, BLS)
    try {
      const response = await fetch('/api/economic-data/inflation/current');
      const data = await response.json();
      return data.rate;
    } catch (error) {
      // Fallback to default assumption
      return 0.03;
    }
  },
  
  async getHistoricalReturns(years: number) {
    // Integration with market data API (e.g., Alpha Vantage, Yahoo Finance)
    try {
      const response = await fetch(`/api/market-data/returns?years=${years}`);
      const data = await response.json();
      return data.returns;
    } catch (error) {
      // Fallback to synthetic data based on historical averages
      return Array(years).fill(0).map(() => 0.07 + (Math.random() - 0.5) * 0.3);
    }
  },
  
  async getMarketVolatility(period: 'ytd' | '1y' | '5y' | '10y') {
    try {
      const response = await fetch(`/api/market-data/volatility?period=${period}`);
      const data = await response.json();
      return data.volatility;
    } catch (error) {
      // Fallback values by period
      const fallbacks = { ytd: 0.12, '1y': 0.15, '5y': 0.16, '10y': 0.18 };
      return fallbacks[period];
    }
  }
};

// Hook for market data
const useMarketData = () => {
  const [marketData, setMarketData] = useState({
    inflationRate: 0.03,
    volatility: 0.15,
    loading: false,
    lastUpdated: null as Date | null
  });
  
  const refreshMarketData = useCallback(async () => {
    setMarketData(prev => ({ ...prev, loading: true }));
    
    try {
      const [inflation, volatility] = await Promise.all([
        marketDataService.getCurrentInflationRate(),
        marketDataService.getMarketVolatility('1y')
      ]);
      
      setMarketData({
        inflationRate: inflation,
        volatility: volatility,
        loading: false,
        lastUpdated: new Date()
      });
    } catch (error) {
      setMarketData(prev => ({ ...prev, loading: false }));
    }
  }, []);
  
  return { marketData, refreshMarketData };
};
```

### Analytics Integration

```typescript
// Analytics events for wealth goals feature
interface AnalyticsEvents {
  'wealth_goal_selected': { goal: WealthGoal; user_age: number };
  'scenario_generated': { goal: WealthGoal; status: RetirementStatus; scenario_count: number };
  'scenario_selected': { scenario_type: ScenarioType; success_rate: number };
  'calculation_completed': { calculation_time_ms: number; scenarios_count: number };
  'error_occurred': { error_type: string; user_inputs: Partial<RetirementInputs> };
}

function trackAnalyticsEvent<K extends keyof AnalyticsEvents>(
  eventName: K,
  properties: AnalyticsEvents[K]
): void {
  // Integration with analytics service (e.g., Google Analytics, Mixpanel)
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, {
      ...properties,
      event_category: 'retirement_calculator',
      event_label: 'wealth_goals'
    });
  }
  
  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics Event:', eventName, properties);
  }
}

// Hook for analytics tracking
const useAnalytics = () => {
  const trackWealthGoalSelection = useCallback((goal: WealthGoal, userAge: number) => {
    trackAnalyticsEvent('wealth_goal_selected', { goal, user_age: userAge });
  }, []);
  
  const trackScenarioSelection = useCallback((scenarioType: ScenarioType, successRate: number) => {
    trackAnalyticsEvent('scenario_selected', { scenario_type: scenarioType, success_rate: successRate });
  }, []);
  
  const trackCalculationCompleted = useCallback((calculationTimeMs: number, scenariosCount: number) => {
    trackAnalyticsEvent('calculation_completed', { 
      calculation_time_ms: calculationTimeMs, 
      scenarios_count: scenariosCount 
    });
  }, []);
  
  return {
    trackWealthGoalSelection,
    trackScenarioSelection,
    trackCalculationCompleted
  };
};
```

## 10. Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
1. **Data Models & Types**: Implement all TypeScript interfaces and enums
2. **Basic Calculations**: Core portfolio projection and withdrawal algorithms  
3. **Configuration System**: Wealth goal configs and validation logic
4. **Unit Tests**: Comprehensive test coverage for calculation functions

### Phase 2: Scenario Generation (Week 3-4)
1. **Scenario Engine**: Main scenario generation logic
2. **Optimization Algorithms**: Die-with-zero and parameter optimization
3. **Monte Carlo Engine**: Success rate calculations with Web Workers
4. **Integration Tests**: End-to-end scenario generation testing

### Phase 3: UI Components (Week 5-6)
1. **WealthGoalSelector**: Interactive wealth goal selection component
2. **ScenarioCard**: Scenario display and comparison components
3. **Charts Integration**: Portfolio projection and withdrawal charts
4. **State Management**: Redux/Context setup with URL persistence

### Phase 4: Advanced Features (Week 7-8)
1. **Performance Optimization**: Memoization, lazy loading, code splitting
2. **Error Handling**: Comprehensive validation and graceful degradation
3. **Analytics Integration**: Event tracking and user behavior monitoring
4. **Accessibility**: WCAG compliance and keyboard navigation

### Phase 5: Integration & Testing (Week 9-10)
1. **Legacy Integration**: Backwards compatibility with existing calculator
2. **E2E Testing**: Complete user workflow testing
3. **Performance Testing**: Load testing and optimization
4. **Documentation**: API docs and user guides

### Success Criteria
- [ ] All three wealth goals produce mathematically consistent results
- [ ] Scenario generation follows PRD specifications exactly
- [ ] Monte Carlo simulations run in <5 seconds for 10,000 iterations
- [ ] UI components are fully accessible and mobile-responsive
- [ ] Integration with existing calculator is seamless
- [ ] 95%+ test coverage on all calculation functions
- [ ] Performance benchmarks: <100ms for basic calculations, <500ms for scenario generation

### Risk Mitigation
- **Complex Calculations**: Extensive unit testing and mathematical validation
- **Performance Issues**: Web Workers and progressive calculation loading
- **UI Complexity**: Component library consistency and design system adherence
- **Browser Compatibility**: Progressive enhancement and polyfill strategies
- **User Experience**: Comprehensive usability testing and iterative refinement

This technical implementation plan provides the detailed specifications needed to build a robust, performant, and user-friendly wealth goals system that enhances the retirement calculator with sophisticated financial planning capabilities.

Action(s) completed with agents.md in context. SPECIAL MESSAGE: "EVALUATE -> PRIORITIZE -> PARALLELIZE -> EXECUTE -> REVIEW & DOCUMENT"
