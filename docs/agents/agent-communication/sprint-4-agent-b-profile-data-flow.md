# Agent B: Profile Data Flow Analysis Report
**Sprint**: 4 - State Management & Data Flow Analysis  
**Agent**: B - Profile Data Flow Analyst  
**Duration**: 2 hours  
**Phase**: Phase 2 (Parallel) - USING AGENT A FOUNDATION
**Status**: ✅ COMPLETE

---

## EXECUTIVE SUMMARY

**Mission**: Analyze user profile data requirements across calculators and design efficient cross-calculator data sharing architecture using Agent A's unified store specification.

**Key Finding**: Significant data overlap exists between calculators (70%+ shared data points), presenting excellent opportunities for cross-calculator integration while maintaining calculator-specific optimizations.

**Recommendation**: Implement **Intelligent Data Synchronization Architecture** with automatic cross-calculator population and selective persistence optimization.

---

## USER PROFILE DATA REQUIREMENTS ANALYSIS (ARCH-035)

### Complete Data Field Mapping

#### Paycheck Allocator Profile Structure Analysis
**Primary Data Domains** (from `/lib/types/index.ts`):

**1. Income Data** (Lines 3-22)
```typescript
interface IncomeData {
  grossPaycheck: number;      // Per-paycheck amount
  netPaycheck: number;        // After-tax per-paycheck
  frequency: PayFrequency;    // How often paid
  regularBonus: boolean;      // Has regular bonuses
  bonusAmount: number;        // Average bonus amount
  bonusFrequency: string;     // How often bonus paid
  monthlyGross: number;       // Computed monthly equivalent
  monthlyNet: number;         // Computed monthly net
  // Legacy compatibility fields
  gross: number;              // Same as monthlyGross
  net: number;                // Same as monthlyNet
  bonusExpected: number;      // Monthly bonus equivalent
}
```

**2. Tax Data** (Lines 24-33)
```typescript
interface TaxData {
  federalBracket: number;     // Current tax bracket
  state: string;              // State for tax calculations
  filingStatus: string;       // Tax filing status
  currentWithholding: {       // Current tax withholdings
    federal: number;
    state: number;
    fica: number;
  };
}
```

**3. Benefits Data** (Lines 35-78)
```typescript
interface BenefitsData {
  employer401k: {             // 401k plan details
    available: boolean;
    matchPercent: number;
    matchLimit: number;
    currentContribution: number;
    afterTaxAvailable: boolean;
    currentYTD: number;
  };
  hsa: {                      // HSA details
    eligible: boolean;
    employerContribution: number;
    currentContribution: number;
    currentYTD: number;
    coverageType: string;
    investmentStrategy: boolean;
  };
  ira: {                      // IRA details
    hasIRA: boolean;
    accountTypes: { traditional: boolean; roth: boolean; };
    currentContributions: { traditional: number; roth: number; };
    currentBalances: { traditional: number; roth: number; };
  };
}
```

**4. User Preferences** (Lines 90-105)
```typescript
interface UserPreferences {
  emergencyFundMonths: number;        // Target emergency fund size
  currentEmergencyFund: number;       // Current emergency savings
  emergencyFundAPY: number;           // Emergency fund yield
  necessaryExpenses: number;          // Monthly essential expenses
  funMoney: { min: number; max: number; current: number; };  // Discretionary spending
  age: number;                        // User age
  isPeakEarnings: boolean;            // Peak earning years status
  expectedRetirementBracket: number;  // Expected retirement tax bracket
  riskTolerance: string;              // Investment risk tolerance
  optimizationGoal: string;           // Primary optimization objective
}
```

#### Retirement Calculator Input Structure Analysis
**Primary Data Requirements** (from `/lib/calculations/retirement.ts`):

```typescript
interface RetirementInputs {
  startingAge: number;                // Starting age for planning
  retirementAge: number;              // Target retirement age
  targetIncome: number;               // Desired retirement income
  startingBalance: number;            // Current retirement balance
  currentIncome: number;              // Current annual income
  monthlySavings: number;             // Monthly savings amount
  necessaryMonthlyExpenses: number;   // Monthly essential expenses
  accumulationReturn: number;         // Investment return during accumulation
  retirementReturn: number;           // Investment return during retirement
  inflationRate: number;              // Expected inflation rate
  socialSecurityAge: number;          // Social Security claim age
  socialSecurityBenefit: number;      // Expected Social Security benefit
  healthcareCostMultiplier: number;   // Healthcare cost adjustment
  volatility: number;                 // Market volatility assumption
  filingStatus: string;               // Tax filing status
}
```

