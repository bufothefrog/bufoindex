# BufoIndex Testing Framework Documentation

**Sprint 7: Testing Framework Implementation**  
**Updated:** 2025-08-28  
**Coverage Targets:** 100% Calculations | 80% Components | 70% Integration

---

## Overview

This testing framework provides comprehensive test coverage for the BufoIndex financial platform, with specialized utilities and patterns for:

- **Financial Calculations:** Exact verification with IRS data and mathematical precision
- **React Components:** Accessibility, responsive design, and user interaction testing
- **Integration Flows:** URL state persistence, cross-calculator data flow, and complete user workflows

---

## Directory Structure

```
test/
├── README.md                          # This documentation
├── setup.ts                           # Global test configuration
├── utils/                             # Testing utilities and helpers
│   ├── financial-test-helpers.ts      # Financial calculation testing utilities
│   ├── component-test-helpers.tsx     # React component testing utilities  
│   └── integration-test-helpers.ts    # Integration and workflow testing
├── patterns/                          # Test pattern examples and templates
│   ├── calculation-test-patterns.ts   # Patterns for 100% calculation coverage
│   ├── component-test-patterns.tsx    # Patterns for 80% component coverage
│   └── integration-test-patterns.ts   # Patterns for 70% integration coverage
├── lib/                               # Library and calculation tests
│   └── calculations/                  # 100% coverage required
│       ├── sample.test.ts             # Example calculation test
│       └── [19 calculation files]     # All lib/calculations/*.ts tests
├── components/                        # Component tests  
│   ├── sample.test.tsx                # Example component test
│   └── [50+ component files]         # Component test files
└── integration/                       # Integration tests
    └── [workflow tests]               # End-to-end workflow tests
```

---

## Quick Start

### Running Tests

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test categories
npm run test -- test/lib/calculations/    # Calculation tests only
npm run test -- test/components/          # Component tests only  
npm run test -- test/integration/         # Integration tests only

# Watch mode for development
npm run test:watch

# Performance benchmarks
npm run benchmark
```

### Coverage Requirements

The framework enforces strict coverage thresholds:

- **lib/calculations/\*\*/\*.{ts,js}:** 100% coverage (all branches, functions, lines, statements)
- **components/\*\*/\*.{tsx,ts}:** 80% coverage
- **app/\*\*/\*.{tsx,ts}:** 80% coverage
- **lib/utils/\*\*/\*.{ts,js}:** 90% coverage

---

## Testing Utilities

### Financial Test Helpers

```typescript
import { 
  measureCalculationPerformance,
  FINANCIAL_TEST_CASES,
  TAX_BRACKETS,
  CONTRIBUTION_LIMITS 
} from '@/test/utils/financial-test-helpers'

// Custom matchers for financial precision
expect(result).toBeCloseToCurrency(19671.51)
expect(tax).toMatchTaxCalculation(75000, 'single')
expect(portfolioValue).toBeWithinPercentageRange(1500000, 5.0)
expect(successRate).toMatchMonteCarloDistribution(0.85, 2.0)

// Performance testing for calculations
const { duration, result } = measureCalculationPerformance(
  'compound-interest-calculation',
  () => calculateCompoundInterest(10000, 0.07, 10),
  50 // Max 50ms
)
```

### Component Test Helpers

```typescript
import { 
  renderWithProviders,
  testResponsiveDesign,
  checkAccessibility,
  testKeyboardNavigation 
} from '@/test/utils/component-test-helpers'

// Enhanced rendering with providers
const { user } = renderWithProviders(
  <PaycheckAllocator />,
  { withStateProvider: true, withFormProvider: true }
)

// Responsive design testing
testResponsiveDesign(
  (width) => render(<Calculator />, { mockWindowSize: { width, height: 800 } }),
  {
    mobile: () => expect(screen.getByTestId('mobile-layout')).toBeVisible(),
    desktop: () => expect(screen.getByTestId('desktop-layout')).toBeVisible()
  }
)

// Accessibility compliance
const element = screen.getByRole('button')
expect(element).toBeAccessible()
```

### Integration Test Helpers

```typescript
import { 
  URLHashTester,
  LocalStorageTester,
  DataFlowTester,
  UserWorkflowTester 
} from '@/test/utils/integration-test-helpers'

