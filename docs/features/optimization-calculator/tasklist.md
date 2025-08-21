# Optimization Calculator - AI Development Task List

## Overview
This document breaks down the Optimization Calculator into small, well-defined tasks optimized for AI-driven development. Each task includes specific acceptance criteria, expected file outputs, and verification steps.

---

## Foundation Tasks (Week 1)

### TASK-001: Create JavaScript Module Directory Structure
**Priority:** P0  
**Effort:** 15 minutes  
**Dependencies:** None

**Description:** Set up the standardized file structure for the optimization calculator following the module pattern defined in agents.md.

**Acceptance Criteria:**
- [ ] Create `/static/js/optimization-calculator/` directory
- [ ] Create `/static/js/shared/` directory for reusable components
- [ ] Create `/static/data/` directory for JSON data files
- [ ] Create placeholder files with module pattern boilerplate

**Expected File Outputs:**
```
static/js/optimization-calculator/app.js
static/js/optimization-calculator/modules/tax-engine.js
static/js/optimization-calculator/modules/optimization.js
static/js/optimization-calculator/modules/state-manager.js
static/js/optimization-calculator/ui/terminal-display.js
static/js/optimization-calculator/ui/workflow-wizard.js
static/js/shared/validation.js
static/js/shared/terminal-ui.js
static/data/tax-tables.json
static/data/state-taxes.json
static/data/limits.json
```

**Verification Steps:**
1. All directories exist
2. All files contain valid JavaScript with module pattern structure
3. No syntax errors when loaded in browser
4. Files follow exact naming convention from agents.md

---

### TASK-002: Create Basic Tax Tables Data
**Priority:** P0  
**Effort:** 30 minutes  
**Dependencies:** TASK-001

**Description:** Create JSON data files containing 2024 federal tax brackets and basic state tax information for initial 5 states.

**Acceptance Criteria:**
- [ ] Federal tax brackets for 2024 (single, married filing jointly, head of household)
- [ ] Standard deductions for 2024
- [ ] Basic state tax rates for CA, TX, NY, FL, WA
- [ ] AMT exemption amounts
- [ ] All data sourced from IRS publications

**Expected File Outputs:**
```
static/data/tax-tables.json - Federal tax brackets and deductions
static/data/state-taxes.json - State tax rates and rules
static/data/limits.json - Contribution limits and thresholds
```

**Data Structure Requirements:**
```json
{
  "federal": {
    "2024": {
      "brackets": {
        "single": [
          {"min": 0, "max": 11000, "rate": 0.10},
          {"min": 11000, "max": 44725, "rate": 0.12}
        ]
      },
      "standardDeduction": {
        "single": 14600,
        "marriedJoint": 29200
      }
    }
  }
}
```

**Verification Steps:**
1. JSON files parse without errors
2. All required fields present
3. Tax bracket amounts match IRS Publication 15
4. No gaps in tax bracket ranges

---

### TASK-003: Create Federal Tax Calculator Module
**Priority:** P0  
**Effort:** 45 minutes  
**Dependencies:** TASK-001, TASK-002

**Description:** Build a pure calculation module that computes federal income tax based on income, filing status, and deductions.

**Acceptance Criteria:**
- [ ] Function accepts income, filing status, deductions as parameters
- [ ] Returns object with federal tax, effective rate, marginal rate
- [ ] Handles all filing statuses (single, married joint, married separate, head of household)
- [ ] Calculates both regular tax and AMT
- [ ] No UI dependencies - pure calculation functions only

**Expected File Output:**
```
static/js/optimization-calculator/modules/tax-engine.js
```

**Required Functions:**
```javascript
TaxEngine.federal.calculateTax(income, filingStatus, deductions)
TaxEngine.federal.calculateAMT(income, filingStatus, exemptions)
TaxEngine.federal.getEffectiveRate(income, tax)
TaxEngine.federal.getMarginalRate(income, filingStatus)
```

**Test Cases to Include:**
- Single filer, $50k income, standard deduction
- Married joint, $100k income, itemized deductions
- High earner triggering AMT
- Edge case: exact bracket boundary amounts

