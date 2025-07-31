# BufoIndex Feature Backlog

**Last Updated:** 2025-07-26  
**Status:** Ready for Implementation

---

## Epic 1: Site Foundation & Infrastructure

### BUFO-001: Initialize Hugo Site
**Priority:** P0  
**Effort:** Small  
**Status:** COMPLETED  
**Completed:** 2025-01-26  
**Acceptance Criteria:**
- [x] Hugo installed and configured
- [x] Custom theme scaffolding created
- [x] GitHub repository structured properly
- [x] Basic .gitignore configured
**Implementation Notes:** Hugo site initialized with custom 'bufoindex' theme, proper directory structure, and configuration for GitHub Pages deployment.

### BUFO-002: Design System Setup
**Priority:** P0  
**Effort:** Medium  
**Status:** COMPLETED  
**Completed:** 2025-01-26  
**Acceptance Criteria:**
- [x] Tailwind CSS configured with custom colors
- [x] Typography scale defined (serif for articles, mono for data)
- [x] Component library started (buttons, callouts, tables)
- [x] Terminal-style components for math/data display
- [x] Print stylesheet configured
**Implementation Notes:** Tailwind configured with BufoIndex brand colors (sage green #7FB069, terminal black #0A0E1A), custom component classes, and print-friendly styles.

### BUFO-003: GitHub Actions Deployment
**Priority:** P0  
**Effort:** Small  
**Status:** COMPLETED  
**Completed:** 2025-01-26  
**Acceptance Criteria:**
- [x] Hugo build action configured
- [x] Auto-deploy to GitHub Pages on main push
- [x] Build status badge in README
- [ ] Deploy preview for PRs (optional)
**Implementation Notes:** GitHub Actions workflow created for automated Hugo deployment with Tailwind CSS build step. README.md created with build status badge. PR previews remain optional.

### BUFO-004: Homepage Design
**Priority:** P0  
**Effort:** Medium  
**Status:** COMPLETED  
**Completed:** 2025-01-26  
**Acceptance Criteria:**
- [x] Clear value proposition above fold
- [x] Navigation to articles and tools
- [x] Subtle Bufo branding (sage green accents)
- [x] Mobile responsive layout
- [x] Educational disclaimer in footer
**Implementation Notes:** Created responsive homepage with hero section, feature cards, mobile menu, and base templates (baseof.html, single.html, list.html) for the entire site.

---

## Epic 2: Article Infrastructure

### BUFO-005: Article Template
**Priority:** P0  
**Effort:** Medium  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Markdown template with frontmatter
- [x] KaTeX integration for math formulas
- [x] Syntax highlighting for calculations
- [x] Terminal-style callout boxes
- [x] Table of contents generation
- [x] Reading time estimation
**Implementation Notes:** Complete article template system with KaTeX math rendering, syntax highlighting, 4 terminal-style shortcodes (terminal, formula, calculation, note), automatic table of contents, and Hugo's built-in reading time estimation.

### BUFO-006: Article Navigation
**Priority:** P1  
**Effort:** Small  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Category pages (Concepts, Strategies, Advanced)
- [x] Suggested next article at bottom
- [x] Breadcrumb navigation
- [x] Topic progression indicators
**Implementation Notes:** Created category structure with index pages for Concepts, Strategies, and Advanced. Added breadcrumb navigation, next/previous article links, and visual progression indicators showing article position within each category.

### BUFO-007: About Page
**Priority:** P1  
**Effort:** Small  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Mission statement
- [x] Brief mention of Bufo (the frog)
- [x] Author background (percentages, no specifics)
- [x] Contact information
- [x] Educational disclaimer
**Implementation Notes:** Created comprehensive About page with mission statement, Bufo etymology explanation, author background with percentage breakdowns, GitHub contact info, and detailed educational disclaimers covering risk warnings and affiliate transparency.

---

## Epic 3: Foundational Content

### BUFO-008: Article - Understanding Opportunity Cost
**Priority:** P0  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] 2,000+ word comprehensive guide
- [x] Real examples with calculations
- [x] Interactive inline calculator
- [x] Terminal-style formula displays
- [x] Links to related tools
**Implementation Notes:** 3,800+ word comprehensive guide with real estate, education, and investment examples. Python-based calculators, KaTeX formulas, and terminal-style displays throughout.

