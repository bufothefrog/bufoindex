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

Review fixes landed after these as one `fix(rebuild): <slice>: ...` commit per slice (s1, s2, s3, w1, docs).

## Public API (names only)

- lib/calculators/types.ts: `CalculatorId`, `CalculatorMeta`, `CalculatorDefinition`, `LegacyStorage` (storage-only, no decode).
- lib/calculators/runtime.ts: `engineInputsFor`, `validateFor`, `prepareRun`, `PreparedRun`.
- lib/store/createCalculatorStore.ts: `createCalculatorStore`, `CalculatorStore`, `CalculatorRunState` (no scenario), `SubmitOptions`, `CreateCalculatorStoreOptions`.
- lib/store/preferencesStore.ts: `usePreferencesStore`, `PreferencesState`, `PREFERENCES_STORAGE_KEY` ('bufo-preferences'). lib/store/legacyImport.ts: `importLegacyCalculatorStorage`.
- lib/workers: `createWorkerRunner` (`WorkerRunner` with `prewarm`, `dispose`), `exposeCalculation`, `calculationErrorMessage`, request/response types.
- components/shared/useDollarDisplay.ts: `useDollarDisplay`, `DollarDisplay`, `DollarDisplayBasis`, `UseDollarDisplayOptions`.
- components/fields: `FieldInput`, `FieldSection`, `FieldSections`, `FieldList` (defined in FieldInput.tsx; FieldList.tsx holds `FieldListBase`, which takes the row renderer, so the two modules do not import each other), `ChoiceGroup`, `NullableField`, `ScreenNotes`, `SectionToggle` (gains `disabled`), `screenHasError`; types `CustomRenderer(s)`, `FieldInputProps`, `FieldSectionProps`, `FieldSectionsProps`, `FieldListProps`, `FieldSize`, `ScreenNotesProps`. components/ui: `Checkbox`, `SliderField`, `FieldMessages` and `fieldMessageIds` (components/ui/FieldMessages.tsx, moved from components/fields; BaseInput, Checkbox, SelectInput, StateSelector, SliderField, ChoiceGroup, FieldList and FieldInput use them); input primitives, SelectInput and StateSelector take `size`.
- lib/fields/runtime.ts: `fieldWrites(spec, value, get)` (the field's write, then its onChange writes, with a Get that sees the new value); FieldInput and the Wizard both use it.
- lib/calculators/registry.ts: `CALCULATORS`, `CALCULATOR_IDS`, `CalculatorEntry`, `CalculatorCard`, `SITE_DISCLAIMER`, `calculatorMeta`, `calculatorDisclaimer`, `calculatorMetadata`, `calculatorHref`.
- components/calculators/shared: `CalculatorPage` (default; `CalculatorPageProps`, `CalculatorResultsArgs`), `useCalculatorBootstrap` (`CalculatorBootstrap`), `useCalculatorValues` (`CalculatorValues`).
- components/ui/layouts/CalculatorLayout.tsx: adds `liveResults`, `resultsLabel`, `CalculatorEmptyState`, `CALCULATE_EMPTY_STATE`, `LIVE_EMPTY_STATE`; deprecated `onShare`, `ShareResult`, `ShareHandler`, `DisclaimerFooter` (= Disclaimer), Simple/AdvancedCalculatorLayout. ResponsiveGrid adds `MaxWidth`.
- lib/fields/shared.ts: `withOverrides`, `offeredWithSaved`, the shared specs (AGE ... STRATEGY_PRESET), `CORE_FIELDS`, `CORE_SCREENS`, `PROFILE_EXTRA_FIELDS`, `PROFILE_EXTRA_SCREENS`, `NET_PAY_AT_MOST_GROSS`, `RETIREMENT_AFTER_AGE`, `intakeDerivedWrites`.
- lib/calculators/forms.ts: `FORMS`, `CORE_FORM`, `PROFILE_FORM`, `PROFILE_FORM_ORDER`, `FormFlow`, `formForFlow`, `fieldRegistry`, `profileCompleteness` (by topic), `composeProfileForm`, `profileFormSection`, `PROFILE_FORM_SECTION_LABELS`. lib/calculators/<id>/form.ts: `<ID>_FORM` (provisional).
- components/calculators/renderers: `RENDERERS`, `ALL_RENDERERS`, `INTAKE_PREWARM`, `INTAKE_DESTINATION`, `<ID>_RENDERERS` (empty), `<ID>_INTAKE_DESTINATION` (today the f5 link builder), `RETIREMENT_INTAKE_PREWARM` (undefined).
- lib/constants/intake.ts: the public names the plan keeps, plus `getIntakeScreens`, `validateIntakeScreen`, `buildIntakeSubmission`, `intakeForm`, `skipLabelFor`, `KEEP_ASSUMPTIONS_LABEL`. Removed: INTAKE_QUESTIONS, INTAKE_SCREENS, INTAKE_SECTION_LABELS, the option arrays, INTAKE_RELATIONS, FILING_SUMMARY, FREQUENCY_SUMMARY.
- lib/constants/frequency.ts: PayFrequencyMeta gains `intakeOption` and `cadence` (the intake wording).

## Semantics later slices rely on

- Run store: validate (calculator-surface screens, then engine checks) -> memo by stableKey -> debounce (0 or `immediate` runs synchronously) -> run. Errors keep the last results with stale=true and drop pending runs; the newest run wins; a failed run reports under 'calculation', including a runner that throws synchronously. Results always render from the inputs that produced them.
- Worker runner: a message that is not a CalculationResponse (id a number, ok a boolean) or a messageerror retires the worker like onerror (owed runs retried in-thread); a failure without a message rejects with 'Calculation failed'.
- Legacy import: writes are grouped per binding. A binding's writes are imported together when any of them differs from that binding's writes for storageDefaults(), and skipped together when any of its paths is already provided, so coupled paths (an amount and its unit) never split.
- engineErrorsToFields takes an optional Get and skips bindings that supplied no value, matching toEngineInputs. It does not detect a later binding with a shorter engine path overwriting a longer one ('a' after 'a.b'); do not overlap bindings that way.
- Bootstrap, once per mount after hydration: replaceState(pathname) when there is any query or hash (`arrivedFromProfile` only for from=profile; everything else dropped unread), then the legacy import when `def.legacy`, then an immediate submit, then ready. CalculatorPage shows results only when ready; before that a "Loading results" skeleton.
- CalculatorPage: `write` = setValues(writes) (marks provided, O1, no debounce). Every profile change resubmits. renderResults runs inside a React.memo child that re-renders only when results, inputs or stale change; its `values` is the profile read (not subscribed) at that moment, so results must show what comes from `inputs` or from profile values the bindings feed. CalculatorLayout receives the field errors only; the run error ('calculation') shows in the results column, never in the mobile "needs attention" bar or the ErrorList. Stale results stay under a "Results out of date" status; a run error with no results shows a "Results unavailable" alert; field errors with no results show LIVE_EMPTY_STATE. `showResultsKey='profile'` after a handoff is the only automatic tab switch in live mode. Restore defaults on an assumption screen writes the default profile's values and unprovides those paths. `liveResultsLabel` names the results region.
- calculatorHref never adds a hash; fromProfile adds exactly `?from=profile`. calculatorMetadata = { title: shortTitle, description: metaDescription }; `title` is the H1.
- FieldSections defaults to surface 'calculator', collapses core screens once every visible field is in `provided`, and freezes collapse state on the first edit. A field error holds a card open and disables its toggle meanwhile.
- FieldList without `newRow`: Add writes `{ id: '<last path segment>-<n>' }` with an n no row uses; for debts, portfolio.accounts, portfolio.securities and portfolio.customAssetClasses the profile store fills the rest from the row defaults. portfolio.holdings (accountId, securityId) and portfolio.classTargets (assetClass) need more than an id, so a FieldList over them without newRow shows a "Missing newRow" alert in place of Add (a schema bug made visible, like CustomSlot's missing renderer). A newRow must still give a unique id.
- Labels: the size class comes before `leading-none` in every input label (tailwind-merge drops leading-none when a text-* class follows it); test/components/InputLabels.test.tsx pins the default label classes.
- Intake 'remaining' mode for an intent = its non-core screens minus every CORE_PATHS field, then screensFor remaining (a partly answered screen shows whole). 'all' mode keeps the form's core screens. The core flow always uses CORE_FORM.
- buildIntakeSubmission writes each provided path whole, drops unknown paths, then appends form.onSubmit; the Wizard calls setValues(writes, { provide }) so derived writes are never provided. Every form's onSubmit is intakeDerivedWrites (preset -> cash.targetMonths unless provided; retirementAge <= age -> age + 1); keep it or compose it.
- PROFILE_FORM: core, then retirement, paycheck, portfolio, leverage (skipping core, assumption and calculator-surface screens), then the profile extras; fields deduped by path (first wins), empty screens dropped, colliding ids prefixed `<formId>-`. Leverage screens sit in the 'portfolio' section.
- Skip label = screen.skipLabel ?? (assumption ? "Keep the default assumptions" : "Skip, use a typical value"). "Skip the rest" on every intent screen but the last; never in the core.
- A choice the intake offers only in part (filing status, target mix) also offers the saved value when it is one of the full set (offeredWithSaved), so it is shown chosen and kept. The Wizard also keeps the option chosen on arrival on offer after the visitor picks another (it resolves function options against the arrival profile too), so it can be chosen again.
- The state question is `required`, so an emptied combobox is an inline error, never a blank answer saved as the old state.
- Wizard coupled writes: a field's onChange writes to paths on no field of its screen are recorded per screen, saved and marked provided when the screen is answered, and reverted and unmarked when it is skipped, matching calculator write-through. A skipped screen's path (own or coupled) that another answered screen also gave goes back to that screen's value (the latest in flow order) and stays marked; any other path goes back to its value on arrival.
- The intent's finish destination is `INTAKE_DESTINATION[id](savedProfile)` from components/calculators/renderers.
- Wizard control names are `intake-<profile path>` (input ids `input-intake-<profile path>`). The intake still writes investing.newCashThisMonth (mirrored into the Brokerage deposit); a provided new cash does not mark portfolio.accounts.

## What a visitor sees differently

- Calculator pages: the Share button, its feedback and the mobile Share icon are gone. Everything else is unchanged.
- Site metadata: "Client-side, shareable by URL." becomes "Client-side.".
- Wizard: the intent lead reads "Everything this calculator uses, a few related questions per screen."; the calculator intents' last line reads "... You can change any answer on the calculator."; /start/<intent> meta description says "A few related questions per screen, skipping what you have already answered".
- Wizard behaviour that follows from running FormSpecs (plan 2.10 and 2.12): a "Skip the rest" button (on every intent screen but the last, including the profile intent's first, core screens); the state question is the StateSelector combobox (O19) at the wizard size (56px, text-lg, a text-base label), with its pin icon instead of the old select's chevron; bounds and option errors show inline; a partly answered screen shows whole; several broken relations on one screen join in one alert; a saved head-of-household or married-filing-separately status, or a saved custom mix, appears as an extra chosen option.

## Tests and coverage

- 86 files, 1811 tests passing after the second review round (1789 after the first, 1755 before it). Global statements 91.1%.
- lib/calculations 97.30% statements / 89.70% branches (unchanged). lib/calculators 100%; lib/fields 100% statements; lib/store/createCalculatorStore.ts, legacyImport.ts and preferencesStore.ts 100%; lib/workers/createWorkerRunner.ts 100% statements; lib/constants/intake.ts 100% statements / 93% branches.

## Deviations from the plan

- `useCalculatorValues()` takes no arguments: with no scenario layer both parameters would be unused.
- Registry entries extend CalculatorMeta with `card` (the /tools copy); CALCULATOR_IDS, calculatorDisclaimer and SITE_DISCLAIMER are additions. The 404 page keeps its three links (no Leverage) so nothing visible changes.
- CalculatorLayout has no `notice` slot (section 0.1 item 4). With liveResults the desktop has no ErrorList; CalculatorPage shows `errors.calculation` itself.
- ShareResult and ShareHandler stay as deprecated types because unmigrated shells import them.
- The first submit happens inside the bootstrap, so the legacy import always lands first.
- s1: `SubmitOptions` and `prepareRun` are additions. s2: the input primitives take `size` (InputSize, with an xl step); FieldSize lg maps onto it for the wizard.
- s2 prop additions to the pinned 2.10 types: `FieldInputProps.errors` (the errors in the field's scope, so a list or custom field sees its row and covered paths), `FieldSectionsProps.provided` (drives the core-collapse rule: phase 3 must pass `provided={profile.provided}`, as CalculatorPage does, or core cards never fold) and `FieldListProps.idPrefix` (control names per surface: 'field' on the calculator, 'intake' in the wizard).
- s3: `CalculatorResultsArgs.values` is the profile as of the last change to results, inputs or stale, not a live subscription (see Semantics).
- w1: provisional forms keep today's wording, so filing status is two options (sentence-cased phrases), the strategy preset lists Standard first and the target mix leaves out custom unless saved. Calculator-only specs live in each form.ts; the split into fields.ts happens in the c slices. Wizard notes render through the shared ScreenNotes (with FieldSection's note icons; no intake screen has notes today, so nothing visible changes).

## Open for phase 3

- c1, c3, c5, c7: `export const metadata = calculatorMetadata('<id>')` (test/lib/calculators/registry.test.ts pins the titles and descriptions as golden strings); the shell becomes `<CalculatorPage definition store renderResults />` (retirement passes its methodology link as afterLayout); set `<ID>_INTAKE_DESTINATION` in your own components/calculators/renderers/<id>.tsx to `() => calculatorHref('<id>', { fromProfile: true })` (Wizard.tsx needs no edit) and delete the handleShare function and the codecs it no longer uses.
- c1: delete the local SectionToggle in app/tools/retirement-calculator/components/InputSection.tsx (lines 80-121, a copy of components/fields/SectionToggle) or import the shared one if InputSection survives. Each slice grows its own form.ts (and keeps `onSubmit: intakeDerivedWrites` or composes it) and fills its renderers file.
- c1: set `RETIREMENT_INTAKE_PREWARM = () => retirementRunner.prewarm()` and export the runner from lib/store/retirementStore.ts.
- c1 and c3 decide whether the intake offers all four filing statuses; c5 decides on 'custom' in the intake and how a deposit counts as provided; c5 drops the portfolio core screens (O5).
- x1: lib/calculators/registry.ts imports the PATH and PROFILE_HANDOFF constants from lib/profile/links.ts; move them before links.ts re-exports calculatorHref, so the two never import each other.
- d1: OverviewDashboard imports Disclaimer from '@/components/ui/results' instead of DisclaimerFooter; NextSteps, ContinueProfileCard, LearnChooser and ProfileCompletenessCard move to forms.ts profileCompleteness (by topic) when their counts may change.
- c1, c3, c5, c7: each calculator's intake pins already live in files the plan gives that slice (w1 created them, so they are not new any more): test/lib/calculators/<id>/form.test.ts (the old question set question by question, visibility, validation and 'remaining' mode for that intent, against the w1 fixture) and test/components/guided/Wizard<Calc>.test.tsx (the intent's wizard walks and its "Skip the rest" link). Replace them there when the form grows. The shared files hold no calculator's flow: test/lib/constants/intake.test.ts pins only the core and the profile-only screens and checks the profile intake against what the calculator forms ask; forms.test.ts and Wizard.test.tsx compute screen counts, sections and labels from FORMS. The old core questions and the askedScreens/oldScreens helpers are in test/utils/intakeFixture.ts; answer and typeInto are in test/utils/wizard.ts.
- x2: remove onShare, ShareResult, ShareHandler, DisclaimerFooter and the deprecated layout wrappers; add CalculatorPage, liveResults and the live empty state to /demo.

## Deferred review findings

- w1-extra-saved-option-visible (owner decision). The intake shows a third filing status (head of household or married filing separately) or 'Custom' target mix only when that value is saved; before, the radio group showed nothing chosen and kept the value. It is listed above as a visible change. Restoring the old look needs an option-membership exemption for saved values in the intake. c1, c3 and c5 decide the final option sets anyway (see above).
