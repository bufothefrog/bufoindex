# Retirement Planning Calculator - Implementation Plan

## Overview
This plan details the implementation strategy for achieving feature parity between the main branch vanilla JavaScript retirement calculator and the refactored React/TypeScript version.

## Implementation Phases

### Phase 1: Enhanced Monte Carlo Engine (Days 1-3)
**Priority**: Critical
**Dependencies**: None

#### Tasks
1. **Box-Muller Transformation**
   - Implement proper normal distribution random number generation
   - Replace current Math.random() with Box-Muller algorithm
   - Add deterministic seeding for testing

2. **Standardized Simulation Runs**
   - Fix Monte Carlo runs at 1,000 for optimal client-side performance
   - Implement performance optimization to complete in <2 seconds
   - Add progress indicators for simulation progress

3. **Percentile Analysis**
   - Calculate 10th, 25th, 50th, 75th, 90th percentiles
   - Track percentile distributions for portfolio values
   - Implement statistical utility functions

4. **Failure Age Tracking**
   - Track when portfolios fail in each simulation
   - Calculate failure age distributions
   - Generate failure probability curves

5. **Yearly Progression Tracking**
   - Record portfolio value for each year of each simulation
   - Calculate median progression paths
   - Support visualization of portfolio evolution

#### Files to Create/Modify
- `lib/calculations/monteCarlo.ts` (new)
- `lib/calculations/statistical.ts` (new)
- `lib/calculations/retirement.ts` (enhance)
- `components/ui/ProgressIndicator.tsx` (new)

### Phase 2: Financial Modeling Module (Days 4-6)
**Priority**: High
**Dependencies**: Phase 1 statistical utilities

#### Tasks
1. **Tax Bracket Implementation**
   - Create 2024 federal tax bracket data structures
   - Implement progressive tax calculation functions
   - Add married/single filing status support

2. **State Tax Calculations**
   - Start with California tax brackets
   - Create extensible state tax system
   - Add state selection to UI

3. **After-Tax Income Calculations**
   - Calculate net retirement income after taxes
   - Factor in standard deductions
   - Account for tax-advantaged account withdrawals

4. **Savings Feasibility Analysis**
   - Implement state-based cost of living adjustments
   - Validate savings rates against realistic income constraints
   - Create feasibility scoring system

#### Files to Create/Modify
- `lib/calculations/taxes.ts` (new)
- `lib/data/taxBrackets.ts` (new)
- `lib/data/costOfLiving.ts` (new)
- `lib/calculations/feasibility.ts` (new)
- `components/ui/StateSelector.tsx` (new)

### Phase 3: Advanced Insights Engine (Days 7-10)
**Priority**: High
**Dependencies**: Phases 1 & 2

#### Tasks
1. **Coast FIRE Detection**
   - Calculate if current savings can coast to retirement
   - Determine latest age to achieve Coast FIRE
   - Generate Coast FIRE specific insights

2. **Risk Assessment Engine**
   - Analyze portfolio risk based on allocation and volatility
   - Generate risk-adjusted recommendations
   - Create market risk warning system

3. **Optimization Engine**
   - Identify opportunities to improve retirement outcomes
   - Generate specific actionable recommendations
   - Analyze time vs money tradeoffs

4. **Insight Generation System**
   - Create comprehensive insight categorization
   - Prioritize insights by impact
   - Generate user-friendly explanations

#### Files to Create/Modify
- `lib/calculations/coastFire.ts` (new)
- `lib/calculations/riskAssessment.ts` (new)
- `lib/calculations/optimization.ts` (new)
- `lib/calculations/insights.ts` (enhance)

### Phase 4: Visualization Components (Days 11-14)
**Priority**: Medium
**Dependencies**: All previous phases

#### Tasks
1. **Chart Infrastructure**
   - Select and configure chart library (Recharts recommended)
   - Create reusable chart components
   - Implement responsive design patterns

2. **Required Charts**
   - Net worth progression with percentile bands
   - Withdrawal timeline through retirement
   - Savings rate vs retirement age analysis
   - Success probability distributions
   - Portfolio allocation visualization

3. **Interactive Features**
   - Tooltips with detailed information
   - Zoom and pan capabilities
   - Chart export functionality
   - Theme integration

#### Files to Create/Modify
- `components/charts/NetWorthChart.tsx` (new)
- `components/charts/WithdrawalChart.tsx` (new)
- `components/charts/SavingsChart.tsx` (new)
- `components/charts/DistributionChart.tsx` (new)
- `components/charts/BaseChart.tsx` (new)

### Phase 5: UI/UX Enhancements (Days 15-17)
**Priority**: Medium
**Dependencies**: All calculation phases

#### Tasks
1. **Enhanced Input Controls (Maximize Component Reuse)**
   - Adapt PaycheckAllocator income input patterns (paycheck frequency, gross/net amounts)
   - Reuse existing StateSelector component (already has tax rate data)
   - Reuse MoneyInput components throughout interface
   - Risk profile selector with auto-population
   - Collapsible assumptions section
   - Reuse existing validation patterns with real-time feedback
   - Contextual help system using existing tooltip patterns

