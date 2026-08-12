# BufoIndex Developer Guide

BufoIndex is a personal-finance calculator suite: **Next.js 16 (App Router) + React 19 + TypeScript 6 + Tailwind CSS 4 + Vitest 4**, deployed to Vercel (no static-site generator, no GitHub Pages). Calculators live under `app/tools/`, financial logic under `lib/calculations/`, shared UI under `components/`.

Deeper references: `docs/architecture.md` (calculation layer, Monte Carlo, URL-hash state, theming), `docs/agents.md` (process and multi-agent coordination), `CONTRIBUTING.md`.

## What this project is

Interactive calculators for people who want to pressure-test financial decisions with math. The tone is sober and quantitative; calculators show their work (the retirement calculator has a public methodology page at `/tools/retirement-calculator/methodology`). State is client-side only; each calculator serializes its inputs to a versioned, compressed URL hash so scenarios are shareable without a backend.

Current calculators:
- **Paycheck Allocator** (`app/tools/paycheck-allocator/`) — monthly allocation across fixed costs, tax-advantaged accounts, and flex spending, with bracket-aware tax math.
- **Retirement Calculator** (`app/tools/retirement-calculator/`) — seeded Monte Carlo modeling with Social Security, healthcare, TDF glide path, scenario comparison, and a today's/nominal-dollars display toggle.
- **Portfolio Rebalancer** (`app/tools/portfolio-rebalancing-calculator/`) — multi-account rebalancing with custom asset classes and placement advice.

## Project layout

```
app/                     # App Router routes
  tools/                 # Calculator pages (retirement-calculator includes methodology/)
  demo/                  # PUBLIC component gallery — the catalog of reusable UI
components/
  ui/                    # Canonical primitives: button, card, input, slider, ThemeToggle,
                         #   inputs/ (BaseInput, EnhancedMoneyInput → re-exported as
                         #   MoneyInput, PercentInput, NumberInput, TickerCombobox),
                         #   cards/ (BaseCard, InputCard, ResultCard, SummaryCard),
                         #   layouts/ (CalculatorLayout variants, ResponsiveGrid, sections)
  shared/                # Navigation, Tooltip, UtilityBar, DollarModeToggle,
                         #   inputs/ (StateSelector, SelectInput, PercentageSlider,
                         #   DebtInput), layout/ (InputRow, FieldGroup),
                         #   cards/ (AllocationCard, OpportunityCostCard)
  paycheck-allocator/    # Paycheck-allocator UI
  calculators/shared/    # CalculatorTabs, ExpandableListCard, StatusAlert, BreakdownRow
  retirement/            # RiskProfileSelector
  methodology/           # Formula display + KaTeX rendering
contexts/                # ThemeContext.tsx
lib/
  calculations/          # Pure financial logic (retirement.ts holds the Monte Carlo engine)
  constants/             # Sourced constants: irs-2026.ts, states-2026.ts, retirement.ts, …
  utils/                 # URL-hash codecs (retirementState, portfolioRebalancingState),
                         #   random.ts (seeded LCG + Box-Muller), displayDollars.ts
  store/                 # Zustand stores
  types/, formulas/, design-system/ (types.ts), demo/, chart-theme.ts
test/
  lib/calculations/      # Unit tests per calculation module
  lib/utils/             # Codec / RNG / display-dollar tests
  components/            # Component tests (@testing-library/react)
  factories/             # test-data-factory.ts (shared mock builders)
  utils/, setup.ts
```

## Tooling

- **Dev server:** `npm run dev` · **Build:** `npm run build` · **Type check:** `npm run type-check` · **Lint:** `npm run lint`
- **Tests:** `npm run test` (watch) / `npm run test:run` (one-shot) / `npm run test:coverage`
- **Pre-commit (husky + lint-staged):** `eslint --fix` + `tsc --noEmit` on staged TS/TSX.
- **CI (`.github/workflows/test.yml`):** type-check, lint (max 200 warnings), and `test:run` on a Node 22 + 24 matrix (coverage + Codecov upload on Node 20 only), then separate production-build and `npm audit --audit-level=high` jobs.

There is no editorial-language grep gate, no orchestration shell script wrapping these commands, and no benchmark workflow in CI. Don't add one without discussion.

## Design System Rules

The `/demo` page is the public visual catalog of every reusable component. Skim it before building new UI.

Component hierarchy — use the highest level that fits, with `components/ui/` as the canonical base layer:

1. **Primitives** — `@/components/ui/*` (see layout tree above for the inventory).
2. **Specialized inputs** — `@/components/shared/inputs/*`.
3. **Charts** — `@/components/charts/*`; charts MUST call `getChartTheme()` from `@/lib/chart-theme` so they adapt to light/dark mode.
4. **Interactive** — `Tooltip` + `HELP_TOOLTIPS` (`@/components/shared/Tooltip`), `CalculatorTabs` + `TabPanel` (`@/components/calculators/shared/CalculatorTabs`), `ThemeToggle`, `DollarModeToggle`.
5. **Layouts** — `@/components/ui/layouts/*` and `@/components/shared/layout/*`.

### Theming — non-negotiable

Use semantic Tailwind classes; never hardcode colors.

```tsx
// Correct
"bg-primary text-primary-foreground"
"text-muted-foreground"
"border-border bg-background"
"bg-sage-600 text-white"   // sage-* is the brand scale (sage-50–sage-900, light/dark variants)

// Wrong — these break dark mode
"bg-blue-500 text-white"
"text-gray-600"
```

Tailwind 4 is configured via `@tailwindcss/postcss`; theme tokens live in `app/globals.css` (`@theme`) — there is no `tailwind.config.js`.

### Before adding a component

1. Check `/demo` and search `components/` — does it already exist? Compose, don't fork.
2. Confirm light + dark theme support and mobile layout.
3. Add reusable components to the matching `/demo` section so they stay discoverable.

Forbidden: hardcoded color literals (`#fff`, `bg-blue-500`, `text-gray-600`), charts without `getChartTheme()`, custom CSS where a Tailwind utility exists, duplicate components.

## Conventions

- TypeScript strict; no `any` unless justified inline.
- **Pure functions in `lib/calculations/`** — no React, DOM, or storage imports. Each module has a matching `test/lib/calculations/*.test.ts` asserting real numeric values, hand-computed where practical.
- **Sourced constants:** tax brackets, contribution limits, and rates live in `lib/constants/` with citation comments (see `irs-2026.ts`, `states-2026.ts`). Update only the constants file when a new tax year lands.
- **Display-dollar boundary:** simulations run in nominal dollars; `lib/utils/displayDollars.ts` converts for display only and must never feed back into calculations.
- Components: typed props, named export of the props type, default export of the component.
- Shared mocks: `test/factories/test-data-factory.ts` — if you change a factory signature, update all callers.
- Path alias: `@/` maps to repo root (`tsconfig.json`, `vitest.config.ts`).
- **Neutral tone:** no calculator copy that asserts a single "right answer." Show the math; let the reader judge.