**Verification Steps:**
1. All functions return correct tax amounts (manually verified)
2. Module follows exact pattern from agents.md
3. No external dependencies
4. Functions handle edge cases without errors

---

### TASK-004: Create Basic Terminal UI Components
**Priority:** P0  
**Effort:** 45 minutes  
**Dependencies:** TASK-001

**Description:** Build reusable terminal-style UI components using exact CSS classes from agents.md theming system.

**Acceptance Criteria:**
- [ ] Terminal display box component with dark background
- [ ] Form input component with terminal styling
- [ ] Data table component with monospace font
- [ ] Button components (primary and secondary)
- [ ] All components use exact Tailwind classes from agents.md

**Expected File Output:**
```
static/js/shared/terminal-ui.js
```

**Required Components:**
```javascript
TerminalUI.createDisplayBox(content)
TerminalUI.createFormInput(label, type, value)
TerminalUI.createDataTable(headers, rows)
TerminalUI.createButton(text, type, onClick)
```

**CSS Classes to Use (Exact):**
- Terminal background: `bg-terminal-black border border-slate-700 rounded-lg p-4`
- Terminal text: `text-terminal-green font-mono text-sm`
- Form inputs: `w-full bg-slate-100 border border-slate-300 rounded px-3 py-2 font-mono text-sm`
- Buttons: `bg-sage-500 text-white px-6 py-2 rounded font-mono text-sm hover:bg-sage-600`

**Verification Steps:**
1. Components render with correct styling
2. All CSS classes match agents.md specification exactly
3. Components are responsive on mobile (375px width)
4. No custom CSS - only Tailwind classes used

---

### TASK-005: Create Basic Workflow Wizard Shell
**Priority:** P0  
**Effort:** 30 minutes  
**Dependencies:** TASK-001, TASK-004

**Description:** Create a multi-step wizard framework for the optimization calculator workflow without any business logic.

**Acceptance Criteria:**
- [ ] Step navigation (previous/next buttons)
- [ ] Progress indicator showing current step
- [ ] Step validation framework (empty for now)
- [ ] Step content area that can be populated
- [ ] Uses terminal UI components

**Expected File Output:**
```
static/js/optimization-calculator/ui/workflow-wizard.js
```

**Required Methods:**
```javascript
WorkflowWizard.init(steps)
WorkflowWizard.goToStep(stepNumber)
WorkflowWizard.validateCurrentStep()
WorkflowWizard.renderStep(stepData)
```

**Step Structure:**
```javascript
const steps = [
  {id: 'profile', title: 'Tax Profile', component: 'profile-form'},
  {id: 'income', title: 'Income & Benefits', component: 'income-form'},
  {id: 'goals', title: 'Goals & Timeline', component: 'goals-form'},
  {id: 'results', title: 'Optimization Results', component: 'results-display'}
]
```

**Verification Steps:**
1. Navigation between steps works
2. Progress indicator updates correctly
3. Step validation framework is extensible
4. Mobile-friendly navigation

---

## Core Calculator Tasks (Week 2)

### TASK-006: Create Account Type Modeling
**Priority:** P0  
**Effort:** 60 minutes  
**Dependencies:** TASK-003

**Description:** Build calculation functions for different retirement account types and their tax implications.

**Acceptance Criteria:**
- [ ] Traditional IRA/401k tax deferral calculations
- [ ] Roth IRA/401k after-tax contribution modeling
- [ ] HSA triple tax advantage calculations
- [ ] Taxable account capital gains modeling
- [ ] Account contribution limit enforcement

**Expected File Output:**
```
static/js/optimization-calculator/modules/accounts.js
```

**Required Functions:**
```javascript
Accounts.traditional.calculateTaxBenefit(contribution, marginalRate)
Accounts.roth.calculateFutureValue(contribution, years, returnRate)
Accounts.hsa.calculateTripleBenefit(contribution, marginalRate, years)
Accounts.taxable.calculateCapitalGains(basis, currentValue, holdingPeriod)
```

