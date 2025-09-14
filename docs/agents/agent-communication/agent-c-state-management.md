# Agent C: State Management & Data Flow - Progress Tracking

**Agent Role:** Application State, URL Persistence, & Data Management  
**Session ID:** WG-S04-20250904  
**Priority:** P1 (Can start structure, depends on Agent A types)  
**Estimated Duration:** 2-3 weeks

## CLAIMED FILES (EXCLUSIVE OWNERSHIP)

### Store Enhancement Files
- `lib/store/wealth-goals-slice.ts` - New Redux/Zustand slice for wealth goals
- `lib/store/retirementStore.ts` - EXTEND existing store with wealth goals integration

### Hook Files  
- `lib/hooks/useWealthGoals.ts` - Primary wealth goals state hook
- `lib/hooks/useScenarioCalculations.ts` - Async calculation coordination
- `lib/hooks/useURLPersistence.ts` - URL state synchronization
- `lib/hooks/useLocalStorage.ts` - User preferences storage
- `lib/hooks/useDebouncedCalculations.ts` - Performance optimization

### Service Files
- `lib/services/url-state-encoder.ts` - URL encoding/decoding for state
- `lib/services/local-storage-service.ts` - Preference management service
- `lib/services/calculation-worker-manager.ts` - Web Worker coordination

### Test Files
- `test/wealth-goals/state/` - State management test directory
- Multiple test files with >80% coverage requirement

## TASK ASSIGNMENTS

### [WG-C001] Extend Store Architecture ⏳
**Status:** NOT STARTED  
**Priority:** HIGH - Required by UI components  
**Target Completion:** Week 1

**Deliverables:**
- [ ] Create wealth goals slice with async actions
- [ ] Implement scenario caching and management
- [ ] Add calculation loading and error states
- [ ] Integrate with existing retirement calculator state
- [ ] Maintain existing Zustand patterns

**Integration Points:** Must work with existing retirementStore patterns

### [WG-C002] Build State Management Hooks ⏳
**Status:** NOT STARTED  
**Priority:** HIGH - Core for Agent B  
**Target Completion:** Week 1

**Deliverables:**
- [ ] `useWealthGoals` hook for component integration
- [ ] Async scenario calculation coordination
- [ ] Optimistic updates for better UX
- [ ] Calculation cancellation and retry logic
- [ ] Error handling and recovery

**Performance Target:** <10ms for state updates

### [WG-C003] Implement URL State Persistence ⏳
**Status:** NOT STARTED  
**Priority:** MEDIUM  
**Target Completion:** Week 2

**Deliverables:**
- [ ] Hash-based URL encoding for shareable scenarios
- [ ] Automatic state restoration on page load
- [ ] Deep linking support for specific configurations
- [ ] Compressed state encoding for shorter URLs
- [ ] Backward compatibility with existing URL patterns

**Performance Target:** <100ms state restoration

### [WG-C004] Create Local Storage Integration ⏳
**Status:** NOT STARTED  
**Priority:** LOW  
**Target Completion:** Week 2-3

**Deliverables:**
- [ ] User preference persistence (default wealth goal, etc.)
- [ ] Market assumption caching
- [ ] Recently used scenarios storage
- [ ] Privacy-compliant data handling
- [ ] Storage quota management

**Storage Targets:** <1MB total local storage usage

### [WG-C005] Web Worker Coordination ⏳
**Status:** NOT STARTED  
**Priority:** MEDIUM  
**Target Completion:** Week 2-3

**Deliverables:**
- [ ] Manager for Monte Carlo calculation workers
- [ ] Progress tracking and cancellation support
- [ ] Worker pool management for multiple calculations
- [ ] Error handling for worker failures
- [ ] Fallback to main thread if workers unavailable

**Performance Target:** Coordinate complex calculations without blocking UI

## INTEGRATION POINTS

### Imports from Agent A (Calculation Engine)
```typescript
import { 
  calculateScenarios, 
  optimizeForDieWithZero,
  runMonteCarloSimulation,
  validateInputs 
} from '@/lib/calculations/wealth-goals-engine';

import type {
  WealthGoal,
  RetirementScenario,
  ValidationResult
} from '@/lib/types/wealth-goals';
```

### Exports to Agent B (UI Components)
```typescript
export { useWealthGoals } from './useWealthGoals';
export { useScenarioCalculations } from './useScenarioCalculations';
export { useURLPersistence } from './useURLPersistence';

export type {
  WealthGoalsState,
  WealthGoalsActions,
  CalculationHooks
};
```

### Exports to Agent D (Testing)
```typescript
export { createMockStore } from './test-utils/mockStore';
export { stateTestHelpers } from './test-utils/helpers';
```

## STATE INTERFACE SPECIFICATIONS

