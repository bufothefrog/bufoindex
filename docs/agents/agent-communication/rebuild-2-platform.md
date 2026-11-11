# 2026-11-11 - rebuild phase 2: platform (s1, s2, s3, w1)

Branch `claude/rebuild-2-platform`. Plan: docs/rebuild-plan.md (section 0 wins). No calculator page,
store or component is rewired; lib/calculations and its tests are unchanged.

## Landed

| Slice | Commit subject |
|---|---|
| s1-run-store-factory | one run-store pattern and worker runner |
| s2-field-renderers | generic renderers for FieldSpec |
| s3-calculator-shell | one calculator page, one registry, share UI removed |
| w1-intake-on-forms | the wizard runs FormSpecs |

## Public API (names only)

- lib/calculators/types.ts: `CalculatorId`, `CalculatorMeta`, `CalculatorDefinition`, `LegacyStorage` (storage-only, no decode).
- lib/calculators/runtime.ts: `engineInputsFor`, `validateFor`, `prepareRun`, `PreparedRun`.
- lib/store/createCalculatorStore.ts: `createCalculatorStore`, `CalculatorStore`, `CalculatorRunState` (no scenario), `SubmitOptions`, `CreateCalculatorStoreOptions`.
- lib/store/preferencesStore.ts: `usePreferencesStore`, `PreferencesState`, `PREFERENCES_STORAGE_KEY` ('bufo-preferences'). lib/store/legacyImport.ts: `importLegacyCalculatorStorage`.
- lib/workers: `createWorkerRunner` (`WorkerRunner` with `prewarm`, `dispose`), `exposeCalculation`, `calculationErrorMessage`, request/response types.
- components/shared/useDollarDisplay.ts: `useDollarDisplay`, `DollarDisplay`, `DollarDisplayBasis`, `UseDollarDisplayOptions`.
- components/fields: `FieldInput`, `FieldSection`, `FieldSections`, `FieldList`, `ChoiceGroup`, `NullableField`, `SectionToggle`, `screenHasError`; types `CustomRenderer(s)`, `FieldInputProps`, `FieldSectionProps`, `FieldSectionsProps`, `FieldListProps`, `FieldSize`. components/ui: `Checkbox`, `SliderField`; input primitives and SelectInput take `size`.
- lib/calculators/registry.ts: `CALCULATORS`, `CALCULATOR_IDS`, `CalculatorEntry`, `CalculatorCard`, `SITE_DISCLAIMER`, `calculatorMeta`, `calculatorDisclaimer`, `calculatorMetadata`, `calculatorHref`.
- components/calculators/shared: `CalculatorPage` (default; `CalculatorPageProps`, `CalculatorResultsArgs`), `useCalculatorBootstrap` (`CalculatorBootstrap`), `useCalculatorValues` (`CalculatorValues`).
- components/ui/layouts/CalculatorLayout.tsx: adds `liveResults`, `resultsLabel`, `CalculatorEmptyState`, `CALCULATE_EMPTY_STATE`, `LIVE_EMPTY_STATE`; deprecated `onShare`, `ShareResult`, `ShareHandler`, `DisclaimerFooter` (= Disclaimer), Simple/AdvancedCalculatorLayout. ResponsiveGrid adds `MaxWidth`.
- lib/fields/shared.ts: `withOverrides`, `offeredWithSaved`, the shared specs (AGE ... STRATEGY_PRESET), `CORE_FIELDS`, `CORE_SCREENS`, `PROFILE_EXTRA_FIELDS`, `PROFILE_EXTRA_SCREENS`, `NET_PAY_AT_MOST_GROSS`, `RETIREMENT_AFTER_AGE`, `intakeDerivedWrites`.
- lib/calculators/forms.ts: `FORMS`, `CORE_FORM`, `PROFILE_FORM`, `PROFILE_FORM_ORDER`, `FormFlow`, `formForFlow`, `fieldRegistry`, `profileCompleteness` (by topic), `composeProfileForm`, `profileFormSection`, `PROFILE_FORM_SECTION_LABELS`. lib/calculators/<id>/form.ts: `<ID>_FORM` (provisional).
- components/calculators/renderers: `RENDERERS`, `ALL_RENDERERS`, `INTAKE_PREWARM`, `<ID>_RENDERERS` (empty), `RETIREMENT_INTAKE_PREWARM` (undefined).
- lib/constants/intake.ts: the public names the plan keeps, plus `getIntakeScreens`, `validateIntakeScreen`, `buildIntakeSubmission`, `intakeForm`, `skipLabelFor`, `KEEP_ASSUMPTIONS_LABEL`. Removed: INTAKE_QUESTIONS, INTAKE_SCREENS, INTAKE_SECTION_LABELS, the option arrays, INTAKE_RELATIONS, FILING_SUMMARY, FREQUENCY_SUMMARY.
- lib/constants/frequency.ts: PayFrequencyMeta gains `intakeOption` and `cadence` (the intake wording).

