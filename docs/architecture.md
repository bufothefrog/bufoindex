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

- **Profile.** `FinancialProfile` (`lib/profile/types.ts`) holds every input any calculator, the intake or the dashboard uses. `lib/store/profileStore.ts` persists it to localStorage (key `bufo-profile`, version 3; every payload goes through `lib/profile/migrate.ts`: a payload older than version 3 first goes through the v2 to v3 account migration described under "Accounts" below, then every payload is normalized against the current defaults, so it loads with every leaf that still exists; a payload newer than 3 is read and never written back). Each saved answer is listed in `provided`, which drives profile completeness. Calculator edits write through to the profile. Three leaves have a derived typical value while unanswered (the emergency fund balance, the target retirement income and the HSA coverage): `withDerivedValues` (`lib/profile/derived.ts`) fills them from the answers, and every reader that turns the profile into engine inputs, dashboard figures, field values or the wizard's grey values goes through it, so the stored profile is never rewritten by reading it.
- **Field schema.** Each field is a `FieldSpec` keyed by its profile path (`lib/fields/types.ts`), grouped into topic screens by a `FormSpec`. One spec drives the wizard at `/start`, the calculator's sections (`components/fields/`), validation (`lib/fields/runtime.ts`) and completeness. The profile form is composed from every calculator's form in `lib/calculators/forms.ts`. A screen marked `optional` (`ScreenSpec.optional`) is left out of the calculator intakes and of completeness, and the profile form asks it last in a section "Optional".
- **Bindings.** `lib/calculators/<id>/bindings.ts` maps profile paths to the engine's inputs; `lib/calculators/runtime.ts` builds engine inputs and validation errors from the profile in one pure pass.
- **Run stores.** `createCalculatorStore` (`lib/store/createCalculatorStore.ts`) makes one store per calculator from its `CalculatorDefinition`. It validates, skips a run whose inputs match the last results, debounces, runs, and keeps the newest run. On invalid inputs the last results stay on screen marked stale. It persists nothing. The retirement simulation runs off the main thread through `lib/workers/createWorkerRunner.ts`, falling back to in-thread where there is no worker.

`CalculatorPage` (`components/calculators/shared/CalculatorPage.tsx`) is the one calculator shell: it reads the registry entry (`lib/calculators/registry.ts`), renders the form's sections and the results inside `CalculatorLayout`, and submits each profile change to the run store.

## Accounts: one list of what the visitor owns

`portfolio.accounts` is the single record of the visitor's money. Every balance a calculator needs (the invested total, the IRA balances, the emergency fund when an account holds it) and the monthly investing total are computed from it and from the contribution answers; none of them is asked a second time.

### The model

- `AccountRow` (`lib/profile/accountTypes.ts`): `{ id, kind, name, balance, holdsEmergencyFund }`. `kind` is one of `401k`, `roth-401k`, `traditional-ira`, `roth-ira`, `hsa`, `brokerage`, `cash`; the labels live only in `ACCOUNT_KIND_LABELS` (`lib/constants/labels.ts`), and `ACCOUNT_KINDS` (`lib/profile/accounts.ts`) maps each kind to its label, its rebalancer tax treatment (`cash` has none and is never rebalanced) and the id a suggested row of that kind takes. `name` may be blank; the display name falls back to the kind label.
- `balance` is the typed value. It counts while the account's holdings are worth 0; once holdings are worth more, the holdings are the value and the typed balance is kept, not cleared ("Use one balance instead" removes the holdings and brings it back).
- `holdsEmergencyFund` is honored only on `brokerage`; normalization forces it false on any other kind.
- Holdings and securities (`portfolio.holdings`, `portfolio.securities`) are unchanged rows that point at an account id.
- `portfolio.newCash` (`NewCashRow { id, amount }`) is the rebalancer's calculator-only "New cash this month" override per account. No row means Auto.
- `investing.monthlyContribution` is nullable: `null` (the default) is Auto, a number is Custom. It is asked only on the retirement page (calculator-only screen 'monthly-investing').

### Derivations (`lib/profile/accounts.ts`, pure)

Every function takes a `Get` over a `withDerivedValues` profile, so an unanswered emergency fund reads as its typical value.

