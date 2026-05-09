# BufoIndex Developer Guide

BufoIndex is a personal-finance calculator suite. Stack: **Next.js 16 (App Router) + React 19 + TypeScript 6 + Tailwind CSS 4 + Vitest 4**. Calculators live under `app/tools/`, financial logic under `lib/calculations/`, shared UI under `components/`. The app is deployed to Vercel — there is no static-site generator and no GitHub Pages deploy.

For multi-agent or repo-process notes, see `docs/agents.md`.

## What this project is

Interactive calculators for people who want to pressure-test financial decisions with math instead of folk wisdom. The audience is comfortable with percentages, opportunity cost, and tax-bracket reasoning. The tone is sober and quantitative; calculators show their work.

Current calculators:
- **Paycheck Allocator** (`app/tools/paycheck-allocator/`) — monthly allocation across fixed costs, tax-advantaged accounts, and flex spending.
- **Retirement Calculator** (`app/tools/retirement-calculator/`) — Monte Carlo retirement modeling with Social Security, healthcare, and scenario comparison.
- **Portfolio Rebalancer** (`app/tools/portfolio-rebalancing-calculator/`) — multi-account rebalancing with custom asset classes and placement advice.

State is held client-side; URLs encode scenarios via compressed hash state so they're shareable without a backend.

## Project layout

```
app/                     # Next.js App Router routes
  tools/                 # Calculator pages (paycheck-allocator, retirement-calculator,
                         #   portfolio-rebalancing-calculator)
  demo/                  # Component gallery (dev only)
components/
  ui/                    # Primitives: button, card, input, slider, ThemeToggle,
                         #   inputs/ (BaseInput, EnhancedMoneyInput, PercentInput,
                         #   NumberInput, TickerCombobox), cards/ (BaseCard +
                         #   InputCard/ResultCard/SummaryCard), layouts/
  shared/                # Cross-cutting UI: Navigation, Tooltip, UtilityBar,
                         #   inputs/, layout/, cards/
  charts/                # Recharts wrappers; must use getChartTheme()
  calculator/, calculators/, retirement/, methodology/, examples/
lib/
  calculations/          # Pure financial logic (retirement, monte-carlo, optimization, …)
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

1. **Primitives** — `@/components/ui/*`
   - `button`, `card`, `input`, `slider`, `ThemeToggle`
   - `inputs/`: `BaseInput`, `EnhancedMoneyInput` (re-exported as `MoneyInput`), `PercentInput`, `NumberInput`, `TickerCombobox`
   - `cards/`: `BaseCard`, `InputCard`, `ResultCard`, `SummaryCard`
2. **Specialized inputs** — `@/components/shared/inputs/*` (`StateSelector`, `SelectInput`, `MoneyInput`, `NumberInput`, `PercentageSlider`, `DebtInput`)
3. **Charts** — `@/components/charts/*` (`RetirementCharts`, `NetWorthProgression`, `WithdrawalTimeline`, `ScenarioComparisonChart`). Charts MUST call `getChartTheme()` from `@/lib/chart-theme` so they adapt to light/dark mode.
4. **Interactive** — `Tooltip` + `HELP_TOOLTIPS` from `@/components/shared/Tooltip`, `CalculatorTabs` + `TabPanel` from `@/components/calculators/shared/CalculatorTabs`, `ThemeToggle` from `@/components/ui/ThemeToggle`.
5. **Layouts** — `@/components/ui/layouts/*` (`CalculatorLayout`, `SimpleCalculatorLayout`, `AdvancedCalculatorLayout`, `ComparisonCalculatorLayout`, `ResponsiveGrid`, `InputSection`, `ResultSection`) and `@/components/shared/layout/*` (`InputRow`, `FieldGroup`).

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

Tailwind 4 is configured via `@tailwindcss/postcss`; theme tokens live in `app/globals.css` (`@theme`) rather than a separate `tailwind.config.js`.

### Before adding a component

1. Check `/demo` — does this already exist?
2. Search `components/` for similar names.
3. Confirm theme support (light + dark) and mobile layout.
4. Add reusable components to the matching `/demo` section so they stay discoverable.

### Forbidden

- Hardcoded color literals (`#fff`, `bg-blue-500`, `text-gray-600`, …).
- Charts without `getChartTheme()`.
- Custom CSS when a Tailwind utility exists.
- Duplicate components — extend or compose existing ones.

## Where things live

- **Financial logic:** `lib/calculations/` (pure TS, no React). Each module has a matching `test/lib/calculations/*.test.ts`.
- **Shared mock builders:** `test/factories/test-data-factory.ts`. Multiple test files depend on it; if you change a factory signature, update all callers.
- **Constants / types:** `lib/constants/`, `lib/types/`.
- **Path alias:** `@/` maps to repo root (see `tsconfig.json` and `vitest.config.ts`).

## Conventions

- TypeScript strict; no `any` unless justified inline.
- Pure functions in `lib/calculations/`; keep React, the DOM, and storage out of them so they stay easy to test.
- Components: typed props, named export of the type, default export of the component.
- Prefer composition over new abstractions. If a component already exists in `/demo`, use it.
- No editorial copy in calculators that asserts a single "right answer." Show the math; let the reader judge.
