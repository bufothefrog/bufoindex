# BufoIndex DRY refactor: target architecture and migration plan

Status: design, ready for an implementation workflow. Repo at HEAD 0e8f421, worktree clean.
Inputs: the three analyzer reports (stores-codecs-shells, fields-inputs-intake,
results-charts-tests), docs/redesign-guided-flow.md (sections 2, 3, 9), and a
read-through of lib/profile/*, lib/constants/intake.ts, components/guided/Wizard.tsx,
the four shells, lib/store/*, lib/workers/retirementWorker.ts, app/demo/DemoClient.tsx.

Owner goals (verbatim): "for the calculators, i'd rather have them answer all necessary
questions at once rather than only a few. also are the calculators optimized to be sharing
as much as possible. i want a dry, clean and optimized codebase."

Hard constraints carried into every slice:

- lib/calculations/* numerics and their tests stay intact. Slices may ADD new pure
  modules under lib/calculations (each with a test file that meets the 80/65 floor), and
  F1 changes one import line in retirement.ts. No existing calculation function changes
  behaviour.
- CI gates: `npm run type-check`, `npm run lint -- --max-warnings=0`,
  `npm run test:coverage` (global 55% statements over lib/**, 80% statements and 65%
  branches over lib/calculations/**), `npm run build`, `npm audit --audit-level=high`.
- CLAUDE.md design rules: semantic Tailwind tokens only, charts call getChartTheme(),
  compose rather than fork, light and dark mode plus mobile for every new component, and a
  /demo entry for every reusable component (delivered in slice x2, see section 4).
- Guided funnel routes stay the same: /start (basics), /start/choose, /start/<intent>,
  /start/review, /overview, and NextSteps at the end of results.
- The per-intent intake asks ALL of that calculator's fields, grouped into topic screens.
- The profile is the one shared record. Every calculator field has a profile home, and
  every profile leaf has an input somewhere.
- Share buttons and share-URL generation leave the UI. Decoders stay for a deprecation
  window, for legacy links only.

--------------------------------------------------------------------------------

## 1. Duplication headline (what the refactor removes)

Numbers from the analyzers. Each was verified by probe or by file:line reads.

| Area | Today | Copies / lines |
|---|---|---|
| Stores | 4 stores, 4 state models (persistence, recalc mode, error shape, results key, validation site all differ) | ~1,410 lines; ~450 verbatim or near-verbatim (loadFromUrl x3 = 105 lines, run/drop-stale/apply x3 = 52, memo check x3, hash write x6 = 45, section updaters x4 = 45) |
| Codecs | 3 base64url wrappers, 3 decode pipelines, 4 garbage policies | ~990 lines; D1-D3 ~90 lines verbatim. About 250 lines exist only for sharing (handleShare x3 = 80 verbatim, generateShareUrl x2, share UI in CalculatorLayout = 125) |
| Defaults | retirement x4 (store, codec elision, codec decode, mapper), paycheck x3 with different values, rebalancer worked example x2 | ~435 lines. Drift: retirement nme 4000 vs 5000; paycheck state CA vs '', months 3 vs 6, frequency bi-weekly vs monthly |
| Field metadata | 25 profile concepts defined up to 5 times | ~88 label/help/option definitions. Pay frequency vocabulary x16. Filing status x9. Cross-field rules: 7 copies of 3 rules |
| Input cards | 17 bespoke input files | 2,927 lines, of which ~2,240 (76%) are generatable from a schema. 9 hand-rolled checkboxes, 3 single-choice card implementations, 3 comboboxes (~780 lines) |
| Intake coverage | paycheck asks 12 of 40, retirement 9 of 20, rebalancer 2 partial, leverage 3 of 9 | 4 profile leaves can never be answered; ~48 calculator inputs have no profile home; 11 engine inputs have no control at all |
| Formatting | 5 currency formatters (2 verbatim), 7 percent formatters, 2 multiple formatters, 6 frequency-label maps, 30 inline `(x*100).toFixed` sites, 15 toLocaleString sites | formatCurrency/formatPercent duplicated verbatim in core.ts:385-403 and utils/index.ts:24-42 |
| Results vocabulary | 7 tone vocabularies, 2 headline-tile components plus ~82 lines of inline tiles, 4 table implementations, 2 alert looks | |
| Charts | 3 production charts duplicate theme subscription, container, axis props, tooltip shell | ~60 lines of scaffold; SavingsRateChart computes a PMT in the component (untested) |
| Calculator identity | names, paths, descriptions, disclaimers in 7+ places that disagree | "Paycheck Allocator" vs "... Calculator", "Portfolio Rebalancer" vs "Portfolio Rebalancing Calculator" |

Bugs that come straight from the duplication. The plan fixes each one structurally:

1. Paycheck: a reload after a wizard handoff loses edits, because the hash is never stripped and it wins over persisted state. Fixed by s3 bootstrap (consume and strip) and by c3 (the profile is the record).
2. Rebalancer: a non-Latin-1 account or security name makes btoa throw, the hash goes stale, and a reload reverts. Fixed by f6 (UTF-8 codec) and c5 (the profile is the persistence, not the hash).
3. Retirement codec default drift (nme). Fixed by f6 (frozen per-version legacy tables) and c1 (one default, in the profile).
4. FinancialStepCard leaves out the 55+ HSA catch-up. Fixed by c4 (shared contribution-limit helpers).
5. Leverage L9 (index expense ratio) is dropped by its query codec. Fixed by c7 (the profile is the record).
6. Paycheck tells users brackets are "calculated automatically", but the engine uses a fixed 22%. c3 corrects the copy; derivation is owner decision O9.
7. Retirement R15, R16 and R18 are editable under TDF, but the engine ignores them. R19 shows 15% while the engine computes its own rate. Fixed by c1 (visibleWhen, nullable auto/override).

Estimated net effect: roughly -3,000 to -3,500 production lines. That breaks down as inputs about -1,350, results/layout/format about -1,300 against about +400 of new primitives, and stores/codecs/share about -1,000. Tests: about 1,000 lines of codec/store/share tests are deleted or rewritten, and about 1,500 lines of new tests are added, concentrated on the new lib modules so the coverage floors hold.

--------------------------------------------------------------------------------

## 2. Target architecture

### 2.1 Five sharing rules

1. **One record.** The FinancialProfile (localStorage `bufo-profile`, v2) holds every user input of every calculator: facts and assumptions. Calculator stores hold no persisted inputs. They hold run state only (results, errors, status, an in-memory legacy scenario). This matches design doc 9.1: "localStorage, one profile record instead of three stores".
2. **One way to define a field.** A FieldSpec is keyed by its profile path. A calculator is a FormSpec: topic screens that list field paths, plus cross-field rules. The same spec drives the wizard screen, the calculator section, validation, the collapsed summary and profile completeness.
3. **One store pattern.** `createCalculatorStore(definition)` gives every calculator the same run store: debounce, memo, newest-run-wins, one error shape, one error policy. Retirement adds a worker runner; nothing else is calculator-specific.
4. **One shell.** `CalculatorPage` renders `CalculatorLayout` from the calculator registry (title, path, disclaimer). Inputs come from `FieldSections` and results from the calculator's own results component. Share is gone.
5. **One results vocabulary.** `lib/format.ts`, the `Tone` scale, and StatTile/StatGrid, KeyValueList, DataTable, ChartFrame, Disclaimer and StatusAlert. Each calculator exports a pure `headline(results, inputs) -> StatSpec[]`, which the results page and the dashboard both consume.

### 2.2 Layering (imports only point downward)

```
app/tools/<calc>/components/*        results + bespoke renderers only
components/guided/*                  Wizard runs FormSpecs
components/calculators/shared/*      CalculatorPage, useCalculatorBootstrap, useCalculatorValues, ScenarioBanner
components/calculators/renderers/*   per-calculator CustomRenderers (debts badge, holdings, class targets)
components/fields/*                  FieldInput, FieldSection(s), FieldList, ChoiceGroup, NullableField
components/ui/results/*, components/ui/charts/*, components/ui/{checkbox,segmented-control,progress-bar}.tsx
-------------------------------------------------------------------- React above, pure below
lib/store/*                          profileStore (inputs), createCalculatorStore + 4 run stores, preferencesStore
lib/workers/*                        createWorkerRunner, exposeCalculation, retirementWorker
lib/calculators/types.ts, runtime.ts, registry.ts, forms.ts
lib/calculators/<id>/                form.ts, fields.ts, bindings.ts, definition.ts, legacy.ts, headline.ts (+ portfolio reducers.ts)
lib/fields/*                         FieldSpec types, paths, runtime (screens, validate, summarize), bindings, shared.ts
lib/profile/*                        v2 shape, defaults, normalize, migrate
lib/format.ts, lib/constants/*, lib/design-system/{tone,stat}.ts
lib/calculations/*                   engines (unchanged numerics; a few new pure modules)
```

lib/fields and lib/calculators are pure: no React, no DOM, no storage. The one exception is the Worker thunk, which lives in lib/store/retirementStore.ts because Turbopack needs the literal `new Worker(new URL('../workers/retirementWorker.ts', import.meta.url))`.

### 2.3 Profile v2: every field gets a home

Rules:

- Facts about the person live in topic sections.
- Model assumptions live under `assumptions.<calc>`.
- Calculator inputs that are not facts but are seeded from facts become nullable overrides (null means "derive from the profile"). These are retirement's effectiveTaxRate and healthcare cost, and leverage's years, start balance and contribution.
- Lists are first-class: debts, and the portfolio accounts, securities, holdings and class targets.
- `provided` keeps dot paths. For a list, the path is the list path (for example 'debts').

| Section.leaf (new in v2 marked +) | Type / default | Home for (calculator input) | Form, screen, tier |
|---|---|---|---|
| person.age | number 30 | P8 preferences.age, R1 startingAge, L2 (derived) | core: about |
| person.state | code 'TX' | P21 taxes.state, R6 state | core: about |
| person.filingStatus (widened to 4) | 'single' | P22 taxes.filingStatus; R7 via map (O10) | core: about |
| person.retirementAge | 60 | R2; L2 (derived) | retirement: target; leverage: facts |
| +person.lifeExpectancy | 85 | R13 | retirement: target |
| income.grossPerPaycheck / frequency / netPerPaycheck | 3500 / 'bi-weekly' / 2600 | P1-P3; R3 (incomeAmount/period derived) | core: pay |
| +income.hasBonus / bonusAmount / bonusFrequency | false / 0 / 'annual' | P4-P6 | paycheck: spending-bonus |
| spending.necessaryMonthly | 3000 | P7, R9 | core: must-pay |
| spending.funMoneyMin / funMoneyMax | 300 / 600 | P9, P10 (current = midpoint, derived) | paycheck: spending-bonus |
| spending.targetRetirementIncome | 80000 | R8 (never askable before) | retirement: target |
| cash.emergencyFundBalance / emergencyFundApy | 5000 / 0.04 | P11, P13 | paycheck: emergency-fund |
| cash.targetMonths | 3 (preset rule kept) | P12 (never askable before) | paycheck: assumptions |
| workplace.has401k / matchPercent / matchLimit | true / 0.5 / 0.06 | P23-P25 | paycheck: 401k |
| +workplace.contributionType | 'traditional' | P26 | paycheck: 401k |
| workplace.contributionPercent | 0.06 | P27/P28 total (never askable before) | paycheck: 401k |
| +workplace.rothContributionPercent | 0 | P29 (split only) | paycheck: 401k |
| +workplace.afterTaxAvailable | false | H2 | paycheck: 401k |
| +hsa.eligible / coverage / monthlyContribution / employerAnnualContribution / investing | false / 'individual' / 0 / 0 / false | P30-P33, H3 | paycheck: hsa |
| +ira.traditional / roth / traditionalMonthly / rothMonthly / traditionalBalance / rothBalance | false x2 / 0 x4 | P14-P18, H5 (hasIRA derived) | paycheck: ira-taxable |
| investing.taxableMonthlyContribution | 500 | P19/P20 (hasTaxable derived), L1 auto | paycheck: ira-taxable; leverage: facts |
| investing.investedBalance / monthlyContribution | 25000 / 1500 | R5, R4; L3/L1 auto | retirement: savings; leverage: facts |
| investing.targetMix (+ 'custom') | '80-20' | B1 (preset or custom) | portfolio: targets |
| investing.newCashThisMonth | deprecated; migrated into the Brokerage deposit; deleted in x1 | n/a | none |
| +retirementIncome.socialSecurityBenefit / socialSecurityAge / annualHealthcareCost | 30000 / 67 / null | R10, R11, R12 | retirement: ss-healthcare |
| +debts[] {id,name,balance,interestRate,minimumPayment,extraPayment,taxDeductible} | [] | P34-P38, H6 | paycheck: debts |
| +portfolio.accounts[] {id,name,accountType,deposit} | Roth IRA (0), Brokerage (1000) | B3-B5 | portfolio: accounts |
| +portfolio.securities[] / holdings[] | worked example (VTI/VXUS/BND, 4 holdings) | B6-B9 | portfolio: holdings (custom renderer covers both) |
| +portfolio.classTargets[] / customAssetClasses[] | 80-20 weights / [] | B1 when 'custom', B2 | portfolio: targets (custom renderer) |
| strategy.preset | 'cashflow-investor' | dashboard, cash.targetMonths rule | profile extra: strategy |
| strategy.leverageRatio | 2 | L4 (never askable before) | leverage: comparison + facts |
| +leverage.monthlyContribution / years / startingBalance | null / null / null | L1, L2, L3 overrides | leverage: comparison (calculator surface) |
| +assumptions.retirement.{riskProfile, accumulationReturn, retirementReturn, inflationRate, volatility, effectiveTaxRate(null), healthcareCostMultiplier} | RetirementConstants defaults, 'tdf', null, 1 | R14-R20 | retirement: assumptions |
| +assumptions.paycheck.{riskTolerance, optimizationGoal, expectedRetirementBracket} | 'moderate', 'balanced', 0.12 | P39, P40, H4 | paycheck: assumptions |
| +assumptions.portfolio.{mode, allowTaxableSelling, showPlacementAdvice} | 'whole', false, true | B10, B11, setting with no control | portfolio: settings |
| +assumptions.leverage.{indexMeanReturn, indexVolatility, financingRate, expenseRatio, indexExpenseRatio} | DEFAULT_DCA_COMPARISON_INPUTS | L5-L9 | leverage: market |

Engine-only inputs (no profile home, on purpose; each binding test enumerates them with a reason):

- **Paycheck:**
  - taxes.federalBracket: fixed 0.22 by default; O9 decides whether to derive it.
  - taxes.currentWithholding: read only by core.ts estimates.
  - employer401k.currentYTD, hsa.currentYTD, benefits.other.*
  - preferences.isPeakEarnings (false)
  - version, lastUpdated, source
  - the legacy monthly income fields, derived by updateLegacyIncomeFields
- **Retirement:** currentIncome, incomeAmount and incomePeriod, all derived from the profile income exactly as toRetirementInputs does today.
- **Portfolio:** setupMode 'multi-shared'.
- **Leverage:** paths (500) and seed.

Proposed single bounds. They replace the divergent ranges in the analyzer's tables A-D. Implementers use these; the owner can adjust them in one place:

- age 16-100
- retirementAge 30-85, strictly above age
- lifeExpectancy 50-110, at least retirementAge
- socialSecurityAge 62-70
- matchPercent 0-2, as a percent input rather than a slider
- matchLimit 0-0.25
- 401(k) contribution 0-1
- emergencyFundApy 0-0.20
- targetMonths 0-24, step 0.5
- debt interestRate 0-0.5
- leverage bounds stay as LEVERAGE_INPUT_BOUNDS
- retirement assumption bounds stay as the current sliders

### 2.4 Field schema (lib/fields)

```ts
// lib/fields/types.ts
export type Tier = 'core' | 'details' | 'assumption';      // design 2.4: Quick answers / Details worth looking up / Assumptions
export type Surface = 'both' | 'intake' | 'calculator';     // where a screen appears (default 'both')
export type FieldKind = 'money' | 'number' | 'percent' | 'slider' | 'select' | 'choice' | 'boolean'
  | 'state' | 'text' | 'list' | 'custom';
export type Get = (path: string) => unknown;
export type Text = string | ((get: Get) => string | undefined);
export interface FieldOption { value: string | number | boolean; label: string; description?: string }
export interface Write { path: string; value: unknown }
export type FieldErrors = Record<string, string>;           // profile path -> message; 'calculation' reserved

export interface FieldSpec {
  path: string;                       // profile path; list row fields are relative to the row ('balance')
  kind: FieldKind;
  label: string;                      // sentence case, the calculator label
  question?: string;                  // wizard heading when the field is alone on a screen
  help?: Text; hint?: Text;           // hint renders as LookupHint ("where to find this")
  placeholder?: string; unit?: { prefix?: string; suffix?: string };
  options?: readonly FieldOption[] | ((get: Get) => readonly FieldOption[]);
  min?: number; max?: number; step?: number; precision?: number; slider?: boolean; maxLength?: number;
  required?: boolean;
  nullable?: { autoLabel: Text; overrideDefault: number | ((get: Get) => number) };  // null = derive
  tier: Tier;
  visibleWhen?: (get: Get) => boolean;
  summary?: (value: unknown, get: Get) => string | null;      // collapsed one-line summary fragment
  onChange?: (value: unknown, get: Get) => Write[];          // coupled writes (pure)
  // list
  row?: readonly FieldSpec[]; newRow?: (get: Get) => Record<string, unknown>;
  itemLabel?: (row: Record<string, unknown>, index: number) => string;
  addLabel?: string; emptyText?: string; minRows?: number; maxRows?: number;
  confirmRemove?: (row: Record<string, unknown>, index: number) => string | null;
  removeRow?: (get: Get, index: number) => Write[];          // cascading removal (accounts -> holdings)
  rowAdornment?: string; footer?: string; renderer?: string; // ids into the CustomRenderers prop
  covers?: readonly string[];                                // sibling paths a custom renderer edits
  testId?: string;                                           // '{i}' is replaced by the row index
}
export interface ScreenNote { text: Text; visibleWhen?: (get: Get) => boolean; tone?: 'info' | 'caution' }
export interface ScreenSpec {
  id: string; title: string; question?: string; description?: string;
  tier: Tier; surface?: Surface; fields: readonly string[]; notes?: readonly ScreenNote[]; skipLabel?: string;
}
export interface CrossFieldRule { lower: string; upper: string; strict: boolean; checkOn: string; message: string }
export interface FormSpec {
  id: string;
  fields: readonly FieldSpec[];
  screens: readonly ScreenSpec[];
  relations?: readonly CrossFieldRule[];
  onSubmit?: (get: Get, provided: ReadonlySet<string>) => Write[];   // derived writes (preset -> months, retirementAge >= age + 1)
}
```

Runtime (pure; lib/fields/paths.ts, runtime.ts, binding.ts):

- **paths:**
  - `getAt(values, path)`
  - `setAt(values, path, value)`: immutable, supports numeric segments
  - `applyWrites(values, writes)`
  - `makeGet(values)`
- **runtime:**
  - `fieldMap(form)`
  - `resolveText`
  - `resolveOptions`
  - `isFieldVisible`
  - `visibleScreenFields(form, screen, get)`
  - `screensFor(form, get, { mode: 'all'|'remaining', provided, tiers?, surface? })`: in 'remaining' mode, drops screens whose visible fields are all provided. A partly answered screen shows all of its fields, prefilled.
  - `validateFields(form, get, { screen? })`: required, min/max, maxLength, option membership and relations, all keyed by path.
  - `summarizeScreen(form, screen, get)`
  - `screenPaths(form, screen, get)`
- **binding:**
  - `Binding<E>`: either `{ profile, engine }` (1:1), or `{ engine, read(get), write?(value, engine) }` (derived).
  - `toEngineInputs(bindings, base, get)`
  - `fromEngineInputs(bindings, engine) -> Write[]`: the reverse direction, used only for legacy hashes and legacy localStorage import.
  - `engineErrorsToFields(bindings, errors)`: maps engine-path errors to profile paths, or to 'calculation'.
  - `stableKey(value)`: a sorted-key stringify used for memoization.

**Shared versus calculator fields.**

- `lib/fields/shared.ts` holds every spec that more than one form or flow references:
  - AGE, STATE, FILING_STATUS
  - GROSS_PAY, PAY_FREQUENCY, NET_PAY
  - NECESSARY_MONTHLY, RETIREMENT_AGE
  - INVESTED_BALANCE, MONTHLY_INVESTING, TAXABLE_MONTHLY
  - EMERGENCY_FUND_BALANCE, EMERGENCY_FUND_APY
  - STRATEGY_PRESET
  - CORE_SCREENS (about, pay, must-pay) and PROFILE_EXTRA_SCREENS (cash-buffer, strategy).
- Everything else lives in `lib/calculators/<id>/fields.ts`.
- `withOverrides(spec, partial)` gives a form its own label, help or tier without copying the spec.
- Option lists and labels come from lib/constants/labels.ts and frequency.ts (f1), which replaces the 16 pay-frequency copies and the 9 filing-status copies.

The derived registries live in lib/calculators/forms.ts:

- `FORMS`, `CORE_FORM`.
- `PROFILE_FORM`: the core, then the union of every form's non-core, non-assumption, intake-surface screens deduplicated by field path (first occurrence wins, and a screen left empty is dropped), then PROFILE_EXTRA.
- `fieldRegistry()`.
- `profileCompleteness(profile)`: counted by topic screen over PROFILE_FORM facts (O14).

### 2.5 Bindings (the profile <-> engine mapping generated from the schema)

Each `lib/calculators/<id>/bindings.ts` exports `BINDINGS: Binding<E>[]` and `ENGINE_ONLY: Record<string, string>` (path -> reason). The forward direction `engineInputsFor(def, profile)` replaces lib/profile/mappers.ts. The reverse direction feeds legacy decoders and the legacy storage import. Derived bindings replace today's side-effect code:

- **Paycheck 401(k) contribution type.** Today this is a three-field side effect in BenefitsInputCard.tsx:82-187. It becomes a pure derivation from contributionType, contributionPercent and rothContributionPercent:
  - traditional: trad = total, roth = 0
  - roth: trad = 0, roth = total
  - split: roth = min(rothPct, total), trad = total - roth
  - currentContribution = total
- **Paycheck income.** updateLegacyIncomeFields is applied in a derived binding. hasIRA = traditional || roth. hasTaxableAccount = taxable > 0. funMoney.current = the midpoint.
- **Retirement income.** incomeAmount and incomePeriod come from income.grossPerPaycheck and frequency, with weekly annualized to yearly as mappers.ts:149-180 does today. currentIncome = annualizeIncome.
- **Retirement filing status.** marriedJoint maps to marriedJoint; the other three map to single, with a visible note on the page (O10).
- **Portfolio class targets.** A preset produces TARGET_MIX_WEIGHTS; 'custom' uses portfolio.classTargets. Deposits come from portfolio.accounts.
- **Leverage.**
  - monthlyContribution = override ?? (taxable > 0 ? taxable : monthlyContribution)
  - years = override ?? clamp(round(retirementAge - age), 1, 60), using LEVERAGE_INPUT_BOUNDS. This replaces three clamps.
  - startingBalance = override ?? investedBalance

Golden tests in each calculator slice assert that `engineInputsFor(def, profile)` equals the old mapper output, for v1-shaped profiles, except for the differences each slice documents. This is what proves "same inputs -> same numbers".

### 2.6 Run store factory, worker runner, preferences (s1)

```ts
// lib/calculators/types.ts
export type CalculatorId = 'paycheck' | 'retirement' | 'portfolio' | 'leverage';
export interface CalculatorMeta { id: CalculatorId; title: string; shortTitle: string; path: string;
  description: string; metaDescription: string; disclaimer: readonly DisclaimerFragment[];
  liveResultsLabel: string; dollarDisplay: 'inflation-input' | 'fixed' | 'none' }
export interface CalculatorDefinition<E, R> {
  id: CalculatorId; form: FormSpec; bindings: readonly Binding<E>[]; engineBase: () => E;
  validate: (inputs: E) => FieldErrors;                 // engine paths
  calculate: (inputs: E) => R;                          // pure, deterministic
  debounceMs: number;
  legacy?: { decode(url: { hash: string; search: URLSearchParams }): E | null;
             storageKey?: string; readStorage?(raw: unknown): E | null; storageDefaults?(): E };
}
// lib/calculators/runtime.ts
export function engineInputsFor<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): E;
export function validateFor<E, R>(def: CalculatorDefinition<E, R>, values: FinancialProfile): FieldErrors;
export function scenarioFrom<E, R>(def: CalculatorDefinition<E, R>, base: FinancialProfile, engine: E): FinancialProfile;

// lib/store/createCalculatorStore.ts
export interface CalculatorRunState<E, R> {
  inputs: E | null; results: R | null; errors: FieldErrors; stale: boolean;
  isCalculating: boolean; hasCalculatedOnce: boolean; resultsKey: string | null;
  scenario: FinancialProfile | null;                     // in-memory legacy-link scenario, never persisted
  submit(values: FinancialProfile, opts?: { immediate?: boolean }): void;  // validate -> memo -> debounce -> run
  flush(): Promise<void>;                                // run the pending submit now
  setScenario(scenario: FinancialProfile | null): void;
  reset(): void;
}
export type CalculatorStore<E, R> = UseBoundStore<StoreApi<CalculatorRunState<E, R>>>;
export function createCalculatorStore<E, R>(opts: { definition: CalculatorDefinition<E, R>;
  runner?: (inputs: E) => Promise<R>; devtoolsName?: string }): CalculatorStore<E, R>;
```

One policy, applied app-wide:

- Validation runs before every run.
- On errors, the store keeps the last results with `stale: true`.
- `hasCalculatedOnce` becomes true only after a successful run.
- The newest run wins, by sequence id.
- Memoization uses `stableKey(inputs)`, which fixes the key-order memo misses.
- Recalculation is live for every calculator: retirement 300 ms off-thread, paycheck 150 ms, portfolio 0, leverage 150 ms (O8). The 300 ms artificial paycheck delay and the 100 ms load timeout go.

Workers:

- `createWorkerRunner({ create: () => Worker, fallback })` holds the generic plumbing from retirementStore.ts:31-128: lazy worker, pending map, onerror retirement with in-thread retry, and fallback when there is no Worker.
- `exposeCalculation(fn)` is the worker side.
- Because validation runs before dispatch, the fieldErrors round trip (retirementWorker.ts:44-46, retirementStore.ts:78-81) is deleted.

Preferences:

- `lib/store/preferencesStore.ts` holds `{ displayMode, setDisplayMode }`, persisted as 'bufo-preferences'. It replaces displayMode in two stores and two codecs (O15).
- `components/shared/useDollarDisplay(inflationRate)` returns `{ mode, setMode, fromNominal(value, yearsFromNow), caption, axisSuffix }` and replaces 4 caption variants.

Legacy storage:

- `lib/store/legacyImport.ts` exports `importLegacyCalculatorStorage(def)`.
- It runs once per calculator on mount and reads `def.legacy.storageKey`: 'retirement-calculator' v3, or 'paycheck-allocator-storage'.
- It writes only values that differ from that store's frozen old defaults and are not already provided in the profile, marks them provided, then removes the key (O7).
- It is idempotent.

### 2.7 Codec helper and legacy decoders (f6)

```ts
// lib/utils/hashCodec.ts
export function encodeBase64UrlJson(value: unknown): string;   // UTF-8 via TextEncoder, never throws on emoji
export function decodeBase64UrlJson(hash: string, opts?: { minLength?: number }): unknown | null;
  // strip '#', charset guard, pad, atob; UTF-8 (fatal) first, Latin-1 fallback for legacy btoa payloads;
  // JSON.parse; null on any failure; no console output
export interface LegacyDecoderSpec<T> { versions: Record<number, (payload: Record<string, unknown>) => unknown>;
  normalize: (raw: unknown) => T | null; minLength?: number }
export function createLegacyDecoder<T>(spec: LegacyDecoderSpec<T>): (hash: string) => T | null;
```

The existing exported names keep their signatures and are retargeted to the helper:

- encodeRetirementToUrlHash / decodeRetirementFromUrlHash
- encodeToUrlHash / decodeFromUrlHash, moved to lib/utils/paycheckState.ts and re-exported from lib/utils/index.ts
- encodeRebalancingToUrlHash / decodeRebalancingFromUrlHash

Legacy unpackers keep frozen per-version default tables. For example, a v2 retirement hash without `nme` decodes to 5000, because that encoder elided 5000. That value is correct for old links and must never read live defaults. Decoders coerce leaves (`{sa:'abc'}` no longer decodes to a string) and migrate a legacy riskProfile to 'custom'.

Encoders survive only while lib/profile/links.ts uses them. x1 deletes them. The decoders and their decode tests stay for the deprecation window, then a follow-up deletes them (section 9).

### 2.8 Mount order: hash > profile > defaults (decision and justification)

On mount, `useCalculatorBootstrap(def, store)` runs once (guarded against a StrictMode double invoke) after the profile store has hydrated:

1. **Wizard or dashboard handoff.** If the URL carries `?from=profile`, strip the query and hash with `history.replaceState(null, '', pathname)`, clear any scenario, and report `arrivedFromProfile` so that phones open on Results. The profile already holds the answers.
2. **Legacy link.** Otherwise, if `def.legacy` decodes the hash (or leverage's c/y/b/l query), build an in-memory scenario with `scenarioFrom(def, profile, decoded)`, strip the hash or query, and show ScenarioBanner. The banner reads: "This page opened with inputs from a link. Your saved answers are unchanged." Its actions are "Use these as my answers" (setValues for this form's fields) and "Back to my answers". Edits in scenario mode stay in memory.
3. **Profile.** Otherwise, values = the profile.
4. **Defaults.** Before hydration and on the server, the profile store's initial state is `getDefaultFinancialProfile()`, so inputs render from defaults. Results show a skeleton until the first run after hydration. "Defaults" is therefore not a separate layer: there is one default per field, in the profile.

Why hash before profile:

- (a) A URL is an explicit, one-shot statement of intent; the profile is ambient.
- (b) During the deprecation window, the only reason to keep decoders is so that links in the wild still show what they encode. With profile-first, every visitor who has a profile would silently see their own numbers instead, and the decoders would be dead code for exactly the people most likely to click a link.
- (c) Consuming and stripping makes the hash non-sticky. That removes the paycheck reload bug for good: after the strip, a reload reads the profile.
- (d) The scenario never writes to the profile unless the visitor asks, so a legacy link cannot clobber saved answers. This is the failure profile-first was meant to prevent.
- (e) It matches design doc 3.4 and 9.1 ("chosen scenario > profile > store defaults").
- (f) When the window ends, deleting step 2 leaves profile > defaults with no other change.
- (g) The wizard and dashboard never use hashes as transport after this refactor. f5 adds `?from=profile` to every link right away, so each calculator stops decoding wizard hashes the moment its slice lands, and x1 drops the hash part.

### 2.9 Shell (s3)

```tsx
// lib/calculators/registry.ts
export const CALCULATORS: Readonly<Record<CalculatorId, CalculatorMeta>>;
export function calculatorMeta(id: CalculatorId): CalculatorMeta;
export function calculatorMetadata(id: CalculatorId): Metadata;           // for app/tools/<id>/page.tsx
export function calculatorHref(id: CalculatorId, opts?: { fromProfile?: boolean }): string;

// components/calculators/shared/CalculatorPage.tsx
export interface CalculatorPageProps<E, R> {
  definition: CalculatorDefinition<E, R>;
  store: CalculatorStore<E, R>;
  renderers?: CustomRenderers;
  renderResults: (args: { results: R; inputs: E; values: FinancialProfile; stale: boolean }) => React.ReactNode;
  afterLayout?: React.ReactNode;                                          // retirement methodology link
}
export default function CalculatorPage<E, R>(props: CalculatorPageProps<E, R>): JSX.Element;
// useCalculatorBootstrap(def, store): { ready: boolean; arrivedFromProfile: boolean }
// useCalculatorValues(def, store): { values: FinancialProfile; get: Get; mode: 'profile' | 'scenario';
//   write(writes: Write[]): void; keepScenario(): void; discardScenario(): void }
```

How the page works:

- CalculatorPage subscribes through selectors, which fixes the whole-store re-render on every keystroke (D29).
- It reads meta from the registry and renders `CalculatorLayout` with `liveResults`, `resultFooter={<NextSteps intent={id}/>}` and `notice={<ScenarioBanner/>}`.
- Inputs: `<FieldSections form get errors onWrite renderers/>`.
- Results: `renderResults(...)`.
- `write` in profile mode calls `useProfileStore.getState().setValues(writes)`, which also marks the paths provided. That is write-through (O1).

CalculatorLayout changes:

- Removes the share UI (about 125 lines). `onShare` stays in the props type as an ignored, @deprecated field until x2, so the shells compile in between.
- Adds `liveResults`: no desktop Calculate card, and the mobile action bar's primary action becomes "See results".
- Adds `notice` and a default empty state.
- `DisclaimerFooter` re-exports the new Disclaimer.
- Deletes ComparisonCalculatorLayout (0 uses). SimpleCalculatorLayout and AdvancedCalculatorLayout stay as @deprecated wrappers until x2, because /demo imports them.

ResponsiveGrid: dedupe InputSection/ResultSection and the maxWidth maps.

Every shell shrinks to about 15 lines. Disclaimers are composed from lib/constants/disclaimers.ts: base + calculator-specific fragments + advice.

### 2.10 Field renderers (s2)

```tsx
export type CustomRenderer = (p: { spec: FieldSpec; get: Get; value: unknown; onWrite(w: Write[]): void;
  error?: string; size: 'md' | 'lg' }) => React.ReactNode;
export type CustomRenderers = Readonly<Record<string, CustomRenderer>>;
export interface FieldInputProps { spec: FieldSpec; get: Get; onWrite(w: Write[]): void; error?: string;
  size?: 'md' | 'lg'; hideLabel?: boolean; renderers?: CustomRenderers;
  onChooseAndAdvance?(v: FieldOption['value']): void; idPrefix?: string }
export interface FieldSectionProps { form: FormSpec; screen: ScreenSpec; get: Get; errors: FieldErrors;
  onWrite(w: Write[]): void; renderers?: CustomRenderers; collapsed?: boolean; onToggle?(): void;
  onRestoreDefaults?(): void }
export interface FieldSectionsProps { form: FormSpec; get: Get; errors: FieldErrors; onWrite(w: Write[]): void;
  renderers?: CustomRenderers; surface?: 'calculator'; initiallyCollapsed?(s: ScreenSpec): boolean;
  onRestoreDefaults?(s: ScreenSpec): void }
export interface FieldListProps { spec: FieldSpec; get: Get; onWrite(w: Write[]): void; errors: FieldErrors;
  renderers?: CustomRenderers; size?: 'md' | 'lg' }
```

Which primitive renders each kind:

| Kind | Primitive |
|---|---|
| money | MoneyInput |
| number | NumberInput |
| percent | PercentInput (showSlider when `slider`) |
| slider | new SliderField = Slider + BaseInput chrome; replaces PercentageSlider and the raw slider at InputSection.tsx:550 |
| select | SelectInput |
| choice | ChoiceGroup + OptionCard (moved from WizardStep.tsx:38-118, with a 'grid' layout); replaces ModeButton and the RiskProfileSelector buttons |
| boolean | new components/ui/checkbox.tsx on the calculator page (replaces 9 hand-rolled checkboxes); Yes/No ChoiceGroup in the wizard |
| state | StateSelector in both places (O19) |
| text | BaseInput + Input |
| list | FieldList |
| custom | the renderers prop |

Behaviour:

- `nullable` fields wrap the input in NullableField, an auto/override toggle that shows the auto value.
- `hint` appends LookupHint.
- `size="lg"` passes through to the primitives (a size prop added to them), which replaces the LARGE_FIELD and TALL_SELECT descendant-selector hacks.
- FieldSection uses InputCard with the moved SectionToggle. Its collapsed body is summarizeScreen. It is forced open when a field on it has an error, renders notes, and offers "Restore defaults" on assumption screens.
- FieldSections collapses by tier: core collapsed once every core field is provided, details expanded, assumptions collapsed. Collapse state is component-local (no persisted showAdvanced or activeSection).

### 2.11 Results vocabulary and formatting (f1, f2, f3)

- **lib/format.ts** (cached Intl instances):
  - `formatCurrency(n, { compact?, signed?, cents? })`
  - `formatPercent(f, { digits?, signed? })`
  - `formatMultiple`, `formatMonths`, `formatYearsAndMonths`, `formatShares`, `formatCount`
  - `formatValue(n, kind: FormatKind)`
  - Default outputs are byte-identical to today's lib/utils formatters (table-driven parity test).
- **lib/constants/frequency.ts, labels.ts, disclaimers.ts:** one table per vocabulary (pay frequency: label, option, phrase, perMonth, perYear; filing status (4); account type; bonus frequency; strategy preset, spelled "Cash-flow investor" once; target mix; risk tolerance; optimization goal; HSA coverage; contribution type; leverage ratio labels) plus disclaimer fragments.
- **lib/design-system/tone.ts:** `Tone = 'neutral'|'positive'|'caution'|'negative'|'info'|'brand'` with TONE_TEXT, TONE_BORDER and TONE_SURFACE maps, plus `toneFromLegacy()`. It replaces 7 vocabularies and the CardVariant name clash.
- **lib/design-system/stat.ts:** `StatSpec { id; label; value: number | null; format: FormatKind; tone?; hint?; badge? }`.
- **components/ui/results:**
  - StatTile and StatGrid (size md|lg, align, tone, loading); they replace SummaryCard and the inline tiles
  - KeyValueList (dl/dt/dd; BreakdownRow becomes its row)
  - DataTable (columns with align/numeric, caption, footer, empty row; generalizes ComparisonTable)
  - Disclaimer
- **components/ui/charts:**
  - ChartFrame: height compact = h-72 md:h-96; caption; mode note; ResponsiveContainer
  - ChartTooltipCard
  - useChartTheme (ThemeContext subscription, replacing the MutationObserver copies)
  - `chartAxisProps(theme)`, `chartGridProps(theme)`, `thinPoints(points, max)`
- **Other primitives:**
  - StatusAlert: adds `tone` and `appearance: 'muted'|'tinted'`; replaces 3 hand-rolled alerts and ErrorList.
  - SegmentedControl: replaces 4 implementations.
  - ProgressBar: role=progressbar.
- **Per calculator:** `lib/calculators/<id>/headline.ts` exports `headline(results, inputs): StatSpec[]`, used by the results header and the dashboard card. This removes the same-figure-two-formats divergence and the 'Your Current Plan' string coupling in derive.ts:265 (keyed by scenario id instead).

### 2.12 Intake and wizard (w1, then each calculator slice)

The wizard runs FormSpecs. WizardStep becomes `FieldInput size="lg"`.

**Answers.** The answers are a working copy of the profile on arrival. FieldInput writes into it with setAt, so lists edit in place.

**Screens.** `screensFor(formForFlow(flow), get, { mode, provided, surface: 'intake' })`:

- The core flow asks CORE_SCREENS.
- An intent flow asks that form's non-core intake-surface screens, assumption screen last (O3).
- 'profile' asks PROFILE_FORM.
- 'remaining' mode skips screens whose visible fields are all provided. A partly answered screen shows every field prefilled.

**Validation.** `validateFields(form, get, { screen })` shows errors inline per field. Relations show as the screen-level alert.

**Finish.**

1. Build `writes` from the provided screens (a whole list per list path) plus `form.onSubmit`. That is where the preset -> targetMonths rule and the retirementAge >= age + 1 rule move.
2. Call `setValues(writes, { provide })`.
3. Navigate with `router.replace(calculatorHref(id, { fromProfile: true }))`. The core flow still uses push, as today.

**Skip affordances.**

- "Skip, use a typical value" per screen.
- "Keep the default assumptions" on assumption screens.
- "Skip the rest" on every intent, which jumps to finish.

**Custom renderers in the wizard.** `components/calculators/renderers/index.ts` exports `RENDERERS: Record<CalculatorId, CustomRenderers>`. The profile intent merges all four.

**Copy.** WizardHeader ("Just the questions this calculator still needs" becomes "Everything this calculator uses, a few related questions per screen"), the "Good enough to start" line, the intake.ts header, and design doc 2.1, 2.3 and the 2.3 table (in x2).

**Screen counts after the core:**

- paycheck 7: spending-bonus, emergency-fund, 401k, hsa, ira-taxable, debts, assumptions
- retirement 4: savings, target, ss-healthcare, assumptions
- portfolio 4: targets, accounts, holdings, settings
- leverage 2: facts, market
- profile: the union, about 16 to 18

w1 is behaviour-preserving: provisional forms carry exactly today's question sets. Each calculator slice then expands its own intent to the full field set in the same PR that makes the calculator read those fields, so every intermediate state is coherent.

### 2.13 What stays bespoke

- **TickerCombobox and holding-to-security linking.** HoldingRow keeps its props. Optional `classTargets` and `customAssetClasses` replace its store reads, so /demo keeps compiling. A HoldingsEditor custom renderer covers portfolio.holdings and portfolio.securities.
- **The class-targets editor** (TargetsCard: relevant classes, sum indicator, creatable class combobox). It becomes the ClassTargetsEditor custom renderer, shown when targetMix = 'custom', and covers customAssetClasses.
- **Portfolio entity reducers** (15 actions), moved verbatim as pure `(portfolio, ...args) => portfolio | [portfolio, id]` functions in lib/calculators/portfolio/reducers.ts. This dedupes the unused-security cleanup (x4) and the blank-security literal (x3).
- **Debt-row decorations.** The rate badge (with neutral-tone copy, which fixes the DebtInput.tsx:40-58 tone violation) and the totals footer, as renderers.
- **Calculator results content.** Paycheck step cards, payroll guide and QuickActions; retirement charts and scenario table; rebalancer plan tables (on DataTable); leverage sentence builders (moved to lib/calculators/leverage/headline.ts or a sibling pure module).
- **The retirement methodology link** (afterLayout).
- **Explanatory copy** (HSA triple-advantage, taxable-selling warning), as ScreenSpec notes. The text stays bespoke; the markup goes.

### 2.14 Per-calculator target, summarized

- **Retirement:**
  - Screens: basics (core: age, state, filing, gross, frequency, must-pay); savings (monthly, invested); target (retirementAge, targetRetirementIncome, lifeExpectancy); ss-healthcare (SS benefit, SS age, healthcare cost nullable); assumptions (riskProfile choice with TDF descriptions; accumulation, retirement and volatility visibleWhen custom; inflation; effectiveTaxRate nullable; healthcare multiplier slider).
  - Relations: age < retirementAge; retirementAge <= lifeExpectancy.
  - RiskProfileSelector and InputSection are deleted.
  - Worker runner.
- **Paycheck:**
  - Screens as in 2.12, plus a basics core screen. The 401(k) coupling is a pure binding.
  - Debts: a FieldList with rate badge and totals renderers.
  - HSA copy as notes.
  - All 7 input cards, InputSection, DebtInput, DebtsInputCard and PercentageSlider are deleted.
  - validateProfile stays in lib/calculations, unwired (O18). Its rules exist as field bounds and relations.
- **Portfolio:**
  - Screens: targets (targetMix choice incl. Custom + ClassTargetsEditor); accounts (FieldList: name, type, new cash; minRows 1; removeRow cascades to holdings via reducers; confirmRemove carries the existing prompt); holdings (HoldingsEditor custom renderer, grouped by account); settings (mode choice, allowTaxableSelling boolean with caution note, showPlacementAdvice boolean).
  - No core screen (O5).
  - AccountsCard, SettingsCard and ModeButton are deleted. Test ids `account-name-{i}` and `holding-price-{i}` are preserved through `testId`.
- **Leverage:**
  - Screens: comparison (calculator surface: contribution, years and start balance as nullable overrides with auto labels naming the profile source; leverageRatio select); facts (intake surface: taxable monthly, retirementAge, invested balance, leverageRatio); market (assumption: the five rates, with "Restore defaults").
  - New run store; persistence comes for free through the profile.
  - LeverageInputs, ComparisonTable, format.ts and queryParams.ts are deleted (the query reader moves to legacy.ts).

--------------------------------------------------------------------------------

## 3. Migration slices

Ownership rule: no two slices that can run at the same time own the same file. A file may appear in two slices only when one depends, directly or transitively, on the other. Those hand-offs are marked "(after X)". New files are created by their owner. A slice that changes a component /demo imports keeps that component's existing exported props and names; x2 removes deprecated exports together with the demo edits.

Phase plan:

| Phase | Slices (run in parallel within a phase where dependencies allow) |
|---|---|
| 0 Foundations | f0-test-infra, f1-format-labels, f2-results-primitives, f3-chart-frame, f4-field-schema, f6-hash-codec, then f5-profile-v2 (needs f1, f4) |
| 1 Platform | s1-run-store-factory, s2-field-renderers, then s3-calculator-shell and w1-intake-on-forms (in parallel) |
| 2 Calculators | c1-retirement-inputs, c3-paycheck-inputs, c5-portfolio-inputs, c7-leverage (in parallel); then c2-retirement-results, c4-paycheck-results, c6-portfolio-results |
| 3 Consumers | d1-dashboard |
| 4 Cleanup | x1-dead-code-cleanup, then x2-demo-and-docs |
| Later | z1-delete-legacy-decoders (after the deprecation window, not part of this run) |

Every slice must pass, before merge: `npm run type-check`, `npm run lint -- --max-warnings=0`, `npm run test:coverage`, and `npm run build` (in CI; not locally while the .next audit runs). Slices merge into an integration branch (suggested `refactor/dry-calculators`). Main receives it once x2 is green. Each slice also leaves the app shippable, using the `?from=profile` marker and the deprecated-export rule.

### f0-test-infra (S)
- Goal: shared test helpers so later slices do not copy setup.
- Owns:
  - test/setup.ts
  - test/utils/financial-test-helpers.ts
  - test/utils/render.tsx (new)
  - test/utils/navigation.ts (new)
  - test/utils/stores.ts (new)
  - test/utils/hashFixtures.ts (new)
  - test/factories/test-data-factory.ts
- Depends on: none.
- Contract:
  - `routerMock` ({push, replace, back, prefetch}), `nextNavigationFactory(search?)` (used as `vi.mock('next/navigation', () => nextNavigationFactory())`), `resetRouterMock()`
  - `resetProfileStore({ hydrated?, profile? })`, `clearBrowserState()` (localStorage, sessionStorage, location hash/search)
  - `renderWithProfile(ui, { profile?, hydrated? })`
  - `encodeLatin1Hash(value)` (legacy btoa form), `encodeUtf8Hash(value)`
  - setup.ts registers toBeCloseToCurrency and a ResizeObserver stub.
  - Remove the zero-caller TestDataFactories, validateTestData, IRS_2026_* and measureCalculationPerformance.
- Tests: the whole suite passes with no assertion changes. Existing test files are not migrated here; each owner migrates the ones it touches.

### f1-format-labels (M)
- Goal: one formatting module and one table per label vocabulary.
- Owns:
  - lib/format.ts (new)
  - lib/constants/frequency.ts
  - lib/constants/labels.ts (new)
  - lib/constants/disclaimers.ts (new)
  - lib/calculations/retirement.ts (import line only: formatCurrency from '@/lib/format', which drops clsx and tailwind-merge from the worker bundle)
  - test/lib/format.test.ts (new)
  - test/lib/constants/labels.test.ts (new)
- Depends on: none.
- Contract:
  - `FormatKind`, `formatCurrency`, `formatPercent`, `formatMultiple`, `formatMonths`, `formatYearsAndMonths`, `formatShares`, `formatCount`, `formatValue`
  - `PAY_FREQUENCY_META` / `PAY_FREQUENCY_OPTIONS` (keeps FREQUENCY_MULTIPLIERS and PayFrequency)
  - `FILING_STATUS_META` (4 values) / `FILING_STATUS_OPTIONS`, plus BONUS_FREQUENCY, ACCOUNT_TYPE, STRATEGY_PRESET, TARGET_MIX, RISK_TOLERANCE, OPTIMIZATION_GOAL, HSA_COVERAGE, CONTRIBUTION_TYPE, LEVERAGE_RATIO option/label tables
  - `DISCLAIMER` fragments and `composeDisclaimer(...fragments)`
- Tests:
  - Table-driven parity with lib/utils formatCurrency/formatPercent and with the leverage format.ts functions ($578k, U+2212 sign, 2.25x).
  - Every enum value has a label.
  - lib/calculations tests are untouched and green.

### f2-results-primitives (M)
- Goal: the shared results vocabulary.
- Owns:
  - lib/design-system/tone.ts, lib/design-system/stat.ts (new)
  - components/ui/results/{StatTile,StatGrid,KeyValueList,DataTable,Disclaimer}.tsx and index.ts (new)
  - components/ui/segmented-control.tsx, components/ui/progress-bar.tsx (new)
  - components/calculators/shared/StatusAlert.tsx, components/calculators/shared/BreakdownRow.tsx (add tone; keep `variant` as an alias)
  - components/shared/DollarModeToggle.tsx (rebuilt on SegmentedControl; same props)
  - test/components/results/*.test.tsx, test/components/SegmentedControl.test.tsx, test/components/ProgressBar.test.tsx (new)
- Depends on: f0, f1.
- Contract: as in section 2.11. Semantic tokens only; light and dark mode; StatTile `loading` replaces the h-[74px] skeleton.
- Tests: role and ARIA assertions (dl/dt/dd, caption, scope, progressbar, radiogroup); tone class mapping; no class-name pinning.

### f3-chart-frame (S)
- Goal: one chart scaffold.
- Owns:
  - components/ui/charts/{ChartFrame,ChartTooltipCard,useChartTheme}.tsx and index.ts (new)
  - lib/chart-theme.ts
  - app/globals.css (a mono font token only; it replaces the unloaded 'IBM Plex Mono' literal)
  - test/components/charts/ChartFrame.test.tsx, test/lib/chart-theme.test.ts (new)
- Depends on: f0.
- Contract: `useChartTheme(): ChartTheme`, `<ChartFrame caption modeNote? height='compact'|'tall'>`, `<ChartTooltipCard title rows/>`, `chartAxisProps(theme)`, `chartGridProps(theme)`, `CHART_MARGINS`, `thinPoints(points, max)`. Charts keep calling getChartTheme() underneath (CLAUDE.md rule).
- Tests: theme switch re-renders; caption renders; thinPoints keeps the endpoints.

### f4-field-schema (M)
- Goal: the pure field-schema runtime.
- Owns: lib/fields/{types,paths,runtime,binding}.ts (new) and test/lib/fields/{paths,runtime,binding}.test.ts (new).
- Depends on: none.
- Contract: section 2.4 (types, getAt/setAt/applyWrites/makeGet, fieldMap, resolveText, resolveOptions, isFieldVisible, visibleScreenFields, screensFor, validateFields, summarizeScreen, screenPaths, Binding, toEngineInputs, fromEngineInputs, engineErrorsToFields, stableKey).
- Tests:
  - Array paths and immutability.
  - Remaining-mode semantics: an all-provided screen drops, a partly provided screen keeps all its fields.
  - Relations: strict and checkOn.
  - Binding round trip, both 1:1 and derived.
  - stableKey is independent of key order.
  - Coverage at least 90%.

### f5-profile-v2 (L)
- Goal: every calculator field gets a profile home; v1 data migrates.
- Owns:
  - lib/profile/{types,defaults,mappers,links,index}.ts
  - lib/profile/migrate.ts (new)
  - lib/store/profileStore.ts
  - lib/constants/intake.ts (compile fix only: FILING_SUMMARY gains marriedSeparate and headOfHousehold)
  - test/lib/profile/{mappers,links}.test.ts, test/lib/profile/{defaults,migrate}.test.ts (new), test/lib/store/profileStore.test.ts
- Depends on: f1, f4.
- Contract:
  - `FinancialProfile` v2 (section 2.3)
  - `FilingStatus` (4 values), with `ProfileFilingStatus` as a deprecated alias
  - `TargetMixPreset` gains 'custom'
  - `getDefaultFinancialProfile()`, `PROFILE_LEAF_PATHS`, `PROFILE_LIST_PATHS`, `isProfilePath(path)` (leaf, list, or list row field)
  - `normalizeProfile(input, base?)`: leaf-wise, list rows normalized against row defaults, invalid rows dropped, nullable leaves allowed
  - `migrateProfile(persisted, fromVersion)`: v1 -> v2; investing.newCashThisMonth goes to the Brokerage account's deposit
  - profileStore: `setValues(writes, opts?: { provide?: readonly string[]; unprovide?: readonly string[] })` (provide defaults to the written paths); `setFields` and `setProvidedValue` stay as wrappers (path-based, any depth); version 2 with migrate; hydration as today
  - links.ts: all four link builders add `from=profile` (retirement, paycheck and portfolio become `${PATH}?from=profile#${hash}`; leverage adds from=profile to its query); export `PROFILE_HANDOFF_PARAM = 'from'` and `PROFILE_HANDOFF_VALUE = 'profile'`
  - mappers: updated to the v2 sources. toRebalanceInputs reads portfolio lists, which removes the mirrored worked example. Output is identical for v1-shaped data.
  - PROFILE_FIELDS (the 25 v1 leaves) stays as a deprecated export until x1.
- Tests:
  - Migrate fixtures, copied from real v1 payloads: default, all provided, hand-edited garbage.
  - normalize for each list.
  - provided filtering of unknown paths.
  - Mapper golden outputs unchanged for the default and for the existing fixtures.
  - Links decode to the same inputs and carry from=profile.
  - The existing profileStore tests keep passing.
- Note: unmigrated calculators ignore the new query parameter (verified: they read only the hash, or only c/y/b/l), so this slice is safe to ship alone.

### f6-hash-codec (M)
- Goal: one UTF-8-safe base64url JSON helper, and typed legacy decoders.
- Owns:
  - lib/utils/hashCodec.ts (new)
  - lib/utils/paycheckState.ts (new; the codec moved out of lib/utils/index.ts:220-493)
  - lib/utils/index.ts (the codec block replaced by a re-export)
  - lib/utils/retirementState.ts, lib/utils/portfolioRebalancingState.ts
  - test/lib/utils/hashCodec.test.ts, test/lib/utils/paycheckState.test.ts (new; moved from index.test.ts:26-172)
  - test/lib/utils/{index,retirementState,portfolioRebalancingState}.test.ts
- Depends on: f0.
- Contract: section 2.7. Existing exported names and signatures are unchanged. There is no console output on a bad hash, and a non-Latin-1 name round-trips.
- Tests:
  - Legacy Latin-1 payloads (with e-acute) still decode.
  - An emoji round-trips.
  - Garbage returns null silently.
  - The v2 retirement hash without nme decodes to 5000 (frozen default).
  - `{sa:'abc'}` coerces to the frozen default.
  - Existing decode suites stay green. The five hand-rolled base64 blocks become hashFixtures calls.

### s1-run-store-factory (L)
- Goal: one run-store pattern, a worker runner, a shared display preference, and the legacy storage import.
- Owns:
  - lib/calculators/types.ts, lib/calculators/runtime.ts
  - lib/store/createCalculatorStore.ts, lib/store/preferencesStore.ts, lib/store/legacyImport.ts
  - lib/workers/createWorkerRunner.ts, lib/workers/exposeCalculation.ts
  - components/shared/useDollarDisplay.ts
  - test/lib/store/{createCalculatorStore,preferencesStore,legacyImport}.test.ts, test/lib/workers/createWorkerRunner.test.ts, test/lib/calculators/runtime.test.ts (all new)
- Depends on: f0, f4, f5.
- Contract: section 2.6, all of it.
- Tests (with a fake definition):
  - debounce
  - memo hit on equal inputs in a different key order
  - stale-drop under out-of-order resolves
  - errors keep results with stale=true
  - hasCalculatedOnce
  - scenario set and clear
  - runner fallback without Worker; a broken worker retries in-thread
  - legacy import writes only non-default, non-provided values, then removes the key
  - preferences persist
- Note: the retired retirementStore.test cases for memo and stale-drop are re-expressed here generically.

### s2-field-renderers (L)
- Goal: generic renderers for FieldSpec, so calculators stop hand-writing cards.
- Owns:
  - components/fields/{FieldInput,FieldSection,FieldSections,FieldList,ChoiceGroup,NullableField}.tsx and components/fields/{types,index}.ts (new)
  - components/ui/checkbox.tsx (new), components/ui/inputs/SliderField.tsx (new)
  - components/ui/inputs/index.ts
  - components/ui/inputs/{BaseInput,EnhancedMoneyInput,NumberInput,PercentInput}.tsx (`size` prop only; drop the colliding PercentInput `formatPercent` re-export if nothing outside tests imports it)
  - components/shared/inputs/SelectInput.tsx (`size` prop only)
  - test/components/fields/*.test.tsx, test/components/{Checkbox,SliderField}.test.tsx (new)
  - test/components/PercentInput.test.tsx (only if the re-export changes)
- Depends on: f0, f1, f2, f4.
- Contract: section 2.10. ChoiceGroup has the same keyboard behaviour as WizardStep today (Enter to advance). OptionCard is imported, not moved.
- Tests:
  - every kind renders with a linked label, help and error (accessible names)
  - visibleWhen
  - nullable auto/override round trip
  - list add, remove, confirm, cascade via removeRow, testId pattern
  - section collapse summary, forced open on error, restore defaults
  - size lg

### s3-calculator-shell (L)
- Goal: one calculator page, share removed, one calculator registry.
- Owns:
  - lib/calculators/registry.ts (new)
  - components/calculators/shared/{CalculatorPage,ScenarioBanner}.tsx and components/calculators/shared/{useCalculatorBootstrap,useCalculatorValues}.ts (new)
  - components/ui/layouts/CalculatorLayout.tsx, components/ui/layouts/ResponsiveGrid.tsx
  - app/sitemap.ts, app/tools/page.tsx, app/not-found.tsx
  - app/layout.tsx (metadata: drop "shareable by URL")
  - app/page.tsx (calculator names and disclaimer via the registry only)
  - test/components/CalculatorLayout.test.tsx
  - test/components/calculators/{CalculatorPage,useCalculatorBootstrap,ScenarioBanner}.test.tsx, test/lib/calculators/registry.test.ts (new)
- Depends on: f0, f1, f2, f5, s1, s2.
- Contract: sections 2.8 and 2.9. CalculatorLayout keeps `onShare` in its type as ignored and @deprecated, keeps the deprecated SimpleCalculatorLayout and AdvancedCalculatorLayout wrappers, and deletes ComparisonCalculatorLayout.
- Tests (with a fake definition):
  - from=profile strips and sets arrivedFromProfile
  - a legacy hash creates a scenario, strips the hash and shows the banner; keep and discard
  - no hash reads the profile
  - edits write through and mark provided
  - results skeleton until hydrated
  - liveResults hides the desktop Calculate card
  - CalculatorLayout still asserts aria-controls
  - the empty-state copy test is updated
  - registry metadata matches each page

### w1-intake-on-forms (L)
- Goal: the wizard runs FormSpecs. Behaviour is preserved: the provisional forms equal today's question sets.
- Owns:
  - lib/fields/shared.ts (new), lib/calculators/forms.ts (new)
  - provisional lib/calculators/{paycheck,retirement,portfolio,leverage}/form.ts (new)
  - stub components/calculators/renderers/{index.ts,paycheck.tsx,retirement.tsx,portfolio.tsx,leverage.tsx} (new; each `export const <ID>_RENDERERS: CustomRenderers = {}`)
  - lib/constants/intake.ts (after f5)
  - components/guided/{Wizard,CoreSummary,LearnChooser,NextSteps,ContinueProfileCard}.tsx
  - components/guided/WizardStep.tsx (delete)
  - app/start/[intent]/page.tsx (metadata copy)
  - test/lib/constants/intake.test.ts, test/lib/calculators/forms.test.ts (new)
  - test/components/guided/{Wizard,LearnChooser,EntryPoints}.test.tsx, test/components/NextSteps.test.tsx
- Depends on: f0, f1, f4, f5, s2.
- Contract:
  - shared specs and CORE_SCREENS / PROFILE_EXTRA_SCREENS (section 2.4)
  - `FORMS`, `CORE_FORM`, `PROFILE_FORM`, `formForFlow(flow)`, `fieldRegistry()`, `profileCompleteness(profile)` (by topic)
  - intake.ts keeps its public names: IntakeIntent, INTAKE_INTENTS, isIntakeIntent, INTENT_OPTIONS, LEARN_OPTIONS, getLearnOption, getIntentOption, IntakeFlow, isIntakeFlow, CORE_START_PATH, LEARN_CHOOSER_PATH, coreStartLink, coreDestination, CORE_PATHS, isCoreComplete, isProfileFinished, remainingIntakeScreens, coreSummary
  - INTAKE_QUESTIONS, INTAKE_SCREENS, the option arrays, INTAKE_RELATIONS and validateIntakeScreen are replaced by `getIntakeScreens(flow, get, opts): ScreenSpec[]`, `validateIntakeScreen(flow, screen, get): FieldErrors` and `buildIntakeSubmission(flow, values, providedPaths, alreadyProvided): { writes: Write[]; providedPaths: string[] }`
  - The Wizard writes with setValues and navigates to `calculatorHref(id, { fromProfile: true })` once a calculator's slice lands; until then it uses the f5 link builders.
- Tests:
  - Intake counts are recomputed from FORMS, not pinned (today's 14, 13 and 11 still hold with the provisional forms).
  - Wizard mechanics through an injected fixture form: advance, skip, skip the rest, Back, focus, Enter, errors inline.
  - PROFILE_FORM dedupe rules.
  - Completeness by topic.
  - Every intent finishes on its calculator path.
  - Calculator-specific flows are pinned in each calculator slice's own Wizard<Calc>.test.tsx, so they do not collide here.

### c1-retirement-inputs (L)
- Goal: retirement reads and writes the profile, asks every field, and runs on the factory and worker runner.
- Owns:
  - lib/calculators/retirement/{fields,bindings,definition,legacy}.ts (new)
  - lib/calculators/retirement/form.ts (after w1)
  - components/calculators/renderers/retirement.tsx (after w1)
  - lib/store/retirementStore.ts (rewritten: createCalculatorStore plus the createWorkerRunner thunk)
  - lib/workers/retirementWorker.ts (exposeCalculation)
  - app/tools/retirement-calculator/page.tsx (calculatorMetadata)
  - app/tools/retirement-calculator/components/RetirementCalculator.tsx
  - app/tools/retirement-calculator/components/InputSection.tsx (delete)
  - app/tools/retirement-calculator/components/{ResultsSection,MonteCarloChart}.tsx (data wiring only: props plus useDollarDisplay instead of store reads)
  - components/retirement/RiskProfileSelector.tsx (delete; not in /demo)
  - test/lib/calculators/retirement/{form,bindings,legacy}.test.ts (new)
  - test/lib/store/retirementStore.test.ts
  - test/components/guided/WizardRetirement.test.tsx, test/components/RetirementCalculator.test.tsx (new)
- Depends on: f6, s1, s2, s3, w1.
- Contract: `RETIREMENT_CALCULATOR: CalculatorDefinition<RetirementInputs, RetirementResults>`, `RETIREMENT_FORM`, `RETIREMENT_BINDINGS`, `RETIREMENT_ENGINE_ONLY`, `useRetirementStore: CalculatorStore<RetirementInputs, RetirementResults>`, `ResultsSection({ results, inputs, stale })`. legacy decodes the hash through decodeRetirementFromUrlHash; storageKey is 'retirement-calculator', with frozen old store defaults.
- Tests:
  - Golden: engineInputsFor equals toRetirementInputs for v1-shaped profiles. The only difference is lifeExpectancy, SS and healthcare read from the profile, and their defaults are equal.
  - Every RetirementInputs leaf is bound or engine-only.
  - Accumulation, retirement and volatility are hidden under tdf.
  - effectiveTaxRate auto/override.
  - Wizard retirement asks 4 screens and lands on the path with from=profile.
  - Legacy hash renders the scenario banner.
  - Legacy storage imports.
  - retirement.test.ts is untouched.
- Removes: handleShare, generateShareUrl, hash writes, toggleAdvanced/activeSection, isClient guard, QUICK/DETAIL/ASSUMPTION_FIELDS, the D10/D11/D12 copies, the `?? 7500` and `?? 0.15` literals.

### c2-retirement-results (M)
- Goal: retirement results on the shared vocabulary; chart math moves to lib.
- Owns:
  - app/tools/retirement-calculator/components/{ResultsSection,MonteCarloChart,SavingsRateChart}.tsx (after c1)
  - lib/calculators/retirement/headline.ts (new)
  - lib/calculations/savingsRate.ts (new; the PMT logic from SavingsRateChart.tsx:79-134, verbatim semantics)
  - test/lib/calculations/savingsRate.test.ts (new; hand-computed values, at least 80/65)
  - test/lib/calculators/retirement/headline.test.ts, test/components/RetirementResults.test.tsx (new)
- Depends on: c1, f1, f2, f3.
- Contract: `retirementHeadline(results, inputs): StatSpec[]` (success probability, projected and required balance, initial withdrawal rate) and `requiredSavingsCurve(...)`, with the signature taken from the extracted code.
- Tests: headline values; savingsRate parity with the old in-component numbers for 3 fixtures; charts render in ChartFrame with captions from useDollarDisplay.
- Removes: the local formatAxisCurrency, the theme MutationObserver copies, the success/withdrawal two-vocabulary mapping.

### c3-paycheck-inputs (XL)
- Goal: the paycheck allocator reads and writes the profile and asks all 40 fields plus the surfaced hidden ones.
- Owns:
  - lib/calculators/paycheck/{fields,bindings,definition,legacy}.ts (new)
  - lib/calculators/paycheck/form.ts (after w1)
  - components/calculators/renderers/paycheck.tsx (after w1: debtRate, debtTotals)
  - lib/store/paycheckStore.ts (new)
  - lib/store/calculatorStore.ts (delete)
  - components/paycheck-allocator/PaycheckAllocator.tsx
  - components/paycheck-allocator/InputSection.tsx (delete)
  - components/paycheck-allocator/inputs/{Income,Expenses,Savings,Tax,Benefits,AdvancedSettings,Debts}*.tsx (delete all 7)
  - components/paycheck-allocator/ResultsSection.tsx (data wiring only)
  - components/shared/inputs/{DebtInput,PercentageSlider}.tsx (delete; neither is in /demo)
  - app/tools/paycheck-allocator/page.tsx
  - test/components/TaxInputCard.test.tsx (delete; replaced by form tests)
  - test/lib/calculators/paycheck/{form,bindings,legacy}.test.ts, test/lib/store/paycheckStore.test.ts, test/components/PaycheckAllocator.test.tsx, test/components/guided/WizardPaycheck.test.tsx (new)
- Depends on: f6, s1, s2, s3, w1.
- Contract: `PAYCHECK_CALCULATOR: CalculatorDefinition<PaycheckProfile, AllocationResult>`, `PAYCHECK_FORM`, `PAYCHECK_BINDINGS`, `PAYCHECK_ENGINE_ONLY`, `usePaycheckStore`, `ResultsSection({ result, inputs, stale })`. legacy decodes through decodeFromUrlHash; storageKey is 'paycheck-allocator-storage', with frozen getDefaultProfile values.
- Tests:
  - Golden: engineInputsFor equals toPaycheckProfile for v1-shaped profiles, with metadata excluded.
  - The 401(k) derivation table.
  - Every PaycheckProfile leaf is bound or engine-only.
  - federalBracket stays 0.22 unless O9 says otherwise.
  - Relations: net <= gross, fun min <= max.
  - Wizard paycheck asks 7 screens (debts list included per O4).
  - Reload after a handoff keeps edits (bug 1 regression test).
  - The tax card copy no longer claims automatic brackets.
  - core.test, optimization.test and paycheck-invariants.test are untouched.
- Removes: the 300 ms delay, the setTimeout auto-calculate, the 4 section updaters, 9 lastUpdated stamps, exportData/importData, the unused selectors, the second loadFromUrl in ResultsSection, handleShare, the duplicate emptyStateConfig.

### c4-paycheck-results (L)
- Goal: paycheck results on the shared vocabulary; limit math is shared.
- Owns:
  - components/paycheck-allocator/{ResultsSection,PaycheckSummaryBox,PaycheckBreakdown,FinancialStepCard,QuickActions,PayrollSetupGuide,StepProgressBar}.tsx (ResultsSection after c3; StepProgressBar keeps its props for the dashboard)
  - lib/calculations/contributionLimits.ts (new)
  - lib/calculations/paycheckSummary.ts (new)
  - lib/utils/stepStatusUtils.ts (uses contributionLimits; outputs unchanged)
  - lib/calculators/paycheck/headline.ts (new)
  - test/components/{QuickActions,PaycheckSummaryBox}.test.tsx (rewrite the class-pinned assertions to roles and dt/dd)
  - test/lib/calculations/{contributionLimits,paycheckSummary}.test.ts, test/lib/calculators/paycheck/headline.test.ts, test/components/PaycheckResults.test.tsx (new)
- Depends on: c3, f1, f2.
- Contract: `contributionLimits` exports `limit401k(age)`, `limitIra(age)`, `limitHsa(coverage, age)` and `HIGH_INTEREST_THRESHOLD` (values equal to optimization.ts, pinned by a parity test). `paycheckSummary(result, inputs)` returns `{ residualTaxes, effectiveRate, match }`. `paycheckHeadline(result, inputs): StatSpec[]`.
- Tests:
  - stepStatusUtils.test.ts (1,128 lines) passes unchanged.
  - The HSA 55+ catch-up shows in FinancialStepCard (bug 4).
  - QuickActions output is unchanged for its fixtures plus 8 golden profiles. Deriving actions from calculateStepStatus is allowed only if this golden table stays identical.
- Removes: 6 frequency-label copies, 4 limit re-implementations, tone maps, the ActionCard defined inside render, 3 unused PaycheckBreakdown props.

### c5-portfolio-inputs (L)
- Goal: the rebalancer reads and writes the profile lists and asks everything; the hash stops being its persistence.
- Owns:
  - lib/calculators/portfolio/{fields,bindings,definition,reducers,legacy}.ts (new)
  - lib/calculators/portfolio/form.ts (after w1)
  - components/calculators/renderers/portfolio.tsx (after w1: holdings, classTargets)
  - lib/store/portfolioRebalancingStore.ts (rewritten)
  - app/tools/portfolio-rebalancing-calculator/page.tsx
  - app/tools/portfolio-rebalancing-calculator/components/{PortfolioRebalancingCalculator,AccountSection,HoldingRow,TargetsCard}.tsx
  - app/tools/portfolio-rebalancing-calculator/components/{AccountsCard,SettingsCard}.tsx (delete)
  - app/tools/portfolio-rebalancing-calculator/components/{RebalanceResults,PlacementAdviceCard}.tsx (data wiring only)
  - test/lib/calculators/portfolio/{reducers,form,bindings,legacy}.test.ts (new)
  - test/lib/store/portfolioRebalancingStore.test.ts (CRUD tests move to reducers.test, about 26 tests almost verbatim)
  - test/components/{PortfolioRebalancingCalculator,HoldingRow}.test.tsx
  - test/components/guided/WizardPortfolio.test.tsx (new)
- Depends on: f6, s1, s2, s3, w1.
- Contract:
  - `PORTFOLIO_CALCULATOR: CalculatorDefinition<RebalanceInputsV2, RebalanceResultV2>`, `PORTFOLIO_FORM`, `PORTFOLIO_BINDINGS`, `usePortfolioRebalancingStore`
  - reducers: addAccount, removeAccount, updateAccount, addHolding, removeHolding, updateHolding, linkHoldingToSecurity, linkHoldingByTicker, updateSecurity, addSecurity (returns [portfolio, id]), setClassTarget, removeClassTarget, addCustomAssetClass (returns [portfolio, id]), removeCustomAssetClass, pruneUnusedSecurities
  - HoldingRow keeps its current props, plus optional `classTargets` and `customAssetClasses`
  - customAssetClasses is required in the normalized shape, which deletes the 7 `?? []` guards
- Tests:
  - Reducers keep their existing assertions.
  - Golden: engineInputsFor equals toRebalanceInputs for the default profile.
  - A non-Latin-1 account name persists across a remount (bug 2).
  - Test ids are preserved.
  - Wizard portfolio asks 4 screens (no core gate per O5).
  - A legacy v1/v2/v3 hash renders the scenario banner.
  - The share-round-trip and "reloads its own share link" tests are deleted.
  - portfolioRebalancing.test.ts is untouched.

### c6-portfolio-results (M)
- Goal: rebalancer results on DataTable and StatGrid.
- Owns:
  - app/tools/portfolio-rebalancing-calculator/components/{RebalanceResults,PlacementAdviceCard}.tsx (after c5)
  - lib/calculators/portfolio/headline.ts (new)
  - test/components/RebalanceResults.test.tsx, test/lib/calculators/portfolio/headline.test.ts (new)
- Depends on: c5, f1, f2.
- Contract: `portfolioHeadline(result, inputs): StatSpec[]` (drift before and after, cash used).
- Tests: tables have a caption and scope; values are unchanged.
- Removes: the dead classDrift/showDrift path, the duplicate ACCOUNT_TYPE_LABELS, the hand-rolled alert, the local formatShares/formatPercentPoints.

### c7-leverage (L)
- Goal: leverage on the factory store and the profile, asking all 9 fields.
- Owns:
  - lib/calculators/leverage/{fields,bindings,definition,legacy,headline}.ts (new)
  - lib/calculators/leverage/form.ts (after w1)
  - components/calculators/renderers/leverage.tsx (after w1)
  - lib/store/leverageStore.ts (new)
  - app/tools/leverage-comparison/page.tsx (the Suspense goes once useSearchParams is gone)
  - app/tools/leverage-comparison/components/{LeverageComparison,LeverageResults,DcaPathChart}.tsx
  - app/tools/leverage-comparison/components/{LeverageInputs,ComparisonTable,format,queryParams}.ts(x) (delete)
  - test/components/LeverageResults.test.tsx
  - test/lib/calculators/leverage/{form,bindings,legacy,headline}.test.ts, test/lib/store/leverageStore.test.ts, test/components/guided/WizardLeverage.test.tsx (new)
- Depends on: f1, f2, f3, s1, s2, s3, w1.
- Contract: `LEVERAGE_CALCULATOR: CalculatorDefinition<DcaComparisonInputs, DcaComparisonResult>`, `useLeverageStore`, `leverageHeadline(result, inputs): StatSpec[]`. The sentence builders move to lib/calculators/leverage/headline.ts (or narrative.ts) with their behaviour unchanged. `validateDcaComparisonInputs` lives in definition.ts.
- Tests:
  - Golden: engineInputsFor equals inputsFromQuery(leverageLink(profile)) for v1-shaped profiles.
  - A legacy c/y/b/l query renders the scenario banner.
  - L9 survives a reload (bug 5).
  - The LeverageResults tests keep their behaviour assertions (import paths change).
  - leverageComparison.test.ts is untouched.

### d1-dashboard (M)
- Goal: the dashboard on the shared vocabulary and the headline functions; its derivations get covered.
- Owns:
  - components/dashboard/*.tsx
  - components/dashboard/cardLayout.ts (delete; its padding moves to the new components/ui/cards/density.ts, `DENSE_CARD_CLASSES`)
  - components/ui/cards/density.ts (new)
  - components/dashboard/derive.ts (move to lib/dashboard/derive.ts)
  - lib/dashboard/derive.ts (new)
  - app/overview/page.tsx
  - test/lib/dashboard/derive.test.ts (new; written before the move so the lib/** coverage floor holds)
  - test/components/dashboard/*.test.tsx (new, a few)
- Depends on: w1, c2, c4, c6, c7.
- Contract: no new exports for others. Cards use engineInputsFor plus headline(), StatGrid, KeyValueList, DataTable, ProgressBar, SegmentedControl (StrategyToggle) and calculatorHref(id, { fromProfile: true }). ProfileCompletenessCard uses forms.profileCompleteness.
- Tests: derive.ts coverage at least 80%; LeverageCard and LeverageResults show the same formatted median; the cash-drag return uses one constant (O16).

### x1-dead-code-cleanup (L)
- Goal: delete everything the migration left dead (non-demo).
- Owns:
  - lib/profile/{types,defaults,mappers,links,index}.ts (after f5): drop investing.newCashThisMonth, PROFILE_FIELDS, the old profileCompleteness and the mappers (replaced by engineInputsFor); links become `calculatorHref` re-exports with no hashes
  - lib/store/profileStore.ts: drop setFields if unused
  - lib/utils/{index,retirementState,portfolioRebalancingState,paycheckState}.ts (after f6): delete encoders, debounce, generateId, loadRetirementFromUrl, updateRetirementUrlHash, the v1 rebalancing encoder (it moves to test/utils/hashFixtures.ts); decoders stay
  - lib/calculations/core.ts: formatCurrency/formatPercent become re-exports of lib/format with byte-identical output, so core.test.ts:806-826 passes unchanged
  - lib/types/index.ts (CalculatorState, FormErrors, ExportableData), lib/design-system/types.ts (CommonProps, FormatOptions, LoadingProps, URLSerializableInputs)
  - components/shared/layout/{FieldGroup,InputRow}.tsx (delete; unused after c1)
  - lib/constants/intake.ts (after w1): drop the remaining legacy helpers
  - components/guided/NextSteps.tsx (after w1): use `DENSE_CARD_CLASSES` from d1 in place of the copied padding
  - test/lib/profile/{links,mappers}.test.ts (rewrite or delete)
  - test/lib/utils/*State.test.ts (drop encoder round trips)
  - test/lib/calculators/integrity.test.ts (new)
  - redundant `afterEach(cleanup)` lines and per-file matcher imports in test files whose owners have merged
- Depends on: d1 (and therefore everything in phases 0-3).
- Contract: no new exports.
- Tests (integrity.test.ts):
  - every FieldSpec.path is a profile path
  - every profile leaf and list (except version, updatedAt and provided) has at least one FieldSpec or a custom-renderer `covers` entry, which is the "no fields without an input" guarantee
  - every engine leaf is bound or in ENGINE_ONLY
  - no FieldSpec is defined twice

### x2-demo-and-docs (L)
- Goal: /demo parity and documentation that matches the code.
- Owns:
  - app/demo/DemoClient.tsx (optionally split into app/demo/sections/*.tsx)
  - lib/demo/mockChartData.ts (trim to what the demo uses)
  - components/ui/cards/BaseCard.tsx and components/ui/cards/index.ts (delete SummaryCard, the unused elevated/lg variants and the `change` prop)
  - components/ui/layouts/CalculatorLayout.tsx (after s3: delete the deprecated wrappers and the onShare type)
  - components/shared/Tooltip.tsx, components/calculators/shared/CalculatorTabs.tsx, components/guided/{IntentPicker.tsx,index.ts} (delete per O13)
  - components/calculators/shared/{StatusAlert,BreakdownRow}.tsx (after f2: drop the `variant` alias)
  - CLAUDE.md (layout tree, component hierarchy, no URL-hash sharing)
  - README.md, docs/architecture.md, docs/redesign-guided-flow.md (2.1, 2.3, 2.4, 3.4, 9.1), docs/agents/code-patterns.md (if it shows the old patterns)
  - package.json ("description": drop "scenarios share via URL hash")
  - test/components/CalculatorLayout.test.tsx (variant tests)
- Depends on: x1.
- Contract: /demo shows FieldInput (every kind), FieldSection, FieldList, ChoiceGroup, Checkbox, SliderField, NullableField, StatTile/StatGrid, KeyValueList, DataTable, ChartFrame (using a production chart with fixture data in place of the 271 lines of mock charts), SegmentedControl, ProgressBar, StatusAlert tones, ScenarioBanner and HoldingRow, all in light and dark mode.
- Tests: suite green; lint clean with no deprecated exports left.

### z1-delete-legacy-decoders (S, later; not part of this run)
After the deprecation window (O6):

- delete lib/calculators/*/legacy.ts, the decoders, lib/utils/hashCodec.ts and their tests
- delete step 2 of useCalculatorBootstrap, ScenarioBanner and the legacyImport module
- the mount order becomes profile > defaults

