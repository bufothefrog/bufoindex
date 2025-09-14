# Sprint 2: Pattern Consistency & Refactoring - AI Agent Implementation Plan

## Overview
**Priority:** HIGH  
**Agent Types:** pattern-consistency-agent, refactoring-agent, shared-component-agent  
**Execution Mode:** Sequential discovery, then parallel refactoring  
**Focus:** Establish consistent patterns across all tools using paycheck allocator as reference

## Success Criteria
- [ ] Retirement calculator matches paycheck allocator structure exactly
- [ ] Shared component library created and used across tools
- [ ] Visual consistency achieved across all calculators
- [ ] Pattern guide documented for future AI agents

## AI Agent Execution Plan

### Phase 1: Pattern Discovery & Analysis (Sequential)

**Agent A (pattern-auditor-agent):** ARCH-010, ARCH-011, ARCH-012  
**Dependencies:** Must complete before Phase 2 agents can start

#### Agent A: Pattern Audit & Documentation  
**Tasks:** ARCH-010, ARCH-011, ARCH-012
**Agent Prompt:**
```
You are a pattern consistency auditor for BufoIndex. Your task is to establish the paycheck allocator as the gold standard and document all deviations.

REFERENCE IMPLEMENTATION: /app/tools/paycheck-allocator/
This is the gold standard. Document its patterns in detail.

AUDIT REQUIREMENTS:
1. Document paycheck allocator patterns:
   - File structure and organization
   - Component naming conventions (XxxInput, XxxResults, XxxChart)
   - Hook patterns (useXxxCalculation, useXxxState)
   - Pure calculation functions in /lib (no React imports)
   - TypeScript interfaces in types.ts

2. Compare retirement calculator against standard:
   - Identify all structural differences
   - Document naming inconsistencies
   - Find pattern violations
   - Create detailed refactoring plan

3. Create unified pattern guide:
   - Standard directory structure template
   - Component naming rules
   - Hook usage guidelines
   - Import/export patterns

DELIVERABLES:
- Complete pattern documentation from paycheck allocator
- Detailed comparison report with retirement calculator
- Unified pattern guide for all future development
- Refactoring task list with specific file changes needed
```

### Phase 2: Refactoring & Component Creation (Parallel)

**Agent B (retirement-refactorer-agent):** ARCH-013, ARCH-014, ARCH-015, ARCH-016  
**Agent C (shared-component-agent):** ARCH-017, ARCH-018  
**Agent D (integration-agent):** ARCH-019

#### Agent B: Retirement Calculator Refactoring
**Tasks:** ARCH-013, ARCH-014, ARCH-015, ARCH-016
**Dependencies:** Agent A must complete pattern documentation first
**Agent Prompt:**
```
You are a retirement calculator refactoring specialist. Transform the retirement calculator to match paycheck allocator patterns exactly.

REFERENCE STANDARD: Use Agent A's pattern documentation as your guide.

REFACTORING REQUIREMENTS:
1. Directory restructure (ARCH-013):
   - Create /app/tools/retirement-calculator/ structure
   - Move components to /components/ subdirectory
   - Organize hooks in /hooks/ subdirectory  
   - Move calculations to /lib/ (pure functions only)
   - Create /types.ts for interfaces

2. Component refactoring (ARCH-014):
   - Create InputSection.tsx matching paycheck allocator style
   - Build ResultsDisplay.tsx component
   - Implement MonteCarloChart.tsx
   - Update all component interfaces

3. Hook extraction (ARCH-015):
   - Create useRetirementCalc.ts hook
   - Build useMonteCarlo.ts hook
   - Extract state management logic
   - Update hook interfaces to match patterns

4. Pure function extraction (ARCH-016):
   - Move all calculations to /lib/calculations.ts
   - Remove React imports from calculation functions
   - Create comprehensive TypeScript interfaces
   - Update constants.ts with configuration

VALIDATION:
- File structure must match paycheck allocator exactly
- Component naming must follow established patterns
- All calculations must remain functionally identical
- TypeScript interfaces must be complete
```

