# 2026-11-11 - rebuild phase 3: calculators (c1, c7, c3, c5, c2, c4, c6)

Branch `claude/rebuild-3-calculators`. Plan: docs/rebuild-plan.md (section 0 wins). Every
calculator page is a CalculatorPage over the shared profile; no hash or query is decoded, there is
no scenario layer, and legacy.ts exists for retirement and paycheck only (storage import). Existing
files under lib/calculations and test/lib/calculations are unchanged; the new files there are
savingsRate.ts, contributionLimits.ts and paycheckSummary.ts and their tests.

## Landed

| Wave | Slice | Commit subject |
|---|---|---|
| 1 | c1-retirement-inputs | retirement on the profile, the run store and the worker runner |
| 1 | c7-leverage | leverage comparison on the profile and the run store |
| 2 | c3-paycheck-inputs | paycheck allocator on the profile and the run store |
| 2 | c5-portfolio-inputs | portfolio rebalancer on the profile lists and the run store |
| 3 | c2-retirement-results | retirement results on the shared vocabulary |
| 3 | c4-paycheck-results | paycheck results on the shared vocabulary and one copy of the limit math |
| 3 | c6-portfolio-results | rebalancer results on DataTable and StatGrid |

## Public API (names only)

- lib/calculators/retirement: definition `RETIREMENT_CALCULATOR`; form `RETIREMENT_FORM`; bindings `RETIREMENT_BINDINGS`, `RETIREMENT_ENGINE_ONLY`, `retirementFilingStatus`, `filingStatusNote`; fields (TARGET_RETIREMENT_INCOME ... HEALTHCARE_COST_MULTIPLIER, `tdfProfileFor`, `estimatedEffectiveTaxRate`); legacy `RETIREMENT_LEGACY`, `readRetirementStorage`; headline `retirementHeadline`, `withdrawalRateStat`, `scenarioCountStat`, `currentPlanScenario`, `successTone`, `withdrawalRateTone`.
- lib/calculators/paycheck: `PAYCHECK_CALCULATOR`, `PAYCHECK_FORM`, `PAYCHECK_BINDINGS`, `PAYCHECK_ENGINE_ONLY`, `split401k`, `Election401k`, the field specs, `PAYCHECK_LEGACY`, `readPaycheckStorage`; headline `paycheckHeadline`, `paycheckFlow`, `PaycheckFlow`.
- lib/calculators/portfolio: `PORTFOLIO_CALCULATOR`, `validateRebalanceInputs`, `PORTFOLIO_FORM`, `PORTFOLIO_BINDINGS`, the path constants, `usesCustomTargets`, `classTargetsFor`, the field specs and renderer ids, reducers (`readPortfolio`, `portfolioWrites`, add/update/remove for accounts, securities, holdings, class targets and custom classes); headline `portfolioHeadline`, `PORTFOLIO_CASH_STAT_IDS`.
- lib/calculators/leverage: `LEVERAGE_CALCULATOR`, `validateDcaComparisonInputs`, `LEVERAGE_FORM`, `LEVERAGE_BINDINGS`, the derived-override helpers, the field specs, `leverageHeadline`, narrative helpers.
- lib/calculations: `requiredSavingsCurve`, `SavingsRateInputs`, `SavingsRatePoint` (savingsRate.ts); `limit401k`, `limitIra`, `limitHsa`, `limit415c`, `HIGH_INTEREST_THRESHOLD` (contributionLimits.ts); `paycheckSummary`, `PaycheckSummary` (paycheckSummary.ts).
- lib/utils/stepStatusUtils.ts: `highestRateHighInterestDebt` is now exported.
- lib/format.ts: FormatKind gains `'percent-1'` (exactly one decimal).
- components/calculators/shared/ExpandableListCard.tsx: `tone` prop; `variant` and `CardVariant` are deprecated aliases.
- components/calculators/renderers: every `<ID>_INTAKE_DESTINATION` is `calculatorHref('<id>', { fromProfile: true })`; `RETIREMENT_INTAKE_PREWARM` prewarms the retirement worker.
- Result components gained default exports: RebalanceResults, PlacementAdviceCard, the paycheck result components; MonteCarloChart and SavingsRateChart have only a default export (next/dynamic).

## Semantics later slices rely on

- Retirement: the current plan is the scenario whose id starts with 'current-plan', else scenarios[0] (d1 replaces the 'Your Current Plan' name lookup in components/dashboard/derive.ts with `currentPlanScenario`). retirementHeadline(results, inputs, mode = 'today') ids: success, projected, required, withdrawal-rate; balances convert with displayDollars over (plan.retirementAge - startingAge) years; with no scenario the plan figures are null. Tones: success >= 0.7 positive, >= 0.5 caution, else negative; withdrawal <= 4% positive, <= 5% caution, else negative.
- Retirement filing status: marriedSeparate and headOfHousehold run as single, with the O10 note. requiredSavingsCurve keeps the old semantics (target income not inflated; ages max(start + 10, 45) to 70; percent capped at 100).
- Paycheck: limits match optimization.ts (HIGH_INTEREST_THRESHOLD is exclusive, > 7%; HSA +$1,000 at 55; IRA +$1,100 at 50; 401(k) +$8,000 at 50 or +$11,250 at 60-63; 415(c) 72,000 / 80,000 / 83,250). paycheckSummary: deferrals and match are 0 without a plan; residualTaxes = max(0, gross - traditional - roth - net); effectiveRate = residual / (gross - traditional), 0 when that is <= 0. paycheckFlow: spending = monthlyToPaycheck(expenses + result.funMoneyAllocated); priority = net - spending and may be negative.
- Paycheck QuickActions scroll to `section[aria-label="<screen title>"]` from PAYCHECK_FORM; titles must stay unique.
- Portfolio: portfolioHeadline(result) ids invested, cash-leftover, drift-before, drift-after (only drift-after has a tone, brand). Drift lines are signed '+' only when positive and print an ASCII '-'; sell amounts keep an ASCII '-' prefix. Only portfolio-level drift rows (accountId null) are shown. Test ids kept: tax-event-warning, account-plan-<id>, plan-row-<holdingId>, class-drift-table, drift-row-portfolio-<class>, placement-advice-*.
- Leverage: debounce 250 ms; contribution, years and starting balance are nullable overrides derived from the profile; the ratio and overrides persist through the profile.
- Results render from the inputs snapshot; `stale` is in each results props type but not read (the shell marks stale results).

