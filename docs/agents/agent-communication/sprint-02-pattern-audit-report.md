# Sprint 2: Pattern Audit Report - Agent A (pattern-auditor-agent)

**Date:** 2025-08-28  
**Agent:** Pattern Auditor (Agent A)  
**Phase:** 1 - Pattern Discovery & Analysis  
**Status:** ✅ COMPLETED

---

## Executive Summary

**CRITICAL FINDING:** Paycheck allocator follows exemplary component decomposition patterns, while retirement calculator violates all established conventions with a monolithic 363-line component.

**PATTERN COMPLIANCE:**
- **Paycheck Allocator:** 🟢 GOLD STANDARD (151 lines, 8 components)
- **Retirement Calculator:** 🔴 COMPLETE REFACTORING REQUIRED (363 lines, 1 component)

---

## Gold Standard Pattern Documentation (Paycheck Allocator)

### File Structure Analysis ✅ EXCELLENT
```
app/tools/paycheck-allocator/
└── page.tsx                           # Route wrapper only (32 lines)

components/calculator/
├── PaycheckAllocator.tsx              # Main orchestrator (151 lines)
├── InputSection.tsx                   # Form inputs (large component)
├── ResultsSection.tsx                 # Results display (large component)  
├── PaycheckBreakdown.tsx              # Data breakdown
├── PaycheckSummaryBox.tsx             # Summary display
├── PayrollSetupGuide.tsx              # Setup guidance
└── StreamlinedInputSection.tsx        # Alternative input style

lib/store/
└── calculatorStore.ts                 # Zustand store with persistence
```

### Component Naming Patterns ✅ CONSISTENT
- **Main Component:** `PaycheckAllocator.tsx` (noun-based)
- **Section Components:** `InputSection.tsx`, `ResultsSection.tsx` (function + Section)
- **Feature Components:** `PaycheckBreakdown.tsx`, `PayrollSetupGuide.tsx` (domain + function)
- **Alternative Styles:** `StreamlinedInputSection.tsx` (adjective + base name)

### State Management Pattern ✅ SOPHISTICATED
```typescript
// Centralized Zustand store with persistence
import { useCalculatorStore } from '@/lib/store/calculatorStore';

// Usage in main component:
const { 
  result, 
  isCalculating, 
  errors, 
  calculate,
  clearErrors,
  loadFromUrl
} = useCalculatorStore();
```

### Component Decomposition ✅ EXCELLENT
- **Main Component:** 151 lines - orchestration only
- **InputSection:** Dedicated form handling
- **ResultsSection:** Dedicated results display
- **Specialized Components:** Breakdown, summary, guidance components

### Import Organization ✅ CLEAN
```typescript
// External React imports
import React from 'react';
// Store/state imports  
import { useCalculatorStore } from '@/lib/store/calculatorStore';
// Local component imports
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
// UI component imports
import { Button } from '@/components/ui/button';
// Icon imports
import { Calculator, Loader2 } from 'lucide-react';
// Utility imports
import { cn } from '@/lib/utils';
```

---

## Retirement Calculator Pattern Violations 🔴 CRITICAL ISSUES

### File Structure Problems
```
app/tools/retirement-calculator/
└── page.tsx                           # Route wrapper (minimal)

components/retirement/
└── RetirementCalculator.tsx           # 🔴 MONOLITHIC (363 lines)
```

**VIOLATIONS:**
- ❌ No component decomposition
- ❌ Single 363-line monolithic component
- ❌ No separation of concerns
- ❌ Mixed state management patterns

### State Management Inconsistencies
```typescript
// 🔴 Local useState instead of centralized store
const [inputs, setInputs] = React.useState<RetirementInputs>({...});
const [results, setResults] = React.useState<RetirementResults | null>(null);
const [isCalculating, setIsCalculating] = React.useState(false);

// 🔴 Direct calculation imports in component
import { calculateRetirementAnalysis } from '@/lib/calculations/retirement';

// 🔴 Manual URL state management
import { encodeRetirementToUrlHash, decodeRetirementFromUrlHash } from '@/lib/utils/retirementState';
```

### Component Size Violations
- **Retirement Calculator:** 363 lines (241% larger than gold standard)
- **Paycheck Allocator:** 151 lines (benchmark)

### Import Organization Problems
```typescript
// 🔴 Mixed import organization
import React from 'react';
import { InputCard } from '@/components/ui/cards/BaseCard'; // UI components mixed
import { Input } from '@/components/ui/input';
import { TrendingUp, DollarSign, User, Share2 } from 'lucide-react'; // Icons mixed
import { RetirementInputs, RetirementResults, calculateRetirementAnalysis } from '@/lib/calculations/retirement'; // Calculations mixed
import { RetirementConstants } from '@/lib/constants/retirement';
import { formatCurrency } from '@/lib/utils';
// 🔴 Very long URL state import
import { encodeRetirementToUrlHash, decodeRetirementFromUrlHash, updateRetirementUrlHash, loadRetirementFromUrl } from '@/lib/utils/retirementState';
```

---

## Required Shared Component Patterns

### Missing Shared Components (Required)
1. **MoneyInput.tsx** - Consistent currency input formatting
2. **PercentageInput.tsx** - Standard percentage input (0-100 range)  
3. **TaxBracketDisplay.tsx** - Tax bracket visualization
4. **ResultCard.tsx** - Consistent result display format
5. **CalculatorLayout.tsx** - Standard calculator wrapper

### Visual Inconsistencies
- Different card styling between calculators
- Inconsistent input components
- No shared layout structure
- Different responsive patterns

---

## Unified Pattern Guide for BufoIndex

