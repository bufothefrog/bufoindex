# Sprint 04: Wealth Goals System - Agent Coordination Plan

**Session ID:** WG-S04-20250904  
**Project Manager:** BufoIndex AI Project Manager  
**Start Time:** 2025-09-04  
**Priority:** HIGH - Core retirement calculator enhancement

## PROJECT STATE ASSESSMENT ✅

### Build Health Verification
- **TypeScript Compilation:** ✅ PASS - No critical errors
- **Test Suite Status:** ✅ PASS - Tests running successfully
- **Existing Calculator:** ✅ OPERATIONAL - Retirement calculator functional
- **Architecture Foundation:** ✅ SOLID - Ready for wealth goals extension

### Current Implementation Analysis
- **Retirement Calculator Files:** 6 core files identified in lib/
- **UI Components:** Complete component structure in app/tools/retirement-calculator/
- **State Management:** Zustand store patterns established
- **Testing Framework:** Vitest configured and operational
- **Performance:** Current baseline established for enhancement

## PARALLEL EXECUTION STRATEGY

### 4 Specialized Agents Working Simultaneously
1. **Agent A:** Core Calculation Engine (TypeScript/algorithms)
2. **Agent B:** UI Components & Visualization (React/charts)  
3. **Agent C:** State Management & Data Flow (Redux/hooks)
4. **Agent D:** Testing & Quality Assurance (Vitest/performance)

### File Ownership Matrix (MANDATORY - NO CONFLICTS ALLOWED)

#### Agent A: Core Calculation Engine (Exclusive)
**Files Claimed:**
- `lib/calculations/wealth-goals-engine.ts` (NEW - main calculation engine)
- `lib/calculations/portfolio-projections.ts` (NEW - projection algorithms)
- `lib/calculations/monte-carlo-simulator.ts` (NEW - success rate simulations)
- `lib/calculations/scenario-optimizer.ts` (NEW - parameter optimization)
- `lib/calculations/validation.ts` (NEW - input validation)
- `lib/types/wealth-goals.ts` (NEW - wealth goal types)
- `lib/types/retirement-scenarios.ts` (NEW - scenario interfaces)

**Integration Points:** Exports calculation APIs to Agents B, C, D

#### Agent B: UI Components & Visualization (Exclusive)  
**Files Claimed:**
- `app/tools/retirement-calculator/components/wealth-goals/` (NEW - directory)
- `app/tools/retirement-calculator/components/wealth-goals/WealthGoalSelector.tsx` (NEW)
- `app/tools/retirement-calculator/components/wealth-goals/ScenarioCard.tsx` (NEW)
- `app/tools/retirement-calculator/components/wealth-goals/ScenarioComparison.tsx` (NEW)
- `app/tools/retirement-calculator/components/wealth-goals/PortfolioProjectionChart.tsx` (NEW)
- `app/tools/retirement-calculator/components/wealth-goals/WithdrawalChart.tsx` (NEW)
- `components/ui/SuccessRateIndicator.tsx` (NEW)
- `components/ui/CurrencyFormatter.tsx` (NEW)

**Integration Points:** Imports from Agent A (types/calculations), Agent C (state hooks)

#### Agent C: State Management & Data Flow (Exclusive)
**Files Claimed:**
- `lib/store/wealth-goals-slice.ts` (NEW - wealth goals state)
- `lib/store/retirementStore.ts` (EXTEND - integrate wealth goals)
- `lib/hooks/useWealthGoals.ts` (NEW - wealth goals hook)
- `lib/hooks/useScenarioCalculations.ts` (NEW - calculation coordination)
- `lib/hooks/useURLPersistence.ts` (NEW - URL state sync)
- `lib/services/url-state-encoder.ts` (NEW - URL encoding/decoding)
- `lib/services/local-storage-service.ts` (NEW - preference management)

**Integration Points:** Imports from Agent A (calculations), exports to Agent B (hooks)

#### Agent D: Testing & Quality Assurance (Exclusive)
**Files Claimed:**
- `test/wealth-goals/` (NEW - wealth goals test directory)
- `test/wealth-goals/calculations.test.ts` (NEW - calculation tests)
- `test/wealth-goals/components.test.tsx` (NEW - UI component tests)
- `test/wealth-goals/integration.test.ts` (NEW - integration tests)
- `test/wealth-goals/performance.test.ts` (NEW - performance benchmarks)
- `test/wealth-goals/e2e.spec.ts` (NEW - end-to-end tests)
- `scripts/wealth-goals-benchmarks.js` (NEW - performance testing)

**Integration Points:** Imports from all agents for comprehensive testing

