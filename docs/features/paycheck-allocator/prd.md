# Product Requirements Document
## BufoIndex Paycheck Allocator

**Version:** 1.0  
**Date:** January 2025  
**Status:** Final Draft

---

## 1. Executive Summary

### Product Name
**BufoIndex Paycheck Allocator** - Smart Monthly Allocation for Your Next Paycheck

### Product Vision
Transform the overwhelming question "Where should my next paycheck go?" into a simple, math-driven priority list. The Paycheck Allocator provides month-to-month optimization that maximizes tax efficiency, account prioritization, and long-term wealth building while respecting individual preferences and financial circumstances.

### Key Objectives
- **Simplify Complex Decisions**: Turn account prioritization into a clear action list
- **Maximize Tax Efficiency**: Optimize current-year tax brackets and deductions
- **Challenge Conventional Wisdom**: Show opportunity costs of "safe" financial advice
- **Enable Informed Choices**: Educate about trade-offs without forcing decisions
- **Monthly Optimization**: Focus on recurring paycheck allocation rather than one-time planning

### Success Metrics
- User completes allocation in <5 minutes
- 80%+ implement at least one recommendation
- Clear priority list generated for 95%+ of inputs
- Users understand opportunity costs before making decisions
- Tool works perfectly on mobile devices

### Tagline
"Your Next Paycheck, Optimized"

---

## 2. Product Overview

### Problem Statement
Most people receive their paycheck and face decision paralysis: Should I contribute more to my 401k? Max my HSA? Pay extra on debt? Build a bigger emergency fund? Traditional financial advice provides generic rules that don't account for individual tax situations, employer benefits, or specific goals. People either:

1. **Follow suboptimal generic advice** (6-month emergency fund, pay off all debt first)
2. **Stick with status quo** (same allocation for years, missing opportunities)
3. **Get overwhelmed** and make no optimization changes
4. **Pay for expensive advice** for what should be straightforward optimization

### Solution
The BufoIndex Paycheck Allocator provides a simple, mobile-friendly calculator that takes your current paycheck and financial situation, then outputs a clear priority list of exactly where each dollar should go. It challenges conventional wisdom with mathematical reasoning while respecting user preferences and risk tolerance.

### Target Users
**Primary:** Working professionals (25-45) seeking paycheck optimization
- Receiving regular paychecks (W2 or contractor)
- Want to optimize but don't know the best order
- Comfortable questioning conventional financial advice
- Looking for specific action items, not general guidance
- Prefer "show me the math" over "trust the process"

**Secondary:** Financial optimizers and FIRE pursuers
- Already saving significant percentages
- Want to ensure optimal account sequencing
- Seeking tax bracket optimization strategies
- Comfortable with higher complexity for better outcomes

---

## 3. Core Features & Functionality

### 3.1 Input Collection (Progressive)

#### Essential Inputs (2 minutes)
**Paycheck Information:**
- Gross monthly income
- Net take-home after taxes/deductions
- Pay frequency (monthly/bi-weekly/weekly)

**Tax Situation:**
- Current federal tax bracket
- State (for state tax calculation)
- Filing status

**Employer Benefits:**
- 401k available (Y/N)
- Employer match percentage and limit
- HSA eligible (Y/N)
- Current contribution percentages

#### Enhanced Inputs (Optional, 3 additional minutes)
**Current Balances (for contribution limit tracking):**
- Current 401k contributions this year
- IRA contributions this year  
- HSA contributions this year

**Debt Information:**
- Major debt balances and interest rates
- Monthly payment amounts

**Financial Preferences:**
- Emergency fund preference (0-12 months slider)
- "Fun money" desired range ($X - $Y per month)
- Risk tolerance (conservative/moderate/optimizer)

### 3.2 Optimization Engine

#### Tax Bracket Optimization
- Calculate marginal tax savings for additional 401k contributions
- Identify opportunities to drop tax brackets with strategic contributions
- Factor in FICA savings for HSA contributions
- State tax considerations and deductions

