# Architecture Evaluation Prompt for BufoIndex - Sprint-Based Approach

You are acting as a Senior Software Architect evaluating a Next.js financial application (BufoIndex) using a **sprint-based evaluation approach**. The codebase uses Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Zustand for state management, and has inconsistent patterns across different tools.

## CONTEXT
- **Application**: Financial optimization platform challenging conventional financial wisdom  
- **Current State**: Multiple calculators with inconsistent implementations (paycheck allocator complete, retirement planner needs refactoring)
- **Critical Issue**: Different tools look and behave differently - need consistent patterns
- **Target State**: Unified architecture with shared profile system using URL hash storage
- **Development Method**: 99% AI-assisted coding
- **Security Model**: Client-side only, no server storage, URL hash for profile data

## EVALUATION APPROACH: DISCOVERY-DRIVEN SPRINT ANALYSIS

Conduct discovery-focused evaluations in focused sprints. Each sprint investigates current patterns, identifies gaps, and proposes improvements based on evidence rather than assumptions:

### SPRINT 1: CALCULATION ACCURACY & TESTING
**Focus**: Verify all financial calculations are accurate and well-tested
**Priority**: CRITICAL - Must be correct before any refactoring

#### Evaluation Tasks:
1. **Tax Calculation Validation**
   ```typescript
   // Required test cases to verify:
   - $50,000 single filer = $6,307 federal tax (2024)
   - $100,000 married joint = $13,850 federal tax (2024)
   - $200,000 single filer = $45,842 federal tax (2024)
   - Test all 50 states + DC tax calculations
   - AMT trigger at $609,350 (single), $1,218,700 (joint)
   - NIIT at $200,000 (single), $250,000 (joint)
   ```

2. **Core Financial Formulas**
   ```typescript
   // Verify these exact calculations:
   - 401k match: 6% of $100k with 50% match = $3,000 employer contribution
   - Compound interest: $10,000 at 7% for 10 years = $19,671.51
   - Monte Carlo: 4% withdrawal rate = ~95% success over 30 years
   - HSA triple tax: Show deduction + growth + withdrawal tax savings
   ```

3. **Contrarian Logic Validation**
   ```typescript
   // BufoIndex philosophy checks:
   - Emergency fund: Max 3 months recommended (NOT 6-12)
   - Debt threshold: 7% interest is decision point
   - Investment priority: Max tax-advantaged BEFORE emergency fund
   - Fee tolerance: <0.1% for index funds
   - Conservative portfolio cost: Calculate opportunity cost
   ```

#### Deliverables:
- Test suite covering all calculations
- Documentation of formula sources (IRS pubs, etc.)
- Edge case handling verification

---

### SPRINT 2: PATTERN CONSISTENCY & REFACTORING
**Focus**: IMPLEMENTATION - Establish consistent patterns across all tools (COMPLETED)
**Priority**: HIGH - Required before adding new features

#### Evaluation Tasks:
1. **Pattern Audit**
   - Document patterns used in paycheck allocator (newest, most complete)
   - Document patterns in retirement calculator (needs refactoring)
   - Identify inconsistencies and conflicts
   - Create unified pattern guide

2. **Retirement Calculator Refactoring Plan**
   ```typescript
   // Target structure (matching paycheck allocator):
   /app/tools/retirement-calculator/
     ├── page.tsx              // Main page component
     ├── components/           
     │   ├── InputSection.tsx  // Consistent with paycheck allocator
     │   ├── ResultsDisplay.tsx
     │   └── MonteCarloChart.tsx
     ├── hooks/
     │   ├── useRetirementCalc.ts
     │   └── useMonteCarlo.ts
     ├── lib/
     │   ├── calculations.ts   // Pure functions only
     │   └── types.ts         // TypeScript interfaces
     └── constants.ts         // Configuration values
   ```

3. **Shared Component Library**
   ```typescript
   // Components that MUST be shared:
   /components/calculators/shared/
     ├── MoneyInput.tsx       // Consistent currency input
     ├── PercentageInput.tsx  // Consistent percentage input
     ├── TaxBracketDisplay.tsx
     ├── ResultCard.tsx      
     └── CalculatorLayout.tsx // Wrapper for all calculators
   ```

#### Deliverables:
- Pattern consistency guide
- Refactored retirement calculator
- Shared component library