## Semantics later slices rely on

- Run store: validate (calculator-surface screens, then engine checks) -> memo by stableKey -> debounce (0 or `immediate` runs synchronously) -> run. Errors keep the last results with stale=true and drop pending runs; the newest run wins; a failed run reports under 'calculation'. Results always render from the inputs that produced them.
- engineErrorsToFields takes an optional Get and skips bindings that supplied no value, matching toEngineInputs.
- Bootstrap, once per mount after hydration: replaceState(pathname) when there is any query or hash (`arrivedFromProfile` only for from=profile; everything else dropped unread), then the legacy import when `def.legacy`, then an immediate submit, then ready. CalculatorPage shows results only when ready; before that a "Loading results" skeleton.
- CalculatorPage: `write` = setValues(writes) (marks provided, O1, no debounce). Every profile change resubmits. Stale results stay under a "Results out of date" status; a run error with no results shows a "Results unavailable" alert; field errors with no results show LIVE_EMPTY_STATE. `showResultsKey='profile'` after a handoff is the only automatic tab switch in live mode. Restore defaults on an assumption screen writes the default profile's values and unprovides those paths. `liveResultsLabel` names the results region.
- calculatorHref never adds a hash; fromProfile adds exactly `?from=profile`. calculatorMetadata = { title: shortTitle, description: metaDescription }; `title` is the H1.
- FieldSections defaults to surface 'calculator', collapses core screens once every visible field is in `provided`, and freezes collapse state on the first edit.
- Intake 'remaining' mode for an intent = its non-core screens minus every CORE_PATHS field, then screensFor remaining (a partly answered screen shows whole). 'all' mode keeps the form's core screens. The core flow always uses CORE_FORM.
- buildIntakeSubmission writes each provided path whole, drops unknown paths, then appends form.onSubmit; the Wizard calls setValues(writes, { provide }) so derived writes are never provided. Every form's onSubmit is intakeDerivedWrites (preset -> cash.targetMonths unless provided; retirementAge <= age -> age + 1); keep it or compose it.
- PROFILE_FORM: core, then retirement, paycheck, portfolio, leverage (skipping core, assumption and calculator-surface screens), then the profile extras; fields deduped by path (first wins), empty screens dropped, colliding ids prefixed `<formId>-`. Leverage screens sit in the 'portfolio' section.
- Skip label = screen.skipLabel ?? (assumption ? "Keep the default assumptions" : "Skip, use a typical value"). "Skip the rest" on every intent screen but the last; never in the core.
- A choice the intake offers only in part (filing status, target mix) also offers the saved value when it is one of the full set (offeredWithSaved), so it is shown chosen and kept.
- Wizard input ids are `intake-<profile path>`. The intake still writes investing.newCashThisMonth (mirrored into the Brokerage deposit); a provided new cash does not mark portfolio.accounts.

