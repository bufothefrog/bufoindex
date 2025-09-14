# Product Requirements Document (PRD)

**Project:** BufoIndex.com  
**Version:** 4.0 - Next.js Migration  
**Last Updated:** 2025-08-26

---

## Executive Summary

### Vision
BufoIndex.com is a personal finance optimization platform that bridges the gap between basic financial advice and the sophisticated strategies used by wealthy individuals. Named after Bufo (the founder's frog), it provides transparent documentation of real financial decisions alongside interactive calculators for modeling complex scenarios.

### Problem Statement
Young professionals seeking aggressive wealth accumulation find only basic personal finance advice ("save 20%") or overly complex institutional strategies. There's no resource that explains optimization, tax strategies, and opportunity cost in an accessible yet sophisticated manner with real examples and actionable tools.

### Solution
A modern web application combining:
- **Interactive calculators** for modeling optimized strategies and scenarios
- **Clear value propositions** showing the cost of conventional wisdom
- **Clean, modern interface** with data-focused design for analysis
- **No monetization** - purely educational resource

### Key Principles
1. **Transparency** - Show actual strategies being used
2. **Sophistication** - Go beyond basic advice  
3. **Accessibility** - Explain complex concepts clearly
4. **Practicality** - Focus on actionable strategies
5. **Optimization** - Challenge conventional wisdom with math

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
- Questions conventional financial wisdom

**What They Want:**
- Optimization strategies that aren't reckless
- Tax efficiency beyond basic advice
- Real examples with performance data
- Tools to model their own scenarios
- Specific action items, not general guidance

### Secondary: High Earners with Complex Situations
- Multiple income sources, business ownership
- Advanced tax situations (AMT, NIIT, multi-state)
- Seeking advisor-level insights without advisor fees
- Comfortable with contrarian approaches

---

## Design System

### Visual Identity
**Color Palette:**
- Primary: Soft sage green (#7FB069) - subtle Bufo reference
- Supporting: Clean grays, whites, and accent colors via shadcn/ui
- Data displays: High contrast, professional presentation

### Typography & Layout
- Clean, modern sans-serif fonts (Inter, system fonts)
- Card-based layouts for calculators and results
- Wide margins, comfortable spacing
- Mobile-first responsive design
- High contrast for data readability

### Component System
- **shadcn/ui component library** for consistency
- **Atomic design principles** (atoms → molecules → organisms)
- **Accessible by default** (WCAG 2.1 AA compliance)
- **Mobile-optimized** touch interfaces

---

## Technical Architecture

### Core Technology Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand for calculator state
- **Data Persistence**: URL hash encoding for sharing
- **Deployment**: Vercel (replacing GitHub Pages)
- **Package Management**: npm

### Architecture Principles
- **Client-side calculations** - no backend API required
- **Static generation** where possible for performance
- **Progressive enhancement** - works without JavaScript
- **Component reusability** across calculators
- **Type-safe data models** throughout

### File Structure
```
site-rework/
├── app/                          # Next.js App Router
│   ├── globals.css
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Homepage
│   └── tools/
│       ├── paycheck-allocator/
│       │   └── page.tsx
│       └── retirement-calculator/
│           └── page.tsx
├── components/
│   ├── calculators/             # Calculator-specific components
│   ├── shared/                  # Reusable components
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── calculations/            # Shared calculation engines
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Helper functions
└── hooks/                       # Custom React hooks
```

---

## Site Architecture

### URL Structure
```
/                                # Homepage with calculator links
├── /tools/paycheck-allocator    # Monthly allocation optimizer
├── /tools/retirement-calculator # Retirement planning tool
└── /tools/[future-calculators]  # Expandable pattern
```

### Navigation Strategy
- **Homepage-centric**: All calculators accessible from main page
- **Direct links**: No intermediate tools index page
- **Calculator cards**: Preview functionality and value prop
- **Expandable grid**: Easy to add new calculators

---

## Calculator Specifications

### 1. Paycheck Allocator (Implemented)
**Purpose**: Smart monthly allocation for your next paycheck

**Key Features**:
- Progressive input collection (2-5 minutes)
- Tax bracket optimization
- Account prioritization algorithm
- Contrarian recommendations (emergency fund, debt strategy)
- Mobile-first design with touch-optimized interface

**Technical Implementation**:
- Next.js 14 with TypeScript
- Zustand state management
- shadcn/ui components
- URL hash state persistence
- Real-time calculation updates

### 2. Retirement Calculator (To Migrate)
**Purpose**: Comprehensive retirement planning with Monte Carlo simulations

**Current Features** (Hugo/Vanilla JS):
- Multiple retirement scenarios comparison
- Advanced financial inputs and tax calculations
- Monte Carlo simulation (configurable runs)
- Interactive charts with zoom/pan
- Dark mode support
- URL state persistence

**Migration Requirements**:
- Port to Next.js/TypeScript architecture
- Integrate with shared component library
- Maintain all existing calculation functionality
- Improve mobile experience
- Add integration with paycheck allocator data

### 3. Future Calculator Pipeline
**Planned Calculators**:
- **Cost of Conservative**: Show hidden costs of "safe" strategies
- **Account Optimizer**: Real-time account prioritization
- **Tax Strategy**: Multi-year tax optimization planning
- **Early Retirement**: FIRE timeline and withdrawal strategies

---

## Shared Foundation

### Calculation Libraries
```typescript
// Shared calculation engines
export class TaxCalculations {
  static federalBrackets(income: number, filingStatus: string): number
  static stateTax(income: number, state: string): number
  static marginalRate(income: number, state: string): number
}

export class OptimizationEngine {
  static accountPriority(profile: FinancialProfile): AllocationResult[]
  static opportunityCost(scenario: ConservativeScenario): CostAnalysis
  static projections(allocation: AllocationResult[], years: number): ProjectionData
}
```

### Data Models
```typescript
interface FinancialProfile {
  demographics: {
    age: number
    state: string
    filingStatus: 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold'
    riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'optimizer'
  }
  income: {
    primarySalary: number
    bonusIncome?: number
    otherIncome?: number
  }
  benefits: {
    employer401k?: EmployerBenefits
    hsa?: HSABenefits
  }
  assets: AccountBalances
  debts: DebtAccount[]
  goals: RetirementGoals
}
```

### Component Library
- **Input Components**: Sliders, dropdowns, currency inputs
- **Display Components**: Results cards, charts, progress bars  
- **Layout Components**: Calculator wrapper, navigation
- **Shared Hooks**: State management, calculations, URL persistence

---

## User Experience Design

### Homepage Design
```
BufoIndex Header
├── Value Proposition
├── "For Those Who Want Financial Control, Not Financial Comfort"
└── Calculator Grid
    ├── [Paycheck Allocator Card]
    │   ├── "Smart Monthly Allocation"
    │   ├── Key benefits preview
    │   └── [Start Optimizing →]
    ├── [Retirement Calculator Card]  
    │   ├── "Comprehensive Retirement Planning"
    │   ├── Monte Carlo simulations preview
    │   └── [Plan Retirement →]
    └── [Future Calculator Cards...]
```

### Calculator User Flow
1. **Entry**: Direct link from homepage calculator card
2. **Input**: Progressive disclosure (essential → advanced)
3. **Results**: Clear priority lists with explanations
4. **Education**: "Show me why" explanations expand
5. **Sharing**: URL hash encoding for bookmarks/sharing
6. **Navigation**: Easy return to homepage or other calculators

### Mobile Experience
- **Touch-optimized**: Large buttons, swipe gestures
- **Progressive input**: One section at a time on small screens
- **Results optimization**: Vertical stacking, readable cards
- **Performance**: Fast loading, smooth interactions

---

## Content Strategy & Messaging

### Contrarian Positioning

#### Emergency Fund Messaging
**Conventional**: "Save 3-6 months of expenses for peace of mind"
**BufoIndex**: "Emergency funds beyond 3 months cost you $15,000-$30,000 per year in opportunity. Here's how to optimize for actual emergencies while maximizing growth."

#### Investment Strategy Messaging
**Conventional**: "Diversify with 60/40 stocks/bonds for safety"
**BufoIndex**: "Conservative allocation strategies cost $300,000+ over 30 years. Here's how to optimize risk-adjusted returns for your specific situation."

#### Debt Strategy Messaging
**Conventional**: "Pay off all debt before investing"
**BufoIndex**: "Low-rate debt (under 5%) should often be paid minimally while excess funds are invested. Here's the math on your specific situation."

### Educational Integration
- **Progressive disclosure**: Simple → detailed explanations
- **Show your work**: All calculations transparent and explainable
- **Contrarian rationale**: Clear reasoning for non-traditional advice
- **Risk communication**: Honest about what could go wrong

---

## Success Metrics

### User Engagement (6-month targets)
- **Homepage conversion**: 70% click-through to calculators
- **Calculator completion**: 80% reach results screen
- **Educational engagement**: 40% expand explanations
- **Sharing rate**: 15% share scenarios via URL
- **Return usage**: 30% return within 30 days

### Optimization Impact
- **Implementation intent**: 60% report planning to implement advice
- **Contrarian acceptance**: 40% accept non-traditional recommendations
- **Optimization score improvement**: Average 25+ point increase
- **Cross-calculator usage**: 30% use multiple tools

### Technical Performance
- **Load time**: <2s on 3G connections
- **Mobile usage**: 60% with full functionality
- **Error rates**: <1% calculation failures
- **Accessibility**: WCAG 2.1 AA compliance

---

## Implementation Roadmap

### Phase 1: Site Foundation (Week 1-2)
- Set up Next.js 14 project with TypeScript
- Configure Tailwind CSS and shadcn/ui
- Create base layout and navigation
- Implement homepage with calculator grid
- Set up deployment pipeline on Vercel

### Phase 2: Calculator Integration (Week 3-4)
- Migrate paycheck-allocator to new site structure
- Port retirement-calculator from Hugo to Next.js
- Implement shared calculation libraries
- Add URL hash persistence across tools
- Optimize mobile experience

### Phase 3: Shared Foundation (Week 5-6)
- Create reusable component library
- Implement shared data models and types
- Add cross-calculator data sharing capability
- Build common UI patterns and hooks
- Performance optimization and testing

### Phase 4: Future Expansion (Week 7+)
- Build additional calculators using shared foundation
- Implement advanced features (user profiles, data sync)
- Add analytics and success metric tracking
- Consider financial dashboard integration (future)

---

## Risk Analysis & Mitigation

### Technical Risks
- **Migration complexity**: Mitigate with incremental porting, thorough testing
- **Performance issues**: Address with code splitting, optimization
- **Mobile experience**: Solve with mobile-first design, touch optimization

### User Experience Risks  
- **Contrarian advice resistance**: Mitigate with clear explanations, user choice
- **Calculator overwhelm**: Address with progressive disclosure, simple defaults
- **Trust issues**: Build with transparent calculations, educational content

### Business Risks
- **Scope creep**: Control with clear MVP focus, phased approach
- **Maintenance burden**: Reduce with shared components, good architecture
- **User acquisition**: Address with clear value props, shareability

---

## Future Enhancements

### Short-term (Next 6 months)
- Additional calculators (cost of conservative, account optimizer)
- Enhanced mobile experience
- User feedback integration
- Performance improvements

### Medium-term (6-12 months)
- Financial dashboard integration
- User profiles and data persistence
- Cross-calculator intelligence
- Advanced sharing features

### Long-term (12+ months)
- API integrations (bank connections, market data)
- Community features (benchmarking, sharing)
- Professional integrations (CPA, advisor tools)
- Advanced AI-powered insights

---

## Technical Specifications

### Dependencies
```json
{
  "next": "14.1.0",
  "react": "^18",
  "typescript": "^5",
  "tailwindcss": "^3.4.0",
  "zustand": "^4.5.0",
  "zod": "^3.22.4",
  "lucide-react": "^0.316.0",
  "@radix-ui/react-slider": "^1.1.2",
  "class-variance-authority": "^0.7.0"
}
```

### Build Configuration
- **Next.js config**: App Router, TypeScript, static optimization
- **Tailwind config**: shadcn/ui integration, custom sage color palette
- **Vercel config**: Optimized builds, environment variables

### Data Persistence Strategy
- **URL Hash**: Compressed state encoding for sharing
- **localStorage**: Browser storage for user preferences
- **No Backend**: Complete client-side privacy protection
- **Future**: Optional cloud sync with Supabase integration

---

*This PRD serves as the comprehensive specification for BufoIndex.com's migration to a modern Next.js architecture, focusing on financial optimization tools that challenge conventional wisdom through mathematical analysis and clear, actionable insights.*