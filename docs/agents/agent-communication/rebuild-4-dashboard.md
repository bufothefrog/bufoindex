# 2026-11-11 - rebuild phase 4: dashboard (d1)

Branch `claude/rebuild-4-dashboard`. Plan: docs/rebuild-plan.md (section 0 wins). /overview now
runs every calculator through its definition (engineInputsFor plus the calculator's calculate and
headline function). No hash or query is decoded, there is no scenario layer, and lib/calculations
and test/lib/calculations are unchanged.

## Landed

| Phase | Slice | Commit subject |
|---|---|---|
| 4 | d1-dashboard | overview cards on the shared calculator layer |

## Public API (names only)

- lib/dashboard/derive.ts (moved from components/dashboard/derive.ts): `strategyDescription`,
  `ASSUMED_PORTFOLIO_RETURN` (0.07), `summarizeCashBuffer`, `PresetTarget`, `CashBufferSummary`,
  `sortAllocations`, `buildChecklistRows`, `LEVER_EXTRA_MONTHLY`, `summarizeRetirement`,
  `RetirementLever`, `RetirementOutcome`. Gone: `STRATEGY_LABELS`, `STRATEGY_ORDER`,
  `PAY_FREQUENCY_LABELS`, `formatMultiple`, `formatMonths`, `leverageMonthlyContribution`,
  `leverageHorizonYears`, `RetirementSummary`.
- components/ui/cards/density.ts: `DENSE_CARD_CLASSES` (header and content padding only; callers
  pass `className="h-full"` themselves).
- components/dashboard: `useDeferredResult` (hook) and `SimulationRegion` (live region with a
  pending note and placeholder). Dashboard-internal; no other slice imports them.
- Deleted: components/dashboard/{cardLayout.ts, StatTile.tsx, StrategyToggle.tsx}.
- lib/constants/intake.ts: `coreStartLink(intent)` returns `/start/<intent>` for an intent that
  needs no core (`intentNeedsCore`), else `/start?next=<intent>` (O5).

## Semantics later slices rely on

- Each card: `engineInputsFor(<CALCULATOR>, profile)`, then the definition's `calculate`
  (leverage checks `validate` first). Figures come from `retirementHeadline` (current plan by id
  through `currentPlanScenario`), `paycheckFlow` and `leverageHeadline`; the cards keep their own
  labels and prose except where lib/constants/labels.ts has the label (strategy preset, target mix).
- Paycheck fun money: before and after, the card shows `paycheckContext.funMoneyPerPaycheck` (the
  minimum). The engine sets `funMoneyAllocated` to that minimum, so it agrees with the allocator
  page's paycheckFlow. "To allocate" is `max(0, paycheckFlow.priority)`; equal to the old sum of
  allocations plus the unassigned amount for every pinned profile, and $0 under a shortfall.
- `useDeferredResult(inputs, compute)` runs after a requestAnimationFrame plus a macrotask, keyed
  by `stableKey(inputs)`, and returns null while pending (H7). Both simulation cards use it.
- Profile completeness is `forms.profileCompleteness` (topic screens, O14); "Fill in the rest"
  versus "Edit the basics" is `isProfileFinished(profile)`. The v1 `profileCompleteness` in
  lib/profile is no longer used by the dashboard.
- The strategy control is a SegmentedControl radio group; a preset writes `strategy.preset` and,
  while `cash.targetMonths` is not provided, the preset's months (not `intakeDerivedWrites`, which
  also moves the retirement age).
- The dashboard does not run `importLegacyStorage(LEGACY_IMPORTS)`; only the calculator pages do.

## What a visitor sees differently

