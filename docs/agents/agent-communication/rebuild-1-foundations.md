# 2026-11-11 - rebuild phase 1: foundations (f0, f1, f4, f2, f3, f5)

Branch `claude/rebuild-1-foundations`. Plan: docs/rebuild-plan.md (section 0 wins). No page
shows or computes anything different; lib/calculations is unchanged except f1's one import line
in retirement.ts.

## Landed

| Slice | Commit subject |
|---|---|
| f0-test-infra | shared test helpers |
| f1-format-labels | one formatting module and one table per label vocabulary |
| f4-field-schema | the pure field-schema runtime |
| f3-chart-frame | one chart scaffold |
| f2-results-primitives | the shared results vocabulary |
| f5-profile-v2 | every calculator field gets a profile home |

## Public API (names only)

- test/utils: `renderWithProfile`; `resetProfileStore`, `ResetProfileStoreOptions`, `clearBrowserState`; `routerMock`, `resetRouterMock`, `nextNavigationFactory`.
- lib/format.ts: `FormatKind`, `formatCurrency`, `formatPercent`, `formatMultiple`, `formatMonths`, `formatYearsAndMonths`, `formatShares`, `formatCount`, `formatValue` (+ option types).
- lib/constants/frequency.ts: `PAY_FREQUENCY_META`, `PAY_FREQUENCY_OPTIONS`, `FREQUENCY_MULTIPLIERS`, `PayFrequency`, `PayFrequencyMeta`.
- lib/constants/labels.ts: `FILING_STATUS_META`/`_OPTIONS` and `*_LABELS`/`*_OPTIONS` for bonus frequency, account type, strategy preset, target mix, risk tolerance, optimization goal, HSA coverage, contribution type; `LEVERAGE_RATIO_LABELS`, `leverageRatioLabel`, `leverageRatioOptions`.
- lib/constants/disclaimers.ts: `DISCLAIMER`, `DisclaimerFragment`, `composeDisclaimer`.
- lib/fields: types (`Tier`, `Surface`, `FieldKind`, `Get`, `Text`, `FieldOption`, `Write`, `FieldErrors`, `FieldSpec`, `ScreenNote`, `ScreenSpec`, `CrossFieldRule`, `FormSpec`); paths (`splitPath`, `joinPath`, `toDotPath`, `getAt`, `setAt`, `applyWrites`, `makeGet`); runtime (`fieldMap`, `resolveText`, `resolveOptions`, `resolveOverrideDefault`, `isFieldVisible`, `rowGet`, `listRows`, `visibleScreenFields`, `visibleScreenNotes`, `screensFor`, `isEmptyValue`, `fieldError`, `relationErrors`, `validateFields`, `summarizeScreen`, `screenPaths`); binding (`Binding`, `DirectBinding`, `DerivedBinding`, `isDerivedBinding`, `toEngineInputs`, `fromEngineInputs`, `engineErrorsToFields`, `stableKey`).
- lib/chart-theme.ts: `ChartTheme` (+ `fontMono`), `getChartTheme`, `getSageVariants`, `subscribeToThemeChanges`, `CHART_FONT_MONO_FALLBACK`, `chartAxisProps`, `chartGridProps`, `CHART_MARGINS` (`labeled`, `compact`), `CHART_SERIES_DEFAULTS`, `thinPoints`.
- components/ui/charts: `ChartFrame` (`ChartFrameProps`, `ChartFrameHeight`), `ChartTooltipCard` (`ChartTooltipCardProps`, `ChartTooltipRow`), `useChartTheme`, plus re-exports of the chart-theme helpers.
- lib/design-system/tone.ts: `Tone`, `TONES`, `TONE_TEXT`, `TONE_BORDER`, `TONE_SURFACE`, `TONE_FILL`, `LegacyTone`, `toneFromLegacy`. stat.ts: `StatSpec`, `MISSING_VALUE`, `formatStatValue`.
- components/ui/results: `StatTile`, `StatGrid`, `KeyValueList`, `KeyValueRow`, `DataTable`, `Disclaimer` (+ prop and option types).
- components/ui: `SegmentedControl` (`SegmentedControlOption`, `SegmentedControlAppearance`, `SegmentedControlSize`), `ProgressBar`.
- StatusAlert: `tone`, `appearance` ('muted' | 'tinted'), `role`, `testId`; BreakdownRow: `tone`. `variant` is a deprecated alias on both. DollarModeToggle: same props.
- lib/profile (via `@/lib/profile`): v2 `FinancialProfile`, `FilingStatus` (4; `ProfileFilingStatus` deprecated), `TargetMixPreset` (+ 'custom'), row aliases (`DebtRow`, `AccountRow`, `SecurityRow`, `HoldingRow`, `ClassTargetRow`, `CustomAssetClassRow`), `ProfileSection`, `ProfileListPath`, `ProfilePatch`; `getDefaultFinancialProfile`, `PROFILE_LEAF_PATHS` (67), `PROFILE_LIST_PATHS`, `PROFILE_LIST_ROW_DEFAULTS`, `PROFILE_ENUM_VALUES`, `isProfilePath`, `providedPathFor`, `normalizeProvided`, `isValidProfileValue`, `getProfileValue`, `normalizeProfile`, `applyProfileWrites`, `patchWrites`, `newCashDepositWrites`, `BROKERAGE_ACCOUNT_ID`, `TARGET_MIX_WEIGHTS` (moved here from mappers), `presetClassTargets`, `PROFILE_VERSION`, `migrateProfile`; links add `PROFILE_HANDOFF_PARAM`, `PROFILE_HANDOFF_VALUE`. Deprecated until x1: `PROFILE_FIELDS`, `profileCompleteness`, `isProfileFieldPath`, `splitProfilePath`, `investing.newCashThisMonth`.
- lib/store/profileStore.ts: `setValues(writes, { provide?, unprovide? })`, `SetValuesOptions`; `setFields` and `setProvidedValue` wrap it; persist version 2. A payload stored under a later version is read (normalized to v2) but never written back in that session, so a rollback cannot delete the newer fields.

