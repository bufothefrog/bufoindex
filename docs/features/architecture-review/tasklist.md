# BufoIndex Architecture Review - Task List

## Sprint 1: Calculation Accuracy & Testing (CRITICAL)

### Tax Calculation Validation
- [ ] **ARCH-001**: Create comprehensive tax calculation test suite
  - [ ] Test $50,000 single filer = $6,307 federal tax (2024)
  - [ ] Test $100,000 married joint = $13,850 federal tax (2024)
  - [ ] Test $200,000 single filer = $45,842 federal tax (2024)
  - [ ] Validate all 50 states + DC tax calculations
  - [ ] Test AMT trigger at $609,350 (single), $1,218,700 (joint)
  - [ ] Test NIIT at $200,000 (single), $250,000 (joint)

- [ ] **ARCH-002**: Document tax calculation sources
  - [ ] Link to IRS publications for each formula
  - [ ] Document state tax law sources
  - [ ] Create formula reference documentation

### Core Financial Formula Validation
- [ ] **ARCH-003**: Validate 401k match calculations
  - [ ] Test 6% of $100k with 50% match = $3,000 employer contribution
  - [ ] Test contribution caps and limits
  - [ ] Verify catch-up contribution logic

- [ ] **ARCH-004**: Validate compound interest calculations
  - [ ] Test $10,000 at 7% for 10 years = $19,671.51
  - [ ] Test monthly contribution scenarios
  - [ ] Verify rounding and precision

- [ ] **ARCH-005**: Validate Monte Carlo simulations
  - [ ] Test 4% withdrawal rate = ~95% success over 30 years
  - [ ] Verify market return assumptions
  - [ ] Test edge cases and extreme scenarios

- [ ] **ARCH-006**: Validate HSA triple tax advantage calculations
  - [ ] Show deduction tax savings
  - [ ] Calculate growth tax savings
  - [ ] Demonstrate withdrawal tax savings

### Contrarian Logic Validation
- [ ] **ARCH-007**: Validate BufoIndex philosophy in calculations
  - [ ] Verify emergency fund max 3 months recommendation
  - [ ] Confirm 7% debt threshold logic
  - [ ] Validate investment priority over emergency fund
  - [ ] Check fee tolerance thresholds (<0.1% good, >0.5% flagged)
  - [ ] Ensure conservative portfolio shows opportunity cost

### Testing Infrastructure
- [ ] **ARCH-008**: Set up calculation testing framework
  - [ ] Choose testing library (Jest/Vitest)
  - [ ] Create test structure and patterns
  - [ ] Set up CI/CD test execution
  - [ ] Configure test coverage reporting

- [ ] **ARCH-009**: Create edge case test suite
  - [ ] Test zero and negative values
  - [ ] Test maximum value scenarios
  - [ ] Test boundary conditions
  - [ ] Handle NaN and Infinity cases

---

## Sprint 2: Pattern Consistency & Refactoring (HIGH)

### Pattern Audit
- [ ] **ARCH-010**: Document paycheck allocator patterns
  - [ ] Analyze file structure and organization
  - [ ] Document component naming conventions
  - [ ] Record hook patterns and usage
  - [ ] Identify shared utilities and helpers

- [ ] **ARCH-011**: Audit retirement calculator patterns
  - [ ] Compare against paycheck allocator structure
  - [ ] Identify inconsistencies and conflicts
  - [ ] Document refactoring requirements
  - [ ] Create migration plan

- [ ] **ARCH-012**: Create unified pattern guide
  - [ ] Define standard file structure
  - [ ] Establish naming conventions
  - [ ] Document component patterns
  - [ ] Create hook usage guidelines

### Retirement Calculator Refactoring
- [ ] **ARCH-013**: Restructure retirement calculator directories
  - [ ] Create `/app/tools/retirement-calculator/` structure
  - [ ] Move components to standard locations
  - [ ] Organize hooks and utilities
  - [ ] Update import paths

- [ ] **ARCH-014**: Refactor retirement calculator components
  - [ ] Create InputSection.tsx (matching paycheck allocator)
  - [ ] Build ResultsDisplay.tsx component
  - [ ] Implement MonteCarloChart.tsx
  - [ ] Update component interfaces

- [ ] **ARCH-015**: Refactor retirement calculator hooks
  - [ ] Create useRetirementCalc.ts
  - [ ] Build useMonteCarlo.ts
  - [ ] Extract calculation logic to pure functions
  - [ ] Update hook interfaces

- [ ] **ARCH-016**: Extract pure calculation functions
  - [ ] Move calculations to `/lib/calculations.ts`
  - [ ] Remove React imports from calculations
  - [ ] Create TypeScript interfaces in types.ts
  - [ ] Update constants.ts configuration

### Shared Component Library
- [ ] **ARCH-017**: Create shared calculator components
  - [ ] Build MoneyInput.tsx component
  - [ ] Create PercentageInput.tsx component
  - [ ] Implement TaxBracketDisplay.tsx
  - [ ] Build ResultCard.tsx component

- [ ] **ARCH-018**: Create CalculatorLayout wrapper
  - [ ] Design consistent layout structure
  - [ ] Implement responsive design
  - [ ] Add common navigation elements
  - [ ] Create shared styling patterns