### BUFO-009: Article - Paycheck Allocation Strategies  
**Priority:** P0  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Fixed expenses vs variable investing concept
- [x] Percentage-based examples
- [x] Flowchart visualization
- [x] Consistent quality of life focus
- [x] Automation strategies
**Implementation Notes:** 4,200+ word guide with 50/30/20 rule breakdown, emergency fund strategies, and Python-based allocation calculators. Includes flowchart for decision making and automation setup guides.

### BUFO-010: Article - Why Tracking Wealth Matters
**Priority:** P1  
**Effort:** Medium  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Benefits of comprehensive tracking
- [x] Tool comparison (Monarch focus)
- [x] Setup best practices
- [x] Monthly review process
- [x] NO affiliate links (per requirements)
**Implementation Notes:** 3,600+ word guide covering net worth calculations, tool comparisons (Monarch, Personal Capital, YNAB), and monthly review frameworks. No affiliate links included per requirements.

---

## Epic 4: Strategy Articles

### BUFO-011: Article - Why SGOV Beats Your HYSA
**Priority:** P0  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Tax efficiency calculations
- [x] Liquidity comparison
- [x] Risk analysis (minimal)
- [x] State tax considerations
- [x] Interactive yield calculator
**Implementation Notes:** 4,000+ word analysis with detailed tax efficiency calculations, state-by-state comparison tables, and Python-based yield calculators. Covers T+1 settlement vs instant access trade-offs.

### BUFO-012: Article - The CD Myth (Sometimes)
**Priority:** P1  
**Effort:** Medium  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] When CDs make sense (rarely)
- [x] Opportunity cost analysis
- [x] Ladder strategies debunked
- [x] SGOV/T-Bill comparison
- [x] Historical data visualization
**Implementation Notes:** 3,200+ word analysis debunking CD ladder strategies with mathematical proof of opportunity costs. Includes rare scenarios where CDs make sense and historical rate comparisons.

### BUFO-013: Article - Credit Card Optimization Guide
**Priority:** P1  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Category spending analysis
- [x] No-fee vs annual fee math
- [x] Travel vs cashback strategies
- [x] Recommended combinations
- [x] Link to optimizer tool
**Implementation Notes:** 4,500+ word comprehensive guide with spending category analysis, annual fee break-even calculations, and detailed card combination strategies (Chase Trifecta, Capital One Duo, etc.). Includes Python calculators for optimization.

---

## Epic 5: Advanced Strategy Articles

### BUFO-014: Article - Portfolio Lines of Credit
**Priority:** P2  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Securities-based lending explained
- [x] Risk management strategies
- [x] Interest rate comparisons
- [x] Use cases (real estate, opportunities)
- [x] Major broker comparison
**Implementation Notes:** 4,100+ word deep-dive into securities-based lending with comprehensive broker comparison (Interactive Brokers, Schwab, Fidelity, etc.), risk management frameworks, and real-world use case analysis.

### BUFO-015: Article - Leveraged ETF Strategies
**Priority:** P2  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Volatility drag explained with math
- [x] Rebalancing strategies
- [x] Risk/reward analysis
- [x] Historical performance data
- [x] Link to risk profiler tool
**Implementation Notes:** 4,300+ word mathematical analysis of leveraged ETFs with volatility drag calculations, rebalancing strategies, and historical performance comparisons. Includes Python simulations and risk management frameworks.

### BUFO-016: Article - Roth vs HSA vs 401(k) Prioritization
**Priority:** P2  
**Effort:** Large  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Tax efficiency comparison
- [x] Why maxing isn't always optimal
- [x] Age-based strategies
- [x] State tax considerations
- [x] Decision flowchart
**Implementation Notes:** 4,600+ word comprehensive analysis with tax efficiency calculations across different income levels and ages. Includes decision flowcharts and state-specific tax considerations. Challenges conventional wisdom about contribution prioritization.

### BUFO-017: Article - Margin Leverage Explained
**Priority:** P3  
**Effort:** Medium  
**Status:** COMPLETED
**Completed:** 2025-07-26
**Acceptance Criteria:**
- [x] Portfolio margin vs Reg T
- [x] Risk management rules
- [x] Interest rate comparison
- [x] Tax implications
- [x] Warning callouts
**Implementation Notes:** 4,800+ word advanced guide covering portfolio margin vs Regulation T differences, comprehensive risk management rules, and broker rate comparisons. Includes extensive warning callouts and tax implications analysis.

---

## Epic 6: Interactive Tools

