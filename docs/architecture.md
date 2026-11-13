# BufoIndex Architecture

How the pieces fit together, and why they're shaped the way they are. Written for an engineer skimming the repo; the running app is at https://bufoindex.com.

## The one design rule: pure calculations

All financial logic lives in `lib/calculations/` as pure TypeScript. No React, no DOM, no storage, no I/O — a calculation module takes a typed inputs object and returns a typed results object, deterministically.

Why:

- **Testability.** Every formula can be asserted against hand-computed values in `test/lib/calculations/` without mounting a component or mocking a browser. Numbers are the product here, so the test suite is mostly numeric assertions.
- **Auditability.** The retirement calculator publishes a methodology page (`/tools/retirement-calculator/methodology`) rendering the actual formulas via `lib/formulas/`. That's only honest if the display formulas and the executed code sit next to each other and share constants. KaTeX turns the formulas into HTML on the server (`components/methodology/renderLatex.ts`), so the page is static and ships no KaTeX JavaScript.
- **Separation of drift-prone data.** Figures that change annually (tax brackets, contribution limits, state rates) live in `lib/constants/` — `irs-2026.ts` and `states-2026.ts` carry source citations (IRS revenue procedures, state statutes) so an update is a one-file diff.

Components call into the calculation layer through each calculator's definition (`lib/calculators/<id>/definition.ts`); the shared profile holds the inputs and a run store per calculator orchestrates recalculation (see below). Nothing in `components/` computes money.

## Monte Carlo engine

The retirement simulation lives in `lib/calculations/retirement.ts`, with randomness from `lib/utils/random.ts`:

- `createSeededRng(seed)` — a Numerical Recipes LCG (`state * 1664525 + 1013904223 mod 2^32`) returning uniform values in [0, 1). It's a local closure, not a `Math.random` patch.
- `boxMullerRandom(mean, stdDev, rng)` — Box–Muller transform over two uniform draws, with a do/while guard against `log(0)`.

`runMonteCarloSimulation` defaults to 1,000 runs and a **fixed seed (`20260812`)**. Reproducibility is the point: the same inputs always produce the same success probability, so every viewer with the same profile sees the same numbers, regression tests can assert exact probabilities, and a user tweaking one input sees the effect of that input rather than sampling noise.

What is and isn't randomized:

- **Accumulation phase: deterministic.** The balance at retirement comes from `calculateProjectedBalance` (monthly compounding; under the TDF profile, an age-based glide path blends stock/bond return assumptions).
- **Per-year schedules: deterministic.** Withdrawals (target income + healthcare − Social Security, floored at 0), mean returns, and volatilities are precomputed once per retirement year. Under the TDF profile the mean/volatility follow the glide path; custom profiles use user-supplied values.
- **Retirement-phase returns: randomized.** Each simulated path draws one normal annual return per year, applies it, subtracts that year's withdrawal, and fails if the balance hits zero before life expectancy. The success probability is `successfulPaths / runs`.

## Shared profile and run stores

There is no backend and no URL-hash sharing: links into a calculator carry only `?from=profile` (`calculatorHref` in `lib/calculators/registry.ts`), and old share links are not supported. Inputs live in one place, the shared financial profile.

- **Profile.** `FinancialProfile` (`lib/profile/types.ts`) holds every input any calculator, the intake or the dashboard uses. `lib/store/profileStore.ts` persists it to localStorage (key `bufo-profile`, versioned; every payload goes through `lib/profile/migrate.ts`, which today only normalizes it against the current defaults, so a payload of an older version loads with every leaf that still exists). Each saved answer is listed in `provided`, which drives profile completeness. Calculator edits write through to the profile. Three leaves have a derived typical value while unanswered (the emergency fund balance, the target retirement income and the HSA coverage): `withDerivedValues` (`lib/profile/derived.ts`) fills them from the answers, and every reader that turns the profile into engine inputs, dashboard figures, field values or the wizard's grey values goes through it, so the stored profile is never rewritten by reading it.
- **Field schema.** Each field is a `FieldSpec` keyed by its profile path (`lib/fields/types.ts`), grouped into topic screens by a `FormSpec`. One spec drives the wizard at `/start`, the calculator's sections (`components/fields/`), validation (`lib/fields/runtime.ts`) and completeness. The profile form is composed from every calculator's form in `lib/calculators/forms.ts`. A screen marked `optional` (`ScreenSpec.optional`) is left out of the calculator intakes and of completeness, and the profile form asks it last in a section "Optional".
- **Bindings.** `lib/calculators/<id>/bindings.ts` maps profile paths to the engine's inputs; `lib/calculators/runtime.ts` builds engine inputs and validation errors from the profile in one pure pass.
- **Run stores.** `createCalculatorStore` (`lib/store/createCalculatorStore.ts`) makes one store per calculator from its `CalculatorDefinition`. It validates, skips a run whose inputs match the last results, debounces, runs, and keeps the newest run. On invalid inputs the last results stay on screen marked stale. It persists nothing. The retirement simulation runs off the main thread through `lib/workers/createWorkerRunner.ts`, falling back to in-thread where there is no worker.

