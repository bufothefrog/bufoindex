# Test Infrastructure Requirements - CRITICAL NEVER-VIOLATE RULES

**Version:** 1.0 - Post-Sprint 08 Crisis  
**Effective Date:** August 28, 2025  
**Status:** MANDATORY CRITICAL RULES - ZERO TOLERANCE  
**Purpose:** Prevent recurrence of Sprint 08 catastrophic test infrastructure failure

---

## 🚨 CRITICAL CONTEXT

**Sprint 08 Crisis:** Complete development halt caused by broken test infrastructure with 76+ TypeScript compilation errors. This document establishes NEVER-VIOLATE rules to prevent recurrence.

**ZERO TOLERANCE:** Violation of any rule in this document blocks all development until fixed.

---

## RULE 1: COMPILATION INTEGRITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
```bash
# These commands MUST always succeed:
npm run type-check    # Zero TypeScript errors
npm run build        # Successful production build  
npm test            # Test suite runs (even if tests fail)
```

### ❌ NEVER ALLOWED
- TypeScript compilation errors in any file
- Configuration file syntax errors
- Unresolved import/export chains
- Missing required dependencies

### ENFORCEMENT
```bash
#!/bin/bash
# .husky/pre-commit - MANDATORY
npm run type-check || {
  echo "🚨 CRITICAL VIOLATION: TypeScript compilation failed"
  echo "Sprint 08 Rule: NEVER commit broken compilation"
  exit 1
}
```

---

## RULE 2: TEST FILE INTEGRITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
- Every test file must compile individually
- All imports must resolve successfully
- No syntax errors in test patterns
- Configuration files must be valid TypeScript

### ❌ NEVER ALLOWED
```typescript
// These patterns caused Sprint 08 crisis - NEVER AGAIN
test/patterns/file.ts(51,25): error TS2339: Property 'forEach' does not exist
test/utils/helpers.ts(19,14): error TS2323: Cannot redeclare exported variable
vitest.config.ts(109,5): error TS2769: No overload matches this call
```

### ENFORCEMENT
```bash
# Test file validation - MANDATORY
find test/ -name "*.ts" -o -name "*.tsx" | while read file; do
  npx tsc --noEmit "$file" || {
    echo "🚨 CRITICAL: Test file $file has compilation errors"
    exit 1
  }
done
```

---

## RULE 3: DEPENDENCY INTEGRITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
All test dependencies must be installed and accessible:

```json
{
  "devDependencies": {
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^14.4.3", 
    "@testing-library/jest-dom": "^6.1.0",
    "vitest": "^3.2.4",
    "@vitest/ui": "^3.2.4",
    "jsdom": "^23.0.0"
  }
}
```

### ❌ NEVER ALLOWED
```typescript
// Sprint 08 actual failures - NEVER AGAIN
error TS2307: Cannot find module '@testing-library/user-event'
error TS2307: Cannot find module 'some-test-utility'
```

### ENFORCEMENT
```bash
# Dependency check - MANDATORY
REQUIRED_DEPS=("@testing-library/react" "@testing-library/user-event" "vitest")
for dep in "${REQUIRED_DEPS[@]}"; do
  npm list "$dep" || {
    echo "🚨 CRITICAL: Missing test dependency $dep"
    exit 1
  }
done
```

---

## RULE 4: CUSTOM MATCHER INTEGRITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
- All custom matchers must be implemented
- Type definitions must be complete
- Setup files must register matchers correctly

```typescript
// REQUIRED: Complete implementation
expect.extend({
  toBeCloseToCurrency(received: number, expected: number, precision = 2) {
    const pass = Math.abs(received - expected) < Math.pow(10, -precision);
    return {
      pass,
      message: () => `Expected ${received} to be within ${precision} decimal places of ${expected}`
    };
  }
});
```

### ❌ NEVER ALLOWED
- Referenced matchers without implementation
- Incomplete type definitions  
- Setup files that don't register correctly