## Semantics later slices rely on

- Profile paths: a leaf is any non-list value at any depth; a list is one of PROFILE_LIST_PATHS; `<list>.<i>` is a row and `<list>.<i>.<key>` a row field (canonical indices only). Section objects are not paths.
- `provided` is canonical: leaves by path, lists by list path (a write to `debts.0.balance` marks `debts`). Unknown paths are dropped everywhere, and so are row paths to rows that do not exist (`normalizeProvided(paths, profile)`; the store and normalizeProfile pass the profile). `patchWrites(patch)` flattens a ProfilePatch to leaf and list writes at any depth; setFields and resetProfileStore use it.
- setValues applies writes in order; refused writes (unknown path, invalid value, index gap, a row or id that repeats another row's id) keep the old value and are not provided. `provide` defaults to the accepted paths; an explicit `provide` (even []) replaces that; `unprovide` runs last and wins. Every call stamps updatedAt; untouched sections keep their identity.
- Values: finite numbers, real booleans, enums from PROFILE_ENUM_VALUES; null only for the five nullable overrides and classTargets.accountId. No numeric bounds here; those belong to FieldSpecs.
- List rows normalize against PROFILE_LIST_ROW_DEFAULTS; rows missing a required field or repeating an id are dropped. Dangling references are kept (c5 reducers own integrity).
- migrateProfile: v1 normalizes into v2, then the Brokerage deposit takes newCashThisMonth (clamped >= 0). A provided newCashThisMonth does not mark `portfolio.accounts`. The Brokerage account is `acc-brok`, else the first taxable account.
- A write to the deprecated `investing.newCashThisMonth` also sets the Brokerage deposit (one way only) until c5 stops asking it; x1 deletes both.
- Mappers: retirement maps marriedSeparate and headOfHousehold to single (O10); 401(k) split gives roth = min(roth part, total); toRebalanceInputs reads the portfolio lists and uses classTargets only for 'custom'.
- Links are `${PATH}?from=profile#${hash}` (leverage: `...&from=profile`); unmigrated calculators ignore the query.
- Tone map: default/neutral -> neutral, success/up -> positive, warning -> caution, danger/error/down -> negative, info -> info, sage/emphasis/selected -> brand. Null or non-finite stat values print U+2014.
- useChartTheme needs ThemeProvider (and a matchMedia stub in jsdom). ChartFrame defers with rootMargin '100% 0px' and never unmounts once mounted (latched, even if deferUntilVisible turns on later). ProgressBar shows a non-finite value as min and treats max <= min as an empty range (aria-valuemax = min). thinPoints(points, MAX_POINTS + 1) reproduces DcaPathChart's sampling.

- lib/fields: fieldError rejects Infinity and -Infinity ("must be a number"), and an empty list fails a minRows above 0 even when the field is not required. engineErrorsToFields sends an error to the last of equally long bindings, the one whose value toEngineInputs keeps. stableKey keeps -0 apart from 0 and writes array holes as null.
- test/utils: resetProfileStore and renderWithProfile seed through setValues(patchWrites(profile)), so every valid leaf at any depth and every list given is marked provided. Mock next/navigation with the order-independent form `vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory())`.

## Tests and coverage

- 60 files, 1481 tests passing (1465 at hand-off, plus the phase 1 review fixes). Global statements 90.04%.
- lib/calculations 97.30% statements / 89.70% branches (unchanged files).
- lib/fields 100% statements; lib/profile 100%; lib/design-system 100%; lib/store/profileStore.ts 100%; lib/chart-theme.ts 95%; lib/format.ts 100%.

## Deviations from the plan

- Additions to the pinned contracts: TONES, TONE_FILL, LegacyTone, MISSING_VALUE, formatStatValue, KeyValueRow, StatusAlert `role`/`testId`, SegmentedControl `appearance: 'cards'`, CHART_FONT_MONO_FALLBACK, and the f5 helpers listed above.
- StatTile is a role=group named by its label (a badge cannot sit in a dl). BreakdownRow stays div-based (standalone KeyValueRow).
- ChartFrame 'tall' is h-96 at every width (the plan leaves it open). chartGridProps uses opacity 0.3; DcaPathChart uses 0.4.
- TARGET_MIX_WEIGHTS moved to defaults.ts to avoid a cycle. lib/profile imports lib/fields/paths (no runtime cycle).
- lib/format deviates from legacy output in a few edge cases no option reproduces (listed in the lib/format.ts header): no minus on a percent that rounds to zero, unsigned "NaN%" for signed NaN, "-" from formatMultiple for non-finite values, and U+2212 negative axis ticks ("-$5k" where MonteCarloChart printed "$-5000"). percent-signed without digits is 0 to 1 decimals; c7 passes { digits: 1, signed: true } to keep formatSignedPct output.
- Integrator fixes: non-ASCII literals in f2 written as \u escapes; row and row-id writes that would duplicate an id are refused, so a reload cannot silently drop a row.

## Open for phase 2

- s1: build on setValues/provide/unprovide and migrateProfile; the legacy import writes through setValues.
- s2: field renderers compose SegmentedControl, StatusAlert tones and ProgressBar; nullable overrides map to the five nullable leaves.
- s3: Disclaimer can back DisclaimerFooter (`text` is required); the bootstrap strips `?from=profile` (PROFILE_HANDOFF_PARAM / VALUE).
- w1: intake still writes `investing.newCashThisMonth` (mirrored into the deposit). Decide whether a provided new cash should mark `portfolio.accounts`. Wizard tests now expect the `?from=profile` links.
- Later owners: c5 derives portfolioRebalancingStore defaults from the profile; d1 must label a 'custom' target mix in OverviewDashboard; c4 decides tabs vs radios for the PayrollSetupGuide tier picker; d1 moving StrategyToggle to SegmentedControl changes it to radios; c7 picks grid opacity 0.4 vs 0.3; x2 drops the `variant` aliases and adds the new primitives to /demo.

## Review notes for later phases

Collected from the phase 1 reviews. Each is a fact about the foundations that a later slice has to design around.

Open follow-ups (small, owned by phase 2):

- lib/fields/binding.ts: the engineErrorsToFields doc says the last of equally long bindings is the one whose value toEngineInputs keeps. That is not true when the later binding reads undefined: toEngineInputs skips undefined and keeps the earlier value, but the error still goes to the later binding. Correct the comment or the tie-break (s1).
- lib/fields/runtime.ts formats bounds in validation messages with a private Intl.NumberFormat (BOUND_FORMAT), because no lib/format option reproduces those messages (unit prefix and suffix, up to 2 decimals). Move it onto lib/format only if the messages stay byte-identical; otherwise record why it stays (s2).

lib/fields:

- rowGet scopes a row field's callbacks (visibleWhen, options, help, summary) to that row. A row field cannot read top-level profile paths, so a row whose options depend on another list (a holding's account) has to be a custom renderer (c5).
- validateFields has no surface filter. Without a screen it validates every visible field of the form, intake-only screens included. A calculator page that should validate only what it shows loops screensFor(form, get, { mode: 'all', surface: 'calculator' }) and validates per screen (s1, s3).
- validateFields merges relation errors into the field map under checkOn. The wizard shows relations as a screen-level alert, so it subtracts relationErrors(...) from the inline errors to avoid showing a message twice (w1).
- A derived binding with errorPath maps every engine error under its engine path to that one path, row errors included: the row index is lost. If a calculator needs per-row errors, bind that list 1:1 (c3, c5).
- Dynamic options that resolve to an empty list switch off the option-membership check.
- toEngineInputs does not clone. Engine inputs share arrays and objects with the profile store, so engines must not mutate their inputs.
- setAt creates an array for a missing container when the next segment is numeric. Writing a numeric-keyed record entry into a missing record throws RangeError, so engine bases pre-create such records.
- An empty list fails minRows above 0. Infinity and -Infinity fail numeric validation.

