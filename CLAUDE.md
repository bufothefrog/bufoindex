# BufoIndex Developer Guide

BufoIndex is a personal-finance calculator suite. Stack: **Next.js 16 (App Router) + React 18 + TypeScript + Tailwind CSS + Vitest**. Calculators live under `app/tools/`, financial logic under `lib/calculations/`, shared UI under `components/`. The app is deployed to Vercel — there is no static-site generator and no GitHub Pages deploy.

For multi-agent or repo-process notes, see `docs/agents.md`.

## Project layout

```
app/                     # Next.js App Router routes
  tools/                 # Calculator pages (paycheck-allocator, retirement-calculator, ...)
  demo/                  # Component gallery (dev only)
components/
  ui/                    # Primitive UI: button, card, input, slider, ThemeToggle
  shared/                # Cross-cutting UI: Navigation, Tooltip, inputs/, layout/, cards/
  charts/                # Recharts wrappers; must use getChartTheme()
  calculators/, retirement/, calculator/, methodology/, examples/
lib/
  calculations/          # Pure financial logic (retirement, monte-carlo, optimization, ...)
  formulas/, constants/, store/, types/, utils/
  chart-theme.ts         # Theme-aware chart colors
  design-system/, demo/
test/
  lib/calculations/      # Unit tests for calculations
  lib/utils/             # Util tests
  components/            # Component tests
  factories/             # test-data-factory.ts (shared mock builders)
  utils/                 # Test helpers
  setup.ts               # Vitest setup
```

## Tooling

- **Dev server:** `npm run dev`
- **Production build:** `npm run build`
- **Type check:** `npm run type-check`
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (watch) / `npm run test:run` (one-shot) / `npm run test:coverage`
- **Pre-commit (husky + lint-staged):** runs `eslint --fix` and `tsc --noEmit` on staged TS/TSX. See `package.json` `lint-staged` block and `.husky/pre-commit`.
- **CI (`.github/workflows/test.yml`):** type-check, lint (max 200 warnings), `test:run`, coverage on Node 20, then a separate production build job.

There is no editorial-language grep gate, no separate orchestration shell script wrapping these commands, and no benchmark workflow in CI. Don't add one without discussion.

## Design System Rules

The `/demo` page is the visual catalog of every reusable component. Skim it before building new UI.

### Component hierarchy (use the highest level that fits)

1. **Primitives** — `@/components/ui/*` (`Button`, `Input`, `Card`, `Slider`, `EnhancedMoneyInput`, `PercentInput`, `NumberInput`, `InputCard`, `ResultCard`, `SummaryCard`)
2. **Specialized inputs** — `@/components/shared/inputs/*` (`StateSelector`, `SelectInput`, `MoneyInput`, `PercentageInput`, `BenefitsSelector`, `DebtInput`)
3. **Charts** — `@/components/charts/*` (`RetirementCharts`, `NetWorthProgression`, `WithdrawalTimeline`, `ScenarioComparisonChart`). Charts MUST call `getChartTheme()` from `@/lib/chart-theme` so they adapt to light/dark mode.
4. **Interactive** — `Tooltip` + `HELP_TOOLTIPS` from `@/components/shared/Tooltip`, `CalculatorTabs` + `TabPanel` from `@/components/calculators/shared/CalculatorTabs`, `ThemeToggle` from `@/components/ui/ThemeToggle`.
5. **Layouts** — `@/components/ui/layouts/CalculatorLayout` (`CalculatorLayout`, `SimpleCalculatorLayout`, `AdvancedCalculatorLayout`) and `@/components/shared/layout/*` (`InputRow`, `FieldGroup`, `ResponsiveGrid`).

### Theming — non-negotiable

Use semantic Tailwind classes. Do not hardcode colors.

```tsx
// Correct
"bg-primary text-primary-foreground"
"text-muted-foreground"
"border-border bg-background"
"bg-sage-600 text-white"   // sage-* is the brand scale

// Wrong — these break dark mode
"bg-blue-500 text-white"
"text-gray-600"
"border-gray-300"
```

For charts, always:

```ts
import { getChartTheme } from '@/lib/chart-theme';
const chartTheme = getChartTheme();
```

The sage scale (`sage-50`–`sage-900`) is the brand palette and has light/dark variants.

### Before adding a component

1. Check `/demo` — does this already exist?
2. Search `components/` for similar names.
3. Confirm theme support (light + dark) and mobile layout.
4. Add reusable components to the matching `/demo` section so they stay discoverable.

### Forbidden

- Hardcoded color literals (`#fff`, `bg-blue-500`, `text-gray-600`, ...).
- Charts without `getChartTheme()`.
- Custom CSS when a Tailwind utility exists.
- Duplicate components — extend or compose existing ones.

## Where things live

- **Financial logic:** `lib/calculations/` (pure TS, no React). Each module has a matching `test/lib/calculations/*.test.ts`.
- **Shared mock builders:** `test/factories/test-data-factory.ts`. Three test files depend on it; if you change a factory signature, update all callers.
- **Constants / types:** `lib/constants/`, `lib/types/`.
- **Path alias:** `@/` maps to repo root (see `tsconfig.json` and `vitest.config.ts`).

## Conventions

- TypeScript strict; no `any` unless justified inline.
- Pure functions in `lib/calculations/`; keep React out of them.
- Components: typed props, named export of the type, default export of the component.
- Prefer composition over new abstractions. If a component already exists in `/demo`, use it.
