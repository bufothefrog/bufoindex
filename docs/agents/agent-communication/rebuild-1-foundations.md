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
