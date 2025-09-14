# Agent 3: Advanced Insights & Analysis - Sprint 1C

## Agent Assignment  
**Role:** Financial Insights & Analysis Engine Specialist
**Sprint:** Sprint 1C - Core Calculations Enhancement
**Duration:** 2-3 hours  
**Status:** READY TO LAUNCH

## Specific Deliverables

### Primary Objective
Build an advanced insights engine that analyzes Monte Carlo results and tax calculations to generate actionable retirement planning recommendations, including Coast FIRE detection, risk assessment algorithms, and optimization opportunities.

### File Ownership (EXCLUSIVE)
- `lib/calculations/retirement-insights.ts` (create new)
- `lib/calculations/coast-fire.ts` (create new)
- `lib/calculations/risk-assessment.ts` (create new)
- `test/lib/calculations/insights.test.ts` (create new)

### Technical Requirements

#### 1. Coast FIRE Detection System
```typescript
interface CoastFIREResult {
  hasCoastFIRE: boolean;
  coastFIREAge: number | null;
  currentProgress: number; // percentage to Coast FIRE
  requiredAmount: number;
  timeToCoastFIRE: number | null; // years remaining
  monthlyContributionToReach: number;
}

function calculateCoastFIRE(
  currentAge: number,
  currentSavings: number,
  targetRetirementAge: number,
  expectedReturn: number,
  desiredRetirementIncome: number
): CoastFIREResult;
```

#### 2. Risk Assessment Algorithms
```typescript
interface RiskAssessment {
  overallRiskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  riskFactors: {
    sequenceOfReturnsRisk: number; // 0-100 score
    inflationRisk: number;
    longevityRisk: number;
    concentrationRisk: number;
    withdrawalRateRisk: number;
  };
  mitigationSuggestions: string[];
}

function assessRetirementRisk(
  scenario: RetirementScenario,
  monteCarloResults: MonteCarloResults
): RiskAssessment;
```

#### 3. Optimization Recommendations Engine
```typescript
interface OptimizationInsight {
  category: 'savings' | 'tax' | 'allocation' | 'timing' | 'geography';
  priority: 'high' | 'medium' | 'low';
  impact: 'major' | 'moderate' | 'minor';
  title: string;
  description: string;
  actionItems: string[];
  potentialBenefit: {
    annualAmount: number;
    lifetimeAmount: number;
    successProbabilityIncrease: number;
  };
  contrarian: boolean; // challenges conventional wisdom
}

function generateOptimizationInsights(
  scenario: RetirementScenario,
  monteCarloResults: MonteCarloResults,
  taxResults: TaxCalculationResult
): OptimizationInsight[];
```

### Implementation Specifications

#### Coast FIRE Analysis
1. **Calculate Coast FIRE threshold** based on compound growth projections
2. **Track progress toward Coast FIRE** with milestone notifications  
3. **Suggest contribution adjustments** to reach Coast FIRE sooner
4. **Account for different retirement age scenarios**
5. **Include tax-advantaged account optimization**

#### Risk Assessment Engine
1. **Sequence of returns risk** - analyze early retirement vulnerability
2. **Inflation risk assessment** - real vs nominal return analysis
3. **Longevity risk** - life expectancy vs withdrawal duration
4. **Portfolio concentration risk** - diversification analysis
5. **Withdrawal rate sustainability** - 4% rule vs dynamic strategies

#### Contrarian Insights (BufoIndex Philosophy)
1. **Emergency fund optimization** - challenge 6-12 month conventional wisdom
2. **Debt vs investment analysis** - mathematical optimization over safety
3. **Tax loss harvesting opportunities** - maximize after-tax returns
4. **Geographic arbitrage** - retirement location optimization
5. **Roth conversion ladders** - tax optimization strategies

### Integration Requirements

#### Dependencies on Agent 1 (Monte Carlo)
```typescript
// MUST use Agent 1's outputs exactly
import { MonteCarloResults, runMonteCarloSimulation } from './monte-carlo';

function analyzeMonteCarloResults(results: MonteCarloResults): InsightAnalysis {
  // Process percentiles for risk assessment
  // Analyze failure scenarios for recommendations
  // Generate actionable insights from statistical data
}
```

