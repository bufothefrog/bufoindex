# Calculator Methodology System - Product Requirements Document

## Executive Summary

The Calculator Methodology System is an automatically-generated documentation feature that displays the exact mathematical formulas, assumptions, and calculations used in each BufoIndex calculator. This system ensures transparency, enables user verification, and maintains accuracy by automatically synchronizing with the underlying calculation code.

## Problem Statement

Users of financial calculators often question the accuracy and methodology behind calculations, leading to:
- Lack of trust in results
- Inability to verify calculations independently
- Black box perception of complex financial modeling
- Difficulty understanding the impact of different assumptions

## Solution Overview

An automatically-generated methodology page for each calculator that:
- Shows all mathematical formulas used (LaTeX-rendered)
- Displays current assumptions, rates, and constants
- Provides interactive mini-calculators for each formula
- Includes worked examples with real numbers
- Links to authoritative sources (IRS publications, academic papers)
- Updates automatically when underlying calculations change

## User Stories

### Primary Users: General Public Financial Planning

**As a user planning for retirement, I want to:**
- See the exact formulas used to calculate my projected balance
- Understand how inflation affects my calculations over time
- Verify specific calculations using my own numbers
- Know where tax rates and other assumptions come from
- Be confident that the calculations are accurate and current

**As a financially curious user, I want to:**
- Learn the mathematical principles behind financial planning
- Compare BufoIndex's approach to conventional wisdom
- Understand the impact of different assumptions on outcomes
- Use individual formulas for my own calculations

**As a skeptical user, I want to:**
- Verify the calculator's work with my own calculations
- See references to authoritative sources
- Understand the limitations and assumptions of the model
- Know when formulas or assumptions were last updated

## Functional Requirements

### 1. Core Methodology Display

#### 1.1 Formula Registry System
- **Automatic Formula Extraction**: Formulas are registered with their implementation functions
- **LaTeX Rendering**: All formulas displayed in proper mathematical notation using KaTeX
- **Variable Definitions**: Clear definitions for all variables in each formula
- **Formula Categories**: Organized by Core, Intermediate, Advanced, and Assumptions
- **Example Calculations**: Worked examples with sample inputs and outputs

#### 1.2 Assumptions and Constants Display
- **Tax Rates**: Current federal and state tax brackets, standard deductions
- **Economic Assumptions**: Default inflation rates, market returns, volatility
- **Social Security**: Current benefit calculations, full retirement age rules
- **Healthcare Costs**: Age-based healthcare cost multipliers
- **Regulatory Constants**: 401k/IRA limits, HSA limits, other IRS-defined values
- **Collapsible Sections**: Detailed assumptions hidden by default to reduce visual clutter

#### 1.3 Interactive Verification
- **Mini-Calculators**: Small, focused calculators for each major formula
- **Live Calculation**: Users can input their own values to verify formulas
- **Step-by-Step Breakdown**: Shows intermediate calculations for complex formulas
- **Copy-Friendly Format**: Formulas can be copied for use in spreadsheets

### 2. Calculator Integration

#### 2.1 Navigation Integration
- **Tab-Based Interface**: "Calculator" | "Methodology" | "Examples" tabs
- **State Preservation**: Switching tabs preserves calculator input state
- **Deep Linking**: Direct links to specific methodology sections
- **Breadcrumb Navigation**: Clear path showing current location

#### 2.2 Content Synchronization
- **Automatic Updates**: Methodology updates when calculation code changes
- **Version Tracking**: "Last updated" timestamps for each formula section
- **Change Detection**: Automated alerts when formulas are modified
- **Build-Time Validation**: Ensures displayed formulas match implementation

### 3. Educational Content

#### 3.1 Formula Explanations
- **Plain English**: Non-technical explanations of what each formula does
- **Purpose Context**: Why each calculation is necessary in the overall model
- **Limitation Discussion**: What the formula doesn't account for
- **Alternative Approaches**: Brief mention of other methods when relevant

#### 3.2 Worked Examples
- **Realistic Scenarios**: Examples using typical user inputs
- **Step-by-Step**: Shows all intermediate calculations
- **Multiple Cases**: Different scenarios (young vs. old, high vs. low income)
- **Edge Cases**: How formulas handle boundary conditions

### 4. Source Attribution