### Standard Directory Structure Template
```
app/tools/[calculator-name]/
└── page.tsx                           # Route wrapper only (navigation + main component)

components/[calculator-name]/
├── [CalculatorName].tsx               # Main orchestrator (< 200 lines)
├── InputSection.tsx                   # Form inputs component
├── ResultsSection.tsx                 # Results display component
├── [Feature]Chart.tsx                 # Visualization components  
├── [Feature]Display.tsx               # Specialized display components
└── types.ts                           # TypeScript interfaces

lib/store/
└── [calculatorName]Store.ts           # Zustand store with persistence

lib/calculations/
└── [calculatorName].ts                # Pure calculation functions (no React imports)
```

### Component Naming Rules
1. **Main Component:** `[DomainName]Calculator.tsx` (e.g., `PaycheckAllocator.tsx`, `RetirementCalculator.tsx`)
2. **Section Components:** `[Function]Section.tsx` (e.g., `InputSection.tsx`, `ResultsSection.tsx`)
3. **Feature Components:** `[Domain][Function].tsx` (e.g., `PaycheckBreakdown.tsx`, `MonteCarloChart.tsx`)
4. **Shared Components:** `[Function][Type].tsx` (e.g., `MoneyInput.tsx`, `ResultCard.tsx`)

### Hook Usage Guidelines
1. **Store Hook:** `use[CalculatorName]Store()` with destructuring
2. **Local State:** Only for UI-specific state (expanded sections, loading states)
3. **Effects:** Minimal - URL loading on mount, debounced URL updates only

### Import/Export Patterns
```typescript
// 1. External React imports
import React from 'react';

// 2. Store/state imports
import { useCalculatorStore } from '@/lib/store/calculatorStore';

// 3. Local component imports (relative)
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';

// 4. Shared component imports (absolute)
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';

// 5. UI component imports
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 6. Icon imports
import { Calculator, Loader2 } from 'lucide-react';

// 7. Utility imports
import { cn, formatCurrency } from '@/lib/utils';
```

---

## Detailed Refactoring Plan for Retirement Calculator

### PHASE 2B Tasks (Agent B - retirement-refactorer-agent)

#### Task B1: Directory Restructure (ARCH-013)
```bash
# Create proper directory structure
mkdir -p app/tools/retirement-calculator/components/
mkdir -p app/tools/retirement-calculator/hooks/
mkdir -p app/tools/retirement-calculator/lib/

# Move and restructure files:
# components/retirement/RetirementCalculator.tsx → split into multiple files
```

#### Task B2: Component Decomposition (ARCH-014)
**Target File Structure:**
```
app/tools/retirement-calculator/
├── page.tsx                           # Route wrapper (keep minimal)
├── components/
│   ├── RetirementCalculator.tsx       # Main orchestrator (< 200 lines)
│   ├── InputSection.tsx               # All form inputs
│   ├── ResultsSection.tsx             # Results display
│   ├── MonteCarloChart.tsx            # Chart visualization
│   ├── ComparisonDisplay.tsx          # Scenario comparison
│   └── types.ts                       # TypeScript interfaces
├── hooks/
│   ├── useRetirementCalc.ts           # Calculation hook
│   └── useMonteCarlo.ts               # Monte Carlo hook
└── lib/
    ├── calculations.ts                # Pure calculation functions
    └── constants.ts                   # Configuration constants
```

#### Task B3: State Management Refactoring (ARCH-015)
```typescript
// Create: lib/store/retirementStore.ts
interface RetirementState {
  inputs: RetirementInputs;
  results: RetirementResults | null;
  isCalculating: boolean;
  errors: Record<string, string>;
  
  // Actions
  updateInputs: (updates: Partial<RetirementInputs>) => void;
  calculate: () => Promise<void>;
  loadFromUrl: () => void;
  generateShareUrl: () => string;
}
```

#### Task B4: Pure Function Extraction (ARCH-016)
```typescript
// Move to: lib/calculations/retirement.ts (NO React imports)
export function calculateRetirementAnalysis(inputs: RetirementInputs): RetirementResults {
  // Pure calculation functions only
}

// Move to: lib/constants/retirement.ts
export const RetirementConstants = {
  DEFAULT_ACCUMULATION_RETURN: 0.07,
  // ... all constants
};
```

---

## Agent B Success Criteria Checklist

**Component Decomposition:**
- [ ] RetirementCalculator.tsx < 200 lines (currently 363)
- [ ] InputSection.tsx created with all form logic
- [ ] ResultsSection.tsx created with all display logic
- [ ] MonteCarloChart.tsx extracted for visualization
- [ ] All components follow naming conventions

**State Management:**
- [ ] Zustand store created matching paycheck allocator pattern
- [ ] Local useState replaced with store usage
- [ ] URL hash persistence integrated into store
- [ ] Error handling consistent with gold standard

**Import Organization:**
- [ ] Imports organized by type (React → Store → Local → Shared → UI → Icons → Utils)
- [ ] Relative imports for local components
- [ ] Absolute imports for shared components

**Functional Equivalence:**
- [ ] All calculations produce identical results
- [ ] URL hash sharing works identically
- [ ] No functionality regressions
- [ ] TypeScript compiles without errors

---

## Dependencies for Phase 2 Agents

### Agent B Requirements
- This pattern documentation
- Access to existing retirement calculator functionality
- Must preserve all calculation logic exactly

### Agent C Requirements  
- This pattern documentation
- Understanding of both calculator UI patterns
- Access to existing shared component patterns in `/components/shared/`

---

## Next Phase Coordination

**Ready for Phase 2 Parallel Execution:**
- Agent B: Refactor retirement calculator using these patterns
- Agent C: Create shared components for visual consistency

**Pattern documentation complete. Phase 1 success criteria met.**

---
*Agent A Pattern Audit Complete - Ready for Phase 2 Parallel Execution*