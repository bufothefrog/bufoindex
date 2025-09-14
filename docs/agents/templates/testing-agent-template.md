# Testing Agent Success Template

**MANDATORY:** All testing agents must use this template for task completion validation.

```markdown
## Agent Task: [Task Name] - Testing Infrastructure
**Agent Type:** Testing/QA
**Task ID:** [BUFO-XXX]
**Files Modified:** [List all files]

### Pre-Task Quick Health Check ✅
**Streamlined validation - critical blockers only:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` passes
- [ ] Testing requirements clearly understood  
- [ ] Test patterns and utilities reviewed
- [ ] Coverage targets defined

*Note: Comprehensive testing (full test suite, linting, coverage) enforced at pre-commit automatically.*

### Test Infrastructure Validation ✅
- [ ] **Test Configuration:** Testing framework properly configured
- [ ] **Test Utilities:** All custom utilities have valid syntax
- [ ] **Mock Data:** Mock data includes all required fields
- [ ] **Test Patterns:** Consistent testing patterns established
- [ ] **Coverage Tools:** Coverage reporting works correctly
- [ ] **CI Integration:** Tests run properly in CI environment

### Test Quality Standards ✅
- [ ] **Test Completeness:** All critical paths covered
- [ ] **Test Reliability:** Tests are deterministic and not flaky
- [ ] **Test Performance:** Test suite completes in reasonable time
- [ ] **Test Readability:** Tests are clear and well-documented
- [ ] **Test Maintainability:** Tests are easy to update when code changes
- [ ] **Error Messages:** Clear, actionable error messages

### Coverage Requirements ✅
- [ ] **Financial Calculations:** 100% test coverage
- [ ] **React Components:** 80% test coverage minimum
- [ ] **Integration Flows:** 70% test coverage minimum
- [ ] **Edge Cases:** All identified edge cases tested
- [ ] **Error Conditions:** All error paths tested
- [ ] **Performance:** Critical performance paths benchmarked

### Post-Task Quick Validation ✅
**Quick check to ensure no regressions:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` still passes
- [ ] All new tests pass consistently (basic verification)
- [ ] No critical existing tests broken
- [ ] Test documentation updated

*Note: Full validation (complete test suite execution, coverage verification, CI pipeline validation) happens automatically at pre-commit.*

### Quality Assurance Requirements ✅
- [ ] **Test Review:** All tests reviewed for quality
- [ ] **Coverage Analysis:** Coverage gaps identified and addressed
- [ ] **Performance Analysis:** Test performance optimized
- [ ] **Documentation:** Test documentation complete and accurate
```