#### 4.1 Authoritative References
- **IRS Publications**: Links to current tax code sources
- **Academic Papers**: Citations for Monte Carlo methods, financial theory
- **Government Data**: Sources for economic assumptions (Fed, BLS, SSA)
- **Industry Standards**: References to accepted financial planning practices

#### 4.2 Transparency Features
- **Update History**: When formulas or assumptions were last changed
- **Source Quality**: Indicators of source reliability and recency
- **Assumption Rationale**: Explanation of why specific default values were chosen
- **Methodology Limitations**: Clear discussion of model boundaries

## Technical Requirements

### 1. Formula Registry Architecture

#### 1.1 Code Integration Pattern
```typescript
@formula({
  name: "Future Value of Investment",
  category: "core",
  latex: "FV = PV \\times (1 + r)^t",
  variables: {
    FV: "Future Value ($)",
    PV: "Present Value ($)",
    r: "Annual Return Rate (decimal)",
    t: "Time Period (years)"
  },
  description: "Calculates compound growth of a lump sum investment",
  example: {
    inputs: { PV: 10000, r: 0.07, t: 30 },
    output: 76123.45,
    explanation: "A $10,000 investment at 7% annual return grows to $76,123 over 30 years"
  },
  sources: ["IRS Publication 590-B", "Federal Reserve Economic Data"]
})
export function futureValue(presentValue: number, rate: number, time: number): number {
  return presentValue * Math.pow(1 + rate, time);
}
```

#### 1.2 Registry Management
- **Function Decorator**: Non-intrusive way to add metadata to calculation functions
- **Build-Time Extraction**: Formulas collected during build process
- **Type Safety**: TypeScript ensures formula metadata matches function signatures
- **Validation**: Automated testing ensures examples produce expected results

### 2. Dynamic Page Generation

#### 2.1 Route Structure
- `/tools/retirement-calculator/methodology` - Main methodology page
- `/tools/paycheck-allocator/methodology` - Paycheck allocator methodology
- Dynamic routing pattern: `/tools/[calculator]/methodology`

#### 2.2 Component Architecture
- **MethodologyLayout**: Consistent layout across all calculators
- **FormulaDisplay**: Renders individual formulas with LaTeX
- **MiniCalculator**: Interactive calculation widget for each formula
- **AssumptionsPanel**: Collapsible display of constants and assumptions
- **SourceCitation**: Formatted references with links

### 3. Content Management

#### 3.1 Automated Updates
- **Build-Time Generation**: Methodology content generated during build
- **Change Detection**: Git-based detection of formula modifications
- **Validation Pipeline**: Ensures all formulas have required metadata
- **Cache Invalidation**: Updates methodology when calculations change

#### 3.2 Content Organization
- **Category-Based Sections**: Core, Intermediate, Advanced, Assumptions
- **Searchable Index**: Full-text search across all methodology content
- **Cross-References**: Links between related formulas and concepts
- **Progressive Disclosure**: Details revealed on-demand to reduce cognitive load

## Implementation Plan

### Phase 1: Core Infrastructure (Sprint 1)
**Duration**: 1-2 weeks
**Deliverables**:
- Formula registry system (decorators, types, validation)
- Basic methodology page layout and components
- LaTeX rendering with KaTeX integration
- Build-time formula extraction pipeline

### Phase 2: Retirement Calculator Integration (Sprint 2)
**Duration**: 2-3 weeks
**Deliverables**:
- All retirement calculation functions decorated with formulas
- Complete methodology page for retirement calculator
- Tab-based navigation integration
- Mini-calculators for key formulas

### Phase 3: Enhancement and Polish (Sprint 3)
**Duration**: 1-2 weeks
**Deliverables**:
- Interactive examples with realistic scenarios
- Assumptions and constants display
- Source attribution and references
- Mobile-responsive design optimization

### Phase 4: Expansion (Sprint 4)
**Duration**: 1-2 weeks
**Deliverables**:
- Paycheck allocator methodology integration
- Search and filtering capabilities
- Performance optimization
- Comprehensive testing suite

## Success Metrics

### User Engagement
- **Methodology Page Views**: Target 25% of calculator users visit methodology
- **Time on Methodology**: Average 3+ minutes indicating meaningful engagement
- **Tab Switching**: Users switching between calculator and methodology tabs
- **Mini-Calculator Usage**: Interactions with individual formula calculators