- **Rows in effect.** `accountsInEffect(get)` returns `{ rows, suggested }`. While `portfolio.accounts` is unanswered (the example list), an example row shows only while its condition holds: 401(k) rows while `workplace.has401k` is true, HSA while `hsa.eligible`, each IRA kind while its flag, brokerage while the taxable contribution is above 0, cash always. Once the list is answered, rows are exactly the stored rows, whatever the answers. `suggested` holds one empty row per kind whose seed answer is an answered Yes and that has no row yet; a suggested row is computed, never stored, and holds no money. A later No never removes a stored row.
- **Values.** `holdingsValue(id)` = sum of shares x price over the account's holdings; `accountValue(a)` = the holdings value when it is above 0, else the typed balance (at least 0).
- **Emergency fund.** `isEmergencyFundAccount(a)` is true for kind `cash` and for a ticked brokerage. `emergencyFundBalance(get)` is the sum of their values while any exists, else the stored `cash.emergencyFundBalance` (or its typical 3 x must-pay while unanswered).
- **Totals.** `investedBalance(get)` = the value of every row that does not hold the emergency fund (the retirement starting balance and the leverage Auto start). `iraBalances(get)` = the values of the `traditional-ira` rows and of the `roth-ira` rows (the paycheck allocator's current IRA balances).
- **Monthly investing.** `contributionParts(get)` gives monthly dollars for: own traditional and Roth 401(k) (the deferral capped at the age's 402(g) limit), the employer match (the engine's match formula), own and employer HSA (own capped at the coverage limit less the employer money), each IRA while its flag is true, and the taxable contribution. `monthlyInvestingAuto(get)` = round2 of their sum (1,540 for the default: 693.33 + 346.67 + 500). `monthlyInvesting(get)` = the Custom number, else Auto.
- **New cash.** `normalNewCash(id)` routes each part to the first row of its kind (401(k) money to the first `401k` row, else the first `roth-401k`; HSA money to the first `hsa`; each IRA to its kind; taxable to the first `brokerage`), emergency fund accounts excluded. A part with no matching row goes to nobody but still counts in the monthly total. `newCashFor(id)` = the `portfolio.newCash` override, else the normal amount.
- **Rebalancer.** `rebalanceCandidates` = rows that are not emergency fund accounts, not `cash`, and have holdings or a balance of 0. `rebalancedAccounts` = candidates with holdings or new cash above 0; only these, their holdings and the securities those reference are sent to the engine. `notRebalancedNote` names every other row and why ("Not rebalanced: 401(k) or similar (no holdings entered)." for the default).
- **Display.** `accountLines` and `accountsSummary` give one line per account ("Brokerage (taxable) $8,775 (3 holdings)"); the collapsed card, the review row and the overview Accounts card read them.

### Writes (`lib/calculators/portfolio/accountWrites.ts`, pure)

Every account action returns `Write[]` that replace whole lists: set a balance, a kind or a name, tick the emergency fund, add, remove (cascading to the account's holdings, the securities only they used, and its new-cash row), "List holdings instead", "Use one balance instead" and set new cash. The first write to the unanswered example list stores exactly the rows in effect (hidden example rows and their holdings are dropped), and a suggested row is stored on its first edit. The actions never write `provided`: the profile store and the wizard mark the written lists answered. Next on a wizard screen that shows the account list stores the rows in effect (`acceptAccounts`).

### Emergency fund rule

- With no ticked brokerage and no cash account, nothing changes: the typed emergency fund (or its typical value) is the fund.
- While at least one account holds it, the sum of those accounts is the fund for the paycheck allocator and the overview cash card. Those accounts are left out of the invested total, the new cash routing and the rebalancer (a security only they hold is not sent). The emergency fund balance input is hidden on the emergency fund screens, and a note names the accounts ("Held in your accounts: <name> $X."). The stored leaf is kept and counts again once no account holds the fund.
- To avoid typing the fund twice: ticking an empty brokerage, adding a cash account, or changing an empty row to cash copies the current emergency fund into its balance, but only when no account held the fund before. Unticking an account with no holdings whose balance still equals the stored fund sets its balance back to 0, so the same dollars never count in both the fund and the invested total.

### Migration from version 2 (`lib/profile/migrateV2.ts`)

`migrateProfile` runs `migrateV2Payload` on any payload older than version 3, then `normalizeProfile`. It never throws and does not mutate its input. In order:

1. It reads the v2 leaves that version 3 removes: the invested balance B, the traditional and Roth IRA balances, and the monthly contribution, each with whether it was answered.
2. Neither the lists (`portfolio.accounts` or `portfolio.holdings`) nor a typed balance answered: the v3 example lists, with any answered example price kept; the list stays unanswered.
3. Lists answered: each account keeps its id and name, with a kind from a name hint (HSA, Roth 401(k), 401(k)/403(b)/457/TSP, Roth IRA, IRA) when the hint agrees with the stored tax type, else from the tax type; balance 0; holdings and securities kept. Only typed balances answered: no account rows.
4. An answered IRA balance above the holdings of the rows of that kind adds a row for the rest ("Traditional IRA (rest)" or "Roth IRA (rest)", or a blank name when that kind had no holdings).
5. An answered invested balance B above the value P of the rows so far adds "Other investments" (kind `401k` while `workplace.has401k` is true or unknown, else `brokerage`) with B - P. The invested total becomes max(B, P): nothing typed is lost and nothing is counted twice.
6. Answered per-account deposits above 0 become `portfolio.newCash` overrides; the rest is Auto.
7. The list is marked answered (steps 3 to 6).
8. The monthly contribution stays Custom when it was answered, else Auto; the three removed leaves leave the payload and `provided`; version 3.

Migration cannot know that an account holds the emergency fund, so a v2 profile that counted the same dollars in both its emergency fund and an account keeps counting them twice until the visitor ticks that account.

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
- `test/lib/fields/`, `test/lib/calculators/`, `test/lib/profile/` - the field schema, each calculator's form and bindings, the profile form and completeness, profile defaults, the account derivations and writes (`accounts`, `accountWrites`), and the persisted-payload migration and normalization (`migrateV2`, `migrate`; the v2 payloads are in `test/factories/profile-90ef4ed-v2.ts`).
- `test/lib/store/`, `test/lib/workers/` - the run store factory and each calculator's store, the profile and preference stores, and the worker runner.
- `test/lib/formulas/` — the formula registry behind the methodology page.
- `test/components/` — Testing Library component tests.
- `test/factories/test-data-factory.ts` — shared mock builders.

Coverage is instrumented across `lib/` (type-only modules excluded) with floors defined in `vitest.config.ts`: a global floor for everything covered, and a higher statements/branches bar for `lib/calculations/` — the layer where a wrong number is a bug rather than a styling issue.
