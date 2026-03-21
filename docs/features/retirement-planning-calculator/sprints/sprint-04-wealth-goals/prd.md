# Sprint 04: Wealth Goals System - Product Requirements Document

## Overview

The wealth goals system defines how users approach retirement spending and portfolio management. This document provides unambiguous specifications for all wealth goal behaviors across scenarios, calculations, and visualizations.

## Wealth Goals Definition

### 1. **Maximize Wealth**
- **Philosophy**: Build the largest possible estate value for inheritance
- **Approach**: Conservative spending, maximum wealth preservation
- **Target User**: Those prioritizing legacy/inheritance over lifestyle

### 2. **Balanced Preservation** 
- **Philosophy**: Maintain purchasing power while preserving some wealth
- **Approach**: Standard 4% withdrawal rule with moderate preservation
- **Target User**: Most retirees seeking balanced approach

### 3. **Die with Zero**
- **Philosophy**: Optimize lifetime spending, minimal inheritance
- **Approach**: Escalating withdrawals designed to exhaust portfolio
- **Target User**: Those prioritizing personal experiences over inheritance

---

## Scenario Generation Rules

### **Status: "Exceeding" Goals**
User has more than enough money for their target retirement.

#### Maximize Wealth
1. **Current Plan**: User's baseline scenario
2. **Early Retirement**: Retire 2 years later at same spending level, show difference in end portfolio value
3. **Ultra Conservative**: Spend 70% of target, build maximum legacy

#### Balanced Preservation  
1. **Current Plan**: User's baseline scenario
2. **Early Retirement**: Retire X years early at same spending level (with an 80% portfolio survival rate)
3. **Conservative**: Spend +X% of target, (with an 80% portfolio survival rate)
4. **Coast Mode**: Reduce current savings, maintain balance

#### Die with Zero
1. **Current Plan**: User's baseline scenario  
2. **Early Retirement**: Retire X years early at same spending level that would result in 5-10% portfolio ending value 
3. **Maximum Lifestyle**: Spend X per year that would result in 5-10% portfolio ending value 
4. **Coast Mode**: Reduce current savings, maintain spending goals that would result in 5-10% portfolio ending value with retirement age specified

### **Status: "On Track"** 
User is reasonably likely to meet their retirement goals.

#### Maximize Wealth
1. **Current Plan**: User's baseline scenario
2. **Extra Savings**: Save $500/month more → retire earlier OR build more wealth
3. **Ultra Conservative**: Spend 80% of target for wealth buffer

#### Balanced Preservation
1. **Current Plan**: User's baseline scenario
2. **Extra Savings**: Save $500/month more → retire earlier
3. **Conservative Buffer**: Spend 90% of target with safety margin

#### Die with Zero
1. **Current Plan**: User's baseline scenario
2. **Extra Savings**: Save $500/month more → spend more in retirement that would result in 5-10% portfolio ending value 
3. **Enhanced Lifestyle**: Spend X per year that would result in 5-10% portfolio ending value 

### **Status: "Falling Short"**
User is unlikely to meet their retirement goals.

#### Maximize Wealth
1. **Current Plan**: User's baseline scenario
2. **Reality Check - Age**: Work until age X to afford target lifestyle  
3. **Reality Check - Income**: Live on $X/month at planned retirement age
4. **Reality Check - Savings**: Save an extra $X/month to retire at planned age & lifestyle
5. **Compromise**: Save extra $500/month → work until age Y (hybrid approach)

#### Balanced Preservation
1. **Current Plan**: User's baseline scenario
2. **Reality Check - Age**: Work until age X to afford target lifestyle
3. **Reality Check - Income**: Live on $X/month at planned retirement age
4. **Reality Check - Savings**: Save an extra $X/month to retire at planned age & lifestyle
4. **Modest Fix**: Save extra $500/month → retire at age Y

#### Die with Zero
1. **Current Plan**: User's baseline scenario that would result in 5-10% portfolio value ending value 
2. **Reality Check - Age**: Work until age X for higher spending in retirement that would result in 5-10% portfolio ending value 
3. **Reality Check - Income**: Live on $X/month at planned retirement age that would result in 5-10% portfolio ending value 
3. **Reality Check - Lifestyle**: Accept lower spending to retire on time that would result in 5-10% portfolio ending value 
4. **Aggressive Save**: Save extra $1000/month → maintain lifestyle goals