### BUFO-018: Credit Card Optimizer Tool
**Priority:** P1  
**Effort:** Large  
**Acceptance Criteria:**
- [ ] Spending category form inputs
- [ ] Annual fee tolerance slider
- [ ] Travel vs cashback toggle
- [ ] Real-time recommendation updates
- [ ] Results show annual value
- [ ] URL hash persistence
- [ ] Share results feature
- [ ] Link to explanation article

**Card Combinations to Include:**
- Chase Trifecta (CSP/CSR + Freedom + Freedom Unlimited)
- Capital One Duo (Venture X + Savor One)  
- Cashback Simplified (Robinhood Gold + Citi Double Cash)
- No-Fee Maximizer (Wells Fargo Active Cash + Citi Custom Cash)

### BUFO-019: Leveraged ETF Risk Profiler
**Priority:** P2  
**Effort:** X-Large  
**Acceptance Criteria:**
- [ ] Risk tolerance questionnaire
- [ ] Historical volatility analysis
- [ ] Leverage ratio recommendations
- [ ] Monte Carlo simulations
- [ ] Rebalancing frequency impact
- [ ] Expense ratio calculations
- [ ] Downloadable results
- [ ] Terminal-style data display

### BUFO-020: Rent vs Buy Calculator
**Priority:** P1  
**Effort:** Large  
**Status:** COMPLETED  
**Completed:** 2025-07-26  
**Acceptance Criteria:**
- [x] Property price and monthly rent inputs
- [x] Mortgage parameters (down payment %, interest rate, term)
- [x] Investment assumptions (stock returns, real estate appreciation)
- [x] Tax considerations (property tax rate, income tax bracket)
- [x] Maintenance and transaction costs
- [x] Time horizon selector (5-30 years)
- [x] Net worth comparison visualization over time
- [x] Breakeven analysis showing crossover point
- [x] US market adaptations (property tax by state, PMI, HOA)
- [x] Terminal-style results display
- [x] URL hash persistence for sharing scenarios
- [x] Export results as CSV/JSON

### BUFO-029: Retirement Planning Dashboard
**Priority:** P1  
**Effort:** X-Large  
**Status:** IN PROGRESS  
**Started:** 2025-07-31  

#### Phase 1: Core Retirement Planning (COMPLETED)
**Acceptance Criteria:**
- [x] Three retirement scenario comparison (A/B/C) with real-time calculations
- [x] Multiple financial inputs: starting age (18-65), retirement ages (30-80), target income, starting balance, current income
- [x] Investment parameters: accumulation/retirement phase returns, volatility modeling, inflation adjustment
- [x] Account type selection (Traditional/Roth/Taxable)
- [x] Terminal-style interface matching BufoIndex theme
- [x] URL hash persistence for sharing
- [x] Export to CSV functionality

#### Phase 2: Advanced Financial Calculations (COMPLETED)
**Acceptance Criteria:**
- [x] Federal tax brackets (2024 rates) with after-tax cost display
- [x] State income tax for 10 states (CA, TX, NY, FL, WA, NV, IL, PA, OH, NC)
- [x] Capital gains tax calculations and tax-efficient contribution strategies
- [x] Social Security integration with age-based benefit adjustments (62-70)
- [x] Early/late claiming calculations with automatic benefit adjustments
- [x] Healthcare cost modeling with base projections, age adjustments, separate inflation rate (5.5%)
- [x] Customizable healthcare multiplier (1x-3x) with pre/post Medicare differences

#### Phase 3: Monte Carlo Simulation Engine (COMPLETED)
**Acceptance Criteria:**
- [x] 100-10,000 configurable simulation runs
- [x] Success probability calculation with sequence of returns risk analysis
- [x] Portfolio survival probability by age with percentile distributions (10th, 25th, 50th, 75th, 90th)
- [x] Worst-case and best-case portfolio balance tracking
- [x] Minimum balance tracking throughout retirement

#### Phase 4: Advanced Metrics & Insights (COMPLETED)
**Acceptance Criteria:**
- [x] Personalized safe withdrawal rate calculation with visual indicator
- [x] Break-even analysis timeline showing crossover points
- [x] Risk analysis metrics with sequence of returns risk factor
- [x] Portfolio survival mini-charts for each scenario
- [x] Automated insights: early vs late retirement impact, tax strategy recommendations
- [x] Social Security optimization suggestions and healthcare cost projections
- [x] Inflation impact analysis and time vs money trade-offs
- [x] Total contribution comparisons and return assumption validation

