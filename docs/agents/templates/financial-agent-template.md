# Financial Calculation Agent Success Template

**MANDATORY:** All calculation agents must use this template for task completion validation.

```markdown
## Agent Task: [Task Name] - Financial Calculation
**Agent Type:** Calculation
**Task ID:** [BUFO-XXX]
**Files Modified:** [List all files]

### Pre-Task Quick Health Check ✅
**Streamlined validation - critical blockers only:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` passes
- [ ] All calculation dependencies verified
- [ ] BufoIndex philosophy research completed
- [ ] Opportunity cost framework understood

*Note: Comprehensive testing (full test suite, linting, coverage) enforced at pre-commit automatically.*

### Implementation Validation ✅
- [ ] **Mathematical Accuracy:** All formulas verified against authoritative sources
- [ ] **IRS Compliance:** Tax calculations match current IRS guidelines
- [ ] **Philosophy Alignment:** 3-month emergency fund max, 7% debt threshold enforced
- [ ] **Opportunity Cost Integration:** Every recommendation includes opportunity cost analysis
- [ ] **Edge Cases Handled:** Zero values, negative inputs, boundary conditions tested
- [ ] **Performance Benchmarks:** <50ms basic, <500ms complex, <5000ms Monte Carlo 10k iterations

### Testing Requirements ✅
- [ ] **Unit Tests:** All calculation functions have comprehensive test coverage
- [ ] **Integration Tests:** Calculator integrates properly with UI components
- [ ] **Manual Verification:** At least 5 test cases verified by hand calculation
- [ ] **Performance Tests:** Benchmarks documented and within limits
- [ ] **Edge Case Tests:** Boundary conditions and error states validated

### Documentation Requirements ✅
- [ ] **Calculation Methods:** All formulas documented with sources
- [ ] **Assumptions:** All assumptions explicitly stated
- [ ] **Limitations:** Known limitations and edge cases documented
- [ ] **Usage Examples:** Clear examples of proper usage
- [ ] **Philosophy Notes:** How calculations align with BufoIndex contrarian principles

### Post-Task Quick Validation ✅
**Quick check to ensure no regressions:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` still passes
- [ ] Manual testing of new calculations completed
- [ ] No performance regressions introduced (basic benchmarking)
- [ ] Philosophy compliance maintained
- [ ] Integration with existing components verified

*Note: Full validation (complete test suite, strict performance benchmarks, comprehensive linting) happens automatically at pre-commit.*

### Handoff Requirements ✅
- [ ] **Agent Communication File:** Created in `/agent-communication/`
- [ ] **Feature Backlog Updated:** Status changed, completion date added
- [ ] **Integration Points Documented:** How other agents can use this calculation
- [ ] **Breaking Changes:** Any API changes clearly documented
```