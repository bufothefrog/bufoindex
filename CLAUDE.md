# BufoIndex Developer Guide

BufoIndex is a personal-finance calculator suite: **Next.js 16 (App Router) + React 19 + TypeScript 6 + Tailwind CSS 4 + Vitest 4**, deployed to Vercel (no static-site generator, no GitHub Pages). Calculators live under `app/tools/`, financial logic under `lib/calculations/`, each calculator's form and wiring under `lib/calculators/<id>/`, shared UI under `components/`.

Deeper references: `docs/architecture.md` (calculation layer, Monte Carlo, shared profile and run stores, theming), `docs/redesign-guided-flow.md` (what remains of the guided-flow design: the visitor's path, the intake wizard, calculator page tiers), `docs/rebuild-plan.md` (the finished rebuild plan, kept as history; code comments cite its sections, and where it differs from the code the code is right), `docs/open-items.md` (likely defects, open questions with the defaults built, known limits), `docs/agents.md` (process and multi-agent coordination), `CONTRIBUTING.md`.

## What this project is

Interactive calculators for people who want to pressure-test financial decisions with math. The tone is sober and quantitative; calculators show their work (the retirement calculator has a public methodology page at `/tools/retirement-calculator/methodology`). State is client-side only: one shared financial profile in localStorage feeds every calculator, the guided intake at `/start` and the `/overview` dashboard. There is no URL-hash sharing and no backend.

Current calculators:
- **Paycheck Allocator** (`app/tools/paycheck-allocator/`, UI in `components/paycheck-allocator/`) - monthly allocation across fixed costs, tax-advantaged accounts, and flex spending, with bracket-aware tax math.
- **Retirement Calculator** (`app/tools/retirement-calculator/`) - seeded Monte Carlo modeling (run in a web worker) with Social Security, healthcare, TDF glide path, scenario comparison, and a today's/nominal-dollars display toggle.
- **Portfolio Rebalancer** (`app/tools/portfolio-rebalancing-calculator/`) - multi-account rebalancing with custom asset classes and placement advice.
- **Leverage Comparison** (`app/tools/leverage-comparison/`) - monthly contributions into a daily-reset leveraged fund against the same contributions into a plain index fund, over seeded paths (run in a web worker).

## Project layout

```
app/                     # App Router routes
  tools/                 # Calculator pages and their bespoke components and charts
  start/                 # Guided intake: /start, /start/[intent], /start/choose, /start/review
  overview/              # Dashboard built from the shared profile
  demo/                  # PUBLIC component gallery (sections/ holds one file per tab)
components/
  ui/                    # Canonical primitives: button, card, input, slider, checkbox,
                         #   segmented-control, progress-bar, ThemeToggle, FieldMessages,
                         #   inputs/ (BaseInput, MoneyInput, PercentInput, NumberInput,
                         #   SliderField, TickerCombobox),
                         #   cards/ (BaseCard, InputCard, ResultCard; density.ts),
                         #   results/ (StatTile, StatGrid, KeyValueList, DataTable, Disclaimer),
                         #   charts/ (ChartFrame, ChartTooltipCard, useChartTheme),
                         #   layouts/ (CalculatorLayout, ResponsiveGrid)
  fields/                # FieldSpec renderers: FieldInput, FieldSection(s), FieldList,
                         #   ChoiceGroup, NullableField, ScreenNotes, SectionToggle
  calculators/shared/    # CalculatorPage (the one calculator shell), StatusAlert,
                         #   ExpandableListCard
  calculators/renderers/ # Per-calculator custom field renderers and intake hooks
  shared/                # UtilityBar, DollarModeToggle, LookupHint,
                         #   inputs/ (StateSelector, SelectInput), cards/ (OpportunityCostCard)
  guided/                # Wizard, OptionCard, ProgressDots, NextSteps, CoreSummary, ...
  dashboard/             # /overview cards
  paycheck-allocator/    # Paycheck-allocator results UI
  methodology/           # Formula display; KaTeX rendered on the server (renderLatex.ts)
contexts/                # ThemeContext.tsx
lib/
  calculations/          # Pure financial logic (retirement.ts holds the Monte Carlo engine)
  calculators/           # registry.ts, forms.ts, runtime.ts, types.ts,
                         #   <id>/{form,fields,bindings,definition,headline}.ts per calculator;
                         #   retirement/ adds claiming.ts, income.ts, socialSecurity.ts
  fields/                # Field schema: types, paths, runtime (validation), binding, shared
  profile/               # The shared profile: types, defaults, derived (typical values of
                         #   unanswered leaves), migrate (+ migrateV2), accounts, accountTypes
  store/                 # profileStore, preferencesStore, createCalculatorStore + one run
                         #   store per calculator
  workers/               # createWorkerRunner, exposeCalculation, retirementWorker,
                         #   leverageWorker
  constants/             # Sourced constants: irs-2026.ts, states-2026.ts, retirement.ts, ...
  utils/                 # index.ts (cn, clamp, formatNumberWithCommas, tax-rate helpers),
                         #   random.ts (seeded LCG + Box-Muller), displayDollars.ts,
                         #   stepStatusUtils.ts (paycheck step status)
  dashboard/derive.ts, format.ts, chart-theme.ts, design-system/ (tone, stat, types),
                         #   formulas/, types/, demo/ (the /demo chart fixture)
test/
  lib/calculations/      # Unit tests per calculation module
  lib/                   # calculators, fields, profile, store, workers, dashboard, ...
  components/            # Component tests (@testing-library/react)
  factories/             # test-data-factory.ts (shared mock builders)
  utils/, setup.ts
```

## Tooling

- **Dev server:** `npm run dev`; **Build:** `npm run build`; **Type check:** `npm run type-check`; **Lint:** `npm run lint`
- **Tests:** `npm run test` (watch) / `npm run test:run` (one-shot) / `npm run test:coverage` (instruments all of `lib/` and enforces the thresholds in `vitest.config.ts`)
- **Pre-commit (husky + lint-staged):** `eslint --fix` + `tsc --noEmit` on staged TS/TSX.
- **CI (`.github/workflows/test.yml`):** type-check, lint with `--max-warnings=0` (any warning fails the build), and the test suite with coverage (the run fails below the floors in `vitest.config.ts`), all on Node 26 only (the version Vercel builds with; `engines.node` is `26.x`, `.nvmrc` says `26`); separate Node 26 production-build and audit jobs run side by side with that job. The audit job blocks on `npm audit --audit-level=high --omit=dev` (production dependencies only) and also runs the full `npm audit --audit-level=high` as a non-blocking report.

There is no editorial-language grep gate, no orchestration shell script wrapping these commands, and no benchmark workflow in CI. Don't add one without discussion.

## Design System Rules

The `/demo` page is the public visual catalog of every reusable component. Skim it before building new UI.

Component hierarchy - use the highest level that fits, with `components/ui/` as the canonical base layer:

1. **Primitives** - `@/components/ui/*` (see layout tree above for the inventory).
2. **Fields** - `@/components/fields`: any profile field renders from its FieldSpec through `FieldInput` / `FieldSections`; don't hand-build a form input a spec can describe.
3. **Specialized inputs** - `@/components/shared/inputs/*`.
4. **Results** - `@/components/ui/results` (tones from `@/lib/design-system/tone`), `StatusAlert`, `ExpandableListCard`; `DENSE_CARD_CLASSES` from `@/components/ui/cards/density` for result cards.
5. **Charts** - wrapped in `ChartFrame`, living with their calculator (e.g. `app/tools/retirement-calculator/components/`); charts MUST take colors from `useChartTheme()` (`@/components/ui/charts`), which wraps `getChartTheme()` from `@/lib/chart-theme`, so they adapt to light/dark mode.
6. **Interactive** - `SegmentedControl`, `ThemeToggle`, `DollarModeToggle`.
7. **Layouts** - `CalculatorPage` (`@/components/calculators/shared/CalculatorPage`) for a calculator page, built on `@/components/ui/layouts/CalculatorLayout`.

### Theming - non-negotiable

Use semantic Tailwind classes; never hardcode colors.

```tsx
// Correct
"bg-primary text-primary-foreground"
"text-muted-foreground"
"border-border bg-background"
"bg-sage-600 text-white"   // sage-* is the brand scale (sage-50 to sage-900, light/dark variants)

// Wrong - these break dark mode
"bg-blue-500 text-white"
"text-gray-600"
```

Tailwind 4 is configured via `@tailwindcss/postcss`; theme tokens live in `app/globals.css` (`@theme`) - there is no `tailwind.config.js`.

### Before adding a component

1. Check `/demo` and search `components/` - does it already exist? Compose, don't fork.
2. Confirm light + dark theme support and mobile layout (390px and 360px, no sideways scroll).
3. Add reusable components to the matching `/demo` section (`app/demo/sections/`) so they stay discoverable.

Forbidden: hardcoded color literals (`#fff`, `bg-blue-500`, `text-gray-600`), charts without `useChartTheme()`, custom CSS where a Tailwind utility exists, duplicate components.

## Conventions

- TypeScript strict; no `any` unless justified inline.
- **Pure functions in `lib/calculations/`** - no React, DOM, or storage imports. Each module has a matching `test/lib/calculations/*.test.ts` asserting real numeric values, hand-computed where practical.
- **One shared profile.** Every input lives in the `FinancialProfile` (`lib/profile/types.ts`), persisted by `lib/store/profileStore.ts` (localStorage key `bufo-profile`). Calculator edits write through to it. The dollar display mode is the one site-wide preference (`lib/store/preferencesStore.ts`).
- **Field schema.** A field is a `FieldSpec` keyed by its profile path and grouped into topic screens by a `FormSpec` (`lib/fields/types.ts`). The same spec drives the wizard, the calculator sections, validation and profile completeness.
- **A calculator is five files** in `lib/calculators/<id>/`: `form.ts` (its FormSpec), `fields.ts` (its own FieldSpecs), `bindings.ts` (profile to engine inputs), `definition.ts` (the `CalculatorDefinition`: form, bindings, engine checks, calculate) and `headline.ts` (the summary the dashboard shows). A few carry extra modules (`reducers.ts` and `accountWrites.ts` in portfolio, `narrative.ts`). Names, paths and disclaimers live only in `lib/calculators/registry.ts`; the profile form is composed in `lib/calculators/forms.ts`.
- **Run stores.** Each calculator has a run store made by `createCalculatorStore` (`lib/store/createCalculatorStore.ts`): it validates, memoizes, debounces and runs, holds results only and persists nothing. Slow engines pass a runner from `lib/workers/createWorkerRunner.ts`.
- **No URL-hash sharing.** Links into a calculator carry only `?from=profile` (`calculatorHref` in `lib/calculators/registry.ts`); old share links are not supported.
- **Sourced constants:** tax brackets, contribution limits, and rates live in `lib/constants/` with citation comments (see `irs-2026.ts`, `states-2026.ts`). Update only the constants file when a new tax year lands.
- **Display-dollar boundary:** simulations run in nominal dollars; `lib/utils/displayDollars.ts` converts for display only and must never feed back into calculations. Display formatting goes through `lib/format.ts`.
- Components: typed props, named export of the props type, default export of the component.
- Shared mocks: `test/factories/test-data-factory.ts` - if you change a factory signature, update all callers.
- Path alias: `@/` maps to repo root (`tsconfig.json`, `vitest.config.ts`).
- **Neutral tone:** no calculator copy that asserts a single "right answer." Show the math; let the reader judge.