On /overview (same profile, before -> after):
- Leverage card runs the calculator's inputs. Default profile: "$180,000 in total, starting from
  $0" -> "$205,000 in total, starting from $25,000"; medians $831,387 / $1,004,450 -> $1,158,212 /
  $1,398,228; "41% of 300 simulated paths" -> "40% of 500 simulated paths". Contribution and
  horizon overrides and profile.assumptions.leverage now apply. A profile with an invested balance
  but no contribution now gets the comparison instead of the "no monthly investing contribution"
  note (shown only when contribution and starting balance are both 0). Ratios print as lib/format
  does (2.25x, was 2.3x). The simulation runs after first paint ("Running 500 simulated market
  paths..." and a placeholder first).
- Cash buffer (O16): cash-drag return 8% -> 7% (rich profile: "about $696 a year" -> "about $522
  a year"). A missing months-on-hand prints U+2014 instead of "-".
- Strategy label "Cashflow investor" -> "Cash-flow investor" (summary, control, preset tile). The
  control is a radio group (aria-checked, arrow keys) instead of two aria-pressed buttons.
- Strategy summary paragraph: like the leverage card, it prints a saved leverage ratio with two
  decimals through lib/format (2.25x, was 2.3x).
- Paycheck card: the allocation amounts render in the KeyValueList value style (monospace, beside
  the description) instead of on the title line.
- Profile completeness by topic: "1 of 25 fields answered" -> "0 of 17 topics answered" (basics);
  missing list shows topic titles; "New cash to invest this month" and "Emergency fund target" are
  never listed; "Every field has..." -> "Every topic has an answer from you."
- Rebalancer line: "the 60/40 target mix" -> "the 60% stocks, 40% bonds target mix".
- Card links: `<path>?from=profile#<hash>` and `/tools/leverage-comparison?c=..&from=profile` ->
  `calculatorHref(id, { fromProfile: true })`, i.e. `<path>?from=profile`.
- Retirement, paycheck and automation figures are unchanged. Presentation only: shared StatTile
  (success tile toned by the headline), KeyValueList allocation rows, StatusAlert shortfall,
  DataTable comparison.

Entry links (O5): the portfolio link on the home page, the empty overview ("Then a portfolio"),
NextSteps and IntentPicker goes from `/start?next=portfolio` to `/start/portfolio`.

## Tests and coverage

- New: test/lib/dashboard/derive.test.ts (15, written against the old path first),
  test/components/dashboard/OverviewCards.test.tsx (22: every card's figures for three fixed
  profiles as literals, LeverageCard equals LeverageResults medians, O16, deferral),
  test/components/dashboard/OverviewDashboard.test.tsx (10: hydration guard, empty state,
  strategy radio group, rebalancer line, completeness incl. everything-but-new-cash).
- Rewritten: EntryPoints.test.tsx completeness block and portfolio link pins; format.test.ts
  dashboard parity cases now pin literals; intake.test.ts pins `coreStartLink('portfolio')`.
- 112 files, 2786 tests on Node 22 and Node 24. Coverage: statements 95.98%, branches 91.4%;
  lib/dashboard/derive.ts 100%.

## Deviations from the plan

- The O5 change is in lib/constants/intake.ts (where coreStartLink lives), not lib/profile/links.ts.
- PaycheckCard props are `(inputs, allocation)`; StrategyToggle is an inline SegmentedControl.
- `ASSUMED_PORTFOLIO_RETURN` is a dashboard constant equal to the allocator's 7%; the allocator's
  own constant is module-private in frozen analysis.ts.
- Completeness copy says "topics" instead of "fields" (three strings), because O14 counts topics.

## Open for phase 5 (x1, x2)

- x1: `retirementLink`, `paycheckLink`, `portfolioLink`, `leverageLink` and their mappers in
  lib/profile have no non-test caller now; the v1 `profileCompleteness` and `PROFILE_FIELDS` only
  serve tests.
- x1: components/guided/NextSteps.tsx spreads `DENSE_CARD_CLASSES` instead of its copied padding.
- x2: list `DENSE_CARD_CLASSES` in the /demo cards section if wanted; no browser pass at 390 px and
  360 px was run in d1 (layout reasoned from the primitives).

## Questions for the site owner

- Should /overview also run `importLegacyStorage(LEGACY_IMPORTS)` once after hydration? Today a
  returning visitor whose first stop is /overview sees cards without the old calculator values
  until they open any calculator.
- With O5 the portfolio entry skips the basics, but the copy around it still says so: EmptyOverview
  "Or answer the basics, then go straight to one calculator" / "Then a portfolio", and NextSteps
  "Answer a few quick questions ... age, state, filing status, pay". New wording?
- The leverage card now runs 500 paths after first paint (needed to match the comparison page);
  move the dashboard simulations off-thread later?
- The deferral moves both simulations after first paint, but the longest main-thread task is not
  shorter than before (the leverage card now runs the calculator's 500 paths instead of 300), so
  moving the dashboard simulations off the main thread is a possible follow-up.
- The retirement card always shows today's dollars and does not follow the saved dollar display
  mode (true before this phase too).