### Core State Interface
```typescript
interface WealthGoalsState {
  // Selection state
  selectedWealthGoal: WealthGoal;
  scenarios: RetirementScenario[];
  selectedScenario: string | null;
  
  // Calculation state
  isCalculating: boolean;
  calculationProgress: number;
  calculationError: string | null;
  
  // Derived state
  retirementStatus: RetirementStatus | null;
  lastCalculated: Date | null;
  
  // UI state
  showAdvancedOptions: boolean;
  comparisonScenarios: string[];
}
```

### Action Interface
```typescript
interface WealthGoalsActions {
  // Core actions
  selectWealthGoal: (goal: WealthGoal) => Promise<void>;
  generateScenarios: () => Promise<void>;
  selectScenario: (scenarioId: string) => void;
  
  // Calculation management
  cancelCalculation: () => void;
  retryCalculation: () => Promise<void>;
  
  // URL and storage
  updateURLState: (state: Partial<URLState>) => void;
  savePreferences: (prefs: UserPreferences) => void;
  
  // Comparison features
  addToComparison: (scenarioId: string) => void;
  removeFromComparison: (scenarioId: string) => void;
  clearComparison: () => void;
}
```

### Hook Return Types
```typescript
interface UseWealthGoalsReturn {
  state: WealthGoalsState;
  actions: WealthGoalsActions;
  isLoading: boolean;
  error: string | null;
}

interface UseScenarioCalculationsReturn {
  calculateScenarios: (inputs: RetirementInputs) => Promise<RetirementScenario[]>;
  cancelCalculation: () => void;
  calculationProgress: number;
  isCalculating: boolean;
}
```

## URL STATE ENCODING SPECIFICATION

### URL State Structure
```typescript
interface URLState {
  wealthGoal?: WealthGoal;
  currentAge?: number;
  retirementAge?: number;
  portfolio?: number;
  targetIncome?: number;
  selectedScenario?: string;
  comparison?: string[]; // scenario IDs
}

// Example encoded URL:
// #wg=balanced&age=35&ret=65&port=500000&inc=8000&scn=current-plan
```

### Local Storage Structure  
```typescript
interface UserPreferences {
  defaultWealthGoal: WealthGoal;
  showAdvancedOptions: boolean;
  recentScenarios: string[]; // scenario IDs
  marketAssumptions: {
    expectedReturn: number;
    volatility: number;
    inflationRate: number;
  };
}
```

## QUALITY GATES

### Development Standards
- [ ] TypeScript compilation: 0 errors
- [ ] State management tests: >80% coverage
- [ ] Performance: <10ms state updates, <100ms URL persistence
- [ ] Memory management: No memory leaks in state subscriptions
- [ ] Error handling: Graceful degradation for all failures

### Integration Requirements
- [ ] Seamless integration with existing Zustand store
- [ ] Backward compatibility with existing URL patterns
- [ ] Privacy compliance for local storage
- [ ] Cross-tab synchronization where appropriate

## CURRENT STATUS

**Overall Progress:** 0% (Not Started)  
**Next Action:** Analyze existing retirementStore patterns and design integration  
**Blockers:** Pending Agent A type definitions  
**Quality Gate Status:** Pending implementation

## EXISTING STORE ANALYSIS

### Current Zustand Store Pattern
```typescript
// Existing pattern from retirementStore.ts
interface RetirementState {
  inputs: RetirementInputs;
  results: RetirementResults | null;
  isCalculating: boolean;
}

// Extension strategy: Add wealth goals as new slice
interface ExtendedRetirementState extends RetirementState {
  wealthGoals: WealthGoalsState;
}
```

## MOCK IMPLEMENTATION FOR DEVELOPMENT

```typescript
// Mock hook for Agent B development
export const useWealthGoals = () => ({
  state: {
    selectedWealthGoal: 'balanced' as WealthGoal,
    scenarios: mockScenarios,
    selectedScenario: null,
    isCalculating: false,
    calculationError: null,
    retirementStatus: 'on-track' as RetirementStatus,
  },
  actions: {
    selectWealthGoal: async (goal: WealthGoal) => console.log('Mock:', goal),
    generateScenarios: async () => console.log('Mock: generating scenarios'),
    selectScenario: (id: string) => console.log('Mock: selecting', id),
  },
  isLoading: false,
  error: null
});
```

## DAILY PROGRESS LOG

### Day 1 (Target) - Architecture Planning
- [ ] Analyze existing retirementStore integration points
- [ ] Design wealth goals slice architecture
- [ ] Create basic hook structures
- [ ] Provide mock implementations for Agent B

### Day 2 (Target) - Core Implementation
- [ ] Implement useWealthGoals hook with basic functionality
- [ ] Create state slice with async actions
- [ ] Set up URL persistence framework

**Note:** This file will be updated daily with state management progress and integration status.

---
**Agent Status:** ⏳ READY TO START (with analysis)  
**Dependencies:** Agent A (type definitions and calculations)  
**Next Update:** After store architecture analysis