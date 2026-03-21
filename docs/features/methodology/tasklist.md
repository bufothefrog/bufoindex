# Calculator Methodology System - Parallel Development Tasklist

## Overview

This tasklist is optimized for **parallel agent development** with clear boundaries, minimal dependencies, and explicit integration contracts. Tasks are designed for simultaneous execution by multiple specialized agents.

## Agent Specialization Recommendations

- **Agent A**: Formula Registry Infrastructure & Build System
- **Agent B**: UI Components & LaTeX Rendering
- **Agent C**: Retirement Calculator Integration & Migration
- **Agent D**: Testing Framework & Validation
- **Agent E**: Navigation & Route Architecture

---

## PHASE 1: CORE INFRASTRUCTURE (Weeks 1-2)
**Parallel Execution Ready** - All tasks can run simultaneously

### AGENT A: Formula Registry System (CRITICAL PATH)
**File Ownership:** `lib/formulas/*`, `lib/methodology/*`

#### TASK A1: Create Formula Registry Infrastructure
- **Priority:** P0 (Blocking others)
- **Effort:** Large (3-4 days)
- **Dependencies:** None
- **Files to Create:**
  - `lib/formulas/types.ts` - TypeScript interfaces
  - `lib/formulas/registry.ts` - Central registry class
  - `lib/formulas/decorators.ts` - Decorator functions
  - `lib/formulas/validator.ts` - Validation utilities

**Acceptance Criteria:**
- [ ] `@formula()` decorator compiles and registers metadata
- [ ] Registry can store and retrieve formula metadata by calculator
- [ ] TypeScript interfaces support all required formula properties
- [ ] Build-time validation functions implemented
- [ ] Zero TypeScript compilation errors

**Integration Contract:**
```typescript
// Export interface for other agents
interface FormulaMetadata {
  name: string;
  category: 'core' | 'intermediate' | 'advanced' | 'assumptions';
  latex: string;
  variables: Record<string, string>;
  description: string;
  example: ExampleData;
  sources: string[];
}

// Export functions for other agents
export const FormulaRegistry: {
  register(name: string, metadata: FormulaMetadata): void;
  getByCalculator(calculator: string): FormulaMetadata[];
  exportForBuild(): SerializedRegistry;
}
```

#### TASK A2: Build-Time Extraction Pipeline
- **Priority:** P0
- **Effort:** Medium (2-3 days)
- **Dependencies:** A1 completed
- **Files to Create:**
  - `lib/methodology/extractor.ts` - Metadata extraction
  - `lib/methodology/generator.ts` - Content generation
  - `scripts/extract-formulas.js` - Build script

**Acceptance Criteria:**
- [ ] Build process extracts formula metadata automatically
- [ ] Static JSON files generated for runtime consumption
- [ ] Next.js webpack integration working
- [ ] Formula validation runs during build
- [ ] Production build completes successfully

---

### AGENT B: UI Components & LaTeX System (INDEPENDENT)
**File Ownership:** `components/methodology/*`, LaTeX dependencies

#### TASK B1: LaTeX Rendering Infrastructure
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** None (independent)
- **Files to Create:**
  - `components/methodology/FormulaDisplay.tsx`
  - `components/methodology/LatexRenderer.tsx`
  - `components/methodology/MathNotation.tsx`

**Acceptance Criteria:**
- [ ] KaTeX dependency installed and configured
- [ ] LaTeX formulas render correctly in browser
- [ ] Support for both inline and block math notation
- [ ] Mobile responsive LaTeX rendering
- [ ] Error handling for invalid LaTeX syntax

**Integration Contract:**
```typescript
// Export props interface for other agents
interface FormulaDisplayProps {
  latex: string;
  variables: Record<string, string>;
  inline?: boolean;
}

export function FormulaDisplay(props: FormulaDisplayProps): JSX.Element;
```

#### TASK B2: Methodology UI Components
- **Priority:** P1
- **Effort:** Large (3-4 days)
- **Dependencies:** B1 completed
- **Files to Create:**
  - `components/methodology/MethodologyLayout.tsx`
  - `components/methodology/FormulaCategory.tsx`
  - `components/methodology/VariableGlossary.tsx`
  - `components/methodology/SourceCitation.tsx`
  - `components/methodology/AssumptionsPanel.tsx`

**Acceptance Criteria:**
- [ ] Complete methodology page layout component
- [ ] Formula categories with collapsible sections
- [ ] Variable definitions with hover/click details
- [ ] Source citations with external links
- [ ] Assumptions panel with expandable content
- [ ] Fully responsive design on mobile/desktop

