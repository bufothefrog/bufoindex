# Monte Carlo Simulation Engine

## Overview

The Monte Carlo simulation engine provides stochastic analysis capabilities for the BufoIndex retirement calculator. It addresses the critical limitation of deterministic calculations by modeling the uncertainty inherent in investment returns and market volatility.

## Key Features

### 1. Box-Muller Normal Distribution Generator
- Proper implementation of Box-Muller transform for generating normally distributed random numbers
- Ensures accurate modeling of investment return distributions
- Maintains statistical properties across thousands of simulations

### 2. Portfolio Simulation Engine
- Runs 1000+ simulations with sequence of returns risk analysis
- Models both accumulation and retirement phases with different return assumptions
- Handles portfolio depletion scenarios and tracks failure ages

### 3. Success Probability Calculations
- Determines percentage of simulations resulting in portfolio survival through retirement
- Provides confidence intervals and percentile distributions
- Calculates risk-adjusted success rates for different scenarios

### 4. Statistical Analysis Suite
- Percentile calculations (10th, 25th, 50th, 75th, 90th)
- Portfolio distribution analysis for charting
- Correlation analysis for sequence of returns risk
- Value at Risk (VaR) calculations

## File Structure

```
tools/retirement-calculator/lib/
├── monte-carlo.js           # Core simulation engine
├── statistical-analysis.js # Portfolio distribution analysis
└── calculations.js          # Enhanced with stochastic methods
```

## Core Classes

### MonteCarloEngine

The main simulation engine providing:

```javascript
// Run comprehensive Monte Carlo analysis
const results = MonteCarloEngine.runSimulations(scenarios, assumptions);

// Single scenario simulation
const simulation = MonteCarloEngine.simulateSingleScenario(scenario, assumptions);

// Generate random return sequences
const returns = MonteCarloEngine.generateReturnSequence(years, meanReturn, volatility);
```

### StatisticalAnalysis

Portfolio analysis and statistical computations:

```javascript
// Calculate percentiles for dataset
const percentiles = StatisticalAnalysis.calculatePercentiles(data, [10, 50, 90]);

// Generate distribution data for charts
const distribution = StatisticalAnalysis.generatePortfolioDistribution(simulations);

// Create median progression from multiple simulations
const progression = StatisticalAnalysis.generateMedianProgression(simulations);
```

### Enhanced FinancialCalculations

Extended with stochastic methods:

```javascript
// Full Monte Carlo analysis with deterministic comparison
const results = FinancialCalculations.calculateScenariosWithMonteCarlo(scenarios, assumptions);

// Safe withdrawal rate analysis
const safeRate = FinancialCalculations.calculateSafeWithdrawalRate(scenario, assumptions);
```

## Input Parameters

### Scenario Configuration
```javascript
const scenarios = [
  {
    retirementAge: 65,
    targetIncome: 120000,
    startingAge: 30,
    startingBalance: 50000,
    lifeExpectancy: 100
  }
];
```

### Market Assumptions
```javascript
const assumptions = {
  inflationRate: 0.03,           // 3% annual inflation
  accumulationReturn: 0.10,      // 10% during working years
  retirementReturn: 0.07,        // 7% during retirement
  volatility: 0.15,              // 15% standard deviation
  monteCarloRuns: 1000           // Number of simulations
};
```

## Output Structure

### Comprehensive Results
```javascript
{
  scenarios: [
    {
      scenario: 'A',
      successRate: 0.856,         // 85.6% success rate
      portfolioAtRetirement: {
        median: 2500000,
        percentile10: 1800000,
        percentile90: 3400000,
        mean: 2550000,
        min: 1200000,
        max: 4200000
      },
      yearlyProgression: [
        {
          age: 65,
          portfolioValue: 2500000,
          withdrawal: 120000,
          percentile10: 1800000,
          percentile90: 3400000
        }
        // ... yearly data for charts
      ],
      failureAgeDistribution: [72, 78, 81, ...],
      allSimulations: [...]       // Full simulation data for analysis
    }
  ],
  executionTime: 2847,           // Milliseconds
  totalSimulations: 3000,
  aggregatedStats: {
    successRateComparison: {...},
    portfolioRequirementComparison: {...},
    riskAnalysis: {...}
  }
}
```