- [ ] **ARCH-019**: Update existing calculators to use shared components
  - [ ] Refactor paycheck allocator components
  - [ ] Update retirement calculator components
  - [ ] Test component consistency
  - [ ] Verify visual consistency

---

## Sprint 3: Type Safety & Data Models (HIGH) - READ-ONLY ANALYSIS

### Unified Data Models
- [ ] **ARCH-020**: Design UnifiedProfile interface
  - [ ] Define core profile structure
  - [ ] Add version field for migrations
  - [ ] Include demographics section
  - [ ] Design income structure

- [ ] **ARCH-021**: Create URL hash profile system
  - [ ] Implement URLProfileManager interface
  - [ ] Build encode() method for URL hash
  - [ ] Create decode() method from URL hash
  - [ ] Add validate() type guard function

- [ ] **ARCH-022**: Design profile data compression
  - [ ] Implement LZString compression
  - [ ] Handle URL length limitations
  - [ ] Create fallback mechanisms
  - [ ] Test compression ratios

### TypeScript Configuration
- [ ] **ARCH-023**: Audit TypeScript configuration
  - [ ] Enable strict mode
  - [ ] Configure noImplicitAny
  - [ ] Enable strictNullChecks
  - [ ] Set noUnusedLocals and noUnusedParameters

- [ ] **ARCH-024**: Eliminate `any` types from codebase
  - [ ] Find all `any` usage
  - [ ] Replace with proper types
  - [ ] Add type guards where needed
  - [ ] Update function signatures

- [ ] **ARCH-025**: Add explicit return types
  - [ ] Add return types to all functions
  - [ ] Create Props interfaces for components
  - [ ] Define State interfaces
  - [ ] Add Config type definitions

### Zod Schema Validation
- [ ] **ARCH-026**: Create Zod validation schemas
  - [ ] Build ProfileSchema with all fields
  - [ ] Add runtime validation for demographics
  - [ ] Create income validation schema
  - [ ] Build comprehensive validation suite

- [ ] **ARCH-027**: Implement schema validation in URL hash system
  - [ ] Validate decoded profile data
  - [ ] Handle validation errors gracefully
  - [ ] Provide user-friendly error messages
  - [ ] Log validation failures for debugging

- [ ] **ARCH-028**: Create migration system for profile versions
  - [ ] Design version migration framework
  - [ ] Handle backwards compatibility
  - [ ] Test migration scenarios
  - [ ] Document migration strategies

---

## Sprint 4: State Management & Data Flow (HIGH) - READ-ONLY ANALYSIS

### URL Hash Profile System
- [ ] **ARCH-029**: Implement ProfileManager class
  - [ ] Create toHash() static method
  - [ ] Build fromHash() static method
  - [ ] Add compression and encoding
  - [ ] Handle malformed data gracefully

- [ ] **ARCH-030**: Test URL hash system security
  - [ ] Verify data is compressed/obscured
  - [ ] Test hash size limitations
  - [ ] Validate against DoS attacks
  - [ ] Ensure no sensitive data exposure

- [ ] **ARCH-031**: Implement URL hash synchronization
  - [ ] Sync profile changes to URL
  - [ ] Handle browser back/forward
  - [ ] Manage URL state updates
  - [ ] Test cross-tab synchronization

### Zustand Store Architecture
- [ ] **ARCH-032**: Design store boundaries
  - [ ] Create useProfileStore
  - [ ] Build useCalculationCache
  - [ ] Implement useUIState
  - [ ] Define clear store responsibilities

- [ ] **ARCH-033**: Implement client-side only stores
  - [ ] Ensure no server persistence
  - [ ] Use memory-only storage
  - [ ] Handle store rehydration from URL
  - [ ] Test store isolation

- [ ] **ARCH-034**: Create store integration patterns
  - [ ] Connect URL hash to stores
  - [ ] Implement store-to-store communication
  - [ ] Handle store cleanup
  - [ ] Test store performance

### Cross-Tool Data Flow
- [ ] **ARCH-035**: Implement profile loading from URL hash
  - [ ] Load profile on app initialization
  - [ ] Handle missing or invalid profiles
  - [ ] Provide default profile values
  - [ ] Test loading edge cases

- [ ] **ARCH-036**: Connect calculations to profile data
  - [ ] Use profile data in calculations
  - [ ] Handle profile updates in real-time
  - [ ] Cache calculation results
  - [ ] Invalidate cache on profile changes

- [ ] **ARCH-037**: Implement profile updates from results
  - [ ] Allow tools to update profile
  - [ ] Sync changes across tools
  - [ ] Handle conflicting updates
  - [ ] Test update propagation

---

## Sprint 5: Performance Optimization (MEDIUM) - READ-ONLY ANALYSIS

### Calculation Performance
- [ ] **ARCH-038**: Implement calculation benchmarking
  - [ ] Set up performance measurement
  - [ ] Create benchmark test suite
  - [ ] Target: Basic calculation <50ms
  - [ ] Target: Complex tax calc <100ms