---

### AGENT C: Interactive Calculators (INDEPENDENT)
**File Ownership:** `components/methodology/MiniCalculator.tsx`, calculator widgets

#### TASK C1: Mini Calculator Infrastructure
- **Priority:** P1
- **Effort:** Large (4-5 days)
- **Dependencies:** None (independent)
- **Files to Create:**
  - `components/methodology/MiniCalculator.tsx`
  - `components/methodology/CalculatorWidget.tsx`
  - `components/methodology/FormulaInput.tsx`
  - `lib/methodology/calculator-engine.ts`

**Acceptance Criteria:**
- [ ] Generic mini-calculator component for any formula
- [ ] Input validation and type conversion
- [ ] Real-time calculation as user types
- [ ] Error handling for invalid inputs
- [ ] Copy-friendly results display
- [ ] Integration with formula metadata system

**Integration Contract:**
```typescript
interface MiniCalculatorProps {
  formula: FormulaMetadata;
  defaultValues?: Record<string, number>;
  onCalculate?: (inputs: Record<string, number>, result: number) => void;
}

export function MiniCalculator(props: MiniCalculatorProps): JSX.Element;
```

---

### AGENT D: Testing Framework (INDEPENDENT)
**File Ownership:** `test/lib/formulas/*`, validation utilities

#### TASK D1: Formula Validation Testing
- **Priority:** P1
- **Effort:** Medium (2-3 days)  
- **Dependencies:** None (can use mock data initially)
- **Files to Create:**
  - `test/lib/formulas/validation.test.ts`
  - `test/lib/formulas/registry.test.ts`
  - `test/lib/formulas/accuracy.test.ts`
  - `test/utils/formula-testing.ts`

**Acceptance Criteria:**
- [ ] Automated validation that examples match implementations
- [ ] Registry functionality completely tested
- [ ] Formula accuracy testing with known values
- [ ] LaTeX syntax validation testing
- [ ] Performance benchmarks for formula operations
- [ ] 100% test coverage for formula system

#### TASK D2: Quality Gate Integration
- **Priority:** P2
- **Effort:** Small (1-2 days)
- **Dependencies:** D1 completed
- **Files to Modify:**
  - `scripts/quality-gates.sh`
  - `.husky/pre-commit`
  - `package.json` (add scripts)

**Acceptance Criteria:**
- [ ] Formula validation runs in pre-commit hooks
- [ ] Build fails if formula examples don't match implementation
- [ ] NPM scripts for formula testing added
- [ ] CI/CD integration for formula validation
- [ ] Quality gate documentation updated

---

### AGENT E: Navigation Architecture (INDEPENDENT)
**File Ownership:** Navigation components, route structure

#### TASK E1: Tab Navigation System
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** None (independent)
- **Files to Create:**
  - `components/calculators/shared/CalculatorTabs.tsx`
  - `components/calculators/shared/TabPanel.tsx`
  - `components/calculators/shared/TabNavigation.tsx`

**Acceptance Criteria:**
- [ ] Generic tab system for all calculators
- [ ] State preservation when switching tabs
- [ ] URL hash integration for tab state
- [ ] Keyboard navigation support
- [ ] Mobile-friendly tab interface
- [ ] TypeScript interfaces for tab configuration

**Integration Contract:**
```typescript
interface TabConfig {
  id: string;
  label: string;
  component: React.ComponentType;
  enabled?: boolean;
}

interface CalculatorTabsProps {
  calculator: string;
  tabs: TabConfig[];
  defaultTab?: string;
}

export function CalculatorTabs(props: CalculatorTabsProps): JSX.Element;
```

#### TASK E2: Dynamic Route Architecture
- **Priority:** P2
- **Effort:** Medium (2-3 days)
- **Dependencies:** E1 completed
- **Files to Create:**
  - `app/tools/[calculator]/methodology/page.tsx`
  - `app/tools/[calculator]/methodology/layout.tsx`
  - `lib/routing/calculator-routes.ts`

**Acceptance Criteria:**
- [ ] Dynamic methodology routes for all calculators
- [ ] Breadcrumb navigation working
- [ ] SEO-friendly URLs and metadata
- [ ] Error handling for invalid calculator names
- [ ] Back navigation preserves calculator state

---

## PHASE 2: RETIREMENT CALCULATOR INTEGRATION (Weeks 3-4)

### AGENT C: Retirement Calculator Migration (CRITICAL PATH)
**File Ownership:** `lib/calculations/retirement.ts`, retirement methodology

