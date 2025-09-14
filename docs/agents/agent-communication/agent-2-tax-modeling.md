# Agent 2: Tax Modeling System - Sprint 1B

## Agent Assignment
**Role:** Tax Calculation & Financial Modeling Specialist
**Sprint:** Sprint 1B - Core Calculations Enhancement
**Duration:** 2-3 hours
**Status:** READY TO LAUNCH

## Specific Deliverables

### Primary Objective
Create a comprehensive tax calculation system with 2024 federal tax brackets, state tax integration leveraging existing StateSelector component, and accurate after-tax income calculations for retirement planning.

### File Ownership (EXCLUSIVE)
- `lib/calculations/taxes.ts` (create new)
- `lib/calculations/tax-brackets-2024.ts` (create new)
- `lib/types/tax-types.ts` (create new)
- `test/lib/calculations/taxes.test.ts` (create new)

### Technical Requirements

#### 1. 2024 Federal Tax Bracket Implementation
```typescript
interface TaxBracket {
  min: number;
  max: number | null; // null for highest bracket
  rate: number;
}

interface FederalTaxBrackets {
  single: TaxBracket[];
  marriedFilingJointly: TaxBracket[];
  marriedFilingSeparately: TaxBracket[];
  headOfHousehold: TaxBracket[];
}

// 2024 IRS tax brackets (must be exactly accurate)
export const IRS_2024_TAX_BRACKETS: FederalTaxBrackets;
```

#### 2. State Tax Integration 
```typescript
interface StateTaxInfo {
  stateCode: string;
  stateName: string;
  hasTax: boolean;
  flatRate?: number;
  brackets?: TaxBracket[];
  standardDeduction?: number;
}

// Integrate with existing StateSelector component tax data
function getStateTaxInfo(stateCode: string): StateTaxInfo;
```

#### 3. Comprehensive Tax Calculations
```typescript
interface TaxCalculationResult {
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  afterTaxIncome: number;
  breakdown: {
    federalBrackets: BracketCalculation[];
    stateBrackets?: BracketCalculation[];
  };
}

function calculateTotalTax(
  income: number,
  filingStatus: FilingStatus,
  state: string,
  standardDeductions?: boolean
): TaxCalculationResult;
```

### Implementation Specifications

#### Federal Tax System
1. **Implement 2024 IRS tax brackets exactly** - zero tolerance for errors
2. **Progressive tax calculation** with proper bracket handling
3. **Standard deduction integration** by filing status
4. **Marginal vs effective rate calculations**
5. **Detailed breakdown** showing tax by bracket

#### State Tax Integration  
1. **Leverage existing StateSelector tax data** - don't duplicate
2. **Handle flat rate states** (e.g., Pennsylvania 3.07%)
3. **Handle progressive states** (e.g., California brackets)
4. **Handle no-tax states** (e.g., Texas, Florida)
5. **Account for state standard deductions** where applicable

#### Advanced Features
1. **After-tax income calculations** for retirement planning
2. **Tax optimization suggestions** (Roth vs Traditional)
3. **Retirement tax bracket projections** based on withdrawal amounts
4. **Tax-advantaged account calculations** (401k, IRA, HSA)

### Integration Requirements

#### StateSelector Component Integration
```typescript
// MUST integrate with existing component - DO NOT recreate
import { StateSelector, getStateTaxRate } from '@/components/shared/inputs/StateSelector';

// Enhance existing tax data, don't replace
interface EnhancedStateTaxData {
  existing: StateTaxRate; // from StateSelector  
  brackets: TaxBracket[]; // new detailed brackets
  standardDeduction: number; // new field
}
```

#### Data Contract Compliance
```typescript
// MUST implement exactly as specified for integration
interface RetirementTaxScenario {
  currentIncome: number;
  retirementIncome: number;
  filingStatus: 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold';
  state: string;
  retirementState?: string; // for tax planning
  taxDeferredAccounts: number; // 401k, traditional IRA
  taxFreeAccounts: number;     // Roth IRA, Roth 401k
  taxableAccounts: number;     // regular investment accounts
}

function calculateRetirementTaxes(scenario: RetirementTaxScenario): TaxCalculationResult;
```

### Testing Requirements (MANDATORY)

#### IRS Compliance Testing (100% Coverage Required)
```typescript
describe('2024 Federal Tax Brackets', () => {
  describe('IRS Compliance', () => {
    it('should match IRS 2024 single filer brackets exactly');
    it('should match IRS 2024 married filing jointly brackets exactly');
    it('should calculate standard deductions correctly');
    it('should handle edge cases at bracket boundaries');
  });
  
  describe('Progressive Tax Calculation', () => {
    it('should calculate taxes correctly across multiple brackets');
    it('should compute marginal rates accurately');
    it('should compute effective rates accurately');
    it('should provide detailed bracket breakdowns');
  });
});

describe('State Tax Integration', () => {
  it('should integrate with existing StateSelector data');
  it('should handle flat rate states correctly');
  it('should handle progressive states correctly');  
  it('should handle no-tax states correctly');
});
```

#### Accuracy Testing Against Known Scenarios
```typescript
describe('Tax Calculation Accuracy', () => {
  // Test against known tax preparation software results
  it('should match TurboTax calculations for test scenarios');
  it('should match H&R Block calculations for test scenarios');
  it('should handle retirement-specific tax situations');
});
```

### BufoIndex Philosophy Compliance
- **Contrarian approach:** Tax optimization over conventional tax advice
- **Mathematical precision:** Exact IRS bracket implementation
- **Opportunity cost focus:** Show tax impact on retirement planning
- **No conventional wisdom language** about tax strategies

### Integration Points

#### With Agent 1 (Monte Carlo)
```typescript
// Agent 1 will use these tax calculations in simulations
interface MonteCarloTaxScenario {
  preRetirementTax: TaxCalculationResult;
  retirementTax: TaxCalculationResult;
  taxOptimization: {
    rothConversion: number;
    taxLossHarvesting: number;
    geographicOptimization: number;
  };
}
```

#### With Agent 3 (Insights) 
```typescript
// Agent 3 will use tax data for optimization insights
interface TaxOptimizationInsight {
  currentStrategy: string;
  optimizedStrategy: string;
  annualSavings: number;
  lifetimeSavings: number;
  actionItems: string[];
}
```

### Success Criteria ✅
- [ ] 2024 IRS federal tax brackets implemented exactly
- [ ] State tax system integrated with existing StateSelector
- [ ] All tax calculation functions tested for accuracy
- [ ] Integration with existing components maintains compatibility
- [ ] >100% test coverage on all tax calculation functions  
- [ ] Tax calculations validated against professional tax software
- [ ] Progressive tax calculations handle all edge cases
- [ ] After-tax income calculations accurate for retirement planning

### Agent Communication
**Progress Updates:** Update this file every hour with completion status
**Integration Notes:** Document any StateSelector enhancements needed
**Accuracy Validation:** Include test results against known calculations
**Completion Status:** Mark complete only when ALL success criteria met

### Quality Validation Required
```bash
# MUST pass before marking complete
npm run test:taxes
npm run test:tax-accuracy
npm run type-check
npm run build
```

**Agent 2 Ready for Launch** ✅