---

## Withdrawal Calculation Logic

### **Maximize Wealth**
- **Withdrawal Rate**: 3.0% first year, then increased yearly by X% inflation
- **Philosophy**: Preserve maximum capital
- **Annual Increases**: Inflation only (maintain real purchasing power)
- **Portfolio Goal**: Grow throughout retirement for inheritance

### **Balanced Preservation**  
- **Withdrawal Rate**: 4.0% first year, then increased yearly by X% inflation
- **Philosophy**: Balance spending and preservation
- **Annual Increases**: Inflation only (maintain real purchasing power)
- **Portfolio Goal**: Maintain value in real terms

### **Die with Zero**
- **Initial Rate**: X% first year, then increased yearly by X% inflation that would result in a 5-10% portfolio ending value
- **Philosophy**: Exhaust portfolio by life expectancy
- **Annual Increases**: Inflation + X% real growth (escalating lifestyle) that would result in a 5-10% portfolio ending value
- **Portfolio Goal**: Decline to 5-10% value from first year of retirement

---

## Graph Behavior Specifications

### **Net Worth Projection Chart**

#### Maximize Wealth
- **Accumulation Phase**: Standard growth curve
- **Retirement Phase**: Portfolio continues growing (withdrawals < returns)
- **End Value**: Substantial balance remaining at life expectancy
- **Color**: Deep blue (wealth preservation theme)

#### Balanced Preservation
- **Accumulation Phase**: Standard growth curve  
- **Retirement Phase**: Portfolio maintains value in real terms with little growth
- **End Value**: Moderate balance remaining at life expectancy (likely close to first retirement year balance indexed for inflation)
- **Color**: Green (balanced theme)

#### Die with Zero
- **Accumulation Phase**: Standard growth curve
- **Retirement Phase**: Portfolio declines steadily
- **End Value**: Near zero at life expectancy
- **Color**: Orange/Red (spending theme)

### **Annual Withdrawals Chart**

#### Maximize Wealth
- **Pattern**: Flat line adjusted for inflation only
- **Starting Amount**: 100%% of target income (conservative)
- **Growth**: 3% annually (inflation adjustment)
- **Emphasis**: Predictable, conservative income

#### Balanced Preservation  
- **Pattern**: Flat line adjusted for inflation only
- **Starting Amount**: 100% of target income (standard)
- **Growth**: 3% annually (inflation adjustment)  
- **Emphasis**: Stable, predictable income

#### Die with Zero
- **Pattern**: Escalating curve (increasing over time)
- **Starting Amount**: X% that would result in a 5-10% portfolio ending value
- **Growth**: X% annually (inflation + X% real increase that would result in a 5-10% portfolio ending value)
- **Emphasis**: Increasing lifestyle, frontloading enjoyment

---

## Success Rate Calculation

### **Monte Carlo Parameters by Wealth Goal**

#### Maximize Wealth
- **Success Definition**: Portfolio value never drops below 80% of peak
- **Risk Tolerance**: Very conservative (success = wealth preservation)
- **Threshold**: 90%+ success rate considered good

#### Balanced Preservation
- **Success Definition**: Portfolio lasts until life expectancy
- **Risk Tolerance**: Moderate (success = goal achievement)  
- **Threshold**: 80%+ success rate considered good

#### Die with Zero
- **Success Definition**: Portfolio provides desired lifestyle until life expectancy
- **Risk Tolerance**: Aggressive (success = lifestyle maintenance)
- **Threshold**: 70%+ success rate considered acceptable

---

## UI/UX Specifications

### **Wealth Goal Selector**
```
🔹 Maximize Wealth
   Build largest estate value
   Conservative spending, maximum inheritance

⚖️ Balanced Preservation  
   Maintain purchasing power
   4% rule, balanced approach
   
⚡ Die with Zero
   Optimize lifetime spending
   Spend more, leave less behind
```