#### TASK C2: Retirement Function Decoration
- **Priority:** P0
- **Effort:** Large (4-5 days)
- **Dependencies:** A1, A2 completed
- **Files to Modify:**
  - `lib/calculations/retirement.ts` (10 functions)
  - `lib/calculations/scenarioAnalysis.ts`
  - `lib/calculations/monte-carlo.ts`

**Function Migration Checklist:**
- [ ] `futureValue` - Core compound interest formula
- [ ] `presentValue` - Discount calculation formula  
- [ ] `futureValueOfAnnuity` - Regular contribution growth
- [ ] `calculateRequiredBalance` - 4% rule and withdrawal needs
- [ ] `calculateProjectedBalance` - Total accumulation projection
- [ ] `calculateSafeWithdrawalRate` - Withdrawal sustainability
- [ ] `calculateSocialSecurityBenefit` - SS benefit calculations
- [ ] `calculateHealthcareCosts` - Healthcare cost projections
- [ ] `runMonteCarloSimulation` - Box-Muller and risk analysis
- [ ] `calculateRetirementAnalysis` - Master analysis function

**Per-Function Requirements:**
- [ ] Formula decorator with complete metadata
- [ ] LaTeX notation for mathematical expression
- [ ] Variable definitions with units and descriptions
- [ ] Realistic example calculation
- [ ] Source citations (IRS, academic papers, Fed data)
- [ ] Assumptions and limitations documented

#### TASK C3: Retirement Constants Documentation
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** C2 in progress
- **Files to Modify:**
  - `lib/constants/retirement.ts`

**Constants Requiring Documentation:**
- [ ] Federal tax brackets (2024 IRS Publication 15)
- [ ] Social Security parameters (SSA.gov official rates)
- [ ] Default return rates (Federal Reserve historical data)
- [ ] Inflation assumptions (BLS Consumer Price Index)
- [ ] Healthcare costs (Kaiser Family Foundation data)
- [ ] Monte Carlo parameters (academic simulation standards)

**Acceptance Criteria:**
- [ ] All 85+ constants have source citations
- [ ] Update frequencies documented
- [ ] Last updated dates recorded
- [ ] Authority source links verified as active

---

### AGENT B: Retirement Methodology UI (PARALLEL)
**File Ownership:** Retirement-specific methodology components

#### TASK B3: Retirement Methodology Page
- **Priority:** P1
- **Effort:** Large (3-4 days)
- **Dependencies:** B1, B2 completed; C2 in progress (can use mock data)
- **Files to Create:**
  - `components/methodology/RetirementMethodology.tsx`
  - `components/methodology/MonteCarloExplanation.tsx`
  - `components/methodology/TaxCalculationBreakdown.tsx`

**Content Categories:**
- [ ] **Core Formulas**: Future value, annuities, compound interest
- [ ] **Intermediate Calculations**: Tax brackets, SS benefits, healthcare
- [ ] **Advanced Modeling**: Monte Carlo simulation, risk analysis
- [ ] **Assumptions**: Economic parameters, regulatory constants

**Acceptance Criteria:**
- [ ] All formula categories properly organized
- [ ] Interactive examples for major calculations
- [ ] Mobile responsive layout
- [ ] Cross-references between related formulas
- [ ] Search functionality within methodology

#### TASK B4: Example Calculations Gallery
- **Priority:** P2
- **Effort:** Medium (2-3 days)
- **Dependencies:** B3 in progress
- **Files to Create:**
  - `components/methodology/ExampleGallery.tsx`
  - `components/methodology/ScenarioCalculation.tsx`
  - `data/retirement-examples.json`

**Example Scenarios:**
- [ ] Young professional (25, $50k income, 40-year timeline)
- [ ] Mid-career worker (40, $75k income, 25-year timeline)
- [ ] Late starter (50, $100k income, 15-year timeline)
- [ ] High earner (35, $150k income, 30-year timeline)

---

### AGENT A: Integration & Build System (PARALLEL)
**File Ownership:** Build integration, deployment

#### TASK A3: Production Build Integration
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** A2 completed, C2 in progress
- **Files to Modify:**
  - `next.config.js`
  - `package.json`
  - `scripts/build-methodology.js`

**Acceptance Criteria:**
- [ ] Formula extraction runs during production builds
- [ ] Static JSON files generated correctly
- [ ] Build performance impact <30 seconds
- [ ] Formula validation errors fail build
- [ ] Deployment pipeline working

