# Product Requirements Document (PRD)

**Project:** BufoIndex.com  
**Version:** 3.0 Final  
**Last Updated:** 2025-07-26

---

## Executive Summary

### Vision
BufoIndex.com is a personal finance education platform that bridges the gap between basic financial advice and the sophisticated strategies used by wealthy individuals. Named after Bufo (the founder's frog), it provides transparent documentation of real financial decisions alongside interactive tools for modeling complex scenarios.

### Problem Statement
Young professionals seeking aggressive wealth accumulation find only basic personal finance advice ("save 20%") or overly complex institutional strategies. There's no resource that explains leverage, tax optimization, and opportunity cost in an accessible yet sophisticated manner with real examples.

### Solution
A static website combining:
- **Educational articles** documenting real portfolio decisions with percentages (not dollar amounts)
- **Interactive calculators** for modeling leveraged strategies and optimization
- **Academic presentation** with financial terminal aesthetics for data display
- **No monetization** - purely educational resource

### Key Principles
1. **Transparency** - Show actual strategies being used
2. **Sophistication** - Go beyond basic advice
3. **Accessibility** - Explain complex concepts clearly
4. **Practicality** - Focus on actionable strategies

---

## Target Audience

### Primary: "The Young Professional Optimizer"
**Profile:**
- Age: 25-35
- Income: $80k-200k
- Savings rate: 20-50%
- Goal: Aggressive wealth accumulation and early retirement

**Characteristics:**
- Already maxing tax-advantaged accounts
- Comfortable with calculated risks
- Seeks strategies beyond "index and chill"
- Values data-driven decisions

**What They Want:**
- Leverage strategies that aren't reckless
- Tax optimization beyond basic advice
- Real examples with performance data
- Tools to model their own scenarios

---

## Design Language

### Visual Identity
**Color Palette:**
- Primary: Soft sage green (#7FB069) - subtle Bufo reference
- Terminal Black: #0A0E1A - tool backgrounds  
- Terminal Green: #00FF41 - positive values
- Monospace Accent: #FFB86C - highlighted data
- Article Background: Off-white (#FAFAF9)
- Text: #1A202C (light), #E4E4E7 (dark)

### Typography & Layout
**Articles:**
- Serif font (Charter, Crimson Pro) for body text
- Clean, academic paper aesthetic
- Wide margins, comfortable line length
- LaTeX-style mathematical formulas

**Tools & Data:**
- Monospace fonts (IBM Plex Mono, Fira Code)
- Terminal-style interfaces
- Dense data layouts like Bloomberg
- ASCII-style progress indicators

**Callouts & Math:**
- Dark terminal boxes with green text
- Syntax highlighting for calculations
- Grid-based data tables
- Minimal, high-contrast charts

---

## Content Strategy

### Blog Categories

#### Foundational Concepts
1. **Understanding Opportunity Cost** - The framework underlying all decisions
2. **Paycheck Allocation Strategies** - Fixed lifestyle costs, variable investing
3. **Why Tracking Matters** - Introduction to Monarch and methodology

#### Intermediate Strategies  
4. **Why SGOV Beats Your HYSA** - Tax efficiency and flexibility
5. **The CD Myth** - When fixed income makes sense (rarely)
6. **Credit Card Optimization** - Maximizing rewards without complexity

#### Advanced Techniques
7. **Portfolio Lines of Credit** - Using securities-based lending wisely
8. **Leveraged ETF Strategies** - Understanding volatility drag and rebalancing
9. **Roth vs HSA vs 401(k)** - Why maxing everything isn't always optimal
10. **Margin Leverage Explained** - Risk management for aggressive growth

### Writing Guidelines
- **Tone:** Professional but approachable, never condescending
- **Examples:** Use percentages, not dollar amounts
- **Math:** Show formulas inline with clear explanations
- **Length:** 1,500-3,000 words for deep dives
- **Visuals:** Terminal-style data displays, minimal charts

---

## Feature Specifications

### Static Site Architecture
- **Generator:** Hugo (latest version)
- **Hosting:** GitHub Pages (free tier)
- **Build:** GitHub Actions for automated deployment
- **CSS Framework:** Tailwind CSS with custom configuration
- **JavaScript:** Vanilla JS for tools (no framework dependencies)

### Article Features
- **Mathematical Formulas:** KaTeX for LaTeX rendering
- **Code Blocks:** Syntax highlighting for calculations
- **Interactive Elements:** Embedded mini-calculators
- **Navigation:** Topic-based grouping with suggested reading order
- **Print CSS:** Clean formatting for PDF saving

### Tool Specifications

#### Credit Card Optimizer
**Purpose:** Recommend optimal card combinations based on spending patterns

**Features:**
- Spending category inputs (groceries, dining, travel, etc.)
- Annual fee tolerance slider
- Travel vs cashback preference toggle
- Recommendations: Chase Trifecta, Venture X + Savor One, Robinhood Gold

**Implementation:**
- Static data file with current card benefits
- Client-side calculation only
- Shareable results via URL hash

#### Leveraged ETF Risk Profiler
**Purpose:** Find optimal leverage ratio based on risk tolerance

**Features:**
- Historical volatility analysis
- Rebalancing frequency impact
- Expense ratio calculations
- Monte Carlo simulations

**Data Requirements:**
- Daily ETF prices via GitHub Actions
- Static JSON files updated weekly
- No real-time API calls

#### Rent vs Buy Calculator
**Purpose:** Compare long-term wealth outcomes between renting and homeownership

**Features:**
- Property price and monthly rent inputs
- Mortgage parameters (down payment, interest rate, term)
- Investment return assumptions (stocks vs real estate)
- Tax considerations (property tax, income tax brackets)
- US-specific factors (PMI, HOA, SALT deduction limits)
- Time horizon modeling (5-30 years)
- Net worth comparison visualization
- Breakeven analysis

**Implementation:**
- Based on PWL Capital's "5% Rule" methodology
- Static calculation engine with no external data
- Terminal-style results display
- Shareable scenarios via URL hash

#### Retirement Planning Dashboard
**Purpose:** Comprehensive retirement planning with Monte Carlo simulations and advanced financial modeling

**Core Features:**
- **Multiple Retirement Scenarios:** Compare 3 different retirement ages simultaneously with real-time calculations
- **Advanced Financial Inputs:** Starting age (18-65), retirement ages (30-80), target income, starting balance, current income, Social Security benefits, healthcare costs
- **Investment Parameters:** Accumulation/retirement phase returns, volatility modeling, inflation adjustment, account type selection (Traditional/Roth/Taxable)
- **Tax Calculations:** Federal tax brackets (2024), state income tax for 10 states, capital gains, tax-efficient strategies
- **Social Security Integration:** Age-based benefit adjustments (62-70), early/late claiming calculations
- **Healthcare Cost Modeling:** Base projections with age adjustments, separate inflation rate (5.5%), customizable multiplier (1x-3x)

**Advanced Analytics:**
- **Monte Carlo Simulation:** 100-10,000 configurable runs, success probability, sequence of returns risk, portfolio survival by age
- **Personalized Safe Withdrawal Rate:** Break-even analysis, risk metrics, portfolio survival mini-charts
- **Automated Insights:** Early vs late retirement impact, tax strategy recommendations, Social Security optimization, healthcare projections

**User Experience:**
- **Interactive Charts:** Annual withdrawal projections, net worth over time, Monte Carlo success probability with zoom/pan
- **Dark Mode:** System preference detection, manual toggle, chart theme adaptation
- **Preset Scenarios:** Conservative, Moderate, Aggressive, FIRE Movement optimized
- **Guided Tour:** 6-step interactive walkthrough with context-sensitive help
- **Inflation Toggle:** Switch between today's dollars and future dollars

**Data Management:**
- **URL State Persistence:** All inputs saved to URL for sharing and bookmarking
- **Export Capabilities:** CSV export, PDF report generation, URL sharing
- **Performance:** Memoized calculations, debounced updates, optimized chart rendering

**Implementation:**
- Client-side only calculations with no data transmission
- Chart.js for interactive visualizations
- Modular JavaScript architecture following project patterns
- Terminal-style interface matching BufoIndex theme

### Data Persistence
- **URL Hash System:** Compress form state to shareable hash
- **Bookmarking:** All tool states can be bookmarked
- **No Accounts:** Completely anonymous usage
- **Export:** Results downloadable as JSON/CSV

---

## Technical Requirements

### Performance
- Page load < 2s on 3G
- Tool calculations < 50ms
- Static site score 95+ on PageSpeed

### Accessibility  
- WCAG 2.1 AA compliant
- Keyboard navigable tools
- Screen reader friendly
- High contrast mode

### Browser Support
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile responsive

### Data Updates
- GitHub Actions cron jobs
- Weekly updates for:
  - Treasury rates
  - ETF prices  
  - Credit card terms
- Committed as JSON to repo

---

## Information Architecture

```
/
├── index.html              # Landing with value prop
├── about/                  # Mission and Bufo story
├── concepts/               # Foundational articles
│   ├── opportunity-cost/
│   ├── paycheck-allocation/
│   └── tracking-wealth/
├── strategies/             # Intermediate articles  
│   ├── sgov-vs-hysa/
│   ├── credit-optimization/
│   └── cd-myths/
├── advanced/               # Leveraged strategies
│   ├── portfolio-loans/
│   ├── leveraged-etfs/
│   └── margin-strategies/
├── tools/                  # Interactive calculators
│   ├── credit-cards/
│   ├── leverage-profiler/
│   ├── rent-vs-buy/
│   └── retirement-planning/
└── data/                   # JSON data files
    ├── rates.json
    ├── etf-prices.json
    └── card-benefits.json
```

---

## Success Metrics

### Engagement (6-month targets)
- 5,000 monthly unique visitors
- Average session: 5+ minutes
- Tool usage: 30% of visitors
- Bookmark rate: 10% of tool users

### Quality Indicators
- Zero calculation errors reported
- 95+ PageSpeed score maintained
- Accessible to screen readers
- Mobile usage: 40% with full functionality

### Growth Metrics
- Organic search: 60% of traffic
- Direct traffic: 30% (bookmarks/shares)
- GitHub stars: 100+

---

## MVP Deliverables

### Phase 1: Foundation (Week 1)
1. Hugo site with custom theme
2. Tailwind configuration  
3. GitHub Actions deployment
4. Homepage and information architecture

### Phase 2: Core Content (Week 2-4)
1. Three foundational articles
2. Article template with KaTeX
3. Terminal-style callout components
4. Print-friendly CSS

### Phase 3: First Tool (Week 5-6)
1. Credit Card Optimizer
2. URL hash persistence
3. Data update pipeline
4. Results sharing

### Future Phases
- Additional tools
- More articles as learnings emerge
- Community contributions via PR
- Translation to other languages

---

## Constraints & Decisions

### What We're NOT Building
- User accounts or authentication
- Real-time trading tools
- Personalized advice
- Comment systems
- Email newsletters
- Monetization features

### Technology Choices
- **Hugo:** Fast builds, markdown-native
- **Tailwind:** Consistent design system
- **Vanilla JS:** No framework overhead
- **GitHub Pages:** Free, reliable hosting
- **KaTeX:** Fast math rendering

### Content Guidelines
- No specific investment recommendations
- No dollar amounts, only percentages
- Educational purpose disclaimer
- Focus on methodology over outcomes

---

## Risk Mitigation

### Technical Risks
- **Data accuracy:** Automated tests for calculations
- **Browser compatibility:** Progressive enhancement
- **Performance:** Static generation, CDN delivery

### Content Risks  
- **Liability:** Clear educational disclaimers
- **Accuracy:** Peer review before publishing
- **Relevance:** Annual content audits

### Project Risks
- **Scope creep:** MVP focus, iterative delivery
- **Maintenance:** Automated updates, simple architecture

---

*This document represents the complete vision for BufoIndex.com as a free educational resource for sophisticated personal finance strategies.*