#### Account Prioritization Algorithm
```
Priority Order (dynamic based on situation):
1. Employer 401k match (up to full match) - 100% return
2. High-interest debt (>7% rate) - guaranteed return
3. HSA max (if eligible) - triple tax advantage  
4. 401k up to tax bracket optimization point
5. Roth IRA (if income eligible)
6. Remaining 401k space to annual limit
7. Taxable investments
8. Emergency fund (only if below user's minimum)
9. Low-interest debt extra payments (often not recommended)
```

#### Contrarian Recommendations Engine
**Emergency Fund Optimization:**
- Default recommendation: 1-3 months maximum
- Show opportunity cost: "Your 6-month emergency fund costs $X,XXX in growth over 10 years"
- Alternative strategies: HELOC, credit lines, invested emergency funds
- User can override but sees the math

**Debt Strategy:**
- Low-rate debt (<5%): Recommend minimum payments + invest difference
- Show calculation: "Paying extra on your 3% mortgage vs investing costs $X,XXX over 20 years"
- Credit card debt: Always prioritize (typically >15% rates)

**Tax Strategy:**
- Roth vs Traditional recommendations based on current vs expected future brackets
- HSA as retirement account strategy
- Tax-loss harvesting opportunities in taxable accounts

### 3.3 Output Generation

#### Primary Output: Simple Priority List
```
YOUR NEXT $3,200 PAYCHECK ALLOCATION:

1. 401k contribution: $320 (to get full employer match)
2. HSA contribution: $692 (max monthly, triple tax advantage)  
3. Roth IRA: $583 (max annual contribution)
4. Fun money: $400 (within your $300-500 preference)
5. Extra 401k: $800 (reduces tax bracket to 12%)
6. Taxable investment: $405 (remaining amount)

Emergency fund: SKIP (you chose 2 months, currently have 3.5 months)
Extra mortgage payment: SKIP (3% rate vs 7% investment return)
```

#### Secondary Output: The Math Behind It
**Opportunity Cost Display (Progressive Disclosure):**
- "Show me why" expands each recommendation
- Tax savings calculations with specific dollar amounts
- Compound growth projections for different strategies
- Risk explanations for contrarian advice

**Annual Projection:**
- "If you follow this monthly: $X,XXX additional wealth in 10 years"
- Tax savings: "$X,XXX less to IRS this year"
- Compound growth benefits: "$X,XXX extra from optimization vs generic advice"

### 3.4 User Experience Features

#### Mobile-First Design
- Single-column layout optimized for phones
- Large touch targets for sliders and buttons
- Quick input with smart defaults
- Results fit on screen without scrolling

#### Sharing & Persistence
- URL hash encoding for sharing scenarios
- "What if" scenario modeling
- Save preferences for next month's paycheck
- Export allocation list to notes/calendar

#### Educational Integration
- Hover/tap explanations for complex concepts
- "Why this matters" for each recommendation
- Links to deeper BufoIndex calculators for advanced scenarios
- IRA vs 401k explainers, HSA strategy guides

---

## 4. User Workflow & Interface

### 4.1 Entry Points
- Direct tool access: `/tools/paycheck-allocator`
- From articles: "Try the Paycheck Allocator" call-to-action buttons
- From other calculators: "Optimize your monthly allocation" links
- Social sharing: URL-encoded scenarios

### 4.2 Input Flow (Progressive Enhancement)

#### Step 1: Quick Start (30 seconds)
```
💰 PAYCHECK ALLOCATOR

How much do you take home monthly?
[Slider: $1,000 - $10,000] → $3,200

What's your current federal tax bracket?  
[Dropdown: 10%, 12%, 22%, 24%, 32%, 35%, 37%] → 22%

Do you get employer 401k matching?
[Yes] [No] → Yes

[Get My Allocation →]
```

#### Step 2: Enhanced Results (Optional)
```
Want more accurate results? (30 seconds more)

Current 401k contribution: [4%]
HSA eligible: [Yes] [No]
Emergency fund preference: [Slider: 0-12 months] → 2 months
Major debt rate: [3.5% mortgage]

[Update Results →]
```