## What a visitor sees differently

All calculators: generated input sections ask every field the engine uses; edits write through to
the profile; results recalculate live (no desktop Calculate button); invalid inputs keep the last
results under "Results out of date"; old share links and queries are stripped and ignored; each
intake lands on `<page>?from=profile`.

- Retirement: inputs grow to savings, target, ss-healthcare and assumptions screens (effective tax rate and healthcare cost are auto/override fields; custom returns only for the custom profile); the O10 note. Results: the two header cards become StatTiles (same texts, no icons, tone tint); scenario details are a dl; chart captions move from above-right to a figcaption below each chart (same text); charts load lazily, do not animate, and use the theme mono font. Numbers are unchanged; a negative axis tick would read "-$5k" with U+2212 instead of "$-5000" (the series are not negative).
- Paycheck: inputs grow to the spending-bonus, emergency-fund, 401k, hsa, ira-taxable, debts and assumptions screens; O9 copy (fixed 22% federal bracket); four filing statuses (O10); no 300 ms delay. Results: bug 4, the HSA step card at 55+ reads "$0 of $9,750" (family) / "$0 of $5,400" (individual) instead of $8,750 / $4,400, and its per-paycheck amount includes the catch-up (for example $729 becomes $813 per monthly paycheck); every other figure is unchanged. The summary box footer loses its trailing colons; the paycheck flow is three StatTiles; the tier picker is a radio group (Basic / Intermediate / Advanced); quick-action cards are tinted in their urgency tone with outlined badges, and their buttons now scroll to the input section (they did nothing before); the progress bar is role=progressbar.
- Portfolio: the share hash is no longer written; a non-Latin-1 account name survives a reload (bug 2); removing an account asks first. Results: cash and drift figures are StatTiles (same text, "3.0%" kept through 'percent-1'); tables are DataTables with captions and row headers, no font-mono and no CSS uppercase headers; the tax warning is a tinted StatusAlert; "on target" uses text-sage-700 in light mode.
- Leverage: the c/y/b/l query is stripped and ignored; the ratio and overrides survive a reload (bug 5); the form adds the leverage ratio and Restore defaults on market assumptions; results use StatGrid, DataTable, KeyValueList and a lazy chart.

## Tests and coverage

- 107 files, 2140 tests passing. Global statements 95.81%, branches 91.17%.
- lib/calculations 97.65% statements / 90.73% branches; savingsRate.ts, contributionLimits.ts and paycheckSummary.ts 100% / 100%.
- lib/calculators 99% to 100% statements per calculator (every headline.ts 100%); lib/fields 100%; lib/store/createCalculatorStore.ts 100%; lib/store/retirementStore.ts 66.7% (the worker-only line).
- Golden tests: test/lib/calculators/<id>/bindings.test.ts compares engineInputsFor with the old mapper (fixtures captured where the mapper or reader was deleted).

## Deviations from the plan

- retirementHeadline takes an optional `mode` (default 'today'); the page header keeps its two tiles (withdrawal rate, scenario count) so nothing it shows changes; the full headline is for d1.
- requiredSavingsCurve takes the five fields it reads (SavingsRateInputs). ChartFrame height is 'tall'; captions use `caption`, not `modeNote`.
- paycheckSummary takes (inputs) only and also returns `traditional` and `roth`; contributionLimits adds `limit415c`; paycheckHeadline is the payroll guide's paycheck flow (no new header row); QuickActions keeps its own generator (golden table unchanged).
- portfolioHeadline takes (result) only and returns four figures (invested and leftover split).
- Integrator: lib/format.ts gained FormatKind 'percent-1' (c6 seam) and ExpandableListCard gained `tone` (c2/c4 seam), so no Tone-to-CardVariant adapter remains.

## Open for phase 4 (d1)

- Dashboard cards render the headline functions: retirementHeadline (and currentPlanScenario instead of the name lookup at derive.ts:265), paycheckHeadline / paycheckFlow (today PaycheckCard prose uses paycheckContext.funMoneyPerPaycheck, the minimum, not funMoneyAllocated), portfolioHeadline, leverageHeadline. d1 decides whether the cards keep their own labels.
- derive.ts PAY_FREQUENCY_LABELS is another frequency-label copy; use PAY_FREQUENCY_META.
- StepProgressBar props are unchanged; the dashboard import keeps working.

## Open for phase 5 (x1, x2)

- x2: drop the `variant` aliases on StatusAlert, BreakdownRow and ExpandableListCard (OpportunityCostCard still passes `variant` and imports CardVariant) and add the new results usage to /demo.
- Optional: FieldSection could expose a stable screen hook (data-screen) so QuickActions scrolls by screen id instead of by title.
- x1: delete whatever codec, mapper and link-builder code no page uses any more.
- Owner checks: the chart caption position (below instead of above-right) and whether the retirement header shows the full headline.