#### Dependencies on Agent 2 (Tax Modeling) 
```typescript
// MUST use Agent 2's outputs exactly
import { TaxCalculationResult, calculateRetirementTaxes } from './taxes';

function generateTaxOptimizationInsights(
  current: TaxCalculationResult,
  retirement: TaxCalculationResult
): OptimizationInsight[] {
  // Roth vs Traditional optimization
  // Geographic tax optimization
  // Tax loss harvesting opportunities
}
```

#### Data Contract Compliance
```typescript
// MUST implement exactly for UI integration (Agent 6)
interface RetirementAnalysis {
  coastFIRE: CoastFIREResult;
  riskAssessment: RiskAssessment;
  insights: OptimizationInsight[];
  recommendations: {
    immediate: string[];      // Act within 30 days
    shortTerm: string[];      // Act within 6 months  
    longTerm: string[];       // Act within 2 years
  };
  contrarian: {
    emergencyFundRecommendation: number; // BufoIndex max: 3 months
    debtPayoffStrategy: string;
    investmentPriority: string[];
  };
}
```

### BufoIndex Philosophy Integration (CRITICAL)

#### Contrarian Insights Required
```typescript
const CONVENTIONAL_WISDOM_CHALLENGES = [
  {
    conventional: "Save 6-12 months emergency fund",
    bufoindex: "Optimize to 3 months max, invest excess for higher returns",
    calculation: "opportunity cost analysis"
  },
  {
    conventional: "Pay off all debt before investing", 
    bufoindex: "Optimize based on 7% interest rate threshold",
    calculation: "mathematical comparison"
  },
  {
    conventional: "Conservative allocation near retirement",
    bufoindex: "Maintain growth allocation for longevity risk",
    calculation: "sequence of returns analysis"
  }
];
```

#### Philosophy Compliance Requirements
- **No conventional wisdom language** in recommendations
- **Mathematical optimization** over emotional comfort
- **Opportunity cost emphasis** in all suggestions
- **Contrarian insights flagged** as philosophy-aligned
- **7% debt threshold** used consistently
- **3-month emergency fund maximum** enforced

### Testing Requirements (MANDATORY)

#### Coast FIRE Testing
```typescript
describe('Coast FIRE Detection', () => {
  it('should accurately calculate Coast FIRE thresholds');
  it('should track progress toward Coast FIRE correctly');
  it('should suggest optimal contribution amounts');
  it('should handle various retirement age scenarios');
  it('should account for existing retirement accounts');
});
```

#### Risk Assessment Testing  
```typescript
describe('Risk Assessment Engine', () => {
  it('should identify sequence of returns risk accurately');
  it('should assess inflation risk correctly');
  it('should calculate longevity risk appropriately');
  it('should provide actionable mitigation strategies');
});
```

#### Philosophy Compliance Testing
```typescript
describe('BufoIndex Philosophy Compliance', () => {
  it('should never recommend >3 month emergency funds');
  it('should use 7% debt optimization threshold');
  it('should challenge conventional wisdom appropriately');
  it('should emphasize opportunity cost in all recommendations');
});
```

### Success Criteria ✅
- [ ] Coast FIRE detection system working accurately
- [ ] Risk assessment engine provides meaningful analysis
- [ ] Optimization insights generated with BufoIndex philosophy
- [ ] Integration with Agent 1 Monte Carlo results complete
- [ ] Integration with Agent 2 tax calculations complete
- [ ] >90% test coverage on all analysis functions
- [ ] All insights include specific action items
- [ ] Contrarian recommendations properly flagged and explained
- [ ] No conventional wisdom language in any recommendations

### Agent Communication
**Progress Updates:** Update this file every hour with completion status
**Integration Status:** Document successful integration with Agent 1 & 2 outputs
**Philosophy Validation:** Confirm all insights align with BufoIndex contrarian approach
**Completion Status:** Mark complete only when ALL success criteria met

### Quality Validation Required
```bash
# MUST pass before marking complete
npm run test:insights
npm run test:philosophy-compliance
npm run type-check  
npm run build
```

**Agent 3 Ready for Launch** ✅