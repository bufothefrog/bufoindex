# TypeScript / React Patterns

Reference patterns for code in this repo. Follow these unless you have a specific reason not to.

## Calculation modules (`lib/calculations/`)

Pure TypeScript. No React, no DOM, no I/O. Anything that needs those belongs in a component or a hook.

```ts
// lib/calculations/example.ts

export interface ExampleInputs {
  amount: number;
  interestRate: number;
  years: number;
}

export interface ExampleOutputs {
  futureValue: number;
  totalReturn: number;
}

export function calculateExample(inputs: ExampleInputs): ExampleOutputs {
  const { amount, interestRate, years } = inputs;
  const futureValue = amount * (1 + interestRate) ** years;
  return {
    futureValue,
    totalReturn: futureValue - amount,
  };
}

// Validation is optional but useful when inputs come straight from a form.
export function validateExampleInputs(inputs: Partial<ExampleInputs>): string[] {
  const errors: string[] = [];
  if ((inputs.amount ?? 0) < 0) errors.push('amount must be non-negative');
  if ((inputs.years ?? 0) < 0) errors.push('years must be non-negative');
  return errors;
}
```

Notes:

- Export named types alongside named functions.
- Avoid wildcard exports (`export *`) — they make tree-shaking and refactors harder.
- If a calculation has multiple sub-steps, factor them into named helpers in the same module rather than inlining or splitting across files.

## React components

```tsx
// components/example/ExampleCard.tsx
import * as React from 'react';

export interface ExampleCardProps {
  /** Primary value to display. */
  value: number;
  /** Called when the user changes the value. */
  onChange: (next: number) => void;
  className?: string;
}

export function ExampleCard({ value, onChange, className }: ExampleCardProps) {
  // ...
  return <div className={className}>{/* ... */}</div>;
}
```

Conventions:

- Named export of the component **and** the props type.
- Props interfaces use JSDoc on each prop so editor hover shows useful info.
- Theming uses semantic Tailwind classes (`bg-background`, `text-muted-foreground`, `border-border`, `bg-sage-*`) — see `CLAUDE.md`.
- Charts pull colors from `getChartTheme()` in `@/lib/chart-theme`. Never hardcode chart colors.
- Keep components free of business logic — call into `lib/calculations/` instead.

## Imports

```ts
// Calculations: import named functions and types explicitly.
import {
  calculateExample,
  validateExampleInputs,
  type ExampleInputs,
  type ExampleOutputs,
} from '@/lib/calculations/example';

// Components: named imports for both component and types.
import { ExampleCard, type ExampleCardProps } from '@/components/example/ExampleCard';

// UI primitives via barrels where they exist.
import { Button } from '@/components/ui/button';
```

The `@/` alias resolves to the repo root (configured in `tsconfig.json` and `vitest.config.ts`).

## Tests

```ts
// test/lib/calculations/example.test.ts
import { describe, it, expect } from 'vitest';
import { calculateExample } from '@/lib/calculations/example';

describe('calculateExample', () => {
  it('compounds correctly over a single year', () => {
    const result = calculateExample({ amount: 1000, interestRate: 0.07, years: 1 });
    expect(result.futureValue).toBeCloseTo(1070);
    expect(result.totalReturn).toBeCloseTo(70);
  });

  it('handles zero years as a no-op', () => {
    const result = calculateExample({ amount: 1000, interestRate: 0.07, years: 0 });
    expect(result.futureValue).toBe(1000);
    expect(result.totalReturn).toBe(0);
  });
});
```

Notes:

- Use `toBeCloseTo` for floating-point comparisons.
- Reuse mock builders from `test/factories/test-data-factory.ts` for complex profile-shaped inputs.
- Component tests go under `test/components/` using `@testing-library/react`. Setup is in `test/setup.ts`.

## Anti-patterns to avoid

- React state living inside calculation modules.
- `as any` to silence type errors — tighten the types instead.
- Hardcoded color literals in components (`#fff`, `text-gray-600`, `bg-blue-500`). Use semantic Tailwind classes or `getChartTheme()`.
- Duplicate components when one already exists in `/demo` or `components/ui/`. Compose, don't fork.
- Calling `npm run build` from CI workflows you've added without confirming you actually need a separate job; the existing CI already runs build.
