# Development Task List
## BufoIndex Paycheck Allocator

**Project:** Standalone paycheck allocation calculator  
**Architecture:** Next.js application (direct implementation)  
**Timeline:** 4 weeks (MVP + polish)  
**Status:** Core MVP Complete

---

## Phase 1: Foundation & Core Engine (Week 1)

### BUFO-PA-001: Project Structure Setup
**Priority:** P0 (Blocker)  
**Effort:** Small (4 hours)  
**Status:** COMPLETED
**Completed:** 2025-01-26

**Acceptance Criteria:**
- [x] Create Next.js project structure for calculator
- [x] Set up TypeScript module architecture
- [x] Configure Tailwind CSS + shadcn/ui components
- [x] Create responsive layout with semantic structure
- [x] Set up state management and performance tracking placeholders

**Implementation:**
```
/paycheck-allocator/
├── app/
├── components/
├── lib/
│   ├── calculations/
│   ├── store/
│   ├── types/
│   └── utils/
└── hooks/
```

**Definition of Done:**
- Next.js builds successfully with calculator application
- Application loads at `/` and `/calculator`
- TypeScript modules compile without errors
- Desktop-first responsive design renders correctly

---

### BUFO-PA-002: Core Calculation Engine
**Priority:** P0 (Blocker)  
**Effort:** Large (16 hours)  
**Status:** COMPLETED  
**Completed:** 2025-01-26
**Dependencies:** BUFO-PA-001

**Acceptance Criteria:**
- [x] Implement `calculateOptimalAllocation()` main function
- [x] Build employer match calculation with contribution limits
- [x] Create HSA optimization with tax advantage calculations
- [x] Implement tax bracket optimization algorithm
- [x] Add debt vs investment decision engine
- [x] Build Roth vs Traditional IRA recommendation logic
- [x] Create emergency fund optimization with opportunity cost
- [x] Add account prioritization sequencing

**Core Functions:**
```typescript
calculateOptimalAllocation(profile) → AllocationResult
calculateEmployerMatch(profile, availableAmount) → AllocationItem
calculateHSAOptimal(profile, availableAmount) → AllocationItem  
calculateTaxBracketOptimization(profile, availableAmount) → AllocationItem
calculateDebtStrategy(profile) → Array<SkippedItem>
calculateEmergencyFundOptimization(profile) → SkippedItem
```

**Test Cases:**
- High earner with all benefits available ✓
- Entry level with debt optimization needed ✓
- Self-employed with variable income ✓
- Conservative user with large emergency fund ✓

**Definition of Done:**
- All calculation functions return correct results for test scenarios ✓
- Tax calculations accurate for 2024 tax brackets ✓
- Opportunity cost calculations mathematically sound ✓
- Performance <50ms for typical inputs ✓
- Functions are pure (no side effects) for migration readiness ✓

---

### BUFO-PA-003: Tax Calculation Engine
**Priority:** P0 (Blocker)  
**Effort:** Medium (8 hours)  
**Status:** COMPLETED  
**Completed:** 2025-01-26
**Dependencies:** BUFO-PA-002

**Acceptance Criteria:**
- [x] Implement 2024 federal tax bracket calculations
- [x] Add state tax calculations for major states
- [x] Calculate FICA tax savings for HSA contributions
- [x] Implement marginal vs effective tax rate calculations
- [x] Add tax bracket optimization detection
- [x] Create Roth vs Traditional decision logic based on brackets

**Tax Data:**
```javascript
const TAX_BRACKETS_2024 = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    // ... complete bracket structure
  ],
  marriedJoint: [...],
  marriedSeparate: [...],
  headOfHousehold: [...]
};

const STATE_TAX_RATES = {
  CA: { rate: 0.093, brackets: [...] },
  TX: { rate: 0, brackets: [] },
  // ... major states
};
```

**Definition of Done:**
- Tax calculations match IRS publication results
- State tax integration works for 10+ major states
- Marginal rate calculations accurate within $1
- Tax bracket optimization recommendations correct
- Code structured for easy 2025 tax year updates

---