#### Agent C: Shared Component Library Creation
**Tasks:** ARCH-017, ARCH-018
**Dependencies:** Agent A pattern documentation
**Agent Prompt:**
```
You are a shared component library architect. Create reusable components that enforce visual and functional consistency.

COMPONENT REQUIREMENTS:
1. Create shared calculator components (ARCH-017):
   - MoneyInput.tsx: Consistent currency input with formatting
   - PercentageInput.tsx: Consistent percentage input (0-100 range)
   - TaxBracketDisplay.tsx: Standard tax bracket visualization
   - ResultCard.tsx: Consistent result display format

2. Create CalculatorLayout wrapper (ARCH-018):
   - Standard layout structure for all calculators
   - Responsive design patterns
   - Common navigation elements
   - Shared styling patterns using Tailwind

DESIGN STANDARDS:
- Use sage green (#7FB069) color palette from Tailwind config
- Mobile-first responsive design
- WCAG 2.1 AA accessibility compliance
- Terminal aesthetic for data display
- Consistent spacing and typography

COMPONENT API DESIGN:
- Props interfaces must be explicit and well-documented
- Support all calculator use cases (paycheck, retirement, etc.)
- Error states and validation built-in
- Loading states for heavy calculations

DELIVERABLES:
- Complete shared component library in /components/calculators/shared/
- Storybook or example usage documentation
- TypeScript interfaces for all components
- Accessibility testing completed
```

#### Agent D: Integration & Migration
**Tasks:** ARCH-019
**Dependencies:** Agents B and C must complete their work first
**Agent Prompt:**
```
You are an integration specialist. Update existing calculators to use the new shared components and verify consistency.

INTEGRATION REQUIREMENTS:
1. Update paycheck allocator to use shared components:
   - Replace custom inputs with MoneyInput/PercentageInput
   - Wrap with CalculatorLayout
   - Use shared ResultCard components
   - Test that functionality remains identical

2. Update refactored retirement calculator:
   - Integrate all shared components
   - Apply CalculatorLayout wrapper
   - Test Monte Carlo chart integration
   - Verify responsive design

3. Visual consistency verification:
   - All calculators must look visually similar
   - Color palette consistent across tools
   - Typography and spacing uniform
   - Mobile layouts consistent

4. Functional testing:
   - All calculations must work identically
   - No regression in functionality
   - State management working properly
   - URL hash persistence maintained

VALIDATION CHECKLIST:
- Visual audit passes (screenshot comparison)
- No functional regressions detected
- All shared components used consistently
- TypeScript compiles with no errors
```

### Phase 3: Pattern Guide & Documentation (Sequential)

**Agent E (documentation-agent):** Pattern guide finalization and AI agent prompt creation

#### Agent E: Pattern Documentation & Future Agent Prompts
**Dependencies:** All Phase 2 agents complete
**Agent Prompt:**
```
You are a documentation architect. Create the definitive pattern guide and AI agent prompts for future consistency.

DOCUMENTATION REQUIREMENTS:
1. Finalize unified pattern guide:
   - Incorporate lessons learned from refactoring
   - Document exact file structures to follow
   - List required naming conventions
   - Provide code examples and templates

2. Create AI agent enforcement prompts:
   - Pattern consistency agent prompt (for future sprints)
   - Component creation guidelines
   - Refactoring best practices
   - Quality checklist for reviews

DELIVERABLES:
- /docs/architecture/pattern-guide.md (definitive reference)
- AI agent prompts for pattern enforcement
- Code templates for new calculator creation
- Refactoring playbook for future tools
```

## Agent Coordination Plan

### Pre-Work Discovery (Agent A Only)
```bash
# Agent A starts with comprehensive discovery
find . -path "*/paycheck-allocator/*" -type f | head -20
find . -path "*/retirement*" -type f | head -20
grep -r "component\|hook\|calculation" app/tools/ --include="*.ts" --include="*.tsx"
```

### Agent Communication Protocol
- `/docs/agents/agent-communication/sprint-02-pattern-audit-report.md` (Agent A)
- `/docs/agents/agent-communication/sprint-02-retirement-refactor-report.md` (Agent B)
- `/docs/agents/agent-communication/sprint-02-shared-components-report.md` (Agent C)
- `/docs/agents/agent-communication/sprint-02-integration-report.md` (Agent D)
- `/docs/agents/agent-communication/sprint-02-documentation-report.md` (Agent E)

### Execution Phases
1. **Phase 1:** Agent A completes pattern audit (sequential)
2. **Phase 2:** Agents B, C spawn simultaneously (parallel)
3. **Phase 3:** Agent D waits for B & C completion (sequential)
4. **Phase 4:** Agent E documents final patterns (sequential)

## Project Manager Coordination

### Spawn Commands
```markdown
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

### Success Gate Validation
- All calculators visually consistent (screenshot audit)
- Shared components used across all tools
- File structures match established patterns
- Pattern guide complete for future development
- No functional regressions detected

### Dependencies from Sprint 1
- All calculation tests from Sprint 1 must continue passing
- Performance benchmarks must be maintained
- No changes to calculation logic allowed (only structural refactoring)