## What a visitor sees differently

- Calculator pages: the Share button, its feedback and the mobile Share icon are gone. Everything else is unchanged.
- Site metadata: "Client-side, shareable by URL." becomes "Client-side.".
- Wizard: the intent lead reads "Everything this calculator uses, a few related questions per screen."; the calculator intents' last line reads "... You can change any answer on the calculator."; /start/<intent> meta description says "A few related questions per screen, skipping what you have already answered".
- Wizard behaviour that follows from running FormSpecs (plan 2.10 and 2.12): a "Skip the rest" button; the state question is the StateSelector combobox at its normal height; bounds and option errors show inline; a partly answered screen shows whole; several broken relations on one screen join in one alert; a saved head-of-household or married-filing-separately status, or a saved custom mix, appears as an extra chosen option.

## Tests and coverage

- 77 files, 1755 tests passing. Global statements 91.06%.
- lib/calculations 97.30% statements / 89.70% branches (unchanged). lib/calculators 100%; lib/fields 100% statements; lib/store/createCalculatorStore.ts, legacyImport.ts and preferencesStore.ts 100%; lib/workers/createWorkerRunner.ts 100% statements; lib/constants/intake.ts 100% statements / 93% branches.

## Deviations from the plan

- `useCalculatorValues()` takes no arguments: with no scenario layer both parameters would be unused.
- Registry entries extend CalculatorMeta with `card` (the /tools copy); CALCULATOR_IDS, calculatorDisclaimer and SITE_DISCLAIMER are additions. The 404 page keeps its three links (no Leverage) so nothing visible changes.
- CalculatorLayout has no `notice` slot (section 0.1 item 4). With liveResults the desktop has no ErrorList; CalculatorPage shows `errors.calculation` itself.
- ShareResult and ShareHandler stay as deprecated types because unmigrated shells import them.
- The first submit happens inside the bootstrap, so the legacy import always lands first.
- s1: `SubmitOptions` and `prepareRun` are additions. s2: the input primitives take `size` (InputSize, with an xl step); FieldSize lg maps onto it for the wizard.
- w1: provisional forms keep today's wording, so filing status is two options (sentence-cased phrases), the strategy preset lists Standard first and the target mix leaves out custom unless saved. Calculator-only specs live in each form.ts; the split into fields.ts happens in the c slices. Wizard notes render as tinted StatusAlerts without FieldSection's note icons.

## Open for phase 3

- c1, c3, c5, c7: `export const metadata = calculatorMetadata('<id>')`; the shell becomes `<CalculatorPage definition store renderResults />` (retirement passes its methodology link as afterLayout); switch the Wizard CALCULATOR_LINKS entry to `calculatorHref(id, { fromProfile: true })` and delete the handleShare function and the codecs it no longer uses. Each slice grows its own form.ts (and keeps `onSubmit: intakeDerivedWrites` or composes it) and fills its renderers file.
- c1: set `RETIREMENT_INTAKE_PREWARM = () => retirementRunner.prewarm()` and export the runner from lib/store/retirementStore.ts.
- c1 and c3 decide whether the intake offers all four filing statuses; c5 decides on 'custom' in the intake and how a deposit counts as provided; c5 drops the portfolio core screens (O5).
- x1: lib/calculators/registry.ts imports the PATH and PROFILE_HANDOFF constants from lib/profile/links.ts; move them before links.ts re-exports calculatorHref, so the two never import each other.
- d1: OverviewDashboard imports Disclaimer from '@/components/ui/results' instead of DisclaimerFooter; NextSteps, ContinueProfileCard, LearnChooser and ProfileCompletenessCard move to forms.ts profileCompleteness (by topic) when their counts may change.
- x2: remove onShare, ShareResult, ShareHandler, DisclaimerFooter and the deprecated layout wrappers; add CalculatorPage, liveResults and the live empty state to /demo; consider exporting FieldSection's note rendering for the wizard.
