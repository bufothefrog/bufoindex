# BufoIndex Calculator Development Pattern Guide

**Version:** 2.0  
**Last Updated:** 2025-08-28  
**Status:** Production Ready  

---

## Executive Summary

This guide establishes the definitive architectural patterns for BufoIndex calculator development. These patterns were validated through Sprint 2's successful refactoring of the retirement calculator and creation of a shared component library.

**Pattern Compliance Status:**
- **Paycheck Allocator:** 🟢 GOLD STANDARD (reference implementation)
- **Retirement Calculator:** 🟢 FULLY COMPLIANT (refactored to match patterns)
- **Shared Components:** 🟢 ESTABLISHED (comprehensive library created)

---

## Core Architecture Principles

### 1. Component Decomposition
- **Main Component:** < 200 lines, orchestration only
- **Section Components:** Focused single-responsibility components
- **Shared Components:** Reusable across all calculators
- **No Monolithic Components:** Everything must be decomposable

### 2. State Management
- **Zustand Stores:** Centralized state with persistence
- **URL Hash Persistence:** All state shareable via URL
- **Selector Hooks:** Fine-grained state subscriptions
- **No Local State:** Except UI-specific interactions

### 3. Design Consistency
- **Shared Component Library:** Enforce visual consistency
- **Color Palette:** Sage green (#7FB069) with variants
- **Typography:** Consistent sizing and spacing
- **Mobile-First:** Responsive design patterns

---

## Directory Structure Standard

### Required File Organization
```
app/tools/[calculator-name]/
├── page.tsx                           # Route wrapper (minimal, navigation only)
└── components/                        # All calculator components
    ├── [CalculatorName].tsx           # Main orchestrator (< 200 lines)
    ├── InputSection.tsx               # Form inputs component
    ├── ResultsSection.tsx             # Results display component
    ├── [Feature]Chart.tsx             # Visualization components
    └── [Feature]Display.tsx           # Specialized display components

lib/store/
└── [calculatorName]Store.ts           # Zustand store with persistence

lib/calculations/
└── [calculatorName].ts                # Pure calculation functions (no React)

lib/constants/
└── [calculatorName].ts                # Configuration constants
```

### Real Examples from Codebase
```
✅ CORRECT: Retirement Calculator (Refactored)
app/tools/retirement-calculator/
├── page.tsx                           # 25 lines
└── components/
    ├── RetirementCalculator.tsx       # 67 lines (orchestrator)
    ├── InputSection.tsx               # 195 lines (forms)
    ├── ResultsSection.tsx             # 183 lines (results)
    └── MonteCarloChart.tsx            # 97 lines (visualization)

lib/store/
└── retirementStore.ts                 # 139 lines (state management)

✅ CORRECT: Paycheck Allocator (Gold Standard)  
app/tools/paycheck-allocator/
└── page.tsx                           # 32 lines

components/calculator/
├── PaycheckAllocator.tsx              # 48 lines (orchestrator)
├── InputSection.tsx                   # Large (forms)
├── ResultsSection.tsx                 # Large (results)
├── PaycheckBreakdown.tsx              # Specialized display
├── PaycheckSummaryBox.tsx             # Summary component
└── PayrollSetupGuide.tsx              # Guidance component

lib/store/
└── calculatorStore.ts                 # State management

❌ INCORRECT: Monolithic Pattern (Before Refactoring)
components/retirement/
└── RetirementCalculator.tsx           # 363 lines (MONOLITHIC - TOO LARGE)
```

---

## Component Naming Standards

### Established Patterns (Mandatory)
1. **Main Components:** `[DomainName]Calculator.tsx`
   - Examples: `PaycheckAllocator.tsx`, `RetirementCalculator.tsx`
   
2. **Section Components:** `[Function]Section.tsx`
   - Examples: `InputSection.tsx`, `ResultsSection.tsx`
   
3. **Feature Components:** `[Domain][Function].tsx`
   - Examples: `PaycheckBreakdown.tsx`, `MonteCarloChart.tsx`
   
4. **Shared Components:** `[Function][Type].tsx`
   - Examples: `MoneyInput.tsx`, `ResultCard.tsx`

### Component Size Limits
- **Main Component:** < 200 lines (orchestration only)
- **Section Components:** < 300 lines (focused responsibility)  
- **Feature Components:** < 200 lines (single feature)
- **Shared Components:** < 250 lines (reusable patterns)

---

## Import Organization Standard

### Mandatory Import Order
```typescript
// 1. External React imports
import React from 'react';

// 2. Store/state imports
import { useCalculatorStore } from '@/lib/store/calculatorStore';

// 3. Local component imports (relative paths)
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';

// 4. Shared component imports (absolute paths)
import { MoneyInput } from '@/components/calculators/shared/MoneyInput';
import { ResponsiveCalculatorLayout } from '@/components/calculators/shared/CalculatorLayout';

// 5. UI component imports
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 6. Icon imports
import { Calculator, Loader2 } from 'lucide-react';

// 7. Utility imports
import { cn, formatCurrency } from '@/lib/utils';
```

### Import Path Rules
- **Local Components:** Use relative paths (`./ComponentName`)
- **Shared Components:** Use absolute paths (`@/components/calculators/shared/`)
- **Store Imports:** Always use absolute paths (`@/lib/store/`)
- **Utility Imports:** Group together at the end

---

## State Management Patterns

### Zustand Store Structure (Mandatory)
```typescript
interface CalculatorState {
  // Current calculation data
  inputs: CalculatorInputs;
  results: CalculatorResults | null;
  
  // UI state  
  isCalculating: boolean;
  activeSection: string;
  showAdvanced: boolean;
  
  // Error handling
  errors: Record<string, string>;
  
  // Actions (follow this exact pattern)
  updateInputs: (updates: Partial<CalculatorInputs>) => void;
  calculate: () => Promise<void>;
  loadFromUrl: () => void;
  generateShareUrl: () => string;
  clearErrors: () => void;
  setActiveSection: (section: string) => void;
  toggleAdvanced: () => void;
}
```

### Selector Hook Patterns
```typescript
// Export these from your store file
export const useCalculatorInputs = () => useCalculatorStore(state => state.inputs);
export const useCalculatorResults = () => useCalculatorStore(state => state.results);
export const useCalculatorCalculating = () => useCalculatorStore(state => state.isCalculating);
export const useCalculatorErrors = () => useCalculatorStore(state => state.errors);
```

### Store Integration Pattern
```typescript
export function CalculatorComponent() {
  const { 
    results, 
    isCalculating, 
    errors, 
    calculate,
    clearErrors,
    loadFromUrl,
    generateShareUrl
  } = useCalculatorStore();
  
  React.useEffect(() => {
    clearErrors();
    loadFromUrl();
  }, [clearErrors, loadFromUrl]);
  
  const handleCalculate = async () => {
    await calculate();
  };

  const handleShare = async () => {
    const url = generateShareUrl();
    // Share implementation...
  };
  
  // Component implementation...
}
```

---

## Shared Component Usage Standards

### Required Shared Components
Use these components for consistency across all calculators:

#### 1. CalculatorLayout (Mandatory)
```typescript
import { ResponsiveCalculatorLayout } from '@/components/calculators/shared/CalculatorLayout';

return (
  <ResponsiveCalculatorLayout
    title="Calculator Title"
    description="Calculator description"
    inputSection={<InputSection />}
    resultsSection={<ResultsSection />}
    isCalculating={isCalculating}
    hasResults={!!results}
    onCalculate={handleCalculate}
    onShare={handleShare}
    calculateButtonText="Calculate" 
    calculatingText="Calculating..."
    errors={errors}
  />
);
```

#### 2. MoneyInput (For Currency Values)
```typescript
import { MoneyInput } from '@/components/calculators/shared/MoneyInput';

<MoneyInput
  label="Annual Income"
  value={income}
  onChange={setIncome}
  min={0}
  step={1000}
  size="lg" // sm, default, lg
  helperText="Your gross annual income"
/>
```

#### 3. PercentageInput (For Rates/Percentages)
```typescript
import { PercentageInput } from '@/components/calculators/shared/PercentageInput';

<PercentageInput
  label="Savings Rate"
  value={savingsRate} // Store as decimal (0.20 for 20%)
  onChange={setSavingsRate}
  min={0}
  max={1}
  displayMode="both" // input, slider, both
/>
```

#### 4. ResultCard (For Results Display)
```typescript
import { ResultCard, MetricCard, InsightCard } from '@/components/calculators/shared/ResultCard';

// Key metrics
<MetricCard
  label="Safe Withdrawal Rate"
  value="4.2%"
  icon={Target}
  variant="success"
  trend="up"
/>

// Insights
<InsightCard
  title="Key Insights"
  insights={["Increase savings by 2%", "Consider Roth conversion"]}
  icon={Lightbulb}
  variant="info"
/>
```

### Component Selection Rules
- **Currency Values:** Always use MoneyInput
- **Percentages/Rates:** Always use PercentageInput  
- **Layout Wrapper:** Always use ResponsiveCalculatorLayout
- **Key Metrics:** Always use MetricCard
- **Lists of Insights:** Always use InsightCard
- **Complex Results:** Use ResultCard with custom content

---

## Main Component Pattern

### Template Structure (Copy This)
```typescript
'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { ResponsiveCalculatorLayout } from '@/components/calculators/shared/CalculatorLayout';

export function CalculatorName() {
  const { 
    results, 
    isCalculating, 
    errors, 
    calculate,
    clearErrors,
    loadFromUrl,
    generateShareUrl
  } = useCalculatorStore();
  
  React.useEffect(() => {
    // Always include these on mount
    clearErrors();
    loadFromUrl();
  }, [clearErrors, loadFromUrl]);
  
  const handleCalculate = async () => {
    await calculate();
  };

  const handleShare = async () => {
    const url = generateShareUrl();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BufoIndex Calculator Name',
          text: 'Check out my calculation results',
          url: url
        });
      } catch (error) {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };
  
  return (
    <ResponsiveCalculatorLayout
      title="Calculator Title"
      description="Clear description of what this calculator does"
      inputSection={<InputSection />}
      resultsSection={<ResultsSection />}
      isCalculating={isCalculating}
      hasResults={!!results}
      onCalculate={handleCalculate}
      onShare={handleShare}
      calculateButtonText="Calculate My Results"
      calculatingText="Processing Analysis..."
      errors={errors}
    />
  );
}
```

---

## Error Handling Patterns

### Store Error Management
```typescript
// In your store
set({ 
  errors: { 
    fieldName: 'User-friendly error message' 
  },
  isCalculating: false 
});

// Clear errors on input changes
updateInputs: (updates) => {
  set((state) => ({
    inputs: { ...state.inputs, ...updates },
    errors: {} // Always clear errors on input change
  }));
}
```

### Component Error Display
```typescript
// Errors automatically displayed by CalculatorLayout
// No manual error handling needed in main component

// For custom error displays in sections:
{errors.fieldName && (
  <div className="text-sm text-red-600">
    {errors.fieldName}
  </div>
)}
```

---

## URL State Management

### Hash Encoding Pattern (Required)
```typescript
// In your store  
generateShareUrl: () => {
  const { inputs } = get();
  try {
    const hash = encodeCalculatorToUrlHash(inputs);
    const baseUrl = typeof window !== 'undefined' ? 
      window.location.origin + window.location.pathname : '';
    return `${baseUrl}#${hash}`;
  } catch (error) {
    console.error('Failed to generate share URL:', error);
    return typeof window !== 'undefined' ? window.location.href : '';
  }
}

