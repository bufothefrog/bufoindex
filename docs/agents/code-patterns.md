# Mandatory Export/Import Patterns

## TypeScript Export Requirements

**CRITICAL:** All agent-generated TypeScript code must follow these export patterns exactly:

### Financial Calculation Exports
```typescript
// REQUIRED: lib/calculations/[calculator-name].ts
// All calculation functions must be properly typed and exported

// Interface definitions (REQUIRED)
export interface CalculatorInputs {
  // All input parameters with proper types
  amount: number;
  interestRate: number;
  timeHorizon: number;
}

export interface CalculatorOutputs {
  // All output values with proper types  
  futureValue: number;
  totalReturn: number;
  opportunityCost: number; // MANDATORY: All calculations must include opportunity cost
}

// Calculation function (REQUIRED)
export function calculateFinancialResult(inputs: CalculatorInputs): CalculatorOutputs {
  // Implementation must include:
  // 1. Input validation
  // 2. Mathematical calculations
  // 3. Opportunity cost analysis
  // 4. Error handling
  
  return {
    futureValue: /* calculation */,
    totalReturn: /* calculation */,
    opportunityCost: /* calculation */
  };
}

// Validation functions (REQUIRED)
export function validateInputs(inputs: Partial<CalculatorInputs>): string[] {
  // Return array of validation errors, empty if valid
}

// Performance benchmarking (REQUIRED)
export function benchmarkCalculation(): { executionTime: number; memoryUsage: number } {
  // Return performance metrics
}
```

### React Component Exports  
```typescript
// REQUIRED: app/components/[component-name].tsx
import React from 'react';

// Props interface (REQUIRED)
interface ComponentProps {
  // All props with proper types and documentation
  /** The primary value to display */
  value: number;
  /** Callback when value changes */
  onChange: (value: number) => void;
  /** Optional className for styling */
  className?: string;
}

// Main component (REQUIRED)
export default function ComponentName({ value, onChange, className }: ComponentProps) {
  // Implementation requirements:
  // 1. WCAG 2.1 AA compliance
  // 2. Mobile responsive design
  // 3. Error state handling
  // 4. Loading state handling
  // 5. Keyboard navigation support
  
  return (
    // JSX implementation
  );
}

// Named exports for testing (REQUIRED)
export { ComponentName };
export type { ComponentProps };
```

### Test File Exports
```typescript
// REQUIRED: test/[feature].test.ts
import { describe, it, expect } from 'vitest';

// Test utilities (REQUIRED if creating custom utilities)
export function createMockData(): TestDataType {
  // Must include all required fields
  // Must be valid according to interfaces
}

export function setupTestEnvironment(): void {
  // Environment setup for tests
}

// Test suites must be properly structured
describe('Feature Name', () => {
  it('should handle basic functionality', () => {
    // Test implementation
  });
  
  it('should handle edge cases', () => {
    // Edge case testing
  });
  
  it('should meet performance requirements', () => {
    // Performance testing
  });
});
```

## Import Pattern Requirements

### Calculation Imports
```typescript
// REQUIRED: When using calculation functions
import { 
  calculateFinancialResult,
  validateInputs,
  type CalculatorInputs,
  type CalculatorOutputs 
} from '@/lib/calculations/[calculator-name]';

// FORBIDDEN: Don't use wildcard imports for calculations
// import * from '@/lib/calculations/[calculator-name]'; ❌
```

### Component Imports
```typescript
// REQUIRED: When importing components
import ComponentName from '@/components/ComponentName';
import { type ComponentProps } from '@/components/ComponentName';

// REQUIRED: For multiple related components
import {
  Button,
  Input,
  type ButtonProps,
  type InputProps
} from '@/components/ui';
```

## Integration with Quality Gates

### Pre-Commit Hooks Integration
```bash
# REQUIRED: .husky/pre-commit must include these checks
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Quality Gates (MANDATORY)
echo "🔍 Running quality gates..."

# TypeScript compilation
npm run type-check || {
  echo "❌ TypeScript errors detected"
  echo "Fix all TypeScript errors before committing"
  exit 1
}

# Build verification
npm run build || {
  echo "❌ Build failed"
  echo "Fix build errors before committing"
  exit 1
}

# Test execution
npm test || {
  echo "❌ Tests failed"  
  echo "Fix failing tests before committing"
  exit 1
}

# Philosophy compliance
philosophy_violations=$(grep -ri "money guys\|dave ramsey\|conventional wisdom\|6 months emergency" lib/ app/ components/ 2>/dev/null || true)
if [ -n "$philosophy_violations" ]; then
  echo "❌ Philosophy violations detected:"
  echo "$philosophy_violations"
  echo "Remove conventional wisdom language before committing"
  exit 1
fi

echo "✅ All quality gates passed"
```

### CI/CD Integration Requirements
```yaml
# REQUIRED: .github/workflows/quality-gates.yml
name: Quality Gates
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      # MANDATORY: All quality gates must pass
      - name: Install dependencies
        run: npm ci
        
      - name: TypeScript Check
        run: npm run type-check
        
      - name: Build Check  
        run: npm run build
        
      - name: Test Suite
        run: npm test
        
      - name: Philosophy Compliance
        run: |
          violations=$(grep -ri "money guys\|dave ramsey\|conventional wisdom\|6 months emergency" lib/ app/ components/ || true)
          if [ -n "$violations" ]; then
            echo "Philosophy violations detected:"
            echo "$violations"
            exit 1
          fi
          
      - name: Performance Benchmarks
        run: npm run test:performance
```