#### Phase 5: User Experience Enhancements (COMPLETED)
**Acceptance Criteria:**
- [x] Dark mode support with system preference detection and manual toggle
- [x] Preset scenarios: Conservative (6% return, 10% volatility), Moderate (8% return, 15% volatility), Aggressive (12% return, 20% volatility), FIRE Movement optimized
- [x] Guided tour functionality with 6-step interactive walkthrough
- [x] Inflation toggle to switch between today's dollars and future dollars
- [x] Input enhancements: range sliders with live values, currency formatting, percentage displays
- [x] Real-time validation with error messages and tooltips for financial terms
- [x] Loading states with smooth overlay and calculation progress indication

#### Phase 6: Data Visualization (IN PROGRESS)
**Acceptance Criteria:**
- [ ] Interactive charts with Chart.js: annual withdrawal projections, net worth over time
- [ ] Monte Carlo success probability visualization with zoom and pan functionality
- [ ] Portfolio distribution at retirement with interactive legends
- [ ] Click-to-select data points with detailed popups and hover tooltips
- [ ] Milestone markers: Social Security eligibility (62), Medicare (65), full retirement age (67), RMDs (72)
- [ ] Visual indicators: break-even point highlighting, portfolio depletion warnings
- [ ] Success threshold lines and risk zone shading with confidence bands
- [ ] Chart annotations for key events, market crash scenarios, life event markers

#### Phase 7: Advanced Financial Modeling (PLANNED)
**Acceptance Criteria:**
- [ ] Goal-based planning with reverse calculation from retirement lifestyle
- [ ] Multiple financial goals tracking with priority-based funding
- [ ] Goal achievement probability and trade-off analysis
- [ ] Life events modeling: major purchases, education expenses, inheritance scenarios
- [ ] Emergency fund requirements and income scenarios (part-time work, pensions)
- [ ] Market crash scenarios with historical replay (2008, 2000, 1987)
- [ ] Custom downturn modeling with recovery time analysis and stress testing

#### Phase 8: Optimization Engine (PLANNED)
**Acceptance Criteria:**
- [ ] Contribution optimization with optimal monthly contribution path
- [ ] Front-loading vs steady contributions and employer match maximization
- [ ] Catch-up contribution planning and tax bracket optimization
- [ ] Advanced withdrawal strategies: dynamic spending rules, guardrail strategies
- [ ] Floor and ceiling approach with bucket strategy modeling
- [ ] Tax optimization: Roth conversion ladder planning, tax-loss harvesting
- [ ] Asset location optimization and state tax arbitrage
- [ ] Portfolio optimization with efficient frontier analysis and glide path optimization

#### Phase 9: Export & Mobile (PLANNED)
**Acceptance Criteria:**
- [ ] Export to PDF functionality with detailed report generation
- [ ] Mobile responsive design optimization with touch-friendly controls
- [ ] Tablet optimization with flexible grid system
- [ ] Accessibility improvements: semantic HTML, ARIA labels, keyboard navigation
- [ ] High contrast support in dark mode and graceful error handling

**Implementation Notes:** 
- Core calculator with Monte Carlo simulations complete
- Phases 1-5 fully implemented with comprehensive financial modeling
- Integrated with BufoIndex terminal theme and color palette
- Modular JavaScript architecture following project patterns
- Performance optimizations: memoized calculations, debounced updates, optimized chart rendering
- Privacy-focused: client-side only calculations, no data transmission, no cookies or tracking

**Current Status:** Phase 6 (Data Visualization) in progress, Phases 7-9 planned for future development

### BUFO-021: Tool Data Pipeline
**Priority:** P1  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] GitHub Action for weekly updates
- [ ] Treasury rate fetching
- [ ] ETF price history collection
- [ ] Credit card terms updates
- [ ] JSON schema validation
- [ ] Error notifications

---

## Epic 7: User Experience Enhancements

### BUFO-022: URL Hash State Management
**Priority:** P1  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] Compress tool state to short hash
- [ ] Decode hash to repopulate forms
- [ ] Shareable links work correctly
- [ ] Bookmark functionality tested
- [ ] No data sent to server

### BUFO-023: Mobile Optimization
**Priority:** P1  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] Touch-friendly tool interfaces
- [ ] Responsive data tables
- [ ] Readable without zoom
- [ ] Fast load on 3G
- [ ] Progressive enhancement

### BUFO-024: Accessibility Compliance
**Priority:** P1  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] WCAG 2.1 AA audit passed
- [ ] Keyboard navigation complete
- [ ] Screen reader tested
- [ ] Color contrast verified
- [ ] Focus indicators visible