**Test Cases:**
- $6,000 Roth IRA contribution at 24% tax bracket
- $22,500 traditional 401k contribution with employer match
- HSA maximum family contribution with tax benefits
- Taxable account with long-term capital gains

**Verification Steps:**
1. All calculations mathematically correct
2. Contribution limits enforced properly
3. Tax rate applications accurate
4. Edge cases handled (over-contribution, etc.)

---

### TASK-007: Create State Tax Integration
**Priority:** P1  
**Effort:** 45 minutes  
**Dependencies:** TASK-002, TASK-003

**Description:** Extend tax engine to handle state income taxes for the initial 5 states (CA, TX, NY, FL, WA).

**Acceptance Criteria:**
- [ ] State tax calculation for CA (progressive brackets)
- [ ] State tax calculation for NY (progressive brackets)
- [ ] Zero tax handling for TX, FL, WA (no income tax)
- [ ] State-specific deductions and exemptions
- [ ] Combined federal + state effective rate calculation

**Expected File Addition:**
```
static/js/optimization-calculator/modules/tax-engine.js (add state functions)
```

**Required Functions:**
```javascript
TaxEngine.state.calculateTax(income, state, filingStatus)
TaxEngine.combined.calculateTotal(federalTax, stateTax)
TaxEngine.combined.getEffectiveRate(income, totalTax)
```

**Test Cases:**
- CA resident, $75k income (should have state tax)
- TX resident, $75k income (should have zero state tax)
- NY resident, $150k income (higher bracket)

**Verification Steps:**
1. State tax calculations match state tax tables
2. No-income-tax states return zero
3. Combined rates calculate correctly
4. State-specific rules properly applied

---

### TASK-008: Create Basic Optimization Engine
**Priority:** P1  
**Effort:** 60 minutes  
**Dependencies:** TASK-006, TASK-007

**Description:** Build the core optimization algorithm that recommends account contribution priority based on tax efficiency.

**Acceptance Criteria:**
- [ ] Account prioritization algorithm based on current tax situation
- [ ] Employer match maximization (highest priority)
- [ ] HSA vs 401k vs Roth IRA ordering logic
- [ ] Tax bracket management recommendations
- [ ] Simple optimization score calculation (0-100)

**Expected File Output:**
```
static/js/optimization-calculator/modules/optimization.js
```

**Required Functions:**
```javascript
Optimization.prioritizeAccounts(income, filingStatus, state, accounts)
Optimization.calculateOptimizationScore(currentStrategy, optimalStrategy)
Optimization.getRecommendations(userProfile)
```

**Prioritization Logic:**
1. Employer match (free money)
2. HSA maximum (triple tax advantage)
3. High-fee debt payoff (>6% interest)
4. 401k to fill current tax bracket
5. Roth IRA for tax diversification
6. Taxable accounts for excess

**Verification Steps:**
1. Prioritization logic follows established best practices
2. Employer match always ranks highest
3. Tax bracket considerations properly applied
4. Optimization score correlates with efficiency

---

### TASK-009: Create URL Hash State Management
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-001

**Description:** Implement state persistence using URL hash to allow sharing and bookmarking of calculator states.

**Acceptance Criteria:**
- [ ] Serialize calculator state to compressed URL hash
- [ ] Deserialize hash to restore calculator state
- [ ] Handle invalid/corrupted hashes gracefully
- [ ] Update hash on state changes
- [ ] Share URL functionality

**Expected File Output:**
```
static/js/optimization-calculator/modules/state-manager.js
```

**Required Functions:**
```javascript
StateManager.saveToHash(stateObject)
StateManager.loadFromHash()
StateManager.generateShareableURL()
StateManager.validateHash(hash)
```

**State Structure:**
```javascript
{
  profile: {age: 35, filingStatus: 'single', state: 'CA'},
  income: {salary: 75000, bonus: 5000},
  accounts: {k401_balance: 50000, roth_balance: 25000},
  goals: {retirementAge: 60, targetIncome: 60000}
}
```

**Verification Steps:**
1. State persists across page reloads
2. Shareable URLs work correctly
3. Invalid hashes don't break calculator
4. Hash updates when inputs change