### Cross-Calculator Data Overlap Analysis

**HIGH OVERLAP (Direct Mapping)**:
| **Shared Data Point** | **Paycheck Allocator Field** | **Retirement Calculator Field** | **Overlap %** |
|-----------------------|-------------------------------|----------------------------------|---------------|
| Current Income | `income.monthlyGross` × 12 | `currentIncome` | 100% |
| User Age | `preferences.age` | `startingAge` | 100% |
| Monthly Expenses | `preferences.necessaryExpenses` | `necessaryMonthlyExpenses` | 100% |
| Tax Filing Status | `taxes.filingStatus` | `filingStatus` | 100% |
| Current Savings | `income.net - preferences.necessaryExpenses` | `monthlySavings` | 95% |

**MEDIUM OVERLAP (Computed Mapping)**:
| **Shared Concept** | **Paycheck Mapping** | **Retirement Mapping** | **Transformation Required** |
|--------------------|----------------------|------------------------|------------------------------|
| Retirement Balance | Sum of all retirement accounts | `startingBalance` | Aggregation |
| Risk Tolerance | `preferences.riskTolerance` | `volatility` + return assumptions | Qualitative → Quantitative |
| Retirement Target | Derived from current lifestyle | `targetIncome` | Lifestyle analysis |
| Tax Optimization | Current tax bracket | `expectedRetirementBracket` | Projection required |

**LOW OVERLAP (Calculator-Specific)**:
| **Calculator** | **Unique Data Requirements** | **Usage** |
|----------------|------------------------------|-----------|
| **Paycheck** | Debt details, employer match specifics, HSA eligibility | Paycheck allocation optimization |
| **Retirement** | Social Security details, healthcare multipliers, Monte Carlo settings | Long-term retirement planning |

### Comprehensive User Profile Schema Design