### **Scenario Card Format**
```
[Icon] Scenario Name                    $X,XXX
       Context/Trade-off                monthly
       Success rate: XX.X%
```

#### Examples by Wealth Goal:

**Maximize Wealth:**
```
💰 Ultra Conservative                   $5,600
   Build $2.1M legacy                  monthly
   Success rate: 95.2%
```

**Balanced:**
```
🏛️ Conservative Buffer                  $6,400  
   $8,000 annual safety margin         monthly
   Success rate: 87.3%
```

**Die with Zero:**
```
🎉 Maximum Lifestyle                    $9,333
   Escalating to $15k by age 85        monthly  
   Success rate: 68.1%
```

### **Success Rate Color Coding**
- **90%+**: Dark Green (excellent)
- **75-89%**: Green (good) 
- **60-74%**: Yellow (acceptable for aggressive goals)
- **45-59%**: Orange (concerning)
- **<45%**: Red (unacceptable)

---

## Technical Implementation Requirements

### **Data Structures**
```typescript
type WealthGoal = 'maximize' | 'balanced' | 'zero';

interface WealthGoalConfig {
  baseWithdrawalRate: number;
  annualEscalationRate: number;
  conservativeMultiplier: number;  // For conservative scenarios
  aggressiveMultiplier: number;    // For aggressive scenarios
  successThreshold: number;        // Minimum acceptable success rate
}
```

### **Configuration Constants**
```typescript
const WEALTH_GOAL_CONFIGS: Record<WealthGoal, WealthGoalConfig> = {
  maximize: {
    baseWithdrawalRate: 0.035,      // 3.5%
    annualEscalationRate: 0.03,     // Inflation only
    conservativeMultiplier: 0.70,   // 70% of target
    aggressiveMultiplier: 0.90,     // 90% of target (still conservative)
    successThreshold: 0.90          // 90% success required
  },
  balanced: {
    baseWithdrawalRate: 0.04,       // 4.0%
    annualEscalationRate: 0.03,     // Inflation only  
    conservativeMultiplier: 0.80,   // 80% of target
    aggressiveMultiplier: 1.10,     // 110% of target
    successThreshold: 0.75          // 75% success required
  },
  zero: {
    baseWithdrawalRate: 0.055,      // 5.5%
    annualEscalationRate: 0.052,    // Inflation + 2% real
    conservativeMultiplier: 1.10,   // 110% of target (still aggressive)
    aggressiveMultiplier: 1.40,     // 140% of target
    successThreshold: 0.60          // 60% success acceptable
  }
};
```

---

## Validation Criteria

### **Logical Consistency Checks**
1. Maximize wealth scenarios always show LOWEST spending amounts
2. Die with zero scenarios always show HIGHEST spending amounts  
3. Balanced scenarios show MODERATE spending amounts
4. Success rates align with risk tolerance of each wealth goal
5. Portfolio projections match withdrawal philosophy
6. Scenario names accurately reflect withdrawal amounts

### **Mathematical Validation**
1. Die with zero portfolios reach near-zero at life expectancy
2. Maximize wealth portfolios grow throughout retirement
3. Withdrawal calculations compound correctly with inflation/escalation
4. Monte Carlo simulations use appropriate success definitions
5. All percentage calculations use correct base values (target income, not projected balance)

### **User Experience Validation**
1. Wealth goal behavior is immediately understandable
2. Scenario trade-offs are clearly explained
3. Success rate implications are transparent
4. Graph visualizations match withdrawal philosophy
5. No contradictory or confusing recommendations

---

## Success Metrics

### **Functional Metrics**
- [ ] All wealth goals produce mathematically consistent scenarios
- [ ] Maximize wealth always shows lowest spending options
- [ ] Die with zero always shows highest spending options
- [ ] Portfolio projections match withdrawal philosophy
- [ ] Success rates align with appropriate risk tolerance

### **User Experience Metrics**  
- [ ] Users can distinguish between wealth goal approaches
- [ ] Scenario recommendations are actionable and logical
- [ ] Trade-offs between goals are clear
- [ ] No confusion about "conservative" meaning higher spending
- [ ] Success rate implications are understood

This comprehensive specification ensures no ambiguity in wealth goal behavior across all calculator functions.