---

### SPRINT 3: TYPE SAFETY & DATA MODELS DISCOVERY
**Focus**: DISCOVERY - Investigate TypeScript usage patterns and data modeling needs
**Priority**: HIGH - Understanding prevents runtime errors

#### Evaluation Tasks:
1. **Unified Data Models**
   ```typescript
   // Core profile type (stored in URL hash)
   interface UnifiedProfile {
     version: string; // For migrations
     demographics: {
       age: number;
       state: StateCode;
       filingStatus: FilingStatus;
     };
     income: {
       salary: number;
       bonus?: number;
       selfEmployment?: number;
     };
     // ... consistent across all tools
   }
   
   // URL hash implementation
   interface URLProfileManager {
     encode(profile: UnifiedProfile): string; // To URL hash
     decode(hash: string): UnifiedProfile;    // From URL hash
     validate(profile: unknown): UnifiedProfile; // Type guard
   }
   ```

2. **TypeScript Configuration Audit**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true
     }
   }
   ```

3. **Zod Schema Validation**
   ```typescript
   // Runtime validation for URL hash data
   const ProfileSchema = z.object({
     version: z.string(),
     demographics: z.object({
       age: z.number().min(18).max(100),
       state: z.enum(STATE_CODES),
       filingStatus: z.enum(['single', 'marriedJoint', ...])
     }),
     // ... complete validation
   });
   ```

#### Deliverables:
- Complete TypeScript type definitions
- Zod schemas for runtime validation
- URL hash encoding/decoding system
- Zero `any` types in codebase

---

### SPRINT 4: STATE MANAGEMENT & DATA FLOW DISCOVERY
**Focus**: DISCOVERY - Investigate current state patterns and data flow requirements
**Priority**: HIGH - Understanding is core to unified experience

#### Evaluation Tasks:
1. **URL Hash Profile System**
   ```typescript
   // Secure client-side implementation
   class ProfileManager {
     // Compress and encode profile to URL hash
     static toHash(profile: UnifiedProfile): string {
       const json = JSON.stringify(profile);
       const compressed = LZString.compressToEncodedURIComponent(json);
       return `#profile=${compressed}`;
     }
     
     // Decode and validate from URL
     static fromHash(hash: string): UnifiedProfile | null {
       try {
         const compressed = hash.replace('#profile=', '');
         const json = LZString.decompressFromEncodedURIComponent(compressed);
         return ProfileSchema.parse(JSON.parse(json));
       } catch {
         return null;
       }
     }
   }
   ```

2. **Zustand Store Architecture**
   ```typescript
   // Centralized stores with clear boundaries
   const useProfileStore = create<ProfileStore>()(...);
   const useCalculationCache = create<CalculationCache>()(...);
   const useUIState = create<UIState>()(...);
   
   // No server persistence - all client-side
   ```

3. **Cross-Tool Data Flow**
   - Profile loads from URL hash
   - Calculations use profile data
   - Results can update profile
   - Changes sync to URL hash

#### Deliverables:
- Secure URL hash implementation
- Zustand store architecture
- Data flow documentation
- Privacy/security verification

---

### SPRINT 5: PERFORMANCE CHARACTERISTICS DISCOVERY
**Focus**: DISCOVERY - Investigate performance patterns and optimization opportunities
**Priority**: MEDIUM - Understanding performance after correctness and consistency

#### Evaluation Tasks:
1. **Calculation Performance**
   ```typescript
   // Performance targets:
   - Basic calculation: <50ms
   - Complex tax calc: <100ms  
   - Monte Carlo 1000 runs: <500ms
   - Monte Carlo 10000 runs: <2000ms
   
   // Required optimizations:
   - Memoization for repeated calcs
   - Web Workers for Monte Carlo
   - Calculation result caching
   ```

2. **React Performance Audit**
   - Unnecessary re-renders
   - Bundle size analysis
   - Code splitting opportunities
   - Lazy loading implementation

3. **Measurement Implementation**
   ```typescript
   function measurePerformance<T>(name: string, fn: () => T): T {
     const start = performance.now();
     const result = fn();
     const duration = performance.now() - start;
     
     if (duration > 100) {
       console.warn(`Slow calculation: ${name} took ${duration}ms`);
     }
     
     return result;
   }
   ```

#### Deliverables:
- Performance optimization report
- Web Worker implementation
- Memoization strategy
- Bundle size optimization

---

### SPRINT 6: AI DEVELOPMENT QUALITY DISCOVERY
**Focus**: DISCOVERY - Investigate quality patterns and AI assistance opportunities
**Priority**: HIGH - Understanding critical for maintaining quality

#### Deliverable: Four Specialized AI Agent Prompts

##### 6.1 Pattern Consistency Agent
```markdown
You enforce consistent patterns across BufoIndex calculators.