### BUFO-PA-004: Data Models & Validation
**Priority:** P1 (Important)  
**Effort:** Medium (6 hours)  
**Status:** COMPLETED
**Completed:** 2025-01-26
**Dependencies:** BUFO-PA-002

**Acceptance Criteria:**
- [x] Define complete `PaycheckProfile` data structure
- [x] Create `AllocationResult` output structure
- [x] Implement input validation with user-friendly errors
- [x] Add data sanitization and boundary checks
- [x] Create TypeScript interfaces (better than JSDoc)
- [x] Build profile completeness scoring

**Data Structures:**
```javascript
/**
 * @typedef {Object} PaycheckProfile
 * @property {IncomeData} income
 * @property {TaxData} taxes  
 * @property {BenefitsData} benefits
 * @property {Array<DebtData>} debts
 * @property {PreferencesData} preferences
 */
```

**Validation Rules:**
- Income: $500-$50,000/month reasonable range
- Tax brackets: Must match federal brackets
- Contribution percentages: 0-100% with limits
- Debt rates: 0-50% (catch input errors)
- Emergency fund: 0-24 months maximum

**Definition of Done:**
- All inputs validated with clear error messages
- Data structure supports all calculation needs
- JSDoc annotations complete for TypeScript migration
- Validation catches edge cases and user errors
- Profile completeness scoring works (0-100%)

---

## Phase 2: User Interface & Interactions (Week 2)

### BUFO-PA-005: Desktop-First Input Interface
**Priority:** P0 (Blocker)  
**Effort:** Large (12 hours)  
**Status:** COMPLETED
**Completed:** 2025-01-26
**Dependencies:** BUFO-PA-001, BUFO-PA-004

**Acceptance Criteria:**
- [x] Create progressive input form (basic → advanced)
- [x] Build desktop-optimized sliders and inputs with mobile compatibility
- [x] Implement real-time input validation
- [x] Add input formatters (currency, percentage)
- [x] Create responsive dropdown selections
- [x] Build comprehensive input flow
- [x] Add input persistence (localStorage via Zustand)

**Input Components:**
```html
<!-- Income Section -->
<section class="calculator-card">
  <h3>Monthly Income</h3>
  <input type="number" class="mobile-input" id="gross-income" placeholder="$5,000">
  <input type="number" class="mobile-input" id="net-income" placeholder="$3,800">
</section>

<!-- Tax Section -->
<section class="calculator-card">
  <h3>Tax Situation</h3>
  <select class="mobile-input" id="tax-bracket">
    <option value="0.12">12% bracket</option>
    <option value="0.22">22% bracket</option>
  </select>
  <select class="mobile-input" id="state">
    <option value="CA">California</option>
    <option value="TX">Texas</option>
  </select>
</section>
```

**Mobile Optimizations:**
- Large touch targets (44px minimum)
- Thumb-friendly slider positioning
- Autocomplete and input hints
- Keyboard-appropriate input types
- Scroll-locked form sections

**Definition of Done:**
- Forms work perfectly on iOS/Android
- Input validation shows immediately
- Progressive enhancement works without JS
- All inputs persist between sessions
- 30-second quick start flow functional

---

### BUFO-PA-006: Results Display & Priority List
**Priority:** P0 (Blocker)  
**Effort:** Large (10 hours)  
**Status:** COMPLETED
**Completed:** 2025-08-26
**Dependencies:** BUFO-PA-005, BUFO-PA-002

**Acceptance Criteria:**
- [x] Create clear priority allocation list
- [x] Build contrarian advice "skipped items" section
- [x] Implement progressive disclosure for explanations
- [x] Add annual impact projections
- [x] Create optimization score display
- [x] Build sharing functionality (URL hash) - COMPLETED
- [x] Add "what if" scenario adjustments - COMPLETED

**Implementation Notes (2025-08-26):**
- **URL Hash Sharing**: Implemented complete state compression and sharing via URL hash. Users can generate shareable links that restore calculator state including income, expenses, benefits, and preferences. Includes fallback modal for manual copy when clipboard API unavailable.
- **What-If Scenario Analysis**: Added expandable component allowing users to adjust key parameters (income, expenses, emergency fund, employer match) and see real-time impact on allocation recommendations without losing original data. Changes only apply when user clicks "Apply & Recalculate".