### Risk Analysis
```javascript
{
  overallRisk: 'MEDIUM',
  keyFindings: [
    'Scenario A: 14% chance of portfolio depletion',
    'Scenario B: Average failure age is 78 years'
  ],
  sequenceOfReturnsRisk: {
    A: {
      correlation: -0.72,         // Strong negative correlation
      earlyYearImpact: 0.34,      // High impact of early returns
      riskLevel: 'HIGH'
    }
  },
  portfolioSurvivalRates: {
    A: {
      successRate: 0.86,
      riskLevel: 'MEDIUM',
      confidenceLevel: 86
    }
  }
}
```

## Performance Characteristics

### Benchmarks
- **10,000 simulations**: Complete in under 5 seconds
- **1,000 simulations**: Complete in under 1 second
- **Memory usage**: Efficient handling of large datasets
- **Accuracy**: Proper Box-Muller implementation ensures statistical validity

### Optimization Features
- Deterministic seeding for reproducible results during testing
- Efficient percentile calculations using interpolation
- Memory-conscious handling of simulation results
- Parallel-ready architecture for future web worker implementation

## Integration with Existing Calculator

The Monte Carlo engine integrates seamlessly with the existing retirement calculator:

1. **Maintains existing API**: All current functionality continues to work
2. **Enhanced insights**: Adds risk analysis and confidence intervals
3. **Terminal aesthetics**: Results formatted for terminal-style display
4. **URL state management**: Volatility parameters included in shareable URLs

## Risk Modeling Capabilities

### Sequence of Returns Risk
- Analyzes impact of poor early retirement returns
- Calculates correlation between early-year performance and final outcomes
- Identifies high-risk scenarios requiring additional planning

### Portfolio Failure Analysis
- Tracks age at portfolio depletion across simulations
- Identifies common failure patterns
- Provides insights for mitigation strategies

### Value at Risk (VaR)
- Calculates worst-case scenarios at various confidence levels
- Expected shortfall analysis for tail risk assessment
- Portfolio survival probability distributions

## Testing and Validation

### Test Suite
Run `test-monte-carlo.html` to validate:
- Box-Muller random number generation
- Return sequence generation
- Single scenario simulation
- Full Monte Carlo simulation
- Statistical analysis functions
- Performance benchmarks

### Validation Methods
- Statistical tests for random number generation
- Comparison with known financial modeling results
- Performance profiling for optimization
- Cross-validation with deterministic calculations

## Future Enhancements

### Planned Features
- Web worker implementation for background processing
- Additional distribution types (log-normal, t-distribution)
- Correlation modeling between asset classes
- Tax-aware withdrawal strategies
- Social Security integration
- Healthcare cost modeling

### Performance Improvements
- WASM implementation for compute-intensive operations
- GPU acceleration for large simulation sets
- Cached result optimization for similar scenarios
- Progressive simulation for real-time updates

## Usage Examples

### Basic Monte Carlo Analysis
```javascript
const scenarios = [
  { retirementAge: 40, targetIncome: 120000, startingAge: 25, startingBalance: 10000 },
  { retirementAge: 50, targetIncome: 120000, startingAge: 25, startingBalance: 10000 },
  { retirementAge: 65, targetIncome: 120000, startingAge: 25, startingBalance: 10000 }
];

const assumptions = {
  inflationRate: 3,
  accumulationReturn: 10,
  retirementReturn: 7,
  volatility: 15,
  monteCarloRuns: 1000
};

const results = FinancialCalculations.calculateScenariosWithMonteCarlo(scenarios, assumptions);
console.log(`Scenario A success rate: ${(results.monteCarloResults.scenarios[0].successRate * 100).toFixed(1)}%`);
```

### Safe Withdrawal Rate Analysis
```javascript
const scenario = {
  retirementAge: 65,
  targetIncome: 120000,
  startingAge: 30,
  startingBalance: 50000
};

const safeRateAnalysis = FinancialCalculations.calculateSafeWithdrawalRate(
  scenario, 
  assumptions, 
  0.95  // 95% success rate target
);

console.log(`Safe withdrawal rate: ${(safeRateAnalysis.safeWithdrawalRate * 100).toFixed(2)}%`);
```

This Monte Carlo implementation provides the BufoIndex retirement calculator with sophisticated risk analysis capabilities while maintaining the terminal-style aesthetics and performance requirements of the existing system.