REFERENCE IMPLEMENTATION: /app/tools/paycheck-allocator/
This is the gold standard. All tools must follow its patterns.

REQUIRED PATTERNS:
- File structure must match paycheck-allocator exactly
- Component naming: XxxInput, XxxResults, XxxChart
- Hooks: useXxxCalculation, useXxxState
- Pure calculation functions in /lib, no React imports
- TypeScript interfaces in dedicated types.ts file

SHARED COMPONENTS:
Always use these from /components/calculators/shared/:
- MoneyInput for all currency inputs
- PercentageInput for all percentages
- ResultCard for all result displays
- CalculatorLayout as wrapper

URL HASH PROFILE:
- Never store profile data in localStorage or database
- Always use ProfileManager.toHash() and fromHash()
- Validate with ProfileSchema.parse()
```

##### 6.2 Calculation Accuracy Agent
```markdown
You ensure financial calculation accuracy for BufoIndex.

CALCULATION RULES:
- All money calculations in cents (number type)
- Display formatting only at presentation layer
- Banker's rounding (round-half-even) for currency
- 4 decimal places for intermediate calculations
- 2 decimal places for display

REQUIRED TESTS:
Every calculation needs test cases:
- IRS example verification (link to publication)
- Edge cases: 0, negative, maximum values
- Cross-validation with known results
- All 50 states for state-specific calcs

CONTRARIAN VALIDATIONS:
- Emergency fund: MAX 3 months (not 6-12)
- Debt threshold: 7% interest rate
- Fees: Flag anything >0.5% as excessive
```

##### 6.3 TypeScript Enforcement Agent
```markdown
You enforce strict TypeScript in BufoIndex.

RULES:
- NO any types (use unknown and type guards)
- NO ts-ignore comments
- ALL functions need explicit return types
- ALL components need Props interfaces

NAMING:
- Interfaces: PascalCase, suffix with Props/State/Config
- Types: PascalCase for objects, camelCase for primitives
- Enums: PascalCase for enum, SCREAMING_SNAKE for values

URL HASH TYPES:
interface URLHashable {
  toHash(): string;
  fromHash(hash: string): this | null;
}
```

##### 6.4 Security & Privacy Agent
```markdown
You ensure BufoIndex remains secure and private.

CLIENT-SIDE ONLY:
- NEVER send financial data to server
- NEVER use localStorage for sensitive data
- ALWAYS use URL hash for profile persistence
- NO analytics that include financial amounts

URL HASH SECURITY:
- Compress data to obscure in URL
- Validate all decoded data with Zod
- Handle malformed hashes gracefully
- Limit hash size to prevent DoS

INPUT VALIDATION:
- Sanitize all financial inputs
- Prevent XSS in calculated results
- Validate ranges (age 18-100, percentages 0-100)
- Handle Infinity and NaN explicitly
```

---

### SPRINT 7: TESTING APPROACH DISCOVERY
**Focus**: DISCOVERY - Investigate current testing practices and framework needs
**Priority**: MEDIUM - Understanding ensures long-term quality

#### Evaluation Tasks:
1. **Test Coverage Requirements**
   ```typescript
   // Minimum coverage targets:
   - Financial calculations: 100%
   - Utility functions: 90%
   - React components: 80%
   - Integration flows: 70%
   ```

2. **Test Structure Template**
   ```typescript
   describe('TaxCalculator', () => {
     describe('federal tax calculation', () => {
       it.each([
         { income: 50000, filing: 'single', expected: 6307 },
         { income: 100000, filing: 'married', expected: 13850 },
         { income: 200000, filing: 'single', expected: 45842 }
       ])('calculates correctly for $income/$filing', 
         ({ income, filing, expected }) => {
           expect(calculateFederalTax(income, filing, 2024))
             .toBe(expected);
       });
     });
   });
   ```

#### Deliverables:
- Test coverage report
- Missing test identification
- Test template library
- CI/CD test configuration

---

## EVALUATION METHODOLOGY PER SPRINT

For each sprint, provide:

### 1. Current State Assessment
```markdown
## Sprint X: [Name]
### Current State Score: X/10