### ENFORCEMENT
```typescript
// Custom matcher validation - MANDATORY
try {
  require('./test/setup');
  expect(100).toBeCloseToCurrency(100, 2); // Must not throw
} catch (error) {
  throw new Error(`🚨 CRITICAL: Custom matcher error: ${error.message}`);
}
```

---

## RULE 5: CONFIGURATION INTEGRITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
```typescript
// vitest.config.ts - Must be valid TypeScript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    reporters: ['default'], // Note: 'reporters' not 'reporter'
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

### ❌ NEVER ALLOWED
```typescript
// Sprint 08 actual failure - NEVER AGAIN
export default defineConfig({
  test: {
    reporter: 'default', // ❌ Should be 'reporters'
    // Other invalid configurations
  }
});
```

### ENFORCEMENT
```bash
# Configuration validation - MANDATORY
npx tsc --noEmit vitest.config.ts || {
  echo "🚨 CRITICAL: vitest.config.ts has TypeScript errors"
  exit 1
}
```

---

## RULE 6: IMPORT/EXPORT COMPLETENESS (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
- All exported classes must have complete implementations
- All declared methods must be implemented
- Import chains must fully resolve

```typescript
// CORRECT: Complete implementation
export class FinancialCalculations {
  calculateFederalTax(income: number, filingStatus: string): number {
    // MUST be fully implemented
    return this.implementedTaxCalculation(income, filingStatus);
  }
  
  private implementedTaxCalculation(income: number, filingStatus: string): number {
    // Complete implementation required
    const brackets = this.getTaxBrackets();
    return this.calculateProgressiveTax(income, brackets);
  }
}
```

### ❌ NEVER ALLOWED
```typescript
// Sprint 08 pattern - caused cascade failures
export class FinancialCalculations {
  // ❌ Empty class with no implementations
}
```

### ENFORCEMENT
```typescript
// Import chain validation - MANDATORY
function validateExportCompleteness(modulePath: string) {
  const module = require(modulePath);
  
  // Check that exported classes have implementations
  Object.keys(module).forEach(exportName => {
    const exported = module[exportName];
    if (typeof exported === 'function' && exported.prototype) {
      // Check methods are implemented
      const methods = Object.getOwnPropertyNames(exported.prototype);
      methods.forEach(method => {
        if (typeof exported.prototype[method] !== 'function') {
          throw new Error(`🚨 CRITICAL: Unimplemented method ${exportName}.${method}`);
        }
      });
    }
  });
}
```

---

## RULE 7: FINANCIAL CALCULATION TESTABILITY (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
- 100% of financial calculations must be testable
- IRS verification test cases must be possible
- Performance benchmarking must be available

```typescript
// REQUIRED: All financial functions must be testable
export function calculateTax(income: number, filingStatus: string): number {
  // Implementation that can be verified against IRS publications
  return verifiableCalculation(income, filingStatus);
}