### Quality Assurance
- **Formula Accuracy**: 100% automated validation between formulas and implementation
- **Source Currency**: All references less than 12 months old
- **Update Frequency**: Methodology automatically updates within 24 hours of code changes
- **Error Rate**: Zero formula display errors or calculation mismatches

### User Satisfaction
- **Trust Metrics**: Decreased user questions about calculation accuracy
- **Educational Value**: Users report better understanding of financial concepts
- **Verification Usage**: Users successfully verify calculations using provided formulas
- **Reference Usage**: External references to BufoIndex methodology

## Testing Strategy

### 1. Automated Testing

#### 1.1 Formula Validation
- **Example Verification**: All formula examples produce expected outputs
- **Implementation Matching**: Displayed formulas mathematically equivalent to code
- **Variable Consistency**: All formula variables properly defined and used
- **LaTeX Rendering**: All mathematical notation renders correctly

#### 1.2 Content Integrity
- **Link Validation**: All external references accessible and current
- **Update Detection**: Changes to calculations trigger methodology updates
- **Cross-Reference Accuracy**: Internal links between formulas work correctly
- **Mobile Compatibility**: All content displays properly on mobile devices

### 2. User Acceptance Testing

#### 2.1 Usability Testing
- **Navigation Clarity**: Users can easily find and use methodology features
- **Comprehension Testing**: General public can understand formula explanations
- **Verification Success**: Users can successfully verify calculations
- **Educational Effectiveness**: Users learn from methodology content

#### 2.2 Accuracy Validation
- **Financial Professional Review**: CPAs/CFPs validate formula correctness
- **Academic Review**: Finance professors confirm theoretical soundness
- **Regulatory Compliance**: Tax calculations align with current IRS guidance
- **Industry Best Practices**: Methodology follows accepted financial planning standards

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Methodology generation could slow build times
  - *Mitigation*: Efficient build-time processing, caching strategies
- **Maintenance Burden**: Keeping formulas synchronized with code changes
  - *Mitigation*: Automated validation, required formula metadata for new functions
- **Complexity Creep**: Formula registry becoming overly complex
  - *Mitigation*: Simple decorator pattern, clear architectural boundaries

### Content Risks
- **Accuracy Errors**: Incorrect formulas or explanations
  - *Mitigation*: Multi-level review process, automated validation, expert review
- **Regulatory Changes**: Tax laws or other regulations changing
  - *Mitigation*: Regular review schedule, authoritative source monitoring
- **Comprehension Issues**: Content too technical for general public
  - *Mitigation*: User testing, plain English explanations, progressive disclosure

### Business Risks
- **Development Delay**: Feature complexity causing timeline slippage
  - *Mitigation*: Phased rollout, MVP approach, clear scope definition
- **User Confusion**: Methodology causing more questions than answers
  - *Mitigation*: Clear user testing, iterative improvement, help documentation

## Dependencies

### External Dependencies
- **KaTeX**: LaTeX rendering library (already integrated)
- **React/TypeScript**: Core application framework
- **Next.js**: Routing and build system

### Internal Dependencies
- **Calculation Functions**: All calculator logic must be refactored to use registry
- **Design System**: Methodology components must align with existing UI patterns
- **Testing Infrastructure**: Automated testing must be extended for formula validation

## Future Enhancements

### Advanced Features (Post-MVP)
- **Comparison Tools**: Side-by-side comparison of different calculation approaches
- **Sensitivity Analysis**: Interactive exploration of how assumptions affect results
- **Export Capabilities**: PDF export of methodology for offline reference
- **API Access**: Programmatic access to formula metadata for third-party integrations

### Educational Expansion
- **Video Explanations**: Embedded videos explaining complex concepts
- **Interactive Tutorials**: Step-by-step walkthroughs of calculation processes
- **Glossary Integration**: Hover definitions for financial terms
- **Related Reading**: Links to BufoIndex articles that explain concepts in depth

## Conclusion

The Calculator Methodology System addresses a critical need for transparency and education in financial calculators. By automatically generating and maintaining accurate, accessible documentation of all calculations, BufoIndex can build user trust while providing significant educational value. The phased implementation approach ensures early wins while building toward a comprehensive system that can support all current and future calculators.

The system's automated nature ensures that methodology documentation never becomes stale or inaccurate, addressing one of the primary challenges of maintaining technical documentation. The focus on general public comprehension, combined with rigorous accuracy validation, positions this feature as a significant competitive advantage in the financial planning tools market.