--------------------------------------------------------------------------------

## 4. Hand-offs and shared-file notes

| File | First owner | Later owner | Why |
|---|---|---|---|
| lib/constants/intake.ts | f5 (FILING_SUMMARY compile fix) | w1 (rewrite), then x1 (remove leftovers) | widened filing status breaks a typed Record |
| lib/calculators/<id>/form.ts | w1 (provisional = today's questions) | c1 / c3 / c5 / c7 | each calculator expands its own intent in the slice that makes the calculator read those fields |
| components/calculators/renderers/<id>.tsx | w1 (empty stub) | c1 / c3 / c5 / c7 | the wizard needs per-calculator custom renderers without a shared registry edit |
| app/tools/retirement-calculator/components/{ResultsSection,MonteCarloChart}.tsx | c1 (data wiring) | c2 (vocabulary) | the store shape changes in c1 |
| components/paycheck-allocator/ResultsSection.tsx | c3 (data wiring) | c4 | same |
| app/tools/portfolio-rebalancing-calculator/components/{RebalanceResults,PlacementAdviceCard}.tsx | c5 (data wiring) | c6 | same |
| lib/profile/*, lib/store/profileStore.ts | f5 | x1 | deprecated exports are kept until every consumer moves |
| lib/utils/{index,retirementState,portfolioRebalancingState,paycheckState}.ts | f6 | x1 | encoders survive until links stop using them |
| components/ui/layouts/CalculatorLayout.tsx | s3 | x2 | /demo imports the deprecated wrappers |
| components/calculators/shared/{StatusAlert,BreakdownRow}.tsx | f2 | x2 | the `variant` alias stays until no caller uses it |
| app/demo/DemoClient.tsx | x2 only | n/a | single owner; earlier slices keep demoed props stable (HoldingRow, DollarModeToggle, OptionCard, NextSteps, CoreSummary, LookupHint, StateSelector, SelectInput, inputs) |
| components/paycheck-allocator/StepProgressBar.tsx | c4 | n/a | the dashboard imports it; props stay stable |
| components/guided/NextSteps.tsx | w1 | x1 | x1 swaps the copied card padding for d1's DENSE_CARD_CLASSES |

--------------------------------------------------------------------------------

## 5. Verification gates and test strategy

- **Numerics.** No test under test/lib/calculations/** changes, except for new files. Every calculator slice adds a golden test: the old mapper or codec output equals `engineInputsFor(def, profile)`, with documented exceptions. Engines are unchanged, so equal inputs prove equal numbers.
- **Coverage.**
  - New lib modules carry their own tests: lib/fields at least 90%, lib/calculators at least 80%, the store factory at least 85%, and new lib/calculations files at least 80% statements and 65% branches.
  - d1 adds derive tests before the move, because derive.ts enters the measured lib/** surface.
  - Global stays at 55% statements or above. Check `npm run test:coverage` in every slice.
- **Lint.** Zero warnings. Deprecated-but-kept exports must not create unused variables: keep `onShare` in the type but do not destructure it.
- **Hydration.** Calculator pages render inputs from the default profile on the server and in the hydration pass (zustand getInitialState). Results wait for hasHydrated. A test asserts no results before hydration.
- **Behaviour regressions with tests:**
  - bug 1 (c3)
  - bug 2 (c5)
  - bug 3 (f6)
  - bug 4 (c4)
  - bug 5 (c7)
  - wizard routes and NextSteps hrefs (w1 and each Wizard<Calc>.test.tsx)
- **Manual pass before main** (run skill or dev server): each intent end to end on a phone viewport, light and dark; a legacy link per calculator; a reload after edits; v1 localStorage fixtures pasted into devtools.

--------------------------------------------------------------------------------

## 6. Risks and mitigations

1. **Paycheck nested PaycheckProfile versus flat profile paths.**
   - Risk: bindings mis-map a nested leaf, or forget a derived legacy income field, and allocations shift silently.
   - Mitigation: a golden test (engineInputsFor == toPaycheckProfile for v1-shaped data) and a leaf-enumeration test (every PaycheckProfile leaf is bound or ENGINE_ONLY with a reason). updateLegacyIncomeFields is applied in one derived binding. The 401(k) coupling has a truth table.
2. **Persisted localStorage from earlier versions and previews.**
   - Data at risk: 'bufo-profile' v1, 'retirement-calculator' v3 (inputs, hasCalculatedOnce, showAdvanced, displayMode), 'paycheck-allocator-storage' (unversioned), and rebalancer state that lives only in old hashes.
   - Mitigation: profile migrate v1 -> v2 with real-payload fixtures. A one-shot, idempotent legacy import that never overrides provided answers and removes the key afterwards (O7 can switch it to discard). Old rebalancer hashes go through the legacy decoder and scenario banner. normalizeProfile drops unknown keys, so later leaf deletions need no version bump.
3. **Rebalancer list editing is relational** (holdings point to shared securities; tickers link or create).
   - Mitigation: the reducers move verbatim with their roughly 26 tests. Holdings and class targets stay custom renderers. Only accounts use the generic FieldList, with removeRow cascading through reducers. Ids are kept stable, and the `testId` pattern preserves `account-name-{i}` and `holding-price-{i}`.
4. **Test churn.**
   - Scale: about 1,000 lines of store, codec and share tests deleted or rewritten; Wizard and intake tests restructured.
   - Mitigation:
     - f0 lands the helpers first.
     - w1 tests mechanics against a fixture form, and each calculator pins its own flow in its own file, so parallel calculator slices never edit the same test.
     - Class-pinned tests (QuickActions, CalculatorLayout, PaycheckSummaryBox) are rewritten to roles and dt/dd in the slices that own those components.
5. **Write-through semantics (O1).**
   - Risk: a what-if edit on a calculator changes the dashboard and the other calculators.
   - Mitigation: retirement keeps its scenario comparison. Assumption sections have "Restore defaults", which writes the defaults and un-provides the paths. The ScenarioBanner pattern also exists for links. If O1 goes the other way, only useCalculatorValues changes: it would write to an in-memory scenario seeded from the profile, plus an explicit "Save to my profile".
6. **localStorage write on every keystroke** (persist writes synchronously).
   - The profile JSON is a few KB, so this is acceptable. If profiling shows jank on low-end phones, s3's write path can debounce setValues by 150 ms, with a flush on blur and on pagehide, without any API change.
7. **SSR and hydration.**
   - Risk: calculators now depend on the profile store.
   - Mitigation: render from defaults during the hydration pass, gate results on hasHydrated, and have a test assert there is no mismatch. The bootstrap reads window only inside an effect. Leverage loses useSearchParams, and with it its Suspense boundary.
8. **Worker bundling under Turbopack.**
   - Risk: the literal `new Worker(new URL(...))` has to stay in lib/store/retirementStore.ts.
   - Mitigation: createWorkerRunner takes a `create` thunk. The build job (CI) verifies it. This analysis did not run a build, because another audit is using .next.
9. **Interim states across slices.**
   - Mitigation: from f5 onward, every wizard and dashboard link carries `?from=profile`. Unmigrated calculators ignore it and keep decoding the hash. Migrated ones ignore the hash and read the profile. Deprecated exports and props keep /demo and the shells compiling until x2. Slices merge to an integration branch.
10. **Longer intake** (paycheck goes from 3 screens to 7 after the core).
    - Risk: more abandonment.
    - Mitigation: topic screens prefilled with typical values; "Skip, use a typical value" and "Skip the rest" on every intent; progress dots per topic; LookupHints in the wizard; the 'remaining' mode skip for fully answered topics (O2, O3).
11. **Profile completeness counts change** (25 leaves become about 16-18 topics).
    - Mitigation: count by topic (O14). Tests compute expected values from FORMS instead of pinning numbers.
12. **Filing status widening.**
    - Risk: retirement models only single and joint.
    - Mitigation: an explicit mapping in one binding, a visible note on the retirement page, and a golden test (O10).
13. **Behaviour changes that look like calculation changes** (federal bracket, live recalculation, stale-results policy).
    - Mitigation: defaults preserve today's numbers (0.22 stays unless O9). Each change is listed in the slice's PR description with before and after values.
14. **Accessibility regressions when cards become generated sections.**
    - Mitigation: s2 tests accessible names and label association for every kind. FieldList fixes the unlinked hand-drawn labels in DebtInput. ProgressBar and DataTable add the missing roles, captions and scope.
15. **Scope creep into lib/calculations** (unused insight modules, the duplicate cash-drag constant, the validateProfile wiring).
    - Mitigation: out of scope by constraint. Listed as O13, O16 and O18 for follow-ups.

--------------------------------------------------------------------------------

## 7. Decisions the owner must make

The plan's default is in brackets.

- **O1. Write-through.** Should calculator edits update the shared profile, and so the dashboard and other calculators? [Yes, write-through: one record, per design 9.1.] The alternative keeps calculators as sandboxes seeded from the profile, with "Save to my profile". This reverses the design doc 2.1 rule "The calculators do not write back to the profile".
- **O2. "At once" means topic screens** (a few related fields per screen; paycheck 7, retirement 4, portfolio 4, leverage 2 after the core). [Topic screens.] The alternative is one long scrolling form per calculator, which FieldSections can render with no schema change.
- **O3. Assumption screens in the intake.** [Yes, as the last screen of each intent, prefilled, skippable with "Keep the default assumptions".] The alternative shows them only on the calculator page.
- **O4. Paycheck debts list in the intake.** [Yes, with a one-tap "I have no debts" that confirms an empty list.]
- **O5. Rebalancer and the core gate.** The rebalancer uses none of the 7 core fields. [Ask its holdings in the intake, and skip the /start gate for /start/portfolio.] Design 2.1 says every path goes through /start; the owner picks one.
- **O6. Legacy links during the window.** [hash > profile > defaults, with an in-memory scenario banner; decoders kept for 90 days after release, then z1.] The alternative is to drop legacy links now and delete the decoders immediately.
- **O7. Old calculator localStorage.** ['retirement-calculator' and 'paycheck-allocator-storage' imported once into the profile: non-default values only, never over provided answers.] The alternative discards them.
- **O8. Live recalculation everywhere, and the desktop Calculate button removed** (the mobile bar keeps "See results"). [Yes.]
- **O9. Paycheck federal bracket.** [Keep the fixed 22% and correct the copy that claims automatic brackets.] The alternative derives the marginal bracket from annual gross minus the standard deduction with the 2026 brackets, which changes most users' results.
- **O10. Filing status.** [Widen the profile to 4 values. Retirement maps head-of-household and married-separate to single, with a visible note.]
- **O11. Retirement income entry.** [Drop the hourly and yearly periods; retirement uses the shared gross-per-paycheck and frequency fields.] The alternative keeps an annual-salary entry as a display unit.
- **O12. Hidden engine inputs.**
  - [Surface: after-tax 401(k), HSA employer contribution, IRA balances, debt tax-deductible, expected retirement bracket.]
  - [Keep engine-internal: withholding and isPeakEarnings.]
- **O13. Deletions beyond the four calculators:**
  - /demo-only components: Tooltip and HELP_TOOLTIPS, CalculatorTabs, IntentPicker, the guided barrel, SummaryCard, Simple/AdvancedCalculatorLayout, the mock chart showcase. [Delete, and show the new primitives instead.]
  - The unused retirement insight modules (coastFire, inflationAdjustment, most of scenarioAnalysis: about 950 production and 700 test lines). [Out of scope here; separate follow-up.]
- **O14. Profile completeness** counted by topic screen. [Yes.] The alternative counts leaves.
- **O15. One display-mode preference** across paycheck and retirement. [Yes.] The alternative is per calculator.
- **O16. Cash-drag return.** The allocator uses 7% and the dashboard uses 8%. [The dashboard uses one constant equal to the allocator's 7%; analysis.ts is untouched.]
- **O17. Results while inputs are invalid.** [Keep the last results visible, marked stale.] The alternative clears them.
- **O18. validateProfile** (paycheck, never wired). [Leave it unwired; its rules live as field bounds and relations.] The alternative wires it, which is a behaviour change.
- **O19. One state picker.** [StateSelector combobox in both the wizard and the calculators.] The alternative is a native select everywhere.
- **O20. CLAUDE.md and the design doc are updated in x2** to describe the new structure and the end of URL sharing. [Yes; the owner reviews those edits.]

--------------------------------------------------------------------------------

## 8. Deletion inventory (what goes, and in which slice)

- **Share** (about 250 lines):
  - in the calculator slices: the handleShare handlers at PaycheckAllocator.tsx:31-58, RetirementCalculator.tsx:33-60 and LeverageComparison.tsx:59-82; generateShareUrl at calculatorStore.ts:220-232 and retirementStore.ts:372-382; every hash write
  - in s3: the layout share UI
  - in x2: the onShare type
- **Stores** (c1, c3, c5): loadFromUrl x3, run/drop-stale/apply x3, the memo check x3, the toErrorMap and errorMap conversions, the debounce timers, the paycheck section updaters and lastUpdated stamps, the dead selectors, exportData/importData, activeSection, toggleAdvanced/setShowAdvanced, the persisted hasCalculatedOnce, displayMode in the stores.
- **Codecs:**
  - f6: base64url x3, plus the console noise
  - x1: the encoders; updateRetirementUrlHash and loadRetirementFromUrl; the v1 rebalancing encoder (moves to fixtures)
  - z1: the decoders
- **Defaults** (f5, c1, c3, c5, x1): the retirement copies at retirementStore.ts:170-193, retirementState.ts:110-181 (frozen into the legacy tables) and mappers.ts:73-92; the mirrored rebalancer example at mappers.ts:177-199; the paycheck codec defaults.
- **Inputs** (c1, c3, c5, c7):
  - retirement InputSection.tsx (581)
  - the paycheck inputs/* (892) and InputSection (57)
  - DebtInput (209), PercentageSlider (109), DebtsInputCard (35)
  - SettingsCard (110), AccountsCard (40), most of AccountSection
  - LeverageInputs (190)
  - RiskProfileSelector (140)
  - FieldGroup and InputRow (x1)
- **Intake** (w1): INTAKE_QUESTIONS, INTAKE_SCREENS, the option arrays, INTAKE_RELATIONS, FILING_SUMMARY, FREQUENCY_SUMMARY, the duplicate age and invested questions, WizardStep (212; moved into FieldInput and ChoiceGroup).
- **Results** (c2, c4, c6, c7, d1, x2):
  - the duplicate formatters (x1 removes core.ts/utils copies via re-export)
  - leverage format.ts (45) and ComparisonTable (67)
  - formatAxisCurrency, the theme observer copies, the 6 frequency-label maps, the 4 limit re-implementations
  - SummaryCard, the BaseCard tone maps, cardLayout.ts, the dead classDrift path, the ActionCard-in-render
- **Layout** (s3, x2): ComparisonCalculatorLayout, then Simple/AdvancedCalculatorLayout, the duplicate ResponsiveGrid sections and maps, the identical emptyStateConfig copies, and the dead DisclaimerFooter default.
- **Dead API** (x1): lib/types CalculatorState/FormErrors/ExportableData; the design-system CommonProps/FormatOptions/LoadingProps/URLSerializableInputs; utils debounce/generateId; useInputState if still unused; the unused calculatorStore/retirementStore selector hooks (gone with the stores).
- **Tests:** the codec round trips (x1), the share round trips (c5), TaxInputCard.test (c3), the drift guards mappers.test.ts:283-300 and :422-437 (x1), and the dead test-factory helpers (f0).

--------------------------------------------------------------------------------

## 9. Deferred follow-ups (not in this run)

- z1: delete the legacy decoders after the window (O6).
- One creatable Combobox to replace StateSelector, TickerCombobox and AddAssetClassControl (about -350 lines).
- Delete the unused retirement insight modules, if the owner agrees (O13, second item).
- Design doc section 9 (encrypted accounts) builds on the single profile record this plan creates: every input lives in the profile, so the profile is the only record to sync.