`CalculatorPage` (`components/calculators/shared/CalculatorPage.tsx`) is the one calculator shell: it reads the registry entry (`lib/calculators/registry.ts`), renders the form's sections and the results inside `CalculatorLayout`, and submits each profile change to the run store.

## Display dollars: nominal inside, converted at the edge

Simulations and projections run entirely in **nominal (future) dollars** — inflation is a modeled input, not a post-hoc adjustment, and mixing deflated values into compounding math is a classic source of subtle errors.

The today's-dollars toggle (`DollarModeToggle` in `components/shared/`, one site-wide preference in `lib/store/preferencesStore.ts`) therefore converts **only at display time**, via `lib/utils/displayDollars.ts`:

- `toTodaysDollars(nominal, inflationRate, yearsFromNow)` divides by `(1 + i)^n`.
- `displayDollars(...)` applies the active mode; `'nominal'` is a pass-through.
- The retirement calculator deflates with the user's own `inflationRate` input. The paycheck allocator has no inflation input, so it uses a documented 3% assumption (`DISPLAY_INFLATION_ASSUMPTION`).

The boundary is one-way by design: display helpers must never feed values back into `lib/calculations/`. Chart series, summary cards, and tooltips convert at render; the underlying simulation results are unchanged when the toggle flips.

## Theming

- **Tokens, not palette classes.** All colors are defined in `app/globals.css` under Tailwind 4's `@theme`: the sage brand scale (`--color-sage-50`–`--color-sage-900`) plus semantic tokens (`--color-background`, `--color-muted-foreground`, …) that resolve through CSS custom properties with light and dark values. Components use semantic classes (`bg-background`, `text-muted-foreground`, `border-border`, `bg-sage-600`); raw palette classes and hex literals are banned. There is no `tailwind.config.js` — Tailwind 4 is configured through `@tailwindcss/postcss` and `@theme`.
- **Mode switching.** `contexts/ThemeContext.tsx` resolves the theme (localStorage override, else `prefers-color-scheme`) and sets `.light`/`.dark` on `<html>`. A custom `dark` variant in `globals.css` respects the *closest* theme-class ancestor, which lets the `/demo` gallery render light and dark columns side by side regardless of the page theme.
- **Charts.** Recharts needs concrete color strings, so `lib/chart-theme.ts` exposes `getChartTheme()`, which reads the live CSS custom properties (with an SSR fallback palette). Chart components read it through `useChartTheme()` (`components/ui/charts/`), which re-reads the palette when the theme changes; this is the one sanctioned bridge between the token system and canvas/SVG rendering.

## Testing

Vitest 4 + jsdom (`vitest.config.ts`; `@/` aliases repo root). Suites:

- `test/lib/calculations/` — one file per calculation module, numeric assertions.
- `test/lib/utils/` - seeded RNG distribution checks, display-dollar conversion, tax-rate lookups.
- `test/lib/fields/`, `test/lib/calculators/`, `test/lib/profile/` - the field schema, each calculator's form and bindings, the profile form and completeness, profile defaults and the persisted-payload normalization (`migrate`).
- `test/lib/store/`, `test/lib/workers/` - the run store factory and each calculator's store, the profile and preference stores, and the worker runner.
- `test/lib/formulas/` — the formula registry behind the methodology page.
- `test/components/` — Testing Library component tests.
- `test/factories/test-data-factory.ts` — shared mock builders.

Coverage is instrumented across `lib/` (type-only modules excluded) with floors defined in `vitest.config.ts`: a global floor for everything covered, and a higher statements/branches bar for `lib/calculations/` — the layer where a wrong number is a bug rather than a styling issue.