## INTEGRATION CONTRACTS (MANDATORY)

### Core API Contracts (Agent A → Others)
```typescript
// Primary wealth goal types
export type WealthGoal = 'maximize' | 'balanced' | 'zero';
export type RetirementStatus = 'exceeding' | 'on-track' | 'falling-short';
export type ScenarioType = 'current-plan' | 'early-retirement' | 'ultra-conservative' | 
  'conservative' | 'maximum-lifestyle' | 'reality-check-age' | 'reality-check-income' |
  'reality-check-savings' | 'coast-mode' | 'aggressive-save';

// Wealth goal configuration
interface WealthGoalConfig {
  baseWithdrawalRate: number;
  annualEscalationRate: number;
  conservativeMultiplier: number;
  aggressiveMultiplier: number;
  successThreshold: number;
  targetEndingValue: number;
  chartColor: string;
}

// Main scenario interface
interface RetirementScenario {
  id: string;
  type: ScenarioType;
  wealthGoal: WealthGoal;
  name: string;
  description: string;
  icon: string;
  retirementAge: number;
  monthlyIncome: number;
  successRate: number;
  endingPortfolioValue: number;
  portfolioProjection: YearlyProjection[];
  calculatedAt: Date;
}

// Core calculation API
interface WealthGoalsCalculationAPI {
  calculateScenarios(inputs: RetirementInputs, goal: WealthGoal): Promise<RetirementScenario[]>;
  optimizeForDieWithZero(inputs: RetirementInputs, targetEndingValue: number): OptimizationResult;
  runMonteCarloSimulation(scenario: RetirementScenario, iterations: number): Promise<number>;
  validateInputs(inputs: RetirementInputs): ValidationResult;
}
```

### State Management Contracts (Agent C → Agent B)
```typescript
interface WealthGoalsState {
  selectedWealthGoal: WealthGoal;
  scenarios: RetirementScenario[];
  selectedScenario: string | null;
  isCalculating: boolean;
  calculationError: string | null;
  retirementStatus: RetirementStatus | null;
}

interface WealthGoalsActions {
  selectWealthGoal(goal: WealthGoal): Promise<void>;
  generateScenarios(): Promise<void>;
  selectScenario(scenarioId: string): void;
  updateURLState(state: Partial<URLState>): void;
}
```

### Component Contracts (Agent B → Integration)
```typescript
interface WealthGoalSelectorProps {
  selectedGoal: WealthGoal;
  onGoalChange: (goal: WealthGoal) => void;
  disabled?: boolean;
}

interface ScenarioCardProps {
  scenario: RetirementScenario;
  isSelected?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}

interface PortfolioProjectionChartProps {
  projections: YearlyProjection[];
  wealthGoal: WealthGoal;
  height?: number;
  showRetirementLine?: boolean;
}
```

## PERFORMANCE REQUIREMENTS (NON-NEGOTIABLE)

### Calculation Performance
- **Basic Calculations:** <50ms (maintain current baseline)
- **Scenario Generation:** <500ms (new requirement)
- **Monte Carlo (10K runs):** <5000ms (new requirement)
- **Portfolio Projections:** <100ms (new requirement)

### UI Performance
- **Component Rendering:** <100ms initial render
- **Chart Rendering:** <2000ms for complex visualizations
- **State Updates:** <10ms for responsive interactions
- **Mobile Performance:** 60fps on mid-range devices

### Memory Constraints
- **Additional Memory:** <50MB for wealth goals feature
- **Calculation Cache:** <10MB for scenario caching
- **Chart Data:** <5MB for visualization data

## QUALITY GATES (MANDATORY)

### Development Gates (Each Agent)
- [ ] TypeScript compilation: 0 errors (strict mode)
- [ ] Unit tests: >95% coverage (calculations), >80% (UI components)
- [ ] Performance benchmarks: All targets met
- [ ] Philosophy compliance: BufoIndex contrarian principles maintained
- [ ] Integration compatibility: APIs work seamlessly

### Integration Gates
- [ ] Cross-agent integration verified
- [ ] End-to-end user workflows functional
- [ ] URL persistence working correctly
- [ ] Mobile responsiveness confirmed
- [ ] Accessibility compliance (WCAG 2.1 AA)

### Final Quality Gates
- [ ] All three wealth goals produce mathematically consistent results
- [ ] Scenario generation follows PRD specifications exactly
- [ ] Success rates align with appropriate risk tolerance
- [ ] Portfolio projections match withdrawal philosophy
- [ ] No conventional wisdom language ("6 months emergency fund", etc.)

## MILESTONE CHECKPOINTS

