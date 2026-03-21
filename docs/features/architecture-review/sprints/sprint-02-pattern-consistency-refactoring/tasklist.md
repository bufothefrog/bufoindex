# BufoIndex Sprint 2: Pattern Consistency & Refactoring - AI Development Tasklist

## Parallel Execution Strategy
**Sequential Phase 1 → Parallel Phase 2 → Sequential Phase 3-4**

---

## PHASE 1: PATTERN DISCOVERY & ANALYSIS (Sequential - 1 Agent)

### Agent A: Pattern Audit & Documentation Specialist
**Priority:** CRITICAL | **Agent Type:** pattern-auditor-agent

#### Tasks:
- **TASK-A1:** Document paycheck allocator gold standard patterns
  - Analyze `/app/tools/paycheck-allocator/` complete structure
  - Document file organization: components/, hooks/, lib/, types.ts
  - Document naming conventions: XxxInput, XxxResults, XxxChart
  - Document hook patterns: useXxxCalculation, useXxxState
  - Document pure calculation functions in /lib (no React imports)

- **TASK-A2:** Compare retirement calculator against standard
  - Audit current retirement calculator structure
  - Identify all structural differences from paycheck allocator
  - Document naming inconsistencies
  - Create detailed refactoring plan with specific file changes
  - List pattern violations and required corrections

- **TASK-A3:** Create unified pattern guide
  - Standard directory structure template
  - Component naming rules and examples
  - Hook usage guidelines and patterns
  - Import/export patterns and conventions
  - TypeScript interfaces placement (types.ts)

**Deliverables:**
- Complete pattern documentation from paycheck allocator
- Detailed comparison report with retirement calculator
- Unified pattern guide for all future development
- Refactoring task list with specific file changes needed

**Success Criteria:**
- [ ] Paycheck allocator patterns fully documented
- [ ] All deviations in retirement calculator identified
- [ ] Pattern guide created for future consistency
- [ ] Refactoring plan ready for implementation

---

## PHASE 2: REFACTORING & COMPONENT CREATION (Parallel - 3 Agents)

### Agent B: Retirement Calculator Refactoring Specialist
**Priority:** CRITICAL | **Agent Type:** retirement-refactorer-agent

#### Tasks:
- **TASK-B1:** Directory restructure (ARCH-013)
  - Create `/app/tools/retirement-calculator/` structure matching paycheck allocator
  - Move components to `/components/` subdirectory
  - Organize hooks in `/hooks/` subdirectory
  - Move calculations to `/lib/` (pure functions only)
  - Create `/types.ts` for interfaces

- **TASK-B2:** Component refactoring (ARCH-014)
  - Create InputSection.tsx matching paycheck allocator style
  - Build ResultsDisplay.tsx component
  - Implement MonteCarloChart.tsx
  - Update all component interfaces to match patterns

- **TASK-B3:** Hook extraction (ARCH-015)
  - Create useRetirementCalc.ts hook
  - Build useMonteCarlo.ts hook
  - Extract state management logic from components
  - Update hook interfaces to match established patterns

- **TASK-B4:** Pure function extraction (ARCH-016)
  - Move all calculations to `/lib/calculations.ts`
  - Remove React imports from calculation functions
  - Create comprehensive TypeScript interfaces
  - Update constants.ts with configuration values

**Deliverables:**
- Fully restructured retirement calculator matching paycheck allocator exactly
- All calculations remain functionally identical
- Complete TypeScript interfaces
- Pattern compliance verification

---

### Agent C: Shared Component Library Specialist
**Priority:** CRITICAL | **Agent Type:** shared-component-agent

#### Tasks:
- **TASK-C1:** Create shared calculator components (ARCH-017)
  - MoneyInput.tsx: Consistent currency input with formatting
  - PercentageInput.tsx: Consistent percentage input (0-100 range)
  - TaxBracketDisplay.tsx: Standard tax bracket visualization
  - ResultCard.tsx: Consistent result display format

