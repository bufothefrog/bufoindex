# Sprint 1: Calculation Accuracy & Testing - AI Agent Implementation Plan

## Overview
**Priority:** CRITICAL  
**Agent Type:** calculation-accuracy-agent  
**Execution Mode:** Parallel where possible, sequential for dependent validations  
**Focus:** Verify all financial calculations are accurate and well-tested before any refactoring

## Success Criteria
- [ ] All tax calculations pass IRS test cases with exact values
- [ ] Core financial formulas verified against known benchmarks
- [ ] Edge cases handled with proper error messages
- [ ] Test suite covers 100% of calculation functions
- [ ] Contrarian BufoIndex philosophy validated in code

## AI Agent Execution Plan

### Phase 1: Discovery & Assessment (Parallel Execution)

**Agent A (tax-validation-agent):** ARCH-001, ARCH-002
**Agent B (formula-validation-agent):** ARCH-003, ARCH-004, ARCH-005, ARCH-006  
**Agent C (philosophy-validation-agent):** ARCH-007
**Agent D (test-infrastructure-agent):** ARCH-008, ARCH-009

#### Agent A: Tax Calculation Validation
**Tasks:** ARCH-001, ARCH-002
**Agent Prompt:**
```
You are a tax calculation validation specialist for BufoIndex. Your task is to create comprehensive test suites and documentation for all tax calculations.

CRITICAL REQUIREMENTS:
- All test cases must use exact IRS values from 2024 tax year
- Test $50,000 single = $6,307 federal tax (verify against IRS pub)
- Test $100,000 married joint = $13,850 federal tax 
- Test $200,000 single = $45,842 federal tax
- Validate AMT triggers and NIIT thresholds
- Test all 50 states + DC (use authoritative state sources)

DELIVERABLES:
1. Complete test files with exact expected values
2. Documentation linking each formula to IRS/state sources
3. Inline code comments citing publications
4. Edge case tests for boundary conditions

VALIDATION METHOD:
- Cross-reference multiple authoritative sources
- Use IRS Publication 15, state revenue dept publications
- Document any discrepancies or assumptions
```

#### Agent B: Core Financial Formula Validation
**Tasks:** ARCH-003, ARCH-004, ARCH-005, ARCH-006
**Agent Prompt:**
```
You are a financial formula validation specialist for BufoIndex. Validate all core financial calculations with known benchmarks.

CRITICAL TEST CASES:
- 401k match: 6% of $100k with 50% match = $3,000 employer contribution
- Compound interest: $10,000 at 7% for 10 years = $19,671.51
- Monte Carlo: 4% withdrawal rate = ~95% success over 30 years
- HSA triple tax: Calculate deduction + growth + withdrawal savings

PRECISION REQUIREMENTS:
- All money calculations in cents (number type)
- Banker's rounding (round-half-even) for currency
- 4 decimal places for intermediate calculations
- 2 decimal places for display

PERFORMANCE TARGETS:
- Monte Carlo 1000 runs < 500ms
- Monte Carlo 10000 runs < 2000ms
```

#### Agent C: Philosophy Validation
**Tasks:** ARCH-007
**Agent Prompt:**
```
You are a BufoIndex philosophy validation specialist. Ensure all recommendation logic follows contrarian financial principles.

CONTRARIAN VALIDATIONS:
- Emergency fund: MAX 3 months (not 6-12) - show opportunity cost
- Debt threshold: 7% interest rate is decision point
- Investment priority: Max tax-advantaged BEFORE emergency fund
- Fee tolerance: <0.1% acceptable, >0.5% flagged as excessive
- Conservative portfolio: Always show opportunity cost vs growth

IMPLEMENTATION:
- Find recommendation logic in existing calculators
- Verify thresholds match BufoIndex philosophy exactly
- Add tests for edge cases around thresholds  
- Ensure opportunity cost calculations are prominent
- Flag any "conventional wisdom" recommendations for removal
```

#### Agent D: Test Infrastructure & Edge Cases
**Tasks:** ARCH-008, ARCH-009  
**Agent Prompt:**
```
You are a testing infrastructure specialist for BufoIndex. Set up comprehensive test framework and edge case coverage.

TESTING REQUIREMENTS:
- Choose Jest/Vitest for Next.js compatibility
- 100% coverage target for calculation functions
- CI/CD integration for automated testing
- Performance benchmarking for heavy calculations

EDGE CASES TO COVER:
- Zero and negative input values
- Maximum value scenarios (JS number limits)
- Boundary conditions (exactly at thresholds)
- NaN and Infinity handling
- Very large numbers (precision limits)

DELIVERABLES:
- Complete test configuration
- Test structure templates
- CI/CD pipeline setup
- Edge case test suite
```

### Phase 2: Validation & Integration (Sequential)

**Dependency Chain:**
1. Agent D completes test infrastructure setup
2. Agents A, B, C run their test suites using the framework
3. Integration validation of all test results
4. Performance benchmark verification
5. Sprint completion verification

### Agent Coordination Plan

#### Pre-Work Discovery (All Agents - Parallel)
```bash
# All agents start with codebase discovery
find . -name "*.ts" -o -name "*.js" | grep -E "(calc|tax|interest|401k|hsa|retirement)"
find . -name "*.test.*" -o -name "*.spec.*"
grep -r "emergency\|debt\|fee\|conservative" --include="*.ts" --include="*.js"
```

#### Agent Communication Protocol
Each agent creates:
- `/docs/agents/agent-communication/sprint-01-[agent-type]-report.md`
- Updates with progress, findings, and blockers
- Documents any calculation discrepancies found

#### Integration Checkpoints
1. **Test Infrastructure Ready:** Agent D signals completion
2. **Tax Tests Complete:** Agent A provides tax calculation verification
3. **Formula Tests Complete:** Agent B provides core formula verification  
4. **Philosophy Tests Complete:** Agent C provides recommendation validation
5. **Final Integration:** Project manager verifies all agents' work

### AI Agent Success Criteria

#### Agent A (Tax Validation) Success:
- [ ] All IRS test cases pass with exact values
- [ ] All 50 state tax calculations verified
- [ ] AMT and NIIT thresholds tested
- [ ] Tax calculation sources documented

#### Agent B (Formula Validation) Success:
- [ ] 401k, compound interest, Monte Carlo tests pass
- [ ] HSA triple tax advantage validated
- [ ] Performance targets met (Monte Carlo timing)
- [ ] Precision handling verified (banker's rounding)

#### Agent C (Philosophy Validation) Success:
- [ ] All contrarian recommendations verified in code
- [ ] Opportunity cost calculations prominent
- [ ] Threshold values match BufoIndex philosophy
- [ ] No conventional wisdom recommendations found

#### Agent D (Test Infrastructure) Success:
- [ ] Test framework configured and working
- [ ] CI/CD pipeline executing tests
- [ ] 100% coverage achieved for calculations
- [ ] Edge case test suite comprehensive

## Project Manager Coordination

### Spawn Commands
```markdown
# Parallel agent spawn (all 4 simultaneously)
Agent A: "Create comprehensive tax calculation test suite for BufoIndex following exact IRS values"
Agent B: "Validate all core financial formulas (401k, compound interest, Monte Carlo, HSA) with precise benchmarks"  
Agent C: "Validate BufoIndex contrarian philosophy in all recommendation logic"
Agent D: "Set up complete testing infrastructure with 100% coverage and CI/CD integration"
```

### Success Gate Validation
All 4 agents must complete successfully before Sprint 2 can begin. Project manager verifies:
- All tests passing
- Performance benchmarks met
- Philosophy compliance verified  
- Test infrastructure operational