lib/profile and the store:

- leverageLink carries profile.leverage overrides but not assumptions.leverage; the leverage page reads those from the query today. c7 reads them from the profile.
- zustand persist calls migrate for every stored version that differs from the current one, including higher ones. The store never overwrites a payload saved by a newer version: the session works on a normalized copy and does not persist. Keep that in mind for any later version bump.
- classTargets.accountId accepts an empty string; c5 reducers treat '' as dangling.
- Unmigrated retirement, paycheck and portfolio pages keep ?from=profile in the address bar after a handoff. The s3 bootstrap strip removes it once each calculator moves onto CalculatorPage.
- PAY_FREQUENCY_META.perYear and mappers.PAYCHECKS_PER_YEAR are two derivations of one table until x1 deletes the mappers. Bindings use PAY_FREQUENCY_META.

lib/format and labels:

- Replacing formatPct or the PercentInput formatPercent with formatPercent({ digits }) turns "-0.0%" into "0.0%" for tiny negatives. Replacing formatLeverage with formatMultiple turns NaN and Infinity into "-".
- c6: the rebalancer drift column needs formatPercent(d, { digits: 1, signed: d > 0 }); signed: true would print U+2212 where the page prints a hyphen-minus today.

Results and chart primitives:

- SegmentedControl has no disabled-option support. None of the four implementations it replaces needs one; a field renderer that needs a disabled choice adds it there, skipping disabled options in the roving and arrow logic (s2).
- StatTile's tone colours the border and surface only; the figure is always text-foreground. A calculator that wants a coloured figure gets a tinted tile instead (c2).
- StatGrid columns=2 is two columns on a phone. Retirement and leverage use one column on a phone and two from md today, so c2 and c7 pass columns=1 with className "md:grid-cols-2", or accept the change.
- KeyValueList prints the prefix before the missing-value glyph when a numeric item is null; callers omit the prefix for null values.
- The dashboard CashBufferCard prints "-" for a missing months-on-hand and StatTile prints U+2014; d1 changes that glyph when it migrates.
- DataTable numeric cells do not add font-mono. The rebalancer tables use font-mono today, so c6 passes it per cell or accepts the change.
- useChartTheme throws outside ThemeProvider. Chart component tests need ThemeProvider and a matchMedia stub.
- useChartTheme reads getChartTheme() in its useState initializer. A chart mounted in the same commit as a theme switch could keep the old palette; mount charts after the theme settles (deferUntilVisible helps) (c2, c7).
- CHART_FONT_MONO_FALLBACK repeats the --font-mono value in app/globals.css for the server render. Change both together.

Test helpers:

- Tests that use nextNavigationFactory either import '@/test/utils/navigation' before any module that loads next/navigation, or use the async form: vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory()).
- resetProfileStore and renderWithProfile mark every seeded leaf as provided, at any depth.
