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
- Portfolio, unnamed account remove button: "Remove Account 3" -> "Remove account 3".
- Portfolio holdings, accessible names: "Price / share" -> "Price / share, Roth IRA holding 1"
  (same for Ticker, Asset class, Shares). Visible labels unchanged.
- Number, money and percent inputs: with the whole value selected, focusing used to drop the
  selection so typing appended ("1,000" then "250" gave 1000250); now typing replaces it (250).
- /start/profile and the /overview completeness list, trimmed leverage screen: "What goes into the
  comparison?" -> "Leverage ratio" / "Which leverage ratio should the comparison use?" with "The
  leverage comparison runs a leveraged fund against a plain index fund that receives the same
  contributions." /start/leverage is unchanged.

## Tests and coverage

- 109 files, 2660 tests on Node 22 and Node 24. Coverage: statements 98.44%, branches 94.42%;
  thresholds in vitest.config.ts hold.
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
- No browser pass at 390 px and 360 px was run in this phase; the /demo layout was reasoned from
  the primitives (break-all code, min-w-0 blocks, one column below lg).

## Deliberately left

- The "owner" and "owner, then x2" rows of the phase 3 table: c1-calculator-copy-replaced,
  c3-card-help-copy-dropped, b-debt-badge-threshold, c4-quickactions-scroll-unplanned.
- The unused retirement insight modules (O13, second item).
- CalculatorLayout's non-live Calculate mode (CALCULATE_EMPTY_STATE, onCalculate): every page uses
  liveResults, and only test/components/CalculatorLayout.test.tsx reaches it.
- `investing.newCashThisMonth` (marked deprecated in lib/profile/types.ts) still has callers in
  defaults, migrate and the v1 profileCompleteness, which the guided cards still use.

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
- (p5) Delete CalculatorLayout's non-live Calculate mode and its tests?
- (p5) Update the remaining sections of docs/redesign-guided-flow.md (1, 2.5, 6) or leave them as
  the historical proposal?
- (p5) Delete the unused retirement insight modules now (O13 follow-up)?
