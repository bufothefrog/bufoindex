# Retirement Calculator - Calculation Methodology

## Overview
The BufoIndex Retirement Calculator uses deterministic financial modeling to project retirement outcomes based on savings rates, investment returns, and the 4% withdrawal rule.

## Core Calculations

### 1. Savings Rate Scenarios
The calculator generates three scenarios based on your current savings rate:
- **Current**: Your actual savings rate
- **Moderate**: Current rate + 10% (e.g., 15% → 25%)
- **Aggressive**: Current rate + 20% (e.g., 15% → 35%)

### 2. Retirement Age Calculation
For each savings rate, the calculator determines when you can retire using:
```
Years to Retirement = log(Target Portfolio / Current Balance) / log(1 + Return Rate)
                     Adjusted for annual contributions
```

The target portfolio is calculated using the 4% rule:
```
Target Portfolio = Annual Income Need × 25
```

### 3. Realism Rating
Each scenario is evaluated for feasibility based on:

#### Savings Feasibility Score (0-100)
- Considers your income level and cost of living by state
- Maximum realistic savings rates vary by location:
  - Very High COL states (CA, NY): ~30-40% max
  - High COL states: ~40-50% max  
  - Moderate COL states: ~50-60% max
  - Low COL states: ~60-70% max

#### Confidence Levels
- **80-100%**: Highly Realistic
- **60-79%**: Challenging but Achievable
- **40-59%**: Unlikely
- **0-39%**: Unrealistic

### 4. Net Worth Projection
The net worth chart shows accumulation and depletion phases:

**Accumulation Phase (Current Age → Retirement Age):**
```
Net Worth = Starting Balance × (1 + Return)^Years + Annual Contribution × FV Factor
```
Where FV Factor is the future value of an annuity.

**Retirement Phase (Retirement Age → End Age):**
```
Annual Withdrawal = Target Income × (1 + Inflation)^Years in Retirement
Net Worth = (Previous Year - Withdrawal) × (1 + Return)
```

### 5. Retirement Withdrawals
Shows inflation-adjusted withdrawals starting at retirement:
```
Withdrawal Amount = Target Income × (1 + Inflation Rate)^Years Since Retirement
```

## Key Assumptions

### Investment Returns (by Risk Profile)
- **Conservative**: 6% accumulation / 4% retirement
- **Moderate**: 8% accumulation / 6% retirement
- **Aggressive**: 10% accumulation / 7% retirement
- **High Risk (2x)**: 14% accumulation / 7% retirement
- **Ultra High Risk (3x)**: 18% accumulation / 7% retirement

### Other Defaults
- **Inflation**: 3% annual
- **Withdrawal Rate**: 4% of portfolio (25x annual income)
- **Life Expectancy**: 85 years (adjustable)

## Calculation Flow

1. **Input Validation**
   - Current age, target retirement age, income needs
   - Current savings rate and starting balance

2. **Scenario Generation**
   - Calculate three savings rate scenarios
   - Determine achievable retirement age for each
   - Assess realism based on location and income

3. **Projection Calculations**
   - Generate net worth progression from current age to end age
   - Calculate required monthly contributions
   - Project inflation-adjusted withdrawals

4. **Visualization**
   - Net worth accumulation and depletion curves
   - Retirement withdrawal amounts over time

## Important Notes

- All calculations are deterministic (no randomness/Monte Carlo)
- The 4% rule assumes a balanced portfolio of stocks and bonds
- Inflation compounds both income needs and withdrawal amounts
- Net worth cannot go below zero in projections
- Tax implications are not considered (all values are pre-tax)