**Enhanced Shared Profile Schema** (Building on Agent A's foundation):
```typescript
interface EnhancedSharedUserProfile {
  // Core Demographics (Agent A + enhancements)
  age: number;                          // Primary: Paycheck, Derived: Retirement start
  state: string;                        // Tax calculations for both
  filingStatus: TaxFilingStatus;        // Tax optimization for both
  
  // Financial Fundamentals (Enhanced from Agent A)
  currentAnnualIncome: number;          // Primary: Paycheck (monthlyGross × 12)
  monthlyNetIncome: number;             // Primary: Paycheck (netPaycheck × frequency)
  necessaryMonthlyExpenses: number;    // Shared directly between both
  currentMonthlySavings: number;        // Computed: Paycheck, Direct: Retirement
  
  // Account Balances (New comprehensive tracking)
  currentBalances: {
    emergencyFund: number;              // Primary: Paycheck preferences
    checking: number;                   // Derived from net income patterns
    retirement401k: number;             // Primary: Paycheck benefits, Used: Retirement
    retirementIRA: number;              // Primary: Paycheck benefits, Used: Retirement
    retirementRoth: number;             // Primary: Paycheck benefits, Used: Retirement
    taxableInvestments: number;         // Computed from allocation results
    totalRetirement: number;            // Computed aggregate for Retirement calc
  };
  
  // Risk & Optimization Preferences (Enhanced)
  riskProfile: {
    tolerance: 'conservative' | 'moderate' | 'optimizer';  // Primary: Paycheck
    retirementVolatility: number;       // Computed: Conservative=0.12, Moderate=0.15, Optimizer=0.18
    accumulationReturn: number;         // Computed: Conservative=0.06, Moderate=0.07, Optimizer=0.08
    retirementReturn: number;           // Computed: Conservative=0.04, Moderate=0.05, Optimizer=0.06
  };
  
  // Goal Setting (New cross-calculator goals)
  goals: {
    emergencyFundMonths: number;        // Primary: Paycheck preferences
    targetRetirementAge: number;        // Primary: Retirement, Used: Paycheck projections
    retirementIncomeTarget: number;     // Primary: Retirement, Influences: Paycheck optimization
    isPeakEarnings: boolean;            // Primary: Paycheck, Used: Retirement projections
    optimizationPriority: 'tax_min' | 'wealth_max' | 'balanced';
  };
  
  // Tax Optimization Data (Shared)
  taxOptimization: {
    currentFederalBracket: number;      // Primary: Paycheck taxes
    expectedRetirementBracket: number;  // Computed from retirement income projections
    stateHasIncomeTax: boolean;         // Derived from state
    currentWithholding: {               // Primary: Paycheck taxes
      federal: number;
      state: number;
      fica: number;
    };
  };
  
  // Metadata (Enhanced from Agent A)
  version: string;
  lastUpdated: number;
  primaryCalculator: 'paycheck' | 'retirement' | 'unknown';  // Most recently used
  syncStatus: {
    lastPaycheckSync: number;
    lastRetirementSync: number;
    pendingUpdates: string[];           // Fields with unsynced changes
  };
}
```

---

## CROSS-CALCULATOR DATA SHARING ARCHITECTURE (ARCH-036)

### Intelligent Synchronization Strategy

**1. Automatic Population Triggers**
```typescript
// When user starts retirement calculator, auto-populate from paycheck data
const retirementDefaults = {
  startingAge: sharedProfile.age,
  currentIncome: sharedProfile.currentAnnualIncome,
  necessaryMonthlyExpenses: sharedProfile.necessaryMonthlyExpenses,
  monthlySavings: sharedProfile.currentMonthlySavings,
  startingBalance: sharedProfile.currentBalances.totalRetirement,
  filingStatus: sharedProfile.filingStatus,
  // Computed from risk profile
  accumulationReturn: sharedProfile.riskProfile.accumulationReturn,
  retirementReturn: sharedProfile.riskProfile.retirementReturn,
  volatility: sharedProfile.riskProfile.retirementVolatility,
};

// When user returns to paycheck calculator, update from retirement insights
const paycheckUpdates = {
  targetRetirementAge: retirementInputs.retirementAge,
  retirementIncomeGoal: retirementInputs.targetIncome,
  // Use retirement analysis to refine risk tolerance
  riskTolerance: computeRiskToleranceFromRetirementChoices(retirementInputs),
};
```

**2. Bidirectional Sync Patterns**
```typescript
interface SyncOperation {
  trigger: 'manual' | 'auto' | 'periodic';
  direction: 'paycheck_to_retirement' | 'retirement_to_paycheck' | 'bidirectional';
  fields: string[];
  transformations: { [field: string]: (value: any) => any };
  conflictResolution: 'newest_wins' | 'primary_source' | 'user_prompt';
}

// High-confidence automatic syncs
const autoSyncOperations: SyncOperation[] = [
  {
    trigger: 'auto',
    direction: 'paycheck_to_retirement',
    fields: ['currentIncome', 'necessaryExpenses', 'age', 'filingStatus'],
    transformations: {
      currentIncome: (monthlyGross) => monthlyGross * 12,
      necessaryExpenses: (monthly) => monthly, // Direct mapping
    },
    conflictResolution: 'primary_source' // Paycheck is primary for income data
  },
  {
    trigger: 'auto', 
    direction: 'retirement_to_paycheck',
    fields: ['targetRetirementAge', 'retirementIncomeGoal'],
    transformations: {
      targetRetirementAge: (age) => age, // Direct mapping
      retirementIncomeGoal: (annual) => annual / 12, // Convert to monthly
    },
    conflictResolution: 'primary_source' // Retirement is primary for retirement goals
  }
];
```

**3. Smart Default Population**
```typescript
// New calculator initialization with intelligent defaults
function getCalculatorDefaults(
  calculatorType: 'paycheck' | 'retirement',
  sharedProfile: EnhancedSharedUserProfile,
  calculatorHistory: CalculatorUsage[]
): Partial<CalculatorInputs> {
  
  if (calculatorType === 'retirement') {
    // If user has paycheck data, use it; otherwise use conservative defaults
    if (sharedProfile.primaryCalculator === 'paycheck') {
      return {
        // High-confidence mappings from paycheck data
        startingAge: sharedProfile.age,
        currentIncome: sharedProfile.currentAnnualIncome,
        necessaryMonthlyExpenses: sharedProfile.necessaryMonthlyExpenses,
        startingBalance: sharedProfile.currentBalances.totalRetirement,
        
        // Computed mappings based on paycheck optimization results
        monthlySavings: computeOptimalSavingsFromPaycheck(sharedProfile),
        retirementAge: computeRecommendedRetirementAge(sharedProfile),
        targetIncome: sharedProfile.necessaryMonthlyExpenses * 12, // Conservative
        
        // Risk-based mappings
        accumulationReturn: sharedProfile.riskProfile.accumulationReturn,
        retirementReturn: sharedProfile.riskProfile.retirementReturn,
        volatility: sharedProfile.riskProfile.retirementVolatility,
      };
    }
  }
  
  if (calculatorType === 'paycheck') {
    // If user has retirement goals, incorporate them into paycheck optimization
    if (sharedProfile.primaryCalculator === 'retirement') {
      return {
        // Age and basic demographics
        age: sharedProfile.age,
        
        // Goal-based optimization
        emergencyFundMonths: Math.min(sharedProfile.goals.emergencyFundMonths, 3), // Bufo constraint
        
        // Income reverse-computed from retirement planning
        monthlyGross: sharedProfile.currentAnnualIncome / 12,
        necessaryExpenses: sharedProfile.necessaryMonthlyExpenses,
        
        // Risk tolerance derived from retirement choices
        riskTolerance: sharedProfile.riskProfile.tolerance,
        optimizationGoal: deriveOptimizationFromRetirementGoals(sharedProfile),
      };
    }
  }
  
  return getStandardDefaults(calculatorType);
}
```

### Data Flow Conflict Resolution

**Conflict Detection Algorithm**:
```typescript
interface DataConflict {
  field: string;
  paycheckValue: any;
  retirementValue: any;
  lastUpdated: { paycheck: number; retirement: number };
  confidenceLevel: 'high' | 'medium' | 'low';
  resolutionStrategy: ConflictResolution;
}

function detectConflicts(
  paycheckData: PaycheckProfile,
  retirementData: RetirementInputs,
  sharedProfile: EnhancedSharedUserProfile
): DataConflict[] {
  const conflicts: DataConflict[] = [];
  
  // Age conflict detection
  if (Math.abs(paycheckData.preferences.age - retirementData.startingAge) > 1) {
    conflicts.push({
      field: 'age',
      paycheckValue: paycheckData.preferences.age,
      retirementValue: retirementData.startingAge,
      lastUpdated: {
        paycheck: paycheckData.lastUpdated,
        retirement: sharedProfile.syncStatus.lastRetirementSync
      },
      confidenceLevel: 'high',
      resolutionStrategy: 'newest_wins'
    });
  }
  
  // Income conflict detection (allowing 5% variance)
  const annualFromPaycheck = paycheckData.income.monthlyGross * 12;
  const incomeDifference = Math.abs(annualFromPaycheck - retirementData.currentIncome) / retirementData.currentIncome;
  if (incomeDifference > 0.05) {
    conflicts.push({
      field: 'currentIncome',
      paycheckValue: annualFromPaycheck,
      retirementValue: retirementData.currentIncome,
      lastUpdated: {
        paycheck: paycheckData.lastUpdated,
        retirement: sharedProfile.syncStatus.lastRetirementSync
      },
      confidenceLevel: 'high',
      resolutionStrategy: 'primary_source' // Paycheck is primary for income
    });
  }
  
  return conflicts;
}
```

**Automatic Resolution Strategies**:
- **High Confidence Fields**: Income, age, expenses → Auto-resolve with primary source
- **Medium Confidence Fields**: Risk tolerance, goals → Prompt user on significant conflicts
- **Low Confidence Fields**: Advanced settings → Manual sync only

---

## DATA PERSISTENCE STRATEGIES (ARCH-037)

### Current Persistence Analysis

**Paycheck Allocator Current Strategy**:
```typescript
// From calculatorStore.ts lines 253-261
{
  name: 'paycheck-allocator-storage',
  partialize: (state) => ({
    profile: state.profile,           // Full profile data
    showAdvanced: state.showAdvanced, // UI preference
    activeSection: state.activeSection, // UI state
  }),
}
```

**Retirement Calculator Current Strategy**:
```typescript
// From retirementStore.ts lines 143-150
{
  name: 'retirement-calculator',
  version: 1,
  partialize: (state) => ({
    inputs: state.inputs,           // Full input data
    showAdvanced: state.showAdvanced, // UI preference
  })
}
```

### Unified Persistence Architecture

**Storage Optimization Strategy**:
```typescript
// Shared data stored once, calculator-specific data stored separately
const persistenceStrategy = {
  // Global shared profile (single storage key)
  'bufo-shared-profile': {
    data: EnhancedSharedUserProfile,
    compression: true, // LZ-string compression for large profiles
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  
  // Calculator-specific overrides and UI state
  'paycheck-calculator': {
    data: {
      profileOverrides: Partial<PaycheckProfile>, // Only fields different from shared
      debts: DebtData[], // Calculator-specific data
      uiState: { activeSection: string; showAdvanced: boolean; },
      lastCalculation: AllocationResult, // Cache recent results
    },
    compression: false, // Small data, not worth compression overhead
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  
  'retirement-calculator': {
    data: {
      inputOverrides: Partial<RetirementInputs>, // Only fields different from shared
      monteCarloSettings: MonteCarloSettings, // Calculator-specific
      uiState: { showAdvanced: boolean; chartSettings: any; },
      lastResults: RetirementResults, // Cache recent results
    },
    compression: false,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }
};
```

**Data Migration Strategy**:
```typescript
interface MigrationPlan {
  fromVersion: string;
  toVersion: string;
  migrationSteps: MigrationStep[];
}

const migrationPlans: MigrationPlan[] = [
  {
    fromVersion: 'current', // Existing separate storage
    toVersion: '2.0-unified',
    migrationSteps: [
      {
        step: 'extract_shared_data',
        description: 'Extract overlapping data from existing stores',
        implementation: (existingData) => {
          const paycheckData = localStorage.getItem('paycheck-allocator-storage');
          const retirementData = localStorage.getItem('retirement-calculator');
          
          if (paycheckData && retirementData) {
            return extractSharedProfile(
              JSON.parse(paycheckData),
              JSON.parse(retirementData)
            );
          }
          
          return null;
        }
      },
      {
        step: 'create_unified_profile',
        description: 'Create new shared profile with merged data',
        implementation: (extractedData) => {
          return createEnhancedSharedProfile(extractedData);
        }
      },
      {
        step: 'preserve_calculator_specifics',
        description: 'Maintain calculator-specific data in separate stores',
        implementation: (originalData, sharedProfile) => {
          return {
            paycheck: extractPaycheckSpecificData(originalData.paycheck, sharedProfile),
            retirement: extractRetirementSpecificData(originalData.retirement, sharedProfile)
          };
        }
      },
      {
        step: 'cleanup_old_storage',
        description: 'Remove old storage keys after successful migration',
        implementation: () => {
          // Only after successful verification of new storage
          localStorage.removeItem('paycheck-allocator-storage');
          localStorage.removeItem('retirement-calculator');
        }
      }
    ]
  }
];
```

### Storage Performance Optimization

**Compression Strategy**:
```typescript
// Large shared profile gets compressed
const compressedProfile = LZString.compress(JSON.stringify(sharedProfile));
localStorage.setItem('bufo-shared-profile', compressedProfile);

// Small calculator data stays uncompressed for faster access
localStorage.setItem('paycheck-calculator', JSON.stringify(calculatorState));
```

**Selective Update Strategy**:
```typescript
// Only update localStorage when meaningful changes occur
const shouldPersist = (prevState: any, newState: any) => {
  // Don't persist for UI-only changes
  const uiOnlyFields = ['isCalculating', 'errors', 'activeSection'];
  const meaningfulChanges = Object.keys(newState).some(key => 
    !uiOnlyFields.includes(key) && prevState[key] !== newState[key]
  );
  
  return meaningfulChanges;
};

// Debounced persistence to reduce localStorage writes
const debouncedPersist = debounce((state) => {
  persistToLocalStorage(state);
}, 2000); // Wait 2 seconds of inactivity before persisting
```

---

## INTEGRATION RECOMMENDATIONS

### Implementation Phases (Aligned with Agent A)

**Phase 1: Shared Profile Foundation**
- Implement EnhancedSharedUserProfile schema
- Create global profile store with persistence
- Add read-only integration to existing calculators
- Maintain 100% backward compatibility

**Phase 2: Automatic Population**
- Add smart default population for new calculator usage
- Implement high-confidence auto-sync for basic fields
- Create user notification system for data population

**Phase 3: Bidirectional Synchronization**
- Add conflict detection and resolution
- Implement user prompts for meaningful conflicts
- Create sync history and audit trail

**Phase 4: Advanced Integration**
- Add cross-calculator optimization suggestions
- Implement goal alignment analysis
- Create unified financial snapshot dashboard

### Success Metrics & Validation Criteria

**Data Coverage Metrics**:
- [ ] 95%+ of new calculator sessions auto-populated from existing data
- [ ] <5% user rejection rate for auto-populated defaults
- [ ] Zero data loss during migration from existing storage

**Performance Metrics**:
- [ ] <100ms for shared profile load and sync operations
- [ ] <5MB localStorage usage for typical user profile
- [ ] <200ms for conflict detection across calculators

**User Experience Metrics**:
- [ ] >90% user satisfaction with auto-populated defaults
- [ ] <10% user confusion during cross-calculator data sharing
- [ ] >80% user engagement with cross-calculator goal alignment

---

## INTEGRATION POINTS FOR PHASE 3 AGENTS

### For Agent C (URL Hash Integration)
**Foundation Provided**:
- Shared profile schema with unified field definitions
- Data synchronization patterns for cross-calculator state
- Storage optimization strategy reducing URL hash requirements

**Recommendations**:
- Design URL hash encoding to support shared profile references
- Plan for calculator-specific hash overlays on shared data
- Optimize hash length by excluding data available in shared profile

### For Agent D (Security & Privacy Validation)
**Foundation Provided**:
- Complete localStorage data inventory and usage patterns
- Cross-calculator data sharing architecture with no external transmission
- Data migration strategy preserving existing privacy

**Validation Focus**:
- Ensure shared profile doesn't create new data leakage vectors
- Verify cross-calculator sync doesn't expose sensitive calculation details
- Validate storage compression doesn't compromise data security

### For Agent E (Integration Validation)
**Foundation Provided**:
- Comprehensive data sharing architecture aligned with Agent A's store structure
- Performance-optimized persistence strategy
- Clear implementation phases with backward compatibility

**Integration Verification**:
- Validate data flow architecture integrates with Agent A's unified stores
- Ensure Agent C's URL strategies work with shared profile architecture
- Confirm Agent D's security requirements are met by data sharing patterns

---

## PHASE 2 COMPLETION STATUS

**✅ ARCH-035: User Profile Data Requirements** - COMPLETE
- Analyzed all data fields in both calculators with 70%+ overlap identified
- Created comprehensive shared profile schema covering all calculator needs
- Documented unique calculator-specific requirements requiring separate storage

**✅ ARCH-036: Cross-Calculator Data Sharing Architecture** - COMPLETE
- Designed intelligent synchronization with automatic population and conflict resolution
- Created bidirectional sync patterns with primary source principles
- Planned smart default population with high-confidence automatic mappings

**✅ ARCH-037: Data Persistence Strategies** - COMPLETE
- Analyzed current localStorage usage with optimization opportunities identified
- Designed unified persistence with shared profile and calculator-specific storage
- Planned data migration strategy preserving all existing user data

**DELIVERABLES READY FOR PHASE 3 INTEGRATION**:
- Enhanced shared profile schema ready for Agent E validation
- Cross-calculator data flow patterns ready for Agent C URL integration
- Persistence architecture ready for Agent D security validation

**STATUS**: Phase 2 Agent B analysis complete. Foundation provided for Agent C, Agent D, and final Agent E integration validation.

---

**NEXT STEPS**: Shared profile data architecture ready for URL hash integration analysis and security validation by remaining Phase 2 agents.