#### TASK A4: Performance Optimization
- **Priority:** P2
- **Effort:** Medium (2-3 days)
- **Dependencies:** A3 completed
- **Files to Create:**
  - `lib/methodology/cache.ts`
  - `lib/methodology/lazy-loader.ts`

**Optimization Targets:**
- [ ] Formula metadata cached in memory
- [ ] Lazy loading of methodology components
- [ ] Bundle splitting for methodology code
- [ ] Server-side rendering for LaTeX
- [ ] Methodology page loads <2 seconds

---

### AGENT E: Navigation Integration (PARALLEL)
**File Ownership:** Calculator integration, routing

#### TASK E3: Retirement Calculator Tab Integration
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** E1 completed, C2 in progress
- **Files to Modify:**
  - `app/tools/retirement-calculator/components/RetirementCalculator.tsx`
  - `app/tools/retirement-calculator/page.tsx`

**Acceptance Criteria:**
- [ ] Tab navigation integrated in retirement calculator
- [ ] Calculator state preserved when switching tabs
- [ ] Methodology tab loads formula content
- [ ] URL routing works for direct methodology links
- [ ] Mobile tab interface functional

---

## PHASE 3: QUALITY & POLISH (Weeks 5-6)

### AGENT D: Comprehensive Testing (CRITICAL PATH)
**File Ownership:** All testing infrastructure

#### TASK D3: End-to-End Testing Suite
- **Priority:** P0
- **Effort:** Large (3-4 days)
- **Dependencies:** Phase 2 completion
- **Files to Create:**
  - `test/e2e/methodology.spec.ts`
  - `test/components/methodology.test.tsx`
  - `test/integration/formula-accuracy.test.ts`

**Test Coverage Requirements:**
- [ ] All formula examples validate against implementation
- [ ] LaTeX rendering works across browsers
- [ ] Interactive calculators produce correct results
- [ ] Navigation preserves state correctly
- [ ] Mobile interface fully functional
- [ ] Performance benchmarks met

#### TASK D4: Accessibility & Browser Testing
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** D3 in progress
- **Files to Create:**
  - `test/accessibility/methodology-a11y.test.ts`
  - `test/browser/cross-browser.spec.ts`

**Acceptance Criteria:**
- [ ] WCAG 2.1 AA compliance verified
- [ ] Screen reader compatibility tested
- [ ] Keyboard navigation fully functional
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile device testing completed

---

### AGENT B: Design & Polish (PARALLEL)
**File Ownership:** UI polish, design system integration

#### TASK B5: Design System Integration
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** Phase 2 completion
- **Files to Modify:**
  - All methodology components
  - `components/ui/` integration

**Acceptance Criteria:**
- [ ] Consistent styling with BufoIndex design system
- [ ] Dark mode support for methodology pages
- [ ] Proper spacing and typography throughout
- [ ] Loading states for async formula loading
- [ ] Error states with user-friendly messages

#### TASK B6: Mobile Optimization
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** B5 in progress
- **Files to Modify:**
  - All methodology components (responsive design)

**Acceptance Criteria:**
- [ ] Methodology readable on phones (320px+)
- [ ] Tab navigation works with touch
- [ ] LaTeX formulas scale appropriately
- [ ] Interactive calculators usable on mobile
- [ ] Page performance <3s on 3G

---

### AGENT A: Documentation & DevEx (PARALLEL)
**File Ownership:** Developer documentation

#### TASK A5: Developer Documentation
- **Priority:** P2
- **Effort:** Small (1-2 days)
- **Dependencies:** Phase 2 completion
- **Files to Create:**
  - `docs/development/formula-registry.md`
  - `docs/development/methodology-components.md`
  - `docs/development/adding-calculators.md`

**Acceptance Criteria:**
- [ ] Complete guide for adding formula decorators
- [ ] Component usage documentation
- [ ] LaTeX formatting guidelines
- [ ] Testing best practices
- [ ] Troubleshooting guide

---

## PHASE 4: PAYCHECK ALLOCATOR EXPANSION (Weeks 7-8)

### AGENT C: Paycheck Calculator Integration (INDEPENDENT)
**File Ownership:** Paycheck allocator migration

#### TASK C4: Paycheck Function Decoration
- **Priority:** P1
- **Effort:** Large (3-4 days)
- **Dependencies:** Phase 3 completion
- **Files to Modify:**
  - `lib/calculations/core.ts`
  - `lib/calculations/optimization.ts`

