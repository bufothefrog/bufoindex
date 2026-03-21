# Sprint 1: Calculation Accuracy & Testing - Project Manager Coordination Plan

## EVALUATION COMPLETE ✅

### Project State Assessment
**Date:** 2025-08-28  
**Branch:** feature/financial-dashboard  
**Build Status:** ✅ PASSING (with linting warnings - non-blocking)  
**Architecture:** Next.js (recently transformed from Hugo)  

### Key Findings
1. **Calculation Files Identified:** 20 core calculation files in `/lib/calculations/`
2. **Existing Tests:** 178 test files present (legacy coverage unknown)
3. **Tax Calculation State:** Basic marginal tax rate calculations exist, need IRS validation
4. **Core Formulas State:** Complex financial modeling present, needs benchmark validation
5. **Philosophy Integration:** Contrarian principles embedded but needs verification
6. **Test Infrastructure:** Present but may need optimization for Sprint requirements

### CRITICAL ISSUES IDENTIFIED
- **Tax Calculations:** Need exact IRS test case validation (2024 tax year)
- **Precision Handling:** Banker's rounding not verified, money calculations inconsistent
- **Performance:** Monte Carlo simulations need benchmark timing validation
- **Philosophy Compliance:** Need to verify contrarian recommendations vs conventional wisdom
- **Test Coverage:** Unknown coverage percentage for calculation functions

## PARALLELIZATION STRATEGY ✅

### Phase 1: Parallel Discovery & Validation (NOW)
**Execute ALL 4 agents simultaneously - no dependencies**

#### File Ownership Matrix
```
Agent A (Tax): /lib/calculations/optimization.ts (tax functions), new tax test files
Agent B (Formula): /lib/calculations/core.ts, monte-carlo.js, projections.ts, new formula tests  
Agent C (Philosophy): /lib/calculations/analysis.ts, optimization.ts (recommendations), new philosophy tests
Agent D (Infrastructure): test config files, CI/CD setup, edge case test suites
```

#### Pre-defined Contracts
- **Tax Test Format:** Exact IRS values with publication citations
- **Formula Precision:** 4 decimal intermediate, 2 decimal display, banker's rounding
- **Performance Targets:** Monte Carlo <500ms/1000 runs, <2000ms/10000 runs
- **Philosophy Thresholds:** Emergency fund max 3 months, debt threshold 7%, fees <0.1% acceptable

## AGENT SPAWN COMMANDS

### Agent A: Tax Calculation Validation Specialist
**Command:** "Create comprehensive tax calculation test suite for BufoIndex following exact IRS values and all 50 state requirements"

**Assigned Tasks:**
- TASK-A1: Audit existing tax calculation functions  
- TASK-A2: Create IRS-verified test cases (2024 tax year)
- TASK-A3: State tax validation (all 50 states + DC)
- TASK-A4: Tax calculation documentation with citations

**Critical Test Cases:**
- $50,000 single = $6,307 federal tax
- $100,000 married joint = $13,850 federal tax
- $200,000 single = $45,842 federal tax
- AMT triggers and NIIT thresholds

### Agent B: Core Financial Formula Validation Specialist
**Command:** "Validate all core financial formulas (401k, compound interest, Monte Carlo, HSA) with precise benchmarks and performance targets"

**Assigned Tasks:**
- TASK-B1: Audit existing financial calculations
- TASK-B2: 401k match calculation validation
- TASK-B3: Compound interest precision testing  
- TASK-B4: Monte Carlo simulation validation
- TASK-B5: HSA triple tax advantage calculation

**Critical Benchmarks:**
- 401k: 6% of $100k with 50% match = $3,000 employer contribution
- Compound: $10,000 at 7% for 10 years = $19,671.51
- Monte Carlo: 4% withdrawal rate ~95% success over 30 years

### Agent C: BufoIndex Philosophy Validation Specialist  
**Command:** "Validate BufoIndex contrarian philosophy compliance in all recommendation logic and calculations"

**Assigned Tasks:**
- TASK-C1: Audit recommendation logic
- TASK-C2: Emergency fund validation (MAX 3 months)
- TASK-C3: Debt management philosophy validation (7% threshold)
- TASK-C4: Investment priority validation (tax-advantaged first)
- TASK-C5: Fee tolerance validation (<0.1% acceptable)

**Contrarian Validations:**
- Emergency fund MAX 3 months (not 6-12) with opportunity cost shown
- 7% interest rate as debt vs investment decision point
- Max tax-advantaged BEFORE emergency fund completion

### Agent D: Test Infrastructure & Edge Cases Specialist
**Command:** "Set up complete testing infrastructure with 100% coverage, CI/CD integration, and comprehensive edge case testing"

**Assigned Tasks:**
- TASK-D1: Test framework setup (Jest/Vitest)
- TASK-D2: CI/CD integration (GitHub Actions)
- TASK-D3: Edge case test suite development
- TASK-D4: Performance testing infrastructure
- TASK-D5: Test coverage optimization (100% target)

**Infrastructure Requirements:**
- Choose Jest vs Vitest for Next.js compatibility
- 100% coverage for calculation functions
- Performance benchmarking for Monte Carlo
- Edge cases: zero/negative values, JS number limits, NaN/Infinity

## PHASE 2: SEQUENTIAL INTEGRATION CHAIN

**Dependency Order:**
1. Agent D completes test infrastructure → Signals "TEST_INFRASTRUCTURE_READY"
2. Agents A, B, C execute their test suites using the framework
3. Project Manager validates all test results and integration
4. Performance benchmarks verified against targets  
5. Sprint completion criteria validated

## SUCCESS CRITERIA GATES

### Agent A Success Validation:
- [ ] All IRS test cases pass with exact values
- [ ] All 50 state tax calculations verified with authoritative sources
- [ ] AMT and NIIT thresholds tested with boundary conditions
- [ ] Tax calculation sources documented with inline comments

### Agent B Success Validation:
- [ ] 401k, compound interest, Monte Carlo tests pass benchmarks
- [ ] HSA triple tax advantage validated with current limits
- [ ] Performance targets met (Monte Carlo <500ms/1000 runs)
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

## COMMUNICATION PROTOCOL

### Agent Communication Files
Each agent creates: `/docs/agents/agent-communication/sprint-01-[agent-type]-report.md`

### Integration Checkpoints
1. **Test Infrastructure Ready** (Agent D → All Agents)
2. **Tax Tests Complete** (Agent A → Project Manager)
3. **Formula Tests Complete** (Agent B → Project Manager)  
4. **Philosophy Tests Complete** (Agent C → Project Manager)
5. **Final Integration** (Project Manager validates all work)

## PROJECT MANAGER MONITORING

### Progress Tracking
- Monitor agent communication files for updates
- Verify no agent is blocked waiting for dependencies
- Coordinate integration handoffs between Phase 1 and Phase 2
- Validate all success criteria before Sprint completion

### Sprint Gate Validation  
**ALL agents must complete successfully before Sprint 2 begins**

Final verification checklist:
- [ ] All calculation tests passing with exact values
- [ ] Performance benchmarks met (Monte Carlo timing)
- [ ] Philosophy compliance verified (contrarian principles)
- [ ] Test infrastructure operational (100% coverage)
- [ ] No build failures or critical issues
- [ ] Feature backlog updated with completion status

---

**Status:** READY FOR AGENT SPAWN  
**Next Action:** Launch all 4 agents simultaneously for Phase 1 parallel execution