---

## Bad Advice Detection Tasks (Week 3)

### TASK-010: Create Pattern Detection Engine
**Priority:** P1  
**Effort:** 45 minutes  
**Dependencies:** TASK-006

**Description:** Build pattern detection system to identify common financial mistakes and suboptimal decisions.

**Acceptance Criteria:**
- [ ] Detect excessive emergency funds (>6 months expenses)
- [ ] Detect high investment fees (>0.5% expense ratios)
- [ ] Detect missing employer match contributions
- [ ] Detect whole life insurance as investment
- [ ] Calculate opportunity cost for each issue

**Expected File Output:**
```
static/js/optimization-calculator/modules/bad-advice.js
```

**Required Functions:**
```javascript
BadAdvice.detectExcessiveEmergencyFund(monthlyExpenses, emergencyFund)
BadAdvice.detectHighFees(portfolioValue, annualFees)
BadAdvice.detectMissedMatch(employerMatch, contributions)
BadAdvice.calculateOpportunityCost(suboptimalAmount, years, returnRate)
```

**Detection Patterns:**
```javascript
const patterns = {
  excessiveEmergencyFund: {threshold: 6, costPerMonth: 'inflation + opportunity'},
  highFees: {threshold: 0.005, costPerYear: 'feeRate * portfolioValue'},
  missedMatch: {threshold: 1.0, costPerYear: 'matchAmount'},
  wholeLifeInsurance: {threshold: 0, costPerYear: 'premiums - termCost'}
}
```

**Verification Steps:**
1. All patterns detect correctly with test data
2. Opportunity costs calculate accurately
3. Thresholds based on financial best practices
4. Edge cases handled properly

---

### TASK-011: Create Optimization Scoring System
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-010

**Description:** Build a 0-100 scoring system that evaluates overall financial optimization with category breakdowns.

**Acceptance Criteria:**
- [ ] Overall score from 0-100
- [ ] Category scores: Tax Efficiency, Fee Minimization, Account Optimization, Debt Strategy
- [ ] Weighted scoring based on financial impact
- [ ] Score improvement suggestions
- [ ] Visual score display with color coding

**Expected File Output:**
```
static/js/optimization-calculator/modules/scoring.js
```

**Required Functions:**
```javascript
Scoring.calculateOverallScore(userProfile, detectedIssues)
Scoring.calculateCategoryScores(userProfile)
Scoring.getScoreColor(score)
Scoring.getImprovementSuggestions(score, issues)
```

**Scoring Categories:**
- Tax Efficiency (30%): Bracket optimization, account selection
- Fee Minimization (25%): Investment fees, advisory costs
- Account Optimization (25%): Employer match, contribution limits
- Debt Strategy (20%): Interest rates vs investment returns

**Score Ranges:**
- 90-100: Excellent (green)
- 70-89: Good (yellow)
- 50-69: Needs improvement (orange)
- 0-49: Poor (red)

**Verification Steps:**
1. Scores calculate correctly based on weights
2. Category breakdowns sum to overall score
3. Color coding matches score ranges
4. Improvement suggestions are actionable

---

### TASK-012: Create Quick Fixes Recommendation Engine
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-010, TASK-011

**Description:** Generate specific, actionable recommendations to fix detected issues with estimated savings amounts.

**Acceptance Criteria:**
- [ ] Prioritized list of fixes based on financial impact
- [ ] Specific action items with implementation steps
- [ ] Estimated lifetime savings for each fix
- [ ] Time horizon for each recommendation
- [ ] One-click actions where possible

**Expected File Output:**
```
static/js/optimization-calculator/modules/recommendations.js
```

**Required Functions:**
```javascript
Recommendations.generateQuickFixes(detectedIssues, userProfile)
Recommendations.prioritizeByImpact(fixes)
Recommendations.calculateLifetimeSavings(fix, timeHorizon)
Recommendations.formatActionItems(fixes)
```