### 4.3 Results Display

#### Mobile Layout
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR $3,200 ALLOCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 401k Match: $320
   (Don't leave money on table)

✅ HSA Max: $692  
   (Triple tax advantage)
   
⚠️  Roth IRA: $583
   (Better than Traditional at 22%)

💡 Extra 401k: $800
   (Drops you to 12% bracket)

📈 Taxable: $405
   (Remaining funds)

🚫 SKIP Emergency Fund
   (2.8 months → Your preference: 2 months)
   Opportunity cost: $45,000 over 10 years

🚫 SKIP Extra Mortgage  
   (3% rate vs 7% investment return)
   Cost: $89,000 over 20 years

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANNUAL IMPACT IF FOLLOWED:
• Extra wealth: +$127,000 in 10 years
• Tax savings: -$2,400 this year  
• Optimization score: 87/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Share This Plan] [What If Scenarios] [Save Preferences]
```

#### Desktop Enhancements
- Side-by-side comparison with "typical advice"
- Interactive sliders to adjust preferences
- Detailed tax calculations with brackets
- Charts showing compound growth projections

### 4.4 Progressive Disclosure

#### Level 1: Simple List (Default)
Just the priority order with brief explanations

#### Level 2: Show Math (Optional)
- Tax bracket calculations
- Compound growth projections  
- Opportunity cost specifics
- Risk considerations

#### Level 3: Advanced Scenarios (Power Users)
- Bonus allocation strategies
- Mid-year contribution limit tracking
- Tax-loss harvesting coordination
- Multiple income stream optimization

---

## 5. Technical Architecture (Migration-Ready)

### 5.1 Current Implementation (Hugo Static Site)

#### File Structure
```
/static/js/calculators/paycheck-allocator/
├── core.js           // Pure calculation logic (portable)
├── ui.js            // DOM manipulation (will be replaced)  
├── state.js         // Data management (convert to hooks)
└── tax-data.js      // Tax tables and constants

/layouts/tools/
├── paycheck-allocator.html  // HTML template
└── partials/
    └── calculator-wrapper.html
```

#### Data Models (TypeScript-Ready)
```javascript
/**
 * @typedef {Object} PaycheckProfile
 * @property {number} grossMonthly
 * @property {number} netMonthly  
 * @property {string} taxBracket
 * @property {string} state
 * @property {string} filingStatus
 * @property {EmployerBenefits} benefits
 * @property {EmergencyFundPrefs} emergencyPrefs
 * @property {Array<Debt>} debts
 */

/**
 * @typedef {Object} AllocationResult
 * @property {Array<AllocationItem>} priorityList
 * @property {OpportunityCosts} skippedItems
 * @property {AnnualImpact} projections
 * @property {number} optimizationScore
 */
```

### 5.2 Next.js Migration Path (Future)

#### Component Structure (Planned)
```typescript
// /app/tools/paycheck-allocator/page.tsx
export default function PaycheckAllocatorPage() {
  return <PaycheckAllocator />
}

// /components/calculators/PaycheckAllocator.tsx
interface PaycheckAllocatorProps {
  initialProfile?: PaycheckProfile
}

// /hooks/usePaycheckCalculation.ts  
export function usePaycheckCalculation(profile: PaycheckProfile) {
  // Core logic from core.js
}