### 25% Checkpoint (Week 2): Foundation
- **Agent A:** Type definitions and basic calculation engine complete
- **Agent B:** Component scaffolding with mocked data ready
- **Agent C:** State management structure established
- **Agent D:** Testing infrastructure set up

### 50% Checkpoint (Week 4): Core Development
- **Agent A:** Portfolio projections and optimization algorithms implemented
- **Agent B:** Interactive UI components functional
- **Agent C:** State management hooks operational
- **Agent D:** Comprehensive test suites created

### 75% Checkpoint (Week 6): Advanced Features
- **Agent A:** Monte Carlo simulations with Web Worker support
- **Agent B:** Chart visualizations and advanced interactions
- **Agent C:** URL persistence and local storage complete
- **Agent D:** Performance benchmarking and integration testing

### 100% Checkpoint (Week 8): Final Validation
- **All Agents:** Cross-agent integration completed
- **Agent D:** End-to-end testing and accessibility validation
- **Project Manager:** Final quality assurance and documentation

## SUCCESS CRITERIA

### Functional Requirements
- [ ] Three wealth goals (maximize/balanced/die-with-zero) fully implemented
- [ ] Scenario generation produces appropriate recommendations for each status
- [ ] Die-with-zero optimization achieves 5-10% portfolio ending value
- [ ] Success rates reflect appropriate risk tolerance for each goal
- [ ] Portfolio projections visually match wealth goal philosophy

### Technical Requirements  
- [ ] Performance targets met across all calculations
- [ ] Test coverage targets achieved (95%/80%/70%)
- [ ] TypeScript strict mode compliance maintained
- [ ] Integration with existing calculator seamless
- [ ] URL persistence enables scenario sharing

### Quality Requirements
- [ ] BufoIndex philosophy consistently applied
- [ ] No conventional wisdom language anywhere
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Mobile-first responsive design
- [ ] Comprehensive error handling and edge cases

## COMMUNICATION PROTOCOL

### Agent Progress Files (MANDATORY)
Each agent must create and update daily:
- `docs/agents/agent-communication/agent-a-calculation-engine.md`
- `docs/agents/agent-communication/agent-b-ui-components.md`
- `docs/agents/agent-communication/agent-c-state-management.md`
- `docs/agents/agent-communication/agent-d-testing-qa.md`

### Progress Update Requirements
Daily updates must include:
- **Completed Tasks:** Specific deliverables finished
- **Current Status:** What's being worked on
- **Integration Readiness:** APIs available for other agents
- **Blockers:** Any issues requiring project manager attention
- **Quality Gate Status:** Test results, performance metrics
- **Next Day Plan:** Specific tasks scheduled

### Integration Checkpoints
- **Weekly sync:** All agents review integration status
- **Conflict resolution:** Project manager addresses any file ownership issues
- **Quality review:** Continuous validation of performance and philosophy compliance

## RISK MITIGATION

### Identified Risks & Mitigation Strategies

1. **Calculation Complexity Risk**
   - **Risk:** Die-with-zero optimization algorithms may be complex
   - **Mitigation:** Agent A provides extensive unit testing and mathematical validation
   - **Fallback:** Conservative assumptions if optimization fails

2. **Performance Risk** 
   - **Risk:** Monte Carlo simulations may be slow
   - **Mitigation:** Web Workers for background processing, progress indicators
   - **Monitoring:** Agent D provides continuous performance benchmarking

3. **Integration Risk**
   - **Risk:** Complex state management across multiple components
   - **Mitigation:** Clear API contracts, early integration testing
   - **Communication:** Daily progress updates and conflict resolution

4. **UI Complexity Risk**
   - **Risk:** Three different wealth goal behaviors may confuse users
   - **Mitigation:** Progressive disclosure, clear explanations, accessibility testing
   - **Validation:** User experience testing in Agent D

## NEXT STEPS

1. **Immediate Actions:**
   - ✅ Create agent communication infrastructure
   - ⏳ Spawn all four agents simultaneously
   - ⏳ Begin parallel development with clear file ownership
   - ⏳ Start daily progress monitoring

2. **Ongoing Coordination:**
   - Monitor integration checkpoints
   - Resolve conflicts and blockers
   - Ensure quality gates are maintained
   - Coordinate milestone achievements

3. **Final Validation:**
   - Test complete user workflows
   - Verify PRD specification compliance
   - Update feature backlog status
   - Create comprehensive completion documentation

---

**Expected Completion:** 8 weeks from start date  
**Success Probability:** HIGH (clear specifications, proven coordination patterns)  
**Next Action:** Spawn Agent A (Core Calculation Engine) immediately