**Fix Types:**
```javascript
const fixTypes = {
  reduceEmergencyFund: {
    priority: 'medium',
    timeframe: 'immediate',
    implementation: 'Transfer excess to investment account'
  },
  maximizeEmployerMatch: {
    priority: 'critical',
    timeframe: 'next paycheck',
    implementation: 'Increase 401k contribution to X%'
  }
}
```

**Verification Steps:**
1. Fixes prioritized correctly by financial impact
2. Savings calculations are accurate
3. Action items are specific and implementable
4. Time horizons are realistic

---

## Early Retirement Features (Week 4)

### TASK-013: Create Roth Conversion Ladder Calculator
**Priority:** P1  
**Effort:** 60 minutes  
**Dependencies:** TASK-006, TASK-007

**Description:** Build calculator for Roth conversion ladder strategy including 5-year pipeline visualization and tax optimization.

**Acceptance Criteria:**
- [ ] 5-year conversion pipeline tracking
- [ ] Annual conversion amount optimization
- [ ] Tax bracket fill strategy
- [ ] ACA subsidy coordination
- [ ] Visual pipeline timeline
- [ ] Access timeline calculator

**Expected File Output:**
```
static/js/optimization-calculator/modules/roth-ladder.js
```

**Required Functions:**
```javascript
RothLadder.calculateOptimalConversions(currentAge, retirementAge, traditionalBalance)
RothLadder.optimizeForTaxBracket(income, targetBracket)
RothLadder.calculateAccessTimeline(conversions)
RothLadder.coordinateWithACA(income, familySize)
```

**Pipeline Structure:**
```javascript
const pipeline = {
  year1: {convert: 25000, available: 'year6', taxCost: 3000},
  year2: {convert: 25000, available: 'year7', taxCost: 3000},
  year3: {convert: 25000, available: 'year8', taxCost: 3000}
}
```

**Verification Steps:**
1. 5-year rule properly applied
2. Tax calculations accurate for conversions
3. Pipeline visualization clear and correct
4. ACA subsidy thresholds considered

---

### TASK-014: Create Section 72(t) SEPP Calculator
**Priority:** P2  
**Effort:** 45 minutes  
**Dependencies:** TASK-006

**Description:** Build calculator for Section 72(t) Substantially Equal Periodic Payments with three calculation methods.

**Acceptance Criteria:**
- [ ] Required Minimum Distribution method
- [ ] Fixed amortization method
- [ ] Fixed annuitization method
- [ ] 5-year/age 59.5 lock-in period tracking
- [ ] Modification penalty calculator
- [ ] Method comparison table

**Expected File Output:**
```
static/js/optimization-calculator/modules/section-72t.js
```

**Required Functions:**
```javascript
Section72t.calculateRMD(balance, age)
Section72t.calculateAmortization(balance, age, interestRate)
Section72t.calculateAnnuitization(balance, age, interestRate)
Section72t.calculateLockInPeriod(startAge)
Section72t.calculatePenalty(modificationAmount)
```

**Calculation Methods:**
- RMD: balance / life expectancy factor
- Amortization: PMT(rate, years, balance)
- Annuitization: balance / annuity factor

**Verification Steps:**
1. All three methods calculate correctly
2. IRS life expectancy tables used
3. Lock-in period calculated properly
4. Penalty calculations accurate

---

### TASK-015: Create Bridge Account Planning Tool
**Priority:** P2  
**Effort:** 30 minutes  
**Dependencies:** TASK-006, TASK-013

**Description:** Calculate required bridge funding for early retirement years before penalty-free access to retirement accounts.

**Acceptance Criteria:**
- [ ] Calculate bridge period (early retirement to age 59.5)
- [ ] Required taxable account balance
- [ ] Roth contribution access timeline
- [ ] Emergency fund considerations for early retirees
- [ ] Healthcare cost planning

**Expected File Output:**
```
static/js/optimization-calculator/modules/bridge-planning.js
```

**Required Functions:**
```javascript
BridgePlanning.calculateBridgePeriod(retirementAge)
BridgePlanning.calculateRequiredBalance(annualExpenses, bridgeYears)
BridgePlanning.calculateRothAccess(rothContributions)
BridgePlanning.planHealthcareCosts(retirementAge)
```