- **TASK-C2:** Create CalculatorLayout wrapper (ARCH-018)
  - Standard layout structure for all calculators
  - Responsive design patterns using Tailwind
  - Common navigation elements
  - Sage green (#7FB069) color palette integration

**Design Standards:**
- Mobile-first responsive design
- WCAG 2.1 AA accessibility compliance
- Terminal aesthetic for data display
- Consistent spacing and typography

**Deliverables:**
- Complete shared component library in `/components/calculators/shared/`
- Component usage documentation
- TypeScript interfaces for all components
- Accessibility testing completed

---

### Agent D: Integration & Migration Specialist
**Priority:** HIGH | **Agent Type:** integration-agent
**Dependencies:** Agents B and C must complete first

#### Tasks:
- **TASK-D1:** Update paycheck allocator integration
  - Replace custom inputs with MoneyInput/PercentageInput
  - Wrap with CalculatorLayout
  - Use shared ResultCard components
  - Test that functionality remains identical

- **TASK-D2:** Update refactored retirement calculator
  - Integrate all shared components
  - Apply CalculatorLayout wrapper
  - Test Monte Carlo chart integration
  - Verify responsive design

- **TASK-D3:** Visual consistency verification
  - All calculators must look visually similar
  - Color palette consistent across tools
  - Typography and spacing uniform
  - Mobile layouts consistent

- **TASK-D4:** Functional testing
  - All calculations must work identically
  - No regression in functionality
  - State management working properly
  - URL hash persistence maintained

**Deliverables:**
- Both calculators using shared components consistently
- Visual audit passing (screenshot comparison)
- No functional regressions detected
- TypeScript compiles with no errors

---

## PHASE 3: PATTERN GUIDE & DOCUMENTATION (Sequential - 1 Agent)

### Agent E: Pattern Documentation & Future Agent Prompts
**Priority:** HIGH | **Agent Type:** documentation-agent
**Dependencies:** All Phase 2 agents complete

#### Tasks:
- **TASK-E1:** Finalize unified pattern guide
  - Incorporate lessons learned from refactoring
  - Document exact file structures to follow
  - List required naming conventions with examples
  - Provide code examples and templates

- **TASK-E2:** Create AI agent enforcement prompts
  - Pattern consistency agent prompt for future sprints
  - Component creation guidelines
  - Refactoring best practices
  - Quality checklist for reviews

- **TASK-E3:** Create comprehensive sprint report
  - Document all discovered architecture issues and solutions
  - Highlight successful patterns that should be emphasized
  - Create recommendations for future development
  - Establish pattern consistency standards for future sprints

**Deliverables:**
- `/docs/architecture/pattern-guide.md` (definitive reference)
- AI agent prompts for pattern enforcement
- Code templates for new calculator creation
- Refactoring playbook for future tools
- **`/docs/features/architecture-review/sprints/sprint-02-pattern-consistency-refactoring/report.md`** (comprehensive findings)

---

## AGENT COORDINATION PROTOCOL

### Pre-Work Discovery (Agent A Only):
```bash
# Agent A starts with comprehensive discovery
find . -path "*/paycheck-allocator/*" -type f | head -20
find . -path "*/retirement*" -type f | head -20
grep -r "component\|hook\|calculation" app/tools/ --include="*.ts" --include="*.tsx"
```

### Communication Files:
- `/docs/agents/agent-communication/sprint-02-pattern-audit-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-02-retirement-refactor-report.md` (Agent B)
- `/docs/agents/agent-communication/sprint-02-shared-components-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-02-integration-report.md` (Agent D)
- `/docs/agents/agent-communication/sprint-02-documentation-report.md` (Agent E)

### Execution Phases:
1. **Phase 1:** Agent A completes pattern audit (sequential)
2. **Phase 2:** Agents B, C spawn simultaneously (parallel)
3. **Phase 3:** Agent D waits for B & C completion (sequential)
4. **Phase 4:** Agent E documents final patterns (sequential)

---

## PROJECT MANAGER SPAWN COMMANDS

### Phase Execution:
```bash
# Phase 1 (Sequential)
Agent A: "Audit paycheck allocator patterns and create comprehensive refactoring plan for retirement calculator"

# Phase 2 (Parallel - after A completes)
Agent B: "Refactor retirement calculator to match paycheck allocator patterns exactly using pattern documentation"
Agent C: "Create shared component library for calculator consistency using established patterns"

# Phase 3 (Sequential - after B & C complete)  
Agent D: "Integrate shared components across all calculators and verify visual/functional consistency"

# Phase 4 (Sequential - after D completes)
Agent E: "Create definitive pattern guide and AI agent prompts for future consistency enforcement"
```

---

## SUCCESS CRITERIA VALIDATION

### Sprint Gate Requirements:
- [ ] All calculators visually consistent (screenshot audit passes)
- [ ] Shared components used across all tools
- [ ] File structures match established patterns exactly
- [ ] Pattern guide complete for future development
- [ ] No functional regressions detected
- [ ] All Sprint 1 calculation tests continue passing
- [ ] Performance benchmarks maintained
- [ ] TypeScript compiles with no errors

### Integration Dependencies:
- Must maintain calculation accuracy from Sprint 1
- No changes to calculation logic allowed (only structural refactoring)
- All existing functionality must be preserved

---

## NOTES FOR AI DEVELOPMENT

**Optimization for Sequential/Parallel Execution:**
- Phase 1 (Agent A) must complete before Phase 2 begins
- Phase 2 (Agents B, C) can run simultaneously with clear file ownership
- Phase 3 (Agent D) requires Phase 2 completion for integration
- Phase 4 (Agent E) documents final outcomes

**Critical Dependencies:**
- Agent A's pattern documentation drives all subsequent work
- Agent B and C work independently on different file sets
- Agent D integrates work from B and C
- Agent E captures lessons learned for future consistency

**File Ownership Matrix:**
- Agent B: `/app/tools/retirement-calculator/` (complete restructure)
- Agent C: `/components/calculators/shared/` (new shared components)
- Agent D: Integration across all calculators (no new files, only updates)
- Agent E: Documentation in `/docs/architecture/` (pattern guide) + sprint report

## SPRINT REPORT REQUIREMENTS

### Report Structure (Agent E):
```markdown
# Sprint 2: Pattern Consistency & Refactoring - Architecture Report

## Executive Summary
- Current state vs desired state analysis
- Key architectural decisions made
- Critical issues discovered and resolved

## Architecture Issues Discovered
- List of inconsistencies found between calculators
- Anti-patterns identified and eliminated
- Technical debt addressed

## Successful Patterns Established
- File structure standards that work well
- Component naming conventions that improve maintainability
- Shared component patterns that enhance consistency
- Hook patterns that promote reusability

## Architecture Standards Established
- Directory structure requirements
- Naming convention standards
- Component composition patterns
- Import/export organization rules

## Recommendations for Future Development
- Pattern enforcement strategies
- Code review checkpoints
- Automated validation approaches
- Developer onboarding improvements

## Quality Metrics
- Before/after consistency measurements
- Refactoring impact analysis
- Developer experience improvements
- Maintainability enhancements
```