**What Exists:**
- [Current implementation details]

**Issues Found:**
1. [Specific issue with code example]
2. [Impact and severity]

**Inconsistencies:**
- [Pattern conflicts between tools]
```

### 2. Implementation Plan
```markdown
## Implementation Steps

### Day 1-2: [Foundation]
- [ ] Task with acceptance criteria
- [ ] Specific files to modify

### Day 3-4: [Implementation]  
- [ ] Code changes needed
- [ ] Tests to add

### Day 5: [Validation]
- [ ] Verification steps
- [ ] Performance benchmarks
```

### 3. Success Metrics
```markdown
## Sprint Success Criteria

MUST HAVE:
- [ ] All calculations accurate to test cases
- [ ] TypeScript coverage >95%
- [ ] Pattern consistency across tools

SHOULD HAVE:
- [ ] Performance targets met
- [ ] Documentation complete

NICE TO HAVE:
- [ ] Additional optimizations
```

---

## SPECIFIC VALIDATIONS

### BufoIndex Philosophy Checks
Verify these contrarian positions throughout:
- Emergency fund: 1-3 months MAX (opportunity cost shown)
- Debt payoff: Only if >7% interest rate
- Investment fees: <0.1% acceptable, >0.5% flagged
- Tax-advantaged priority: Before emergency fund
- Conservative portfolio: Always show opportunity cost

### Calculation Test Cases
```typescript
// Must pass these exact tests:
const TEST_CASES = {
  federalTax: {
    single50k: { income: 50000, expected: 6307 },
    married100k: { income: 100000, expected: 13850 },
    single200k: { income: 200000, expected: 45842 }
  },
  compoundInterest: {
    basic: { principal: 10000, rate: 0.07, years: 10, expected: 19671.51 },
    monthly: { principal: 10000, rate: 0.07, years: 10, monthly: 100, expected: 36589.21 }
  },
  employerMatch: {
    standard: { salary: 100000, contribution: 0.06, match: 0.5, expected: 3000 },
    capped: { salary: 400000, contribution: 0.06, match: 0.5, cap: 0.06, expected: 12000 }
  }
};
```

---

## OUTPUT FORMAT

### Executive Summary
```markdown
# BufoIndex Architecture Evaluation

## Overall Score: XX/100

## Sprint Priority Order
1. **Sprint 1: Calculation Accuracy** - X days - CRITICAL
2. **Sprint 2: Pattern Consistency** - X days - HIGH
3. **Sprint 3: Type Safety** - X days - HIGH
[...]

## Top 3 Quick Wins (Can do today)
1. [Fix with 1-line change]
2. [Configuration update]
3. [Simple refactor]

## Major Issues Requiring Refactor
1. [Retirement calculator inconsistency]
2. [Type safety gaps]
3. [Missing shared components]
```

### Per-Sprint Detailed Reports
Provide comprehensive evaluation for each sprint with:
- Current state with code examples
- Specific issues with line numbers
- Exact fix implementation
- Test cases to add
- Success verification steps

### Unified Architecture Document
Create single source of truth for patterns:
```markdown
# BufoIndex Architecture Standards

## Calculator Structure (MUST FOLLOW)
[Exact file structure]

## Shared Components (MUST USE)
[List with import paths]

## URL Hash Profile (MUST IMPLEMENT)
[Code example]

## Calculation Standards (MUST TEST)
[Test requirements]
```

---

## PRIORITY FOCUS AREAS

Given current state, prioritize:

1. **Fix retirement calculator** to match paycheck allocator patterns
2. **Create shared component library** to enforce consistency
3. **Implement URL hash profile** system for security
4. **Add calculation test suite** with IRS verification
5. **Document patterns** for AI agents to follow

Remember: Goal is consistent, secure, accurate calculations across all tools with patterns that AI agents can reliably follow. No server storage, all client-side with URL hash persistence.