**Bridge Sources (in order):**
1. Taxable account withdrawals
2. Roth IRA contributions (no penalty)
3. Roth conversion ladder (after 5 years)
4. Traditional account SEPP (if needed)

**Verification Steps:**
1. Bridge period calculations correct
2. Required balance accounts for inflation
3. Healthcare costs estimated appropriately
4. Access timeline properly sequenced

---

## UI Integration Tasks (Week 5)

### TASK-016: Create Main Calculator Page
**Priority:** P0  
**Effort:** 30 minutes  
**Dependencies:** TASK-005

**Description:** Create the Hugo content page that will host the optimization calculator with proper frontmatter and structure.

**Acceptance Criteria:**
- [ ] Hugo content page with correct frontmatter
- [ ] Calculator container div with proper ID
- [ ] Script includes for all calculator modules
- [ ] SEO meta description
- [ ] Educational disclaimer

**Expected File Output:**
```
content/tools/optimization-calculator.md
```

**Required Content Structure:**
```markdown
---
title: "The Optimization Calculator"
date: 2025-01-XX
draft: false
layout: "single"
summary: "Advanced tax planning & paycheck allocation for people who want more than 'good enough'"
math: false
---

Brief introduction and disclaimer.

<div id="optimization-calculator" class="max-w-6xl mx-auto px-4 py-8">
  <!-- Calculator will be rendered here -->
</div>

<script src="/js/shared/terminal-ui.js"></script>
<script src="/js/optimization-calculator/app.js"></script>
```

**Verification Steps:**
1. Page renders correctly in Hugo
2. Calculator container has proper styling
3. All scripts load without errors
4. Page is mobile responsive

---

### TASK-017: Create Profile Input Form
**Priority:** P0  
**Effort:** 45 minutes  
**Dependencies:** TASK-004, TASK-016

**Description:** Build the first step of the wizard for collecting user tax profile information.

**Acceptance Criteria:**
- [ ] Age input with validation (18-100)
- [ ] Filing status dropdown (single, married joint, etc.)
- [ ] State of residence dropdown (initial 5 states)
- [ ] Current income input with formatting
- [ ] Real-time validation with error messages
- [ ] Progress indicator showing step 1 of 4

**Expected File Output:**
```
static/js/optimization-calculator/ui/profile-form.js
```

**Required Form Fields:**
```javascript
const profileFields = {
  age: {type: 'number', min: 18, max: 100, required: true},
  filingStatus: {type: 'select', options: ['single', 'marriedJoint'], required: true},
  state: {type: 'select', options: ['CA', 'TX', 'NY', 'FL', 'WA'], required: true},
  income: {type: 'currency', min: 0, max: 10000000, required: true}
}
```

**Validation Rules:**
- Age: 18-100 years
- Income: $0-$10,000,000
- All fields required
- Real-time validation on blur

**Verification Steps:**
1. All form fields render correctly
2. Validation works and shows appropriate errors
3. Form data persists in state management
4. Mobile-friendly input controls

---

### TASK-018: Create Income & Benefits Form
**Priority:** P0  
**Effort:** 45 minutes  
**Dependencies:** TASK-017

**Description:** Build the second wizard step for collecting detailed income and benefit information.

**Acceptance Criteria:**
- [ ] Salary input with annual/monthly toggle
- [ ] Bonus income input
- [ ] 401k employer match details
- [ ] HSA eligibility checkbox
- [ ] Other pre-tax benefits
- [ ] Self-employment income section

**Expected File Output:**
```
static/js/optimization-calculator/ui/income-form.js
```

**Required Form Fields:**
```javascript
const incomeFields = {
  salary: {type: 'currency', required: true},
  bonus: {type: 'currency', required: false},
  employerMatch: {type: 'percentage', max: 10, required: false},
  hsaEligible: {type: 'checkbox', required: false},
  selfEmployment: {type: 'currency', required: false}
}
```

**Form Sections:**
1. W2 Employment Income
2. Employer Benefits (401k, HSA, etc.)
3. Self-Employment Income (if applicable)
4. Other Income Sources