// REQUIRED: Test must be possible
describe('Tax Calculations', () => {
  it('matches IRS Publication 15 examples', () => {
    expect(calculateTax(50000, 'single')).toBeCloseTo(6307, 0);
  });
});
```

### ❌ NEVER ALLOWED
- Financial calculations that cannot be tested
- Missing verification against authoritative sources
- Calculations without performance benchmarks

---

## RULE 8: BUF0INDEX PHILOSOPHY COMPLIANCE (NEVER VIOLATE)

### ✅ ALWAYS REQUIRED
- No conventional wisdom language in calculations
- Opportunity cost must be emphasized
- 3-month emergency fund maximum enforcement
- 7% debt threshold decision points

```typescript
// CORRECT: BufoIndex contrarian philosophy
const emergencyFundRecommendation = `
BufoIndex recommends maximum 3-month emergency fund.
Opportunity cost of 6-month fund: $${opportunityCost}/year in lost returns.
`;
```

### ❌ NEVER ALLOWED  
```typescript
// DETECTED in codebase - must be fixed
"Money Guys recommend 3-6 months"
"conventional wisdom suggests"
"Dave Ramsey advises"
```

### ENFORCEMENT
```bash
# Philosophy compliance check - MANDATORY
grep -ri "money guys\|dave ramsey\|conventional wisdom" lib/ app/ components/ && {
  echo "🚨 CRITICAL: Philosophy violations detected"
  exit 1
} || echo "✅ Philosophy compliant"
```

---

## EMERGENCY RESPONSE PROTOCOL

### When Infrastructure Fails (Sprint 08 Pattern)

1. **🛑 IMMEDIATE HALT**
   - Stop all development
   - No new features, no bug fixes
   - Focus 100% on infrastructure repair

2. **🔍 RAPID DIAGNOSIS**
   ```bash
   # Run full health check
   npm run type-check
   npm run build  
   npm test
   npm run lint
   ```

3. **🔧 SYSTEMATIC REPAIR**
   - Fix TypeScript errors first
   - Validate configuration files
   - Check dependencies
   - Test custom matchers
   - Verify import chains

4. **✅ VALIDATION GATE**
   ```bash
   # All must pass before resuming development
   npm run type-check &&
   npm run build &&
   npm test &&
   echo "Infrastructure recovered - development may resume"
   ```

---

## AUTOMATED ENFORCEMENT

### Pre-Commit Hook (MANDATORY)
```bash
#!/bin/bash
# .husky/pre-commit - Sprint 08 Prevention

echo "🚨 Running Sprint 08 Prevention Protocol..."

# Rule 1: Compilation
npm run type-check || exit 1

# Rule 2: Test Files  
find test/ -name "*.ts" -o -name "*.tsx" | xargs -I {} npx tsc --noEmit {} || exit 1

# Rule 3: Dependencies
npm list @testing-library/react @testing-library/user-event vitest || exit 1

# Rule 4: Custom Matchers
node -e "require('./test/setup'); expect(1).toBeCloseTo(1)" || exit 1

# Rule 5: Configuration
npx tsc --noEmit vitest.config.ts || exit 1

# Rule 8: Philosophy
grep -ri "money guys\|dave ramsey" lib/ app/ components/ && exit 1 || true

echo "✅ All rules validated - commit allowed"
```

### CI/CD Pipeline (MANDATORY)
```yaml
# .github/workflows/test-infrastructure-validation.yml
name: Test Infrastructure Validation
on: [push, pull_request]

jobs:
  validate-infrastructure:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm ci
    - name: Sprint 08 Prevention Protocol
      run: |
        npm run type-check
        npm run build
        npm test
        npm run lint
```

---

## SUCCESS METRICS

### Zero Tolerance Metrics
- **Compilation Errors:** 0 (no exceptions)
- **Import Failures:** 0 (no exceptions)  
- **Configuration Errors:** 0 (no exceptions)
- **Missing Dependencies:** 0 (no exceptions)

### Quality Gates
- TypeScript compilation: 100% success
- Test file compilation: 100% success  
- Build process: 100% success
- Import resolution: 100% success

---

## CONCLUSION

These rules exist because Sprint 08 demonstrated the catastrophic cost of broken test infrastructure. **Every rule violation risks repeating the complete development halt.**

**REMEMBER:** Prevention is exponentially cheaper than recovery. These rules are non-negotiable guardrails that enable confident, rapid development.

---

**Status:** ACTIVE ENFORCEMENT  
**Compliance:** 100% REQUIRED - ZERO TOLERANCE  
**Review Schedule:** Weekly (enhanced from monthly post-Sprint 08)  
**Emergency Contact:** Sprint 08 patterns MUST trigger immediate response

*🚨 Created in response to Sprint 08 testing infrastructure crisis*

*Action(s) completed with agents.md in context. SPECIAL MESSAGE: "EVALUATE -> PRIORITIZE -> PARALLELIZE -> EXECUTE -> REVIEW & DOCUMENT"*