**Functions to Migrate:**
- [ ] `calculateOptimalAllocation` - Tax-optimized allocation
- [ ] `paycheckToMonthly` - Frequency conversion formulas
- [ ] `calculateTaxBracketOptimization` - Tax bracket optimization
- [ ] `calculateOpportunityCost` - Investment opportunity cost
- [ ] `calculateCompoundGrowth` - Growth projection formulas

#### TASK C5: Paycheck Methodology Page
- **Priority:** P1
- **Effort:** Medium (2-3 days)
- **Dependencies:** C4 in progress
- **Files to Create:**
  - `components/methodology/PaycheckMethodology.tsx`
  - Components for paycheck-specific formulas

**Acceptance Criteria:**
- [ ] Complete methodology for paycheck allocator
- [ ] Tab integration working
- [ ] Cross-references to retirement formulas
- [ ] Interactive tax bracket calculator

---

### AGENT E: Cross-Calculator Integration (PARALLEL)
**File Ownership:** Cross-calculator features

#### TASK E4: Formula Cross-References
- **Priority:** P2
- **Effort:** Medium (2-3 days)
- **Dependencies:** C4 in progress
- **Files to Create:**
  - `lib/methodology/cross-references.ts`
  - Components for formula relationships

**Acceptance Criteria:**
- [ ] Related formulas linked between calculators
- [ ] Shared constants documented once
- [ ] Navigation between calculator methodologies
- [ ] Unified search across all formulas

---

## INTEGRATION CONTRACTS & BOUNDARIES

### File Ownership Matrix
```
Agent A: Formula Registry Infrastructure
├── lib/formulas/types.ts
├── lib/formulas/registry.ts
├── lib/formulas/decorators.ts
├── lib/methodology/extractor.ts
└── scripts/extract-formulas.js

Agent B: UI Components & Design
├── components/methodology/FormulaDisplay.tsx
├── components/methodology/MethodologyLayout.tsx
├── components/methodology/FormulaCategory.tsx
└── All LaTeX rendering components

Agent C: Calculator Integration
├── lib/calculations/retirement.ts (decorators)
├── lib/calculations/core.ts (decorators)
└── Calculator-specific methodology components

Agent D: Testing & Quality
├── test/lib/formulas/**
├── test/components/methodology/**
└── Quality gate integration

Agent E: Navigation & Routing  
├── components/calculators/shared/CalculatorTabs.tsx
├── app/tools/[calculator]/methodology/page.tsx
└── Routing infrastructure
```

### Integration Dependencies
```
Phase 1: All tasks independent (perfect parallelization)
Phase 2: A1→C2 (decorators need registry)
        E1→E3 (tabs need navigation system)
Phase 3: All previous phases → testing
Phase 4: Independent expansion work
```

### Communication Protocols

**Daily Standups:** Each agent reports:
- Completed tasks from previous day
- Current task in progress
- Integration points needed from other agents
- Blockers requiring coordination

**Integration Points:** Pre-defined contracts ensure agents can develop independently:
- TypeScript interfaces define component props
- Mock data allows UI development without backend completion
- Feature flags enable independent deployment
- Test doubles allow testing without full system

**Conflict Resolution:**
- File ownership prevents merge conflicts
- Integration contracts minimize breaking changes
- Regular integration testing catches issues early
- Clear rollback procedures for each agent's work

---

## SUCCESS METRICS

### Per-Agent Metrics
- **Agent A:** Build system performance, registry API completeness
- **Agent B:** Component reusability, LaTeX rendering accuracy
- **Agent C:** Formula coverage, calculation accuracy
- **Agent D:** Test coverage percentage, bug detection rate
- **Agent E:** Navigation usability, route performance

### Integration Metrics
- **Cross-Agent:** Zero merge conflicts, successful daily builds
- **End-to-End:** Complete user workflows functional
- **Performance:** Page load times, build speeds within targets
- **Quality:** All tests passing, documentation complete

---

## RISK MITIGATION

### Parallel Development Risks
- **Risk:** Integration conflicts between agents
  - *Mitigation:* Clear file ownership, defined contracts
- **Risk:** Inconsistent implementations
  - *Mitigation:* Shared TypeScript interfaces, code reviews
- **Risk:** Delayed dependencies blocking other work
  - *Mitigation:* Mock data, progressive enhancement

### Quality Risks
- **Risk:** Formula accuracy issues
  - *Mitigation:* Agent D validates all formulas independently
- **Risk:** Performance degradation
  - *Mitigation:* Agent A monitors build/runtime performance
- **Risk:** UI inconsistencies
  - *Mitigation:* Agent B owns all visual components

This tasklist enables maximum parallel development while maintaining quality and integration safety through clear boundaries and contracts.