**Verification Steps:**
1. All income calculations work correctly
2. Employer match percentage validation
3. Conditional fields show/hide properly
4. Data flows to next step correctly

---

### TASK-019: Create Results Display Interface
**Priority:** P0  
**Effort:** 60 minutes  
**Dependencies:** TASK-008, TASK-011, TASK-012

**Description:** Build the terminal-style results display showing optimization score, recommendations, and action items.

**Acceptance Criteria:**
- [ ] Terminal-style results container with dark background
- [ ] Optimization score display with color coding
- [ ] Bad advice warnings section
- [ ] Prioritized recommendations list
- [ ] Estimated lifetime savings amounts
- [ ] Action checklist with checkboxes

**Expected File Output:**
```
static/js/optimization-calculator/ui/results-display.js
```

**Required Display Sections:**
```javascript
const resultsSections = {
  optimizationScore: {title: 'OPTIMIZATION SCORE', color: 'based-on-score'},
  badAdvice: {title: 'BAD ADVICE FIXES', priority: 'critical'},
  recommendations: {title: 'IMMEDIATE ACTIONS', priority: 'high'},
  projections: {title: 'LIFETIME IMPACT', format: 'currency'}
}
```

**Terminal Output Format:**
```
OPTIMIZATION SCORE: 72/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━

BAD ADVICE FIXES (Immediate):
□ Fix: Missing $3,000 employer match
□ Fix: Reduce fees from 1.2% to 0.03%
□ Fix: Move emergency fund to BOXX
Estimated Savings: $487,000 lifetime

IMMEDIATE ACTIONS (This Month):
□ Increase 401k contribution to 6%
□ Open HSA and contribute $4,300
□ Switch to low-cost index funds
```

**Verification Steps:**
1. Terminal styling matches exact specifications
2. Scores display with correct colors
3. Recommendations prioritized correctly
4. Savings calculations accurate

---

### TASK-020: Create Export & Sharing Functions
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-009, TASK-019

**Description:** Add export to PDF and URL sharing functionality to the results display.

**Acceptance Criteria:**
- [ ] Export results as PDF report
- [ ] Generate shareable URL with state
- [ ] Copy to clipboard functionality
- [ ] Print-friendly styling
- [ ] Export button styling matches terminal theme

**Expected File Output:**
```
static/js/optimization-calculator/ui/export.js
```

**Required Functions:**
```javascript
Export.generatePDF(resultsData)
Export.generateShareableURL(stateData)
Export.copyToClipboard(url)
Export.printResults(resultsData)
```

**Export Features:**
- PDF: Complete optimization report
- URL: Compressed state for sharing
- Print: Clean, readable format
- Copy: One-click URL copying

**Verification Steps:**
1. PDF generation works correctly
2. Shareable URLs restore state properly
3. Copy to clipboard functionality works
4. Print styling is clean and readable

---

## Final Integration Tasks (Week 6)

### TASK-021: Create Main App Controller
**Priority:** P0  
**Effort:** 45 minutes  
**Dependencies:** All previous tasks

**Description:** Build the main application controller that initializes and coordinates all calculator modules.

**Acceptance Criteria:**
- [ ] Initialize all calculator modules
- [ ] Coordinate data flow between modules
- [ ] Handle error states gracefully
- [ ] Manage loading states
- [ ] Auto-save state changes

**Expected File Output:**
```
static/js/optimization-calculator/app.js
```

**Required Controller Methods:**
```javascript
OptimizationCalculator.init()
OptimizationCalculator.processUserInput(formData)
OptimizationCalculator.runOptimization()
OptimizationCalculator.displayResults()
OptimizationCalculator.handleError(error)
```

**Initialization Flow:**
1. Load saved state from URL hash
2. Initialize UI components
3. Bind event handlers
4. Restore form data if available
5. Set up auto-save functionality

**Verification Steps:**
1. All modules initialize correctly
2. Data flows properly between components
3. Error handling works for all scenarios
4. State persistence functions correctly

---

