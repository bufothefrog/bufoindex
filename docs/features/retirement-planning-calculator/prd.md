# Retirement Planning Calculator - Product Requirements Document

## Executive Summary
The Retirement Planning Calculator is a comprehensive financial planning tool that helps users model retirement scenarios using Monte Carlo simulations, tax calculations, and state-specific cost analysis. This PRD outlines the requirements for achieving feature parity between the current vanilla JavaScript implementation and the refactored React/TypeScript version.

## Current State
- **Main Branch**: Full-featured vanilla JS/HTML calculator with advanced Monte Carlo simulations, tax modeling, and visualizations
- **Feature Branch**: Refactored React/TypeScript version with basic functionality but missing key features

## Objectives
1. Achieve complete feature parity with the main branch implementation
2. Maintain clean React/TypeScript architecture
3. Improve performance and user experience
4. Ensure mobile responsiveness throughout
5. Add comprehensive testing coverage

## Feature Requirements

### 1. Core Calculation Engine

#### 1.1 Monte Carlo Simulation
- **Box-Muller Transformation**: Implement proper normal distribution for market returns
- **Standardized Runs**: Fixed at 1,000 simulation runs for optimal client-side performance
- **Percentile Analysis**: Calculate 10th, 25th, 50th, 75th, 90th percentiles
- **Failure Tracking**: Track portfolio failure ages and distribution
- **Yearly Progression**: Track portfolio value through accumulation and retirement phases
- **Volatility Metrics**: Calculate and display portfolio volatility statistics
- **Performance Target**: Complete 1K simulations in under 2 seconds

#### 1.2 Statistical Analysis
- **Distribution Analysis**: Analyze success/failure distributions
- **Median Progression**: Calculate median portfolio paths
- **Cross-Scenario Comparison**: Compare multiple retirement ages
- **Aggregated Statistics**: Generate portfolio-wide statistics

### 2. Financial Modeling

#### 2.1 Tax Calculations
- **Federal Tax Brackets**: Implement 2024 federal tax brackets
  - Single filer brackets
  - Married filing jointly brackets
- **State Tax**: Support state-specific tax calculations (start with California)
- **Standard Deductions**: Apply appropriate standard deductions
- **After-Tax Income**: Calculate net retirement income after taxes

#### 2.2 Savings Feasibility
- **State Cost of Living**: Incorporate state-specific COL data
- **Realistic Savings Validation**: Validate savings against income and expenses
- **Geographic Feasibility**: Score savings feasibility by location
- **Income-Based Limits**: Apply realistic savings constraints

### 3. Advanced Features

#### 3.1 Insights Engine
- **Coast FIRE Status**: Detect if user can coast to retirement
- **Time vs Money Analysis**: Analyze tradeoffs between working years and savings rate
- **Risk Assessment**: Evaluate portfolio risk levels
- **Market Warnings**: Alert users to market risk factors
- **Optimization Opportunities**: Identify areas for improvement
- **Action Items**: Generate specific actionable recommendations

#### 3.2 Scenario Modeling
- **Multiple Retirement Ages**: Compare retiring at different ages
- **Savings Rate Scenarios**: Model different savings rates
- **Risk Profile Variations**: Compare conservative vs aggressive strategies
- **Target Date Funds**: Model age-based asset allocation

### 4. Visualizations

#### 4.1 Required Charts
- **Net Worth Progression**: Portfolio value over time with percentile bands
- **Withdrawal Timeline**: Annual withdrawals through retirement
- **Savings vs Retirement Age**: Relationship between savings rate and retirement timing
- **Success Probability Distribution**: Monte Carlo outcome distribution
- **Portfolio Distribution**: Asset allocation visualization

#### 4.2 Chart Features
- **Interactive Tooltips**: Detailed information on hover
- **Responsive Design**: Charts adapt to screen size
- **Export Capability**: Save charts as images
- **Theme Support**: Match application theme

### 5. User Interface

#### 5.1 Input Enhancements
- **Component Reuse Priority**: Maximize reuse of existing PaycheckAllocator components
- **Income Input**: Adapt paycheck frequency pattern with gross/net paycheck inputs
- **State Selection**: Reuse existing StateSelector (already includes tax rate data)
- **Money Inputs**: Reuse existing MoneyInput components throughout
- **Risk Profile Selector**: 
  - Conservative
  - Moderate
  - Aggressive
  - Target Date Fund (auto-adjust by age)
  - Custom
- **Collapsible Sections**: Hide/show advanced assumptions
- **Input Validation**: Reuse existing validation patterns with real-time feedback
- **Help Tooltips**: Contextual help for each input

#### 5.2 Results Display
- **Scenario Comparison Table**: Side-by-side scenario analysis
- **Success Metrics**: Clear success probability display
- **Key Insights**: Highlighted actionable insights
- **Detailed Breakdowns**: Expandable detailed analysis

### 6. Export & Sharing

#### 6.1 PDF Export
- **Comprehensive Report**: Multi-page PDF with all analysis
- **Chart Inclusion**: Embed all visualizations
- **Input Summary**: Document all assumptions
- **Professional Formatting**: Clean, printable layout

#### 6.2 URL Sharing
- **State Persistence**: Encode all inputs in URL
- **Shareable Links**: Generate shareable scenario links
- **Version Compatibility**: Handle URL format changes gracefully

## Technical Requirements

### Architecture
- **TypeScript**: Full type safety for all calculations
- **React Components**: Maximize reuse of existing UI components from PaycheckAllocator
- **Calculation Modules**: Separate calculation logic from UI, build on existing patterns
- **State Management**: Efficient state handling with React hooks, reuse existing URL state patterns
- **Performance**: Optimize 1K Monte Carlo simulations with memoization (target <2s)
- **Chart Library**: Use Recharts (already installed) for visualization components

### Testing
- **Unit Tests**: 100% coverage for financial calculations
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Benchmark calculation performance

### Accessibility
- **WCAG 2.1 AA**: Full compliance
- **Keyboard Navigation**: Complete keyboard support
- **Screen Readers**: Proper ARIA labels
- **Color Contrast**: Meet contrast requirements

## Success Metrics
1. **Feature Parity**: 100% of main branch features implemented
2. **Performance**: Monte Carlo simulations complete in <3 seconds
3. **Test Coverage**: >90% code coverage
4. **Mobile Usage**: Fully functional on mobile devices
5. **User Satisfaction**: Intuitive, professional interface

## Timeline
- **Phase 1**: Core Calculations (3-4 days)
- **Phase 2**: Financial Modeling (3-4 days)
- **Phase 3**: Advanced Features (4-5 days)
- **Phase 4**: UI/UX Enhancements (3-4 days)
- **Phase 5**: Testing & Polish (2-3 days)

**Total**: 15-20 days for complete implementation

## Dependencies
- React 18+
- TypeScript 5+
- Chart library (Chart.js or Recharts)
- PDF generation library (jsPDF or react-pdf)
- Testing framework (Vitest + React Testing Library)

## Risks & Mitigations
1. **Performance**: Monte Carlo simulations may be slow
   - Mitigation: Use web workers for parallel processing
2. **Complexity**: Tax calculations are complex
   - Mitigation: Start with simplified model, iterate
3. **Mobile Experience**: Charts may be difficult on small screens
   - Mitigation: Responsive design with mobile-specific layouts

## Future Enhancements
- International tax support
- Cryptocurrency portfolio modeling
- Estate planning integration
- Social Security optimization
- Healthcare cost projections
- Inflation scenario modeling