- [ ] **ARCH-039**: Optimize Monte Carlo performance
  - [ ] Target: 1000 runs <500ms
  - [ ] Target: 10000 runs <2000ms
  - [ ] Implement Web Workers for heavy calculations
  - [ ] Add progress indicators

- [ ] **ARCH-040**: Implement calculation memoization
  - [ ] Cache repeated calculations
  - [ ] Implement smart cache invalidation
  - [ ] Optimize cache size and memory usage
  - [ ] Test cache hit rates

### React Performance
- [ ] **ARCH-041**: Audit React re-renders
  - [ ] Find unnecessary re-renders
  - [ ] Implement React.memo where appropriate
  - [ ] Optimize hook dependencies
  - [ ] Use callback memoization

- [ ] **ARCH-042**: Analyze bundle size
  - [ ] Create bundle analysis reports
  - [ ] Identify large dependencies
  - [ ] Implement code splitting
  - [ ] Add lazy loading for heavy components

- [ ] **ARCH-043**: Implement performance monitoring
  - [ ] Add performance measurement tools
  - [ ] Create performance dashboard
  - [ ] Set up automated performance testing
  - [ ] Monitor regression in CI

---

## Sprint 6: AI Agent System Prompts (HIGH) - READ-ONLY ANALYSIS

### Pattern Consistency Agent
- [ ] **ARCH-044**: Create pattern enforcement prompt
  - [ ] Define paycheck allocator as reference
  - [ ] List required patterns and structures
  - [ ] Specify shared component usage
  - [ ] Document URL hash requirements

### Calculation Accuracy Agent
- [ ] **ARCH-045**: Create calculation validation prompt
  - [ ] Define calculation rules and precision
  - [ ] List required test cases
  - [ ] Document contrarian philosophy validation
  - [ ] Specify formula verification requirements

### TypeScript Enforcement Agent
- [ ] **ARCH-046**: Create TypeScript rules prompt
  - [ ] Prohibit `any` types and `ts-ignore`
  - [ ] Require explicit return types
  - [ ] Define naming conventions
  - [ ] Specify URL hash type requirements

### Security & Privacy Agent
- [ ] **ARCH-047**: Create security validation prompt
  - [ ] Enforce client-side only requirements
  - [ ] Specify URL hash security rules
  - [ ] Define input validation requirements
  - [ ] Document privacy protection measures

---

## Sprint 7: Testing Framework (MEDIUM) - READ-ONLY ANALYSIS

### Test Coverage Setup
- [ ] **ARCH-048**: Configure test coverage requirements
  - [ ] Set financial calculations: 100% coverage
  - [ ] Set utility functions: 90% coverage
  - [ ] Set React components: 80% coverage
  - [ ] Set integration flows: 70% coverage

- [ ] **ARCH-049**: Create test structure templates
  - [ ] Build calculation test templates
  - [ ] Create component test patterns
  - [ ] Design integration test structure
  - [ ] Document testing best practices

### Test Implementation
- [ ] **ARCH-050**: Implement missing tests
  - [ ] Add tests for all financial calculations
  - [ ] Create component unit tests
  - [ ] Build integration test suite
  - [ ] Test URL hash functionality

- [ ] **ARCH-051**: Set up CI/CD testing
  - [ ] Configure test execution in CI
  - [ ] Add test coverage reporting
  - [ ] Set up test failure notifications
  - [ ] Create test performance monitoring

---

## Quick Wins (Can do today)

- [ ] **ARCH-QW-001**: Enable strict TypeScript mode in tsconfig.json
- [ ] **ARCH-QW-002**: Add explicit return types to 5 most-used functions
- [ ] **ARCH-QW-003**: Create simple MoneyInput shared component
- [ ] **ARCH-QW-004**: Add basic performance measurement to one calculation
- [ ] **ARCH-QW-005**: Fix any TypeScript `any` types in current code

## Major Refactoring Items

- [ ] **Retirement calculator complete restructure** (ARCH-013 through ARCH-016)
- [ ] **URL hash profile system implementation** (ARCH-020 through ARCH-031)
- [ ] **Shared component library creation** (ARCH-017 through ARCH-019)
- [ ] **Comprehensive test suite addition** (ARCH-001 through ARCH-009)

---

## Success Criteria

### Sprint 1 Complete When:
- [ ] All tax calculations pass IRS test cases
- [ ] Core financial formulas verified with known results
- [ ] Edge cases handled with proper error messages
- [ ] Test suite covers all calculation functions

### Sprint 2 Complete When:
- [ ] Retirement calculator matches paycheck allocator structure
- [ ] Shared components used across all tools
- [ ] Visual consistency achieved across calculators
- [ ] Pattern guide documented and followed

### Sprint 3 Complete When:
- [ ] Zero `any` types in codebase
- [ ] All functions have explicit return types
- [ ] URL hash system handles all profile data
- [ ] Zod validation catches all edge cases

### Overall Success Metrics:
- [ ] All calculations accurate to test cases (100%)
- [ ] TypeScript coverage >95%
- [ ] Pattern consistency across tools (visual audit passes)
- [ ] Performance targets met for all calculations
- [ ] Security audit passes (no server storage, proper validation)