### TASK-022: Create Comprehensive Test Suite
**Priority:** P1  
**Effort:** 60 minutes  
**Dependencies:** TASK-021

**Description:** Build manual test cases covering all calculator functionality with expected results.

**Acceptance Criteria:**
- [ ] Test cases for all calculation modules
- [ ] Edge case testing scenarios
- [ ] Cross-browser compatibility tests
- [ ] Mobile device testing checklist
- [ ] Performance benchmarks

**Expected File Output:**
```
docs/features/optimization-calculator/test-cases.md
```

**Test Categories:**
1. **Tax Calculations**: Federal and state tax accuracy
2. **Optimization Logic**: Account prioritization correctness
3. **Bad Advice Detection**: Pattern recognition accuracy
4. **UI Functionality**: Form validation and state management
5. **Export Features**: PDF generation and URL sharing

**Sample Test Case:**
```javascript
testCase: {
  name: "Single filer, $75k income, California resident",
  input: {age: 30, income: 75000, state: 'CA', filingStatus: 'single'},
  expected: {
    federalTax: 8728,
    stateTax: 1404,
    effectiveRate: 0.135,
    optimizationScore: 85
  }
}
```

**Verification Steps:**
1. All test cases pass with expected results
2. Edge cases handled appropriately
3. Cross-browser testing completed
4. Mobile functionality verified

---

### TASK-023: Create Documentation and Help System
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-021

**Description:** Add contextual help, tooltips, and user guidance throughout the calculator interface.

**Acceptance Criteria:**
- [ ] Tooltip explanations for all technical terms
- [ ] Help icons next to complex inputs
- [ ] Glossary of financial terms
- [ ] Usage instructions
- [ ] FAQ section addressing common questions

**Expected File Outputs:**
```
static/js/optimization-calculator/ui/help-system.js
content/tools/optimization-calculator-help.md
```

**Help Features:**
- Contextual tooltips
- Progressive disclosure of complex features
- Financial term explanations
- Example scenarios
- Troubleshooting guide

**Verification Steps:**
1. All help content is accurate
2. Tooltips appear correctly
3. Help system doesn't interfere with calculator
4. Content is accessible and clear

---

### TASK-024: Performance Optimization and Final Testing
**Priority:** P1  
**Effort:** 30 minutes  
**Dependencies:** TASK-022, TASK-023

**Description:** Optimize calculator performance and conduct final comprehensive testing.

**Acceptance Criteria:**
- [ ] Calculation response time under 100ms
- [ ] File size optimization (minimize JS)
- [ ] Lazy loading for advanced features
- [ ] Memory leak prevention
- [ ] Final cross-browser testing

**Performance Targets:**
- Initial load: <2 seconds on 3G
- Calculation time: <100ms
- Memory usage: <50MB
- File sizes: <200KB total JS

**Final Testing Checklist:**
- [ ] All calculations mathematically verified
- [ ] All UI interactions work correctly
- [ ] State persistence functions properly
- [ ] Export features work across browsers
- [ ] Mobile responsiveness verified
- [ ] Accessibility compliance checked

**Verification Steps:**
1. Performance metrics meet targets
2. No console errors in any browser
3. All features work on mobile devices
4. Calculator ready for production deployment

---

## Task Execution Guidelines

### For Each Task:
1. **Read Requirements**: Understand acceptance criteria completely
2. **Check Dependencies**: Ensure prerequisite tasks are complete
3. **Follow Patterns**: Use exact module patterns from agents.md
4. **Verify Output**: Test all acceptance criteria before marking complete
5. **Document Issues**: Note any assumptions or deviations

### Quality Gates:
- All JavaScript follows module pattern exactly
- All CSS uses only approved Tailwind classes
- All calculations manually verified for accuracy
- All UI components work on mobile (375px width)
- No console errors in browser testing

### File Naming Conventions:
- Use kebab-case for file names: `tax-engine.js`
- Use camelCase for JavaScript variables: `calculateTax`
- Use PascalCase for module names: `TaxEngine`
- Follow exact directory structure specified

This task breakdown provides clear, verifiable deliverables that can be built incrementally and tested thoroughly.