// /lib/calculators/paycheck-core.ts
export function calculateOptimalAllocation(profile: PaycheckProfile): AllocationResult
```

#### State Management Strategy
- **Current**: localStorage + URL hash
- **Future**: Zustand store + Next.js router
- **Migration**: State shapes designed to be compatible

#### Component Library Integration
- **Atomic Components**: Input sliders, result cards, progress bars
- **Molecular Components**: Tax bracket display, allocation list
- **Organism Components**: Full calculator, results dashboard
- **Template**: Calculator page layout

### 5.3 Shared Calculation Engine

#### Pure Functions (Portable Across Frameworks)
```javascript
// Core calculations - no DOM dependencies
export function calculateOptimalAllocation(profile) {
  const allocations = [];
  
  // 1. Employer match (always first if available)
  if (profile.benefits.match.available) {
    allocations.push(calculateEmployerMatch(profile));
  }
  
  // 2. High-interest debt (>7% typically)
  const highInterestDebt = profile.debts.filter(debt => debt.rate > 0.07);
  if (highInterestDebt.length > 0) {
    allocations.push(calculateDebtPayment(highInterestDebt));
  }
  
  // 3. HSA (if eligible)
  if (profile.benefits.hsa.eligible) {
    allocations.push(calculateHSAContribution(profile));
  }
  
  // 4. Tax bracket optimization
  const taxOptimization = calculateTaxBracketOptimization(profile);
  if (taxOptimization.worthwhile) {
    allocations.push(taxOptimization.contribution);
  }
  
  // Continue with remaining logic...
  
  return {
    allocations,
    skippedItems: calculateSkippedItems(profile),
    projections: calculateAnnualImpact(allocations),
    optimizationScore: calculateOptimizationScore(profile, allocations)
  };
}
```

---

## 6. Content Strategy & Messaging

### 6.1 Contrarian Positioning

#### Emergency Fund Messaging
**Conventional:** "Save 3-6 months of expenses in a savings account"
**BufoIndex:** "Emergency funds beyond 3 months typically cost $50,000+ in lost growth over 10 years. Here's how to optimize for actual emergencies while maximizing wealth."

#### Debt Payoff Messaging  
**Conventional:** "Pay off all debt before investing"
**BufoIndex:** "Low-rate debt (under 5%) should often be paid minimally while excess funds are invested. Your 3% mortgage vs 7% market returns costs you $89,000 over 20 years if you pay extra."

#### Account Prioritization Messaging
**Conventional:** "Max your 401k first"
**BufoIndex:** "HSA beats 401k for retirement savings if you're eligible. It's the only triple tax-advantaged account: deductible contributions, tax-free growth, tax-free withdrawals for medical expenses (including Medicare premiums)."

### 6.2 Educational Integration

#### Progressive Education Strategy
- **Level 1**: Simple explanations ("HSA = triple tax advantage")
- **Level 2**: Basic math ("$692/month × 12 = $8,300 max annual")
- **Level 3**: Advanced concepts ("HSA as stealth retirement account after age 65")

#### "Show Me Why" Expansions
Each recommendation includes optional detailed explanation:
- **The Calculation**: Specific math and assumptions  
- **The Alternative**: What happens if you don't follow this advice
- **The Risk**: What could go wrong and how to mitigate
- **The Timeline**: When this advice might change

---

## 7. Success Metrics & Analytics

### 7.1 User Engagement Metrics
- **Completion rate**: % users who get to results screen
- **Input quality**: % users who provide enhanced inputs
- **Educational engagement**: % users who expand "show me why"
- **Sharing rate**: % users who share their scenarios
- **Return rate**: % users who come back next month

### 7.2 Optimization Impact Metrics
- **Average optimization score**: Starting vs ending score
- **Implementation intent**: % users who report implementing advice
- **Contrarian acceptance**: % users who accept emergency fund/debt advice
- **Tax savings identified**: Average per user
- **Wealth projection improvement**: Additional 10-year wealth vs conventional advice

### 7.3 Product Health Metrics
- **Mobile performance**: Load time and usability scores
- **Calculation accuracy**: Validation against known scenarios  
- **User satisfaction**: Feedback scores and feature requests
- **Technical performance**: Error rates and calculation speed

---

## 8. Risk Analysis & Mitigation

### 8.1 User Experience Risks

#### Decision Overwhelm
- **Risk**: Too many options cause decision paralysis
- **Mitigation**: Progressive disclosure, clear priority order, simple defaults

#### Contrarian Advice Rejection
- **Risk**: Users uncomfortable with non-traditional advice
- **Mitigation**: Show math clearly, allow user overrides, explain risks

#### Mobile Experience Issues
- **Risk**: Complex financial tool doesn't work well on phones
- **Mitigation**: Mobile-first design, simplified inputs, thumb-friendly interface

### 8.2 Technical Risks

#### Calculation Accuracy
- **Risk**: Math errors damage trust and lead to bad financial decisions
- **Mitigation**: Extensive test cases, validation against known scenarios, conservative assumptions

#### Performance on Mobile
- **Risk**: Complex calculations slow down mobile experience
- **Mitigation**: Efficient algorithms, progressive enhancement, loading states

#### State Management Complexity
- **Risk**: URL hash and localStorage become unwieldy
- **Mitigation**: Clear data schemas, validation, migration plan to proper state management

### 8.3 Business Risks

#### Feature Creep  
- **Risk**: Tool becomes overly complex like existing calculators
- **Mitigation**: Strict scope focus on paycheck allocation, link to other tools for complexity

#### User Trust
- **Risk**: Contrarian advice causes users to question tool reliability
- **Mitigation**: Transparent calculations, clear disclaimers, educational content explaining reasoning

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Core MVP (Week 1-2)
**Essential Features:**
- Basic input collection (income, tax bracket, employer match)
- Core allocation algorithm (match, HSA, 401k, IRA prioritization)
- Simple results display with priority list
- Mobile-responsive design
- URL hash state persistence

**Deliverables:**
- Working calculator with essential inputs
- Clear priority list output
- Mobile-optimized interface
- Basic sharing capability

### 9.2 Phase 2: Enhanced Features (Week 3)
**Advanced Inputs:**
- Debt information and optimization
- Emergency fund preferences and opportunity cost
- Current contribution tracking
- "Fun money" allocation preferences

**Enhanced Output:**
- Opportunity cost calculations for skipped items
- Annual projection if plan is followed
- Optimization score with breakdown
- "What if" scenario adjustments

### 9.3 Phase 3: Educational & Polish (Week 4)
**Educational Features:**
- Progressive disclosure "show me why" explanations
- Contrarian advice explanations with math
- Links to related BufoIndex tools and articles
- Tax bracket and contribution limit education

**Polish & Performance:**
- Animation and micro-interactions
- Improved mobile performance
- Enhanced sharing capabilities
- Analytics integration

### 9.4 Future: Next.js Migration Preparation
**Documentation Phase:**
- Component boundary documentation
- State management migration plan
- TypeScript interface definitions
- Component library integration strategy

**Migration Readiness:**
- Calculation engine separated from UI
- React-style data flow patterns
- Modular component architecture
- State management compatible with Zustand/Redux

---

## 10. Future Enhancements

### 10.1 Advanced Features (Post-MVP)
- **Bonus allocation optimizer**: Handle irregular income
- **Multi-paycheck planning**: Coordinate married couples' paychecks
- **Tax-loss harvesting integration**: Coordinate with taxable account management
- **Quarterly optimization**: Adjust allocation based on year-to-date progress

### 10.2 Integration Opportunities  
- **BufoIndex ecosystem**: Feed data to/from other calculators
- **Calendar integration**: Set contribution change reminders
- **Banking integrations**: Track actual vs planned allocations
- **Tax software integration**: Export optimization strategies

### 10.3 Next.js Migration Features
- **Server-side calculations**: Handle complex scenarios
- **Database integration**: Save user preferences and history
- **Advanced visualizations**: Interactive charts and projections
- **Real-time updates**: Market condition integration

---

## Appendix A: Calculation Examples

### Example 1: Software Engineer Optimization
**Profile:**
- Age 28, $6,000/month take-home
- 22% federal bracket, CA state taxes
- Employer 401k with 50% match up to 6%
- HSA eligible, no high-interest debt
- Currently saving 10%, wants to increase to 20%

**Current Allocation:**
- 401k: 6% ($480)
- Savings account: $600 (emergency fund building)
- Remaining: $4,920 (lifestyle and "savings" account)

**Optimized Allocation:**
1. 401k match: $480 (keep current)
2. HSA max: $692 (new)
3. Roth IRA: $583 (new)
4. Additional 401k: $500 (tax optimization)
5. Taxable investing: $245 (remaining allocated amount)
6. Fun money: $4,000 (preference)

**Impact:**
- Tax savings: $1,800/year (HSA + additional 401k)
- 10-year wealth gain: $287,000 vs current approach
- Emergency fund recommendation: Reduce to 3 months, invest difference

### Example 2: Contrarian Advice Case
**Profile:**
- Dual income, $8,000/month combined take-home
- 8-month emergency fund ($32,000 in savings)
- Extra mortgage payments: $800/month on 3% rate
- Not maxing HSAs or employer matches

**Conventional Approach Issues Detected:**
- Missing $4,800/year in employer matches
- $32,000 emergency fund opportunity cost: $421,000 over 20 years
- Extra mortgage payments vs investing: $156,000 opportunity cost over 20 years

**Optimized Allocation:**
1. Both employer matches: $900/month
2. HSA contributions: $1,384/month (both spouses)
3. Reduce emergency fund to $12,000 (3 months)
4. Stop extra mortgage payments
5. Invest the difference: $1,520/month to taxable accounts

**Total Optimization Impact: $577,000 additional wealth over 20 years**

---

## Appendix B: Technical Specifications

### B.1 Data Structures
```javascript
const PaycheckProfile = {
  income: {
    gross: number,
    net: number,
    frequency: 'monthly' | 'bi-weekly' | 'weekly'
  },
  taxes: {
    federalBracket: number, // 0.10, 0.12, 0.22, etc.
    state: string,
    filingStatus: 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold',
    currentWithholding: number
  },
  benefits: {
    employer401k: {
      available: boolean,
      matchPercent: number,
      matchLimit: number, // as percentage of salary
      currentContribution: number // current percentage
    },
    hsa: {
      eligible: boolean,
      employerContribution: number,
      currentContribution: number
    }
  },
  debts: [{
    name: string,
    balance: number,
    interestRate: number,
    minimumPayment: number
  }],
  preferences: {
    emergencyFundMonths: number, // 0-12 slider
    funMoneyRange: { min: number, max: number },
    riskTolerance: 'conservative' | 'moderate' | 'optimizer'
  }
};