// URL hash state persistence
const urlTester = new URLHashTester()
urlTester.setHash('#calculator=retirement&data=...')
await urlTester.waitForHashUpdate()

// Cross-calculator data flow
const dataFlowTester = new DataFlowTester()
await dataFlowTester.testFlow([
  { calculator: 'paycheck', action: 'input', data: { income: 100000 } },
  { calculator: 'retirement', action: 'load', data: { annualSavings: 25000 } }
])
```

---

## Test Patterns

### Pattern 1: Financial Calculation Testing (100% Coverage)

```typescript
describe('Tax Calculations', () => {
  it('calculates federal tax correctly against IRS brackets', () => {
    const tax = calculateFederalTax(75000, 'single')
    expect(tax).toMatchTaxCalculation(75000, 'single')
    expect(tax).toBeCloseToCurrency(12238) // Known 2024 value
  })

  it('meets performance benchmarks', () => {
    measureCalculationPerformance(
      'tax-calculation-batch',
      () => Array.from({length: 100}, (_, i) => 
        calculateFederalTax(30000 + i * 1000, 'single')
      ),
      50 // Max 50ms for 100 calculations
    )
  })
})
```

### Pattern 2: Component Testing (80% Coverage)

```typescript
describe('MoneyInput Component', () => {
  it('handles user input with validation', async () => {
    const { user } = renderWithProviders(
      <MoneyInput 
        label=\"Annual Income\" 
        value={0}
        onChange={mockOnChange}
        validation={value => value > 0 ? null : 'Income required'}
      />
    )
    
    await user.type(screen.getByLabelText('Annual Income'), '100000')
    expect(mockOnChange).toHaveBeenCalledWith(100000)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('meets accessibility requirements', () => {
    const { container } = renderWithProviders(<MoneyInput label=\"Test\" />)
    expect(container.firstChild).toBeAccessible()
  })
})
```

### Pattern 3: Integration Testing (70% Coverage)

```typescript
describe('Complete Calculator Workflow', () => {
  it('persists state across page reloads', async () => {
    const workflowTester = new UserWorkflowTester()
    
    workflowTester.addStep({
      description: 'User completes paycheck allocation',
      action: async () => {
        await fillPaycheckForm({ income: 100000, expenses: 60000 })
      },
      validation: async () => {
        expect(localStorage.getItem('bufoindex-paycheck')).toBeTruthy()
      }
    })
    
    await workflowTester.executeWorkflow('State Persistence')
  })
})
```

---

## Phase 2 Agent Guidelines

### Agent B: Calculation Tester (100% Coverage Target)

**Scope:** All files in `lib/calculations/` (19 files requiring 100% coverage)

**Priority Order:**
1. **Core financial functions:** `calculations.ts`, `core.ts`, `financial-modeling.ts`
2. **Monte Carlo engine:** `monte-carlo.ts` with statistical validation
3. **Tax calculations:** `analysis.ts` with IRS 2024 bracket verification
4. **Optimization logic:** `optimization.ts`, `projections.ts`
5. **Legacy JavaScript files:** Ensure 100% coverage with performance benchmarks

**Key Requirements:**
- Use exact IRS 2024 tax brackets and contribution limits for verification
- Test all edge cases: zero values, negative inputs, extreme ranges
- Performance benchmarks: <50ms for basic calculations, <5s for Monte Carlo
- Error handling validation for all invalid inputs
- Statistical validation for Monte Carlo simulations

### Agent C: Component Tester (80% Coverage Target)

**Scope:** All React components in `components/` and `app/` directories

**Priority Order:**
1. **Shared components:** `MoneyInput`, `PercentageInput`, `ResultCard`, `CalculatorLayout`
2. **Calculator-specific:** Paycheck allocator, retirement calculator components
3. **UI components:** Design system components in `components/ui/`
4. **Page components:** App router pages and layouts

**Key Requirements:**
- WCAG 2.1 AA accessibility compliance testing
- Responsive design validation across mobile/tablet/desktop breakpoints
- Keyboard navigation and screen reader compatibility
- Form validation and error state testing
- Performance testing for complex components (charts, calculations)

### Agent D: Integration Tester (70% Coverage Target)

**Scope:** Cross-system integration, data flows, and complete user workflows

**Priority Order:**
1. **URL hash persistence:** State encoding/decoding, sharing functionality
2. **Cross-calculator data flow:** Paycheck → Retirement data transfer
3. **LocalStorage integration:** Profile persistence, calculation history
4. **Complete user workflows:** End-to-end financial planning scenarios
5. **Error recovery:** Graceful degradation and error handling

**Key Requirements:**
- Test complete user journeys from start to finish
- Validate data consistency across calculators
- Performance testing for complex workflows
- Accessibility workflow testing
- Error recovery and graceful degradation validation

---

## Performance Benchmarks

### Calculation Performance Targets

- **Basic calculations:** <50ms (compound interest, tax calculations)
- **Complex calculations:** <500ms (paycheck optimization, portfolio analysis)
- **Monte Carlo simulations:** <5s (10,000 iterations)
- **Batch calculations:** <100ms for 100 iterations

### Component Performance Targets

- **Initial render:** <100ms for simple components
- **Complex components:** <500ms (calculators with charts)
- **Re-render optimization:** <50ms for state updates
- **Memory usage:** <10MB increase during heavy usage

### Integration Performance Targets

- **URL hash updates:** <100ms
- **LocalStorage operations:** <50ms
- **Cross-calculator navigation:** <200ms
- **Complete workflows:** <10s end-to-end

---

## Coverage Validation

### Pre-commit Checks

```bash
# Verify coverage before committing
npm run test:coverage

# Expected output:
# ✅ lib/calculations/**: 100% coverage (all metrics)
# ✅ components/**: 80% coverage minimum  
# ✅ app/**: 80% coverage minimum
# ✅ Global: 75% coverage minimum
```

### CI/CD Integration

The framework automatically runs in GitHub Actions with:
- Coverage enforcement at specified thresholds
- Performance benchmark validation
- Accessibility compliance checks
- Cross-browser compatibility testing

---

## BufoIndex Philosophy Tests

All recommendation logic must validate contrarian principles:

```typescript
describe('BufoIndex Philosophy', () => {
  it('should recommend max 3 months emergency fund', () => {
    const recommendation = calculateEmergencyFundRecommendation(income)
    expect(recommendation.months).toBeLessThanOrEqual(3)
    expect(recommendation.opportunityCost).toBeGreaterThan(0)
  })

  it('should flag debt above 7% interest', () => {
    const analysis = analyzeDebt([{ balance: 10000, rate: 0.08 }])
    expect(analysis.shouldPayOff).toBe(true)
    expect(analysis.priority).toBe('high')
  })
})
```

---

## Troubleshooting

### Common Issues

**Coverage not meeting thresholds:**
- Check excluded files in `vitest.config.ts`
- Ensure all branches and edge cases are tested
- Use `--coverage.reporter=html` to see uncovered lines

**Performance tests failing:**
- Increase timeout values for complex calculations
- Check for memory leaks in component tests
- Use `--benchmark` flag to identify slow tests

**Integration tests flaky:**
- Ensure proper cleanup in `afterEach` hooks
- Use `waitFor` for asynchronous operations
- Mock external dependencies consistently

### Debug Commands

```bash
# Run specific test with debug output
DEBUG=true npm run test -- --reporter=verbose test/specific-test.ts

# Generate detailed coverage report
npm run test:coverage -- --coverage.reporter=html

# Run performance benchmarks
npm run benchmark -- --reporter=verbose
```

---

## Contributing

When adding new tests:

1. **Use appropriate patterns** from `test/patterns/` directory
2. **Follow naming conventions:** `[component-name].test.{ts,tsx}`
3. **Include performance tests** for calculation-heavy code
4. **Test accessibility** for all interactive components
5. **Document complex test scenarios** with comments

### Test File Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { /* testing utilities */ } from '@/test/utils/...'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  describe('core functionality', () => {
    it('handles basic case', () => {
      // Test implementation
    })

    it('handles edge cases', () => {
      // Edge case testing
    })
  })

  describe('performance', () => {
    it('meets performance benchmarks', () => {
      // Performance validation
    })
  })

  describe('accessibility', () => {
    it('meets WCAG 2.1 AA requirements', () => {
      // Accessibility testing
    })
  })
})
```

---

**Framework Status:** Phase 1 Complete | Ready for Phase 2 Implementation  
**Next Steps:** Deploy Phase 2 agents for parallel test suite implementation