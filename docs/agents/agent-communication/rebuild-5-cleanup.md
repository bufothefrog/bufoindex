# 2026-11-12 - rebuild phase 5: cleanup (x1, x2)

Branch `claude/rebuild-5-cleanup`. Plan: docs/rebuild-plan.md (section 0 wins). This phase deletes
what the migration left dead, rebuilds /demo, moves the methodology page's KaTeX to the server and
brings the docs up to date. lib/calculations and test/lib/calculations are unchanged except the
two formatter re-exports in lib/calculations/core.ts that the plan names; package-lock.json is
unchanged.

## Landed

| Phase | Slice | Commit subject |
|---|---|---|
| 5 | x1-dead-code-cleanup | profile mappers, link builders and the profile barrel |
| 5 | x1-dead-code-cleanup | URL-hash codecs and duplicate lib/utils formatters |
| 5 | x1-dead-code-cleanup | unused types, UI exports and layout components |
| 5 | x1-dead-code-cleanup | schema integrity test and redundant test setup |
| 5 | x2-demo-and-docs | deferred review items and stale comments |
| 5 | x2-demo-and-docs | rebuild /demo around the current components |
| 5 | x2-demo-and-docs | delete demo-only components and legacy aliases |
| 5 | x2-demo-and-docs | render methodology formulas on the server |
| 5 | docs | bring CLAUDE.md, README and design docs up to date with the rebuild |
| 5 | x1-dead-code-cleanup (fix) | test-only exports were kept in lib |
| 5 | x1-dead-code-cleanup (fix) | the Calculate mode and unused primitive props survived O8 |
| 5 | x1-dead-code-cleanup (fix) | duplicate formatters and compatibility exports remained |
| 5 | x1-dead-code-cleanup (fix) | calculator paths lived outside the registry and two completeness counts shared a name |
| 5 | x1-dead-code-cleanup (fix) | the spec integrity check skipped shared paths one form asks |
| 5 | x2-demo-and-docs (fix) | the demo theme columns did not switch tokens and Fields scrolled at 360px |
| 5 | x1-dead-code-cleanup (fix) | the run store kept a field nothing reads |
| 5 | x1-dead-code-cleanup (fix) | the guided cards still counted v1 profile fields |

## What was removed

- x1 (`git diff --shortstat dd616fd..ba263da`): 105 files, +775 / -4236. The URL-hash codecs and
  their tests, the hash link builders, the lib/utils formatter copies, unused types and UI exports,
  FieldGroup and InputRow; core.ts formatCurrency and formatPercent re-export lib/format.
- x2 (`git diff --shortstat ba263da..77b0869`): 60 files, +1890 / -3239. Deleted
  components/shared/Tooltip.tsx, components/calculators/shared/{CalculatorTabs,BreakdownRow}.tsx,
  components/guided/{IntentPicker.tsx,index.ts}; SummaryCard and the unused BaseCard options
  (size, elevated, gradient, collapsible, ResultCard highlight, InputCard required); the
  Simple/Advanced CalculatorLayout wrappers, the DisclaimerFooter re-export and the onShare types;
  the `variant` aliases on StatusAlert and ExpandableListCard (OpportunityCostCard moved to
  `tone`); toneFromLegacy, LegacyTone and LEGACY_TONES; KeyValueRow `standalone`; CardVariant and
  ComponentSize in lib/design-system/types.ts; the mock chart generators in lib/demo.
- Review fixes: validateFor (tests read `prepareRun(...).errors`), legacyDefaultGaps,
  createFormulaRegistry and the registry's test-only lookup, search and validation methods;
  CalculatorLayout's Calculate mode (onCalculate, the Calculate card, CALCULATE_EMPTY_STATE,
  emptyStateConfig, the stacked mobile mode, reveal-on-settle, isCalculating) and `liveResults`;
  the props no caller passes (BaseInput `state` and ComponentState, NumberInput
  formatDisplay/parseValue, MoneyInput `currency`, CoreSummary editHref, BaseCard titleClassName,
  ResponsiveGrid and Container sizing props, the empty-state feature dots); BaseCard's
  ComponentColor and its two class maps (BaseCard and ResultCard take `tone`); PercentInput's
  formatPercent and parsePercent; the EnhancedMoneyInput name (the file is MoneyInput.tsx); the
  StateSelector compatibility re-export and the unused barrel exports (KeyValueRow,
  SectionToggle, screenHasError, BaseInputProps); lib/profile/links.ts (paths are in the
  registry entries, the handoff marker next to calculatorHref).