loadFromUrl: () => {
  try {
    if (typeof window === 'undefined') return;
    
    const hash = window.location.hash.slice(1);
    if (hash) {
      const urlInputs = decodeCalculatorFromUrlHash(hash);
      if (urlInputs) {
        set({ inputs: urlInputs });
      }
    }
  } catch (error) {
    console.warn('Failed to load from URL:', error);
  }
}
```

### URL Update Pattern
```typescript
// Debounced URL updates on input changes
updateInputs: (updates) => {
  set((state) => ({
    inputs: { ...state.inputs, ...updates },
    errors: {}
  }));
  
  // Debounced URL update
  const timeoutId = setTimeout(() => {
    const { inputs } = get();
    try {
      const hash = encodeCalculatorToUrlHash(inputs);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${hash}`);
      }
    } catch (error) {
      console.warn('Failed to update URL hash:', error);
    }
  }, 1000);

  return () => clearTimeout(timeoutId);
}
```

---

## Calculation Function Standards

### Pure Function Requirements
```typescript
// ✅ CORRECT: Pure calculation function
export function calculateRetirement(inputs: RetirementInputs): RetirementResults {
  // No React imports
  // No side effects  
  // No console.logs in production
  // Comprehensive input validation
  // Return consistent interface
}

// ❌ INCORRECT: Mixed concerns
export function calculateRetirement(inputs: RetirementInputs): RetirementResults {
  console.log('Calculating...'); // Side effect
  setIsLoading(true);             // React dependency
  // ...
}
```

### File Organization
```typescript
// lib/calculations/calculatorName.ts
export interface CalculatorInputs {
  // All input properties with types
}

export interface CalculatorResults {
  // All result properties with types
}

export function calculateMainAnalysis(inputs: CalculatorInputs): CalculatorResults {
  // Main calculation logic
}

export function calculateSubAnalysis(inputs: Partial<CalculatorInputs>): SubResults {
  // Helper calculations
}
```

---

## Code Quality Standards

### TypeScript Requirements
- **100% Type Coverage:** No `any` types allowed
- **Interface Exports:** All interfaces must be exportable
- **Generic Types:** Use generics for reusable patterns
- **Strict Mode:** Enable strict TypeScript checking

### Performance Requirements
- **Calculation Speed:** < 50ms for all calculations
- **Bundle Size:** Keep shared components under 15KB gzipped
- **Memory Leaks:** Clean up all useEffect dependencies
- **Re-renders:** Minimize using selector hooks

### Accessibility Requirements
- **WCAG 2.1 AA:** All components must meet standards
- **Keyboard Navigation:** Full keyboard accessibility
- **Screen Readers:** Proper labeling and ARIA attributes
- **Focus Management:** Visible focus indicators

---

## Testing Patterns

### Manual Testing Checklist (Required)
- [ ] All calculations produce correct results
- [ ] URL sharing and loading works
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility confirmed
- [ ] Error states display properly
- [ ] Loading states work correctly
- [ ] Accessibility verified

### Calculation Verification
```typescript
// Always verify calculations manually
const testInputs = {
  income: 100000,
  savings: 20000,
  // ... other inputs
};

const results = calculateAnalysis(testInputs);
console.log('Expected vs Actual:', expected, results);
// Manually verify each calculation
```

---

## Common Anti-Patterns to Avoid

### ❌ Monolithic Components
```typescript
// DON'T: Single component with 300+ lines
export function Calculator() {
  // 300+ lines of mixed concerns
}
```

### ❌ Mixed State Management
```typescript
// DON'T: Mix useState with Zustand
const [localState, setLocalState] = useState();
const globalState = useStore();
```

### ❌ Inconsistent Naming
```typescript
// DON'T: Inconsistent file naming
Calculator.tsx
calculator-inputs.tsx  
CalculationResults.tsx
```

### ❌ Hardcoded Values
```typescript
// DON'T: Hardcode colors or spacing
<div className="bg-green-500 p-4">
  
// DO: Use design system
<div className="bg-primary p-4">
```

---

## Pattern Validation Checklist

### Pre-Development Checklist
- [ ] Directory structure follows standard
- [ ] Component naming matches patterns
- [ ] Zustand store template copied
- [ ] Shared components identified
- [ ] Import organization planned

### Development Checklist  
- [ ] Main component < 200 lines
- [ ] Imports in correct order
- [ ] Shared components used
- [ ] TypeScript strict mode passing
- [ ] Error handling implemented

### Pre-Deployment Checklist
- [ ] Manual calculation verification
- [ ] Mobile responsive testing
- [ ] URL sharing tested
- [ ] Cross-browser verification
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met

---

## Migration Guide for Existing Calculators

### Step 1: Directory Restructure
1. Create proper directory structure
2. Move components to `components/` subdirectory
3. Extract calculations to `lib/calculations/`
4. Create Zustand store in `lib/store/`

### Step 2: Component Decomposition
1. Split monolithic components (> 200 lines)
2. Create InputSection and ResultsSection
3. Extract feature-specific components
4. Update import paths

### Step 3: Shared Component Integration
1. Replace custom inputs with MoneyInput/PercentageInput
2. Wrap with ResponsiveCalculatorLayout
3. Convert result displays to ResultCard variants
4. Test functionality preservation

### Step 4: State Management Migration
1. Create Zustand store following template
2. Replace useState with store actions
3. Implement URL persistence
4. Test state management

---

## Future Development Guidelines

### When Adding New Calculators
1. **Copy Template:** Start with main component template
2. **Follow Patterns:** Use exact naming and structure patterns  
3. **Share Components:** Identify reusable component opportunities
4. **Test Thoroughly:** Complete validation checklist
5. **Document Deviations:** Any pattern deviations must be documented

### When Updating Existing Calculators  
1. **Check Compliance:** Compare against current patterns
2. **Refactor if Needed:** Bring non-compliant components up to standard
3. **Test Regressions:** Ensure no functionality lost
4. **Update Documentation:** Keep patterns guide current

### When Creating Shared Components
1. **Analyze Usage:** Identify common patterns across calculators
2. **Design APIs:** Create flexible, reusable interfaces
3. **Test Integration:** Verify works with all existing calculators
4. **Update Guide:** Document new shared components

---

**This pattern guide is the single source of truth for BufoIndex calculator development. All future development must follow these established patterns.**

---

*Pattern Guide Version 2.0 - Validated through Sprint 2 Implementation*