---

## Epic 8: Performance & Quality

### BUFO-025: Performance Optimization
**Priority:** P2  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] PageSpeed score 95+
- [ ] Images optimized
- [ ] CSS/JS minified
- [ ] Lazy loading implemented
- [ ] CDN configured

### BUFO-026: Testing Framework
**Priority:** P2  
**Effort:** Medium  
**Acceptance Criteria:**
- [ ] Calculator unit tests
- [ ] Data pipeline tests
- [ ] Build smoke tests
- [ ] Link checker
- [ ] Accessibility tests

### BUFO-027: Analytics Setup
**Priority:** P3  
**Effort:** Small  
**Acceptance Criteria:**
- [ ] Privacy-focused analytics (Plausible)
- [ ] Custom events for tools
- [ ] No personal data collection
- [ ] GDPR compliant
- [ ] Monthly reports

### BUFO-028: US Investment Account Contribution Planning Tool
**Priority:** P1  
**Effort:** X-Large  
**Acceptance Criteria:**
- [ ] Multi-account type support (401k, Roth IRA, Traditional IRA, HSA, Taxable)
- [ ] Current and projected income inputs with tax bracket calculation
- [ ] Age-based contribution limits and catch-up contributions
- [ ] Employer 401k match configuration and optimization
- [ ] State tax integration for all 50 states plus DC
- [ ] Early retirement accessibility analysis (age 35-59.5)
- [ ] Roth conversion ladder planning and timing
- [ ] Tax arbitrage calculations and recommendations
- [ ] Mega Backdoor Roth eligibility and strategy planning
- [ ] HSA triple tax advantage optimization
- [ ] Geographic arbitrage planning (current vs retirement state)
- [ ] Annual contribution capacity optimization across all account types
- [ ] Tax-efficient withdrawal sequence planning for early retirement
- [ ] Real-time priority recommendations based on current situation
- [ ] Interactive decision tree with explanations
- [ ] Multi-year projection and rebalancing recommendations
- [ ] URL hash persistence for sharing scenarios
- [ ] Export results as detailed PDF report

**Early Retirement Specific Features:**
- Bridge strategy planning (ages 35-59.5)
- Roth IRA contribution access timeline (5-year rule)
- SEPP/72(t) early withdrawal calculation
- Taxable account bridge funding requirements
- Healthcare coverage gap planning (pre-Medicare)
- State residency optimization for tax efficiency

**Tax Planning Integration:**
- Current vs future tax rate analysis
- Traditional vs Roth optimization by account type
- Required Minimum Distribution (RMD) planning
- Estate planning considerations for beneficiaries
- Tax-loss harvesting coordination
- Multi-bracket optimization across retirement years

**Data Sources Required:**
- Current tax brackets (federal and state)
- Contribution limits by year and account type
- State tax rates and retirement account treatment
- Standard deduction and personal exemption amounts
- Saver's Credit income limits and percentages

---

## Implementation Order

### Week 1: Foundation
1. BUFO-001: Initialize Hugo Site
2. BUFO-002: Design System Setup  
3. BUFO-003: GitHub Actions Deployment
4. BUFO-004: Homepage Design

### Week 2-3: Article Infrastructure
5. BUFO-005: Article Template
6. BUFO-006: Article Navigation
7. BUFO-007: About Page

### Week 4-6: Core Content
8. BUFO-008: Understanding Opportunity Cost
9. BUFO-009: Paycheck Allocation Strategies
10. BUFO-011: Why SGOV Beats Your HYSA

### Week 7-8: First Tool
11. BUFO-021: Tool Data Pipeline
12. BUFO-018: Credit Card Optimizer Tool
13. BUFO-022: URL Hash State Management

### Future Sprints
- Additional articles based on learning
- Leveraged ETF tool when ready
- Performance and accessibility improvements
- Community feedback incorporation

---

## Definition of Done

For all features:
- [ ] Code reviewed if applicable
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Mobile responsive verified
- [ ] Accessibility checked
- [ ] Documentation updated
- [ ] Deployed to production

For articles:
- [ ] Fact-checked and reviewed
- [ ] Math formulas verified
- [ ] Examples calculated correctly
- [ ] Links working
- [ ] SEO metadata complete

For tools:
- [ ] Calculations unit tested
- [ ] Edge cases handled
- [ ] Error states designed
- [ ] Performance acceptable
- [ ] State persistence working

---

*This backlog is prioritized for MVP delivery with a focus on core educational content and one functional tool.*