const AllocationResult = {
  allocations: [{
    account: string,
    amount: number,
    priority: number,
    reasoning: string,
    taxImpact: number
  }],
  skippedItems: [{
    item: string,
    reasoning: string,
    opportunityCost: number
  }],
  summary: {
    totalAllocated: number,
    taxSavings: number,
    optimizationScore: number,
    tenYearProjection: number
  }
};
```

### B.2 Core Algorithms
```javascript
function calculateAllocation(profile) {
  let availableAmount = profile.income.net;
  let allocations = [];
  
  // Priority 1: Employer Match (100% return)
  if (profile.benefits.employer401k.available) {
    const matchContribution = calculateEmployerMatch(profile);
    if (matchContribution.additional > 0) {
      allocations.push(matchContribution);
      availableAmount -= matchContribution.amount;
    }
  }
  
  // Priority 2: High-Interest Debt (>7%)
  const highInterestDebt = profile.debts.filter(debt => debt.interestRate > 0.07);
  if (highInterestDebt.length > 0) {
    const debtPayment = calculateOptimalDebtPayment(highInterestDebt, availableAmount);
    allocations.push(debtPayment);
    availableAmount -= debtPayment.amount;
  }
  
  // Priority 3: HSA (Triple tax advantage)
  if (profile.benefits.hsa.eligible) {
    const hsaContribution = calculateHSAOptimal(profile, availableAmount);
    if (hsaContribution.amount > 0) {
      allocations.push(hsaContribution);
      availableAmount -= hsaContribution.amount;
    }
  }
  
  // Continue with remaining priority logic...
  
  return {
    allocations,
    remainingAmount: availableAmount,
    skippedItems: calculateSkippedItems(profile)
  };
}
```

---

*This PRD serves as the comprehensive specification for the BufoIndex Paycheck Allocator, focusing on simple monthly optimization with contrarian, mathematically-driven recommendations for users seeking active financial control.*