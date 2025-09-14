# React Component Agent Success Template

**MANDATORY:** All component agents must use this template for task completion validation.

```markdown
## Agent Task: [Task Name] - React Component
**Agent Type:** Component/Frontend
**Task ID:** [BUFO-XXX]
**Files Modified:** [List all files]

### Pre-Task Quick Health Check ✅
**Streamlined validation - critical blockers only:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` passes
- [ ] Component requirements understood
- [ ] Design system patterns reviewed
- [ ] Accessibility standards researched

*Note: Comprehensive testing (full test suite, linting, coverage) enforced at pre-commit automatically.*

### Implementation Validation ✅
- [ ] **TypeScript Compliance:** Zero compilation errors or warnings
- [ ] **Accessibility:** WCAG 2.1 AA compliance verified
- [ ] **Responsive Design:** Mobile, tablet, desktop layouts tested
- [ ] **Performance:** Component renders in <100ms, no unnecessary re-renders
- [ ] **Error Boundaries:** Proper error handling for all edge cases
- [ ] **State Management:** Clean, predictable state updates

### Component Quality Standards ✅
- [ ] **Props Interface:** Well-defined TypeScript interfaces
- [ ] **Default Props:** Sensible defaults for all optional props
- [ ] **Error States:** Loading, error, and empty states handled
- [ ] **User Feedback:** Clear feedback for all user interactions
- [ ] **Keyboard Navigation:** Full keyboard accessibility
- [ ] **Screen Reader Support:** Proper ARIA labels and semantic HTML

### Testing Requirements ✅
- [ ] **Unit Tests:** All component logic tested (80% coverage minimum)
- [ ] **Integration Tests:** Component works with parent/child components
- [ ] **Visual Regression Tests:** Component appearance documented
- [ ] **Accessibility Tests:** Automated accessibility testing passes
- [ ] **User Interaction Tests:** All click, hover, focus states tested
- [ ] **Performance Tests:** Render performance benchmarked

### Post-Task Quick Validation ✅
**Quick check to ensure no regressions:**

- [ ] `source docs/agents/quality-scripts.sh && quick_health_check` still passes
- [ ] Component integrates with existing components
- [ ] No breaking changes to component API
- [ ] Manual testing of component functionality completed
- [ ] Basic accessibility verification completed

*Note: Full validation (complete test suite, strict performance benchmarks, comprehensive linting) happens automatically at pre-commit.*

### Integration Requirements ✅
- [ ] **Component Export:** Properly exported from index files
- [ ] **Documentation:** Usage examples and prop documentation
- [ ] **Storybook Entry:** Component documented in design system
- [ ] **Cross-Component Testing:** Works with other UI components
```