2. **Results Display Enhancement**
   - Tabular scenario comparisons
   - Expandable detailed analysis sections
   - Prioritized insight display
   - Success metric highlighting

3. **Mobile Optimization**
   - Touch-friendly chart interactions
   - Responsive table layouts
   - Mobile-specific navigation
   - Optimized input controls

#### Files to Create/Modify
- `components/ui/RiskProfileSelector.tsx` (new)
- `components/ui/CollapsibleSection.tsx` (new)
- `components/ui/ValidationMessage.tsx` (new)
- `components/ui/HelpTooltip.tsx` (new)
- `components/retirement/ResultsTable.tsx` (new)

### Phase 6: Export & Reporting (Days 18-19)
**Priority**: Medium
**Dependencies**: Visualization components

#### Tasks
1. **PDF Export System**
   - Multi-page report generation
   - Chart embedding in PDF
   - Professional formatting
   - Input assumption documentation

2. **Enhanced URL Sharing**
   - Comprehensive state encoding
   - Backward compatibility handling
   - Share button with native sharing API

#### Files to Create/Modify
- `lib/export/pdfGenerator.ts` (new)
- `lib/export/reportTemplate.ts` (new)
- `lib/utils/urlState.ts` (enhance)

### Phase 7: Testing & Polish (Days 20-21)
**Priority**: High
**Dependencies**: All implementation phases

#### Tasks
1. **Comprehensive Testing**
   - Unit tests for all calculation functions
   - Integration tests for component interactions
   - E2E tests for complete user workflows
   - Performance benchmarking

2. **Final Polish**
   - Code review and cleanup
   - Performance optimization
   - Accessibility audit
   - Documentation updates

#### Files to Create/Modify
- `test/calculations/` (multiple test files)
- `test/components/` (multiple test files)
- `test/e2e/` (end-to-end tests)

## Technical Architecture

### File Organization
```
lib/
├── calculations/
│   ├── retirement.ts (enhanced)
│   ├── monteCarlo.ts (new)
│   ├── statistical.ts (new)
│   ├── taxes.ts (new)
│   ├── feasibility.ts (new)
│   ├── coastFire.ts (new)
│   ├── riskAssessment.ts (new)
│   ├── optimization.ts (new)
│   └── insights.ts (enhanced)
├── data/
│   ├── taxBrackets.ts (new)
│   └── costOfLiving.ts (new)
├── export/
│   ├── pdfGenerator.ts (new)
│   └── reportTemplate.ts (new)
└── utils/
    └── urlState.ts (enhanced)

components/
├── retirement/
│   ├── RetirementCalculator.tsx (enhanced)
│   └── ResultsTable.tsx (new)
├── charts/
│   ├── BaseChart.tsx (new)
│   ├── NetWorthChart.tsx (new)
│   ├── WithdrawalChart.tsx (new)
│   ├── SavingsChart.tsx (new)
│   └── DistributionChart.tsx (new)
└── ui/
    ├── StateSelector.tsx (new)
    ├── RiskProfileSelector.tsx (new)
    ├── CollapsibleSection.tsx (new)
    ├── ValidationMessage.tsx (new)
    ├── HelpTooltip.tsx (new)
    └── ProgressIndicator.tsx (new)
```

### Development Guidelines

#### TypeScript Standards
- Strict typing for all functions
- Interface definitions for all data structures
- Proper error handling with typed exceptions
- Comprehensive JSDoc documentation

#### Performance Considerations
- Memoization for expensive calculations
- Web workers for Monte Carlo simulations
- Lazy loading for chart components
- Efficient state management

#### Testing Strategy
- 100% coverage for calculation functions
- Component testing with React Testing Library
- E2E testing with Playwright
- Performance benchmarking for simulations

## Quality Gates

### Phase Completion Criteria
Each phase must meet the following criteria before moving to the next:

1. **Functionality**: All planned features working correctly
2. **Testing**: Unit tests passing with >90% coverage
3. **Performance**: No performance regressions
4. **Code Quality**: TypeScript compilation with no errors
5. **Documentation**: All new functions documented

### Final Delivery Criteria
- Complete feature parity with main branch
- All tests passing
- Performance benchmarks met
- Accessibility compliance verified
- Mobile responsiveness confirmed

## Risk Mitigation

### Performance Risks
- **Risk**: Monte Carlo simulations too slow
- **Mitigation**: Implement web workers, optimize algorithms
- **Fallback**: Reduce default simulation runs if needed

### Complexity Risks
- **Risk**: Tax calculations become too complex
- **Mitigation**: Start simple, iterate based on user needs
- **Fallback**: Simplified tax estimation initially

### Timeline Risks
- **Risk**: Implementation takes longer than estimated
- **Mitigation**: Prioritize core features, defer nice-to-haves
- **Fallback**: Ship with reduced feature set if needed

## Success Metrics
1. **Feature Completeness**: 100% of main branch features
2. **Performance**: <3 second simulation times
3. **Quality**: >90% test coverage
4. **User Experience**: Intuitive interface, mobile-friendly
5. **Maintainability**: Clean, well-documented TypeScript code

## Post-Implementation
- Monitor user feedback and usage patterns
- Identify areas for further optimization
- Plan additional features based on user needs
- Consider advanced features like international support