# BufoIndex Sprint 1: Calculation Accuracy Testing - AI Development Tasklist

## Parallel Execution Strategy
**Execute all Phase 1 tasks simultaneously with 4 specialized agents**

---

## PHASE 1: PARALLEL DISCOVERY & VALIDATION (4 Agents)

### Agent A: Tax Calculation Validation Specialist
**Priority:** CRITICAL | **Agent Type:** tax-validation-agent

#### Tasks:
- **TASK-A1:** Audit existing tax calculation functions
  - Search codebase for tax-related code: `grep -r "tax\|irs\|federal\|state" --include="*.ts" --include="*.js"`
  - Document all current tax calculations and their sources
  - Identify gaps in tax year coverage (focus on 2024)

- **TASK-A2:** Create IRS-verified test cases
  - Implement test: $50,000 single = $6,307 federal tax
  - Implement test: $100,000 married joint = $13,850 federal tax  
  - Implement test: $200,000 single = $45,842 federal tax
  - Add AMT trigger tests and NIIT threshold tests

- **TASK-A3:** State tax validation (all 50 states + DC)
  - Create comprehensive state tax test suite
  - Document authoritative sources for each state
  - Handle edge cases (no income tax states, special deductions)

- **TASK-A4:** Tax calculation documentation
  - Add inline comments citing IRS publications
  - Create `/docs/calculations/tax-sources.md`
  - Link each formula to official IRS/state publications

**Deliverables:**
- Complete tax test files with exact expected values
- Documentation linking formulas to authoritative sources
- Edge case tests for boundary conditions

---

### Agent B: Core Financial Formula Validation Specialist  
**Priority:** CRITICAL | **Agent Type:** formula-validation-agent

#### Tasks:
- **TASK-B1:** Audit existing financial calculations
  - Search for: `grep -r "401k\|compound\|interest\|monte.*carlo\|hsa" --include="*.ts" --include="*.js"`
  - Document current calculation implementations
  - Verify precision handling (cents, rounding rules)

- **TASK-B2:** 401k match calculation validation
  - Test case: 6% of $100k with 50% match = $3,000 employer contribution
  - Verify contribution limits and catch-up contributions
  - Test boundary conditions (exactly at limits)

- **TASK-B3:** Compound interest precision testing
  - Test case: $10,000 at 7% for 10 years = $19,671.51
  - Implement banker's rounding (round-half-even)
  - Verify 4 decimal intermediate, 2 decimal display precision

- **TASK-B4:** Monte Carlo simulation validation
  - Test: 4% withdrawal rate ~95% success over 30 years
  - Performance target: 1000 runs < 500ms, 10000 runs < 2000ms
  - Verify random number generation and statistical accuracy

- **TASK-B5:** HSA triple tax advantage calculation
  - Calculate deduction + growth + withdrawal tax savings
  - Test contribution limits and catch-up contributions
  - Verify against current year HSA limits

**Deliverables:**
- Comprehensive financial formula test suite
- Performance benchmarks for heavy calculations
- Precision handling verification

---

### Agent C: BufoIndex Philosophy Validation Specialist
**Priority:** HIGH | **Agent Type:** philosophy-validation-agent

#### Tasks:
- **TASK-C1:** Audit recommendation logic
  - Search for: `grep -r "emergency\|debt\|fee\|conservative\|recommendation" --include="*.ts" --include="*.js"`
  - Document all recommendation thresholds and logic
  - Identify any conventional wisdom patterns

- **TASK-C2:** Emergency fund validation
  - Verify MAX 3 months recommendation (not 6-12)
  - Ensure opportunity cost calculation is prominent
  - Test threshold boundaries and messaging

- **TASK-C3:** Debt management philosophy validation
  - Verify 7% interest rate as decision point
  - Test debt vs investment recommendations
  - Validate opportunity cost calculations

- **TASK-C4:** Investment priority validation
  - Verify: Max tax-advantaged BEFORE emergency fund
  - Test recommendation logic for various scenarios
  - Ensure contrarian approach is maintained

- **TASK-C5:** Fee tolerance validation
  - Verify <0.1% acceptable threshold
  - Ensure >0.5% flagged as excessive
  - Test fee impact calculations

**Deliverables:**
- Philosophy compliance test suite
- Contrarian recommendation verification
- Opportunity cost calculation validation

---

### Agent D: Test Infrastructure & Edge Cases Specialist
**Priority:** CRITICAL | **Agent Type:** test-infrastructure-agent

#### Tasks:
- **TASK-D1:** Test framework setup
  - Choose Jest vs Vitest for Next.js compatibility
  - Configure test runner and coverage reporting
  - Set up test file structure and naming conventions

- **TASK-D2:** CI/CD integration
  - Configure GitHub Actions for automated testing
  - Set up test coverage reporting
  - Configure performance benchmark tracking