**Results Layout:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR $3,200 ALLOCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 401k Match: $320
   [Show Math] [Why This First?]

✅ HSA Max: $692  
   [Triple Tax Advantage Details]
   
💡 Extra 401k: $800
   [Tax Bracket Optimization]

🚫 SKIP Emergency Fund
   Opportunity cost: $45,000 over 10 years
   [Challenge Conventional Wisdom]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTIMIZATION SCORE: 87/100
Annual Impact: +$127,000 in 10 years
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Progressive Disclosure:**
- Level 1: Simple priority list
- Level 2: Basic reasoning
- Level 3: Detailed math and alternatives
- Level 4: Advanced strategies and education

**Definition of Done:**
- Priority list displays correctly on all devices
- "Show math" expansions work smoothly
- Contrarian advice clearly explained
- URL sharing encodes complete state
- Annual projections mathematically accurate

---

### BUFO-PA-007: State Management & Persistence
**Priority:** P1 (Important)  
**Effort:** Medium (6 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-005

**Acceptance Criteria:**
- [ ] Implement URL hash state encoding/decoding
- [ ] Add localStorage persistence with expiration
- [ ] Create state validation and migration
- [ ] Build sharing URL generation
- [ ] Add state reset and clear functionality
- [ ] Implement session restoration

**State Management:**
```javascript
class PaycheckStateManager {
  static save(profile) // Save to localStorage
  static load() // Load from localStorage or URL
  static share(profile) // Generate sharing URL
  static restore() // Restore from session
  static clear() // Reset to defaults
  static migrate(oldState) // Handle schema changes
}
```

**URL Encoding:**
```
# Example sharing URL
/tools/paycheck-allocator#eyJpbmNvbWUiOnsibmV0Ijo...
```

**Definition of Done:**
- URL state sharing works across devices
- localStorage persists data for 30 days
- State restoration works on page reload
- Sharing URLs are reasonably short (<200 chars)
- Migration handles schema changes gracefully

---

## Phase 3: Advanced Features & Polish (Week 3)

### BUFO-PA-008: Contrarian Advice Engine
**Priority:** P1 (Important)  
**Effort:** Medium (8 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-002, BUFO-PA-006

**Acceptance Criteria:**
- [ ] Detect excessive emergency fund situations
- [ ] Identify suboptimal debt payoff strategies
- [ ] Calculate opportunity costs for common mistakes
- [ ] Provide alternative strategies with risk assessment
- [ ] Create educational content for contrarian advice
- [ ] Add user override options with acknowledged risks

**Contrarian Patterns:**
```javascript
const CONTRARIAN_PATTERNS = {
  excessiveEmergencyFund: {
    threshold: 6, // months
    opportunityCostYears: 10,
    message: "Emergency funds beyond 6 months typically cost $X in growth"
  },
  
  extraMortgagePayments: {
    threshold: 0.05, // 5% rate threshold
    alternativeReturn: 0.07,
    message: "X% mortgage vs Y% investment return costs $Z over 20 years"
  },
  
  noEmployerMatch: {
    priority: 'critical',
    message: "Missing employer match = turning down 100% return"
  }
};
```

**User Education:**
- "Why This Matters" explanations
- Risk assessment for each strategy
- Conventional vs optimized comparisons
- Links to supporting BufoIndex articles

**Definition of Done:**
- Detects all major suboptimal patterns
- Opportunity cost calculations accurate
- Educational content clear and persuasive
- Users can override with informed consent
- Risk levels appropriately communicated

---

### BUFO-PA-009: Performance Optimization & Analytics
**Priority:** P1 (Important)  
**Effort:** Medium (6 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-007

**Acceptance Criteria:**
- [ ] Implement calculation memoization
- [ ] Add loading states and progressive enhancement
- [ ] Optimize mobile performance (sub-2s load)
- [ ] Add privacy-focused analytics tracking
- [ ] Implement error tracking and reporting
- [ ] Create performance monitoring

**Performance Targets:**
- First Contentful Paint: <1.2s
- Largest Contentful Paint: <2.0s  
- First Input Delay: <100ms
- Calculation Time: <50ms
- Bundle Size: <100KB gzipped

**Analytics Events:**
```javascript
const ANALYTICS_EVENTS = {
  'input_started': 'User begins entering data',
  'calculation_completed': 'Results displayed',
  'education_engaged': 'User expands explanations', 
  'contrarian_accepted': 'User accepts non-traditional advice',
  'sharing_attempted': 'User shares results',
  'implementation_intended': 'User indicates will implement'
};
```

**Definition of Done:**
- Page loads under 2 seconds on 3G
- Calculations complete under 50ms
- Analytics track user engagement (no PII)
- Error rates under 0.1% of calculations
- Performance monitoring dashboard functional

---

### BUFO-PA-010: Educational Integration & Polish
**Priority:** P2 (Nice to Have)  
**Effort:** Medium (8 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-008

**Acceptance Criteria:**
- [ ] Create comprehensive "show math" explanations
- [ ] Add links to related BufoIndex articles
- [ ] Build tooltip help system
- [ ] Create example scenarios and case studies
- [ ] Add accessibility improvements (WCAG 2.1 AA)
- [ ] Implement micro-interactions and animations

**Educational Content:**
```
Topics to explain:
- HSA triple tax advantage
- Tax bracket optimization
- Emergency fund alternatives
- Debt vs investment mathematics
- Employer match importance
- Roth vs Traditional decisions
```

**Accessibility:**
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management
- ARIA labels and descriptions

**Definition of Done:**
- All major concepts clearly explained
- Accessibility audit passes WCAG 2.1 AA
- Educational content links to relevant articles
- Micro-interactions enhance UX without distraction
- Help system works on mobile and desktop

---

## Phase 4: Testing & Migration Preparation (Week 4)

### BUFO-PA-011: Comprehensive Testing Suite
**Priority:** P1 (Important)  
**Effort:** Large (12 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-010

**Acceptance Criteria:**
- [ ] Create unit tests for all calculation functions
- [ ] Build integration tests for user workflows
- [ ] Add visual regression tests for UI components
- [ ] Test mobile responsiveness across devices
- [ ] Validate accessibility compliance
- [ ] Performance test with various input scenarios

**Test Scenarios:**
```javascript
// Calculation accuracy tests
testEmployerMatchCalculation()
testHSAOptimization()  
testTaxBracketOptimization()
testDebtVsInvestmentDecisions()
testEmergencyFundOptimization()

// User workflow tests  
testBasicInputToResults()
testProgressiveDisclosureFlow()
testStateManagementAndSharing()
testContrarian AdviceAcceptance()
testMobileUserExperience()

// Edge case tests
testExtremeIncomeValues()
testUnusualTaxSituations() 
testComplexDebtScenarios()
testZeroEmployerBenefits()
```

**Testing Tools:**
- Jest for unit/integration tests
- Puppeteer for E2E testing
- axe-core for accessibility testing
- Lighthouse for performance testing

**Definition of Done:**
- 95%+ test coverage on calculation functions
- All user workflows tested and passing
- Accessibility compliance verified
- Performance targets met across test devices
- Visual regression tests catch UI changes

---

### BUFO-PA-012: Next.js Migration Documentation
**Priority:** P2 (Future Planning)  
**Effort:** Medium (6 hours)  
**Status:** NOT STARTED  
**Dependencies:** BUFO-PA-011

**Acceptance Criteria:**
- [ ] Document component conversion strategy
- [ ] Create TypeScript interface definitions
- [ ] Plan state management migration (Zustand)
- [ ] Design component library integration approach
- [ ] Map current functions to React hooks
- [ ] Create migration checklist and timeline

**Migration Documentation:**
```typescript
// Component mapping
HTMLTemplateToReactComponent.map
JavaScriptToReactHooks.map
StateManagementMigration.plan
ComponentLibraryIntegration.strategy
TypeScriptConversion.guide

// New structures
interface PaycheckProfile {...}
interface AllocationResult {...}
const usePaycheckCalculation = () => {...}
const useAllocationState = () => {...}
```

**Migration Artifacts:**
- Complete TypeScript definitions
- React component architecture plan
- State management migration guide
- Component library integration strategy
- Performance optimization plan

**Definition of Done:**
- All current functionality mapped to Next.js equivalent
- TypeScript definitions complete and accurate
- Migration timeline documented with dependencies
- Component library strategy selected and documented
- Performance improvements identified for Next.js version

---

## Quality Assurance Checklist

### Pre-Launch Validation
- [ ] **Calculation Accuracy**: All mathematical results validated against manual calculations
- [ ] **Mobile Performance**: Sub-2-second load time on 3G networks
- [ ] **Cross-Browser Testing**: Works on Chrome, Firefox, Safari, Edge
- [ ] **Accessibility Compliance**: WCAG 2.1 AA standards met
- [ ] **User Experience**: Intuitive flow from input to results to implementation
- [ ] **Educational Value**: Contrarian advice clearly explained with supporting math
- [ ] **Error Handling**: Graceful degradation for invalid inputs or calculation errors
- [ ] **State Management**: Sharing and persistence work reliably
- [ ] **Integration**: Links properly to other BufoIndex tools and articles
- [ ] **Analytics**: Privacy-focused tracking implemented and tested

### Migration Readiness
- [ ] **Pure Functions**: All calculations separated from UI concerns
- [ ] **TypeScript Ready**: JSDoc annotations complete and accurate
- [ ] **Component Boundaries**: Clear separation of concerns for React conversion
- [ ] **State Patterns**: Data flow patterns compatible with React hooks
- [ ] **Performance Baseline**: Current performance metrics documented
- [ ] **Migration Guide**: Step-by-step conversion plan documented

---

## Success Metrics

### User Experience Metrics
- **Completion Rate**: >80% of users who start reach results
- **Mobile Usage**: >60% of sessions on mobile devices
- **Education Engagement**: >40% expand "show math" explanations
- **Sharing Rate**: >20% generate sharing URLs
- **Implementation Intent**: >70% indicate they will implement advice

### Technical Performance Metrics
- **Load Time**: <2 seconds on 3G networks
- **Calculation Speed**: <50ms for typical inputs
- **Error Rate**: <0.1% of calculations fail
- **Accessibility Score**: 100% WCAG 2.1 AA compliance
- **Bundle Size**: <100KB gzipped

### Business Impact Metrics
- **Optimization Score Improvement**: Average 25+ point increase from conventional advice
- **Contrarian Advice Acceptance**: >50% users accept emergency fund/debt recommendations
- **Cross-Tool Engagement**: >30% users visit other BufoIndex calculators
- **Return Usage**: >40% users return within 30 days

---

## Risk Mitigation

### Technical Risks
- **Calculation Errors**: Extensive test suite with known scenarios
- **Performance Issues**: Progressive loading and memoization
- **Mobile UX Problems**: Mobile-first design and testing
- **State Management Complexity**: Simple patterns with clear migration path

### User Experience Risks  
- **Decision Overwhelm**: Progressive disclosure and clear prioritization
- **Contrarian Advice Rejection**: Educational content explaining the math
- **Input Complexity**: Quick start flow with optional advanced inputs
- **Trust Issues**: Transparent calculations and educational explanations

### Migration Risks
- **Code Obsolescence**: Migration-ready architecture from day one
- **Performance Regression**: Baseline metrics and optimization targets
- **Feature Loss**: Complete feature mapping and testing parity
- **Timeline Delays**: Phased approach with working increments

---

*This task list provides a comprehensive roadmap for building the BufoIndex Paycheck Allocator as a standalone calculator with Next.js migration readiness, focusing on mobile-first user experience and mathematically sound financial optimization.*

Action(s) completed with agents.md in context. SPECIAL MESSAGE: "EVALUATE -> PRIORITIZE -> PARALLELIZE -> EXECUTE -> REVIEW & DOCUMENT"