- Re-check fixes: the run store's `isCalculating` (no reader after the Calculate mode went);
  profileFieldCompleteness and lib/profile/mappers.ts, PROFILE_FIELDS and ProfileFieldMeta (the
  guided cards count by topic screen now); the deprecated `investing.newCashThisMonth` leaf and
  the write side effect that mirrored it into the Brokerage deposit. The profile stays version 2:
  normalizing drops the leaf from any stored payload (provided entries for it go too), and
  migrateProfile reads a v1 answer from the raw payload and still moves it into the Brokerage
  deposit. A provided v1 new cash still does not mark `portfolio.accounts`.
- Each deletion was grepped across app, components, lib, contexts, test, docs and config first.
  Nothing listed for deletion still had a live caller.

## What a visitor sees differently

- /demo: one long page with entries for SummaryCard, the Simple/Advanced layouts, CalculatorTabs,
  HelpTooltip, IntentPicker, random mock charts and hex swatches -> "BufoIndex component gallery"
  with eight tabs (Fields, Controls, Results, Charts, Guided flow, Layouts, Colors, Typography),
  light and dark side by side or once in the site theme. It shows every FieldInput kind,
  FieldSection, FieldList, ChoiceGroup, Checkbox, SliderField, NullableField, HoldingRow,
  SegmentedControl, StatTile/StatGrid, KeyValueList, DataTable, StatusAlert and ProgressBar tones,
  DENSE_CARD_CLASSES, ChartFrame around the production DcaPathChart on a fixed fixture, the guided
  widgets and CalculatorLayout liveResults. No ScenarioBanner (section 0).
- Methodology page: formulas arrive as server-rendered KaTeX HTML; the page is static and no
  KaTeX JavaScript ships. Formula text is identical (checked for every formula and variable
  symbol); display formulas lose a stray literal "undefined" class.
- /demo after the review fixes: the "Light theme" and "Dark theme" columns now show their own
  theme on either page theme (the semantic colors are `@theme inline` in app/globals.css; live
  pages render the same colors as before). Below sm the gallery cards have narrower sides, so the
  Fields tab no longer scrolls sideways at 360 px. The ResultCard entry names `tone`.
- A PercentInput slider label for a negative fraction that rounds to zero prints "0.0%" instead
  of "-0.0%" (the lib/format deviation); the sliders' ranges are not negative, so no page shows it.
- Portfolio, unnamed account remove button: "Remove Account 3" -> "Remove account 3".
- Portfolio holdings, accessible names: "Price / share" -> "Price / share, Roth IRA holding 1"
  (same for Ticker, Asset class, Shares). Visible labels unchanged.
- Number, money and percent inputs: with the whole value selected, focusing used to drop the
  selection so typing appended ("1,000" then "250" gave 1000250); now typing replaces it (250).
- /start/profile and the /overview completeness list, trimmed leverage screen: "What goes into the
  comparison?" -> "Leverage ratio" / "Which leverage ratio should the comparison use?" with "The
  leverage comparison runs a leveraged fund against a plain index fund that receives the same
  contributions." /start/leverage is unchanged.
- Calculator results, "What next?" card, "Finish your profile": "N of 25 details answered." ->
  "N of 17 topics answered." (counted by topic screen, O14, as on /overview; the rest of the
  sentence is unchanged).
- Home page, "Continue with my profile": "N of 25 details saved in this browser." -> "N of 17
  topics answered, saved in this browser."
- /start/choose, "See your overview" (once no profile question is left): "Every detail is saved."
  -> "Every topic is saved."; "lists the N detail(s) that still use(s) a typical value" -> "lists
  the N topic(s) that still use(s) a typical value". Answering every intake topic now reads
  "Every topic is saved." where it used to list the never-asked emergency-fund target months.
- The counts are smaller (a topic holds several fields), so the same answers read differently:
  the three basics screens answered give "3 of 17" where they gave "7 of 25".

## Tests and coverage

- 108 files, 2646 tests on Node 22 and Node 24 after the re-check fixes. Coverage: statements
  98.42%, branches 94.3%; thresholds in vitest.config.ts hold.
- Re-check fixes: the run store tests assert results and stale instead of isCalculating;
  mappers.test.ts and the PROFILE_FIELDS block are deleted with their subjects; integrity.test.ts
  passes with no named exception; migrate.test.ts and profileStore.test.ts load a stored v2
  profile that still holds the new-cash leaf, and a v1 profile whose new cash lands in the
  Brokerage deposit; the guided-card pins are literals ("1 of 17 topics answered.").
- Review fixes: integrity.test.ts checks every shared path however many forms ask it, with a test
  that fails under the old shortcut. Deleted with their subjects: the legacyDefaultGaps block,
  the registry bookkeeping block, the PercentInput helper block and its lib/format equivalence
  test, the Calculate-button layout tests and the emptyStateConfig override test.
- New in x2: the a1 case in FieldList.test.tsx (fails without the NumberInput fix), removeLabel
  in FieldList and portfolio form tests, holding-input names in HoldingRow and
  PortfolioRebalancingCalculator tests, trimmed-screen wording in forms.test.ts and intake.test.ts.
- Removed with their subjects: the SimpleCalculatorLayout, onShare and variant-equivalence tests,
  the BreakdownRow, IntentPicker and toneFromLegacy blocks.

## Deviations from the plan

- toneFromLegacy, KeyValueRow `standalone` and CardVariant/ComponentSize sit outside x2's file
  list; they went with the aliases they served (test-only after x2), so no shim is left behind.
- CalculatorPage is not shown live in /demo (it would write to the visitor's profile);
  CalculatorLayout with liveResults stands in for it.
- docs/redesign-guided-flow.md: only sections 2.1, 2.3, 2.4, 3.4 and 9.1 were rewritten (O20); its
  status line now says which sections match the code. docs/agents.md had one stale reference fixed.
- docs/rebuild-plan.md keeps its original status line under the new one.
- Browser pass (review fixes): /demo at 360, 390 and 1280 px, light and dark page, both views,
  every tab, has no sideways scroll and each theme column reads its own tokens; the home page,
  /start, /overview, the four calculators and the methodology page have none at 360 px.

## Deliberately left

- The "owner" and "owner, then x2" rows of the phase 3 table: c1-calculator-copy-replaced,
  c3-card-help-copy-dropped, b-debt-badge-threshold, c4-quickactions-scroll-unplanned.
- The unused retirement insight modules (O13, second item).

## Questions for the site owner

From all five phases:

- (p2) Intake option sets: a saved head-of-household / married-filing-separately status or a
  'Custom' target mix shows as an extra chosen option in the intake. Keep it, or exempt saved
  values from the option check?
- (p3) Retirement and paycheck calculator screens keep the intake's labels and help; restore the
  old calculator wording through a calculator-surface help hook?
- (p3) Debt badge: keep the engine's 7% line or restore the old 8% / 5% tiers with neutral copy?
- (p3) Paycheck quick actions on a phone with the Results tab open: switch to Inputs first, or
  keep them inert?
- (p3) Chart caption position (below instead of above-right), and whether the retirement header
  shows the full headline.
- (p3) Legacy import: an old retirement salary with its own frequency next to an answered
  take-home pay imports the salary and keeps the take-home number (not reachable from the UI).
- (p4) Should /overview run `importLegacyStorage(LEGACY_IMPORTS)` once after hydration?
- (p4) The portfolio entry skips the basics (O5) but EmptyOverview and NextSteps copy still says
  "answer the basics"; new wording?
- (p4) Move the dashboard simulations off the main thread? The retirement card always shows
  today's dollars and ignores the saved display mode.
- (p5) Update the remaining sections of docs/redesign-guided-flow.md (1, 2.5, 6) or leave them as
  the historical proposal?
- (p5) Delete the unused retirement insight modules now (O13 follow-up)?