- **TASK-D3:** Edge case test suite development
  - Zero and negative input value tests
  - Maximum value scenarios (JS number limits)
  - Boundary condition tests (exactly at thresholds)
  - NaN and Infinity handling tests

- **TASK-D4:** Performance testing infrastructure
  - Set up performance benchmarking for Monte Carlo
  - Create automated performance regression detection
  - Document performance targets and monitoring

- **TASK-D5:** Test coverage optimization
  - Target 100% coverage for calculation functions
  - Create coverage reports and enforcement
  - Identify untested code paths

**Deliverables:**
- Complete test framework configuration
- CI/CD pipeline for automated testing  
- Comprehensive edge case test suite
- Performance monitoring infrastructure

---

## PHASE 2: SEQUENTIAL INTEGRATION & VALIDATION

### Integration Task Chain (Sequential Dependencies):
1. **Agent D completes** test infrastructure → Signals "TEST_INFRASTRUCTURE_READY"
2. **Agents A, B, C execute** their test suites using the framework
3. **Project Manager validates** all test results and integration
4. **Performance benchmarks** verified against targets
5. **Sprint completion** criteria validated

---

## SUCCESS CRITERIA VALIDATION

### Agent A Success Validation:
- [ ] All IRS test cases pass with exact values
- [ ] All 50 state tax calculations verified with authoritative sources
- [ ] AMT and NIIT thresholds tested with boundary conditions
- [ ] Tax calculation sources documented with inline comments

### Agent B Success Validation:
- [ ] 401k, compound interest, Monte Carlo tests pass benchmarks
- [ ] HSA triple tax advantage validated with current limits
- [ ] Performance targets met (Monte Carlo < 500ms/1000 runs)
- [ ] Precision handling verified (banker's rounding implemented)

### Agent C Success Validation:
- [ ] All contrarian recommendations verified in code
- [ ] Opportunity cost calculations prominent in UI
- [ ] Threshold values match BufoIndex philosophy exactly
- [ ] Zero conventional wisdom recommendations found

### Agent D Success Validation:
- [ ] Test framework configured and operational
- [ ] CI/CD pipeline executing all tests successfully
- [ ] 100% coverage achieved for calculation functions
- [ ] Edge case test suite covers all identified scenarios

---

## AGENT COORDINATION PROTOCOL

### Pre-Work Discovery (All Agents - Parallel Start):
```bash
# Codebase discovery commands for all agents
find . -name "*.ts" -o -name "*.js" | grep -E "(calc|tax|interest|401k|hsa|retirement)"
find . -name "*.test.*" -o -name "*.spec.*"  
grep -r "emergency\|debt\|fee\|conservative" --include="*.ts" --include="*.js"
```

### Communication Files:
Each agent creates: `/docs/agents/agent-communication/sprint-01-[agent-type]-report.md`

### Integration Checkpoints:
1. **Test Infrastructure Ready** (Agent D → All Agents)
2. **Tax Tests Complete** (Agent A → Project Manager)  
3. **Formula Tests Complete** (Agent B → Project Manager)
4. **Philosophy Tests Complete** (Agent C → Project Manager)
5. **Final Integration** (Project Manager validates all work)

---

## PROJECT MANAGER SPAWN COMMANDS

### Parallel Agent Execution:
```bash
# Launch all 4 agents simultaneously
Agent A: "Create comprehensive tax calculation test suite for BufoIndex following exact IRS values and all 50 state requirements"
Agent B: "Validate all core financial formulas (401k, compound interest, Monte Carlo, HSA) with precise benchmarks and performance targets"
Agent C: "Validate BufoIndex contrarian philosophy compliance in all recommendation logic and calculations" 
Agent D: "Set up complete testing infrastructure with 100% coverage, CI/CD integration, and comprehensive edge case testing"
```

### Sprint Gate Validation:
All 4 agents must complete successfully before Sprint 2 begins. Project manager verifies:
- All calculation tests passing with exact values
- Performance benchmarks met (Monte Carlo timing)
- Philosophy compliance verified (contrarian principles)
- Test infrastructure operational (100% coverage)

### Sprint Report Creation:
Upon completion of all agents, project manager creates:
- **`/docs/features/architecture-review/sprints/sprint-01-calculation-accuracy-testing/report.md`** (comprehensive findings)

---

## NOTES FOR AI DEVELOPMENT

**Optimization for Parallel Execution:**
- Tasks A1-A4, B1-B5, C1-C5, D1-D5 can all run simultaneously
- Only Phase 2 integration requires sequential coordination
- Each agent has clearly defined deliverables and success criteria
- Pre-defined communication protocol prevents coordination conflicts

**Critical Dependencies:**
- Agent D must complete infrastructure before others run tests
- All calculation validations must pass before architecture refactoring begins
- Performance benchmarks are non-negotiable gates for sprint completion