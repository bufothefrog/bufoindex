# BufoIndex Architecture

How the pieces fit together, and why they're shaped the way they are. Written for an engineer skimming the repo; the running app is at https://bufoindex.com.

## The one design rule: pure calculations

All financial logic lives in `lib/calculations/` as pure TypeScript. No React, no DOM, no storage, no I/O — a calculation module takes a typed inputs object and returns a typed results object, deterministically.

Why:

- **Testability.** Every formula can be asserted against hand-computed values in `test/lib/calculations/` without mounting a component or mocking a browser. Numbers are the product here; the test suite (360 tests across 14 files) is mostly numeric assertions.
- **Auditability.** The retirement calculator publishes a methodology page (`/tools/retirement-calculator/methodology`) rendering the actual formulas via `lib/formulas/`. That's only honest if the display formulas and the executed code sit next to each other and share constants.
- **Separation of drift-prone data.** Figures that change annually (tax brackets, contribution limits, state rates) live in `lib/constants/` — `irs-2026.ts` and `states-2026.ts` carry source citations (IRS revenue procedures, state statutes) so an update is a one-file diff.

Components call into the calculation layer; Zustand stores (`lib/store/`) hold input state and orchestrate recalculation. Nothing in `components/` computes money.

## Monte Carlo engine

The retirement simulation lives in `lib/calculations/retirement.ts`, with randomness from `lib/utils/random.ts`:

- `createSeededRng(seed)` — a Numerical Recipes LCG (`state * 1664525 + 1013904223 mod 2^32`) returning uniform values in [0, 1). It's a local closure, not a `Math.random` patch.
- `boxMullerRandom(mean, stdDev, rng)` — Box–Muller transform over two uniform draws, with a do/while guard against `log(0)`.

`runMonteCarloSimulation` defaults to 1,000 runs and a **fixed seed (`20260812`)**. Reproducibility is the point: the same inputs always produce the same success probability, so shared links render identically for every viewer, regression tests can assert exact probabilities, and a user tweaking one input sees the effect of that input rather than sampling noise.

What is and isn't randomized:

- **Accumulation phase: deterministic.** The balance at retirement comes from `calculateProjectedBalance` (monthly compounding; under the TDF profile, an age-based glide path blends stock/bond return assumptions).
- **Per-year schedules: deterministic.** Withdrawals (target income + healthcare − Social Security, floored at 0), mean returns, and volatilities are precomputed once per retirement year. Under the TDF profile the mean/volatility follow the glide path; custom profiles use user-supplied values.
- **Retirement-phase returns: randomized.** Each simulated path draws one normal annual return per year, applies it, subtracts that year's withdrawal, and fails if the balance hits zero before life expectancy. The success probability is `successfulPaths / runs`.

## URL-hash state

There is no backend, so a shareable scenario must fit in the URL. Each calculator has a codec in `lib/utils/` (`retirementState.ts`, `portfolioRebalancingState.ts`, and the paycheck codec in `index.ts`) following the same pattern:

- **Encoding:** inputs → JSON with short keys (`sa` = startingAge, `ti` = targetIncome, …) → `btoa` → URL-safe base64 (`+/=` swapped for `-_`), written to `location.hash` via `history.replaceState`.
- **Default elision:** a field is only serialized when it differs from its default, so a lightly-customized scenario produces a short hash and defaults can evolve without bloating old links.
- **Versioning:** every payload carries `v`. Encoders always write the latest version; decoders accept every prior version and migrate forward. Unknown versions and garbage hashes are rejected (decode returns `null`, the calculator falls back to defaults).

Current schemas:

- **Retirement — v2.** Adds `dm` (dollar display mode), elided when `'today'`. v1 payloads decode with the default mode. `dm` is deliberately display-only state that still round-trips through share links, so a link shows the recipient the same numbers the sender saw.
- **Paycheck allocator — v2.** Same `dm` addition.
- **Portfolio rebalancer — v3.** v1 was a single flat asset list; v2 added per-asset account type/class and advice toggles; v3 is the multi-account shape (securities registry, accounts, holdings, class targets). The decoder migrates v1 and v2 hashes into the v3 model (e.g. wrapping legacy assets in a single "Brokerage" account).

Migration policy: never break an old link. Codec tests in `test/lib/utils/` pin round-trips, default elision, and v1-payload decoding.

## Display dollars: nominal inside, converted at the edge

Simulations and projections run entirely in **nominal (future) dollars** — inflation is a modeled input, not a post-hoc adjustment, and mixing deflated values into compounding math is a classic source of subtle errors.

The today's-dollars toggle (`DollarModeToggle` in `components/shared/`) therefore converts **only at display time**, via `lib/utils/displayDollars.ts`:

- `toTodaysDollars(nominal, inflationRate, yearsFromNow)` divides by `(1 + i)^n`.
- `displayDollars(...)` applies the active mode; `'nominal'` is a pass-through.
- The retirement calculator deflates with the user's own `inflationRate` input. The paycheck allocator has no inflation input, so it uses a documented 3% assumption (`DISPLAY_INFLATION_ASSUMPTION`).

The boundary is one-way by design: display helpers must never feed values back into `lib/calculations/`. Chart series, summary cards, and tooltips convert at render; the underlying simulation results are unchanged when the toggle flips.

## Theming

- **Tokens, not palette classes.** All colors are defined in `app/globals.css` under Tailwind 4's `@theme`: the sage brand scale (`--color-sage-50`–`--color-sage-900`) plus semantic tokens (`--color-background`, `--color-muted-foreground`, …) that resolve through CSS custom properties with light and dark values. Components use semantic classes (`bg-background`, `text-muted-foreground`, `border-border`, `bg-sage-600`); raw palette classes and hex literals are banned. There is no `tailwind.config.js` — Tailwind 4 is configured through `@tailwindcss/postcss` and `@theme`.
- **Mode switching.** `contexts/ThemeContext.tsx` resolves the theme (localStorage override, else `prefers-color-scheme`) and sets `.light`/`.dark` on `<html>`. A custom `dark` variant in `globals.css` respects the *closest* theme-class ancestor, which lets the `/demo` gallery render light and dark columns side by side regardless of the page theme.
- **Charts.** Recharts needs concrete color strings, so `lib/chart-theme.ts` exposes `getChartTheme()`, which reads the live CSS custom properties (with an SSR fallback palette). Every chart component pulls colors from it — this is the one sanctioned bridge between the token system and canvas/SVG rendering.

## Testing

Vitest 4 + jsdom (`vitest.config.ts`; `@/` aliases repo root). Suites:

- `test/lib/calculations/` — one file per calculation module, numeric assertions.
- `test/lib/utils/` — URL-hash codecs (round-trip + migration), seeded RNG distribution checks, display-dollar conversion, tax-rate lookups.
- `test/components/` — Testing Library component tests.
- `test/factories/test-data-factory.ts` — shared mock builders.

Coverage is collected over `lib/calculations/` and `lib/utils/` — the layers where a wrong number is a bug rather than a styling issue.
