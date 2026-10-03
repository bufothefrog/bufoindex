# Guided-flow redesign sketch

Status: proposal, not yet implemented. Written 2026-10-03 against the
`Initial release` commit.

This document sketches a reimagined BufoIndex: a mobile-first landing page
that asks what the visitor wants to do, a short intake that seeds the right
calculator, calculators that defer the "go look it up" inputs to a second
pass, an optional full financial profile that feeds every calculator at once,
and a dashboard built on that profile. It also covers how to lean the content
toward young high earners (cash-flow dollar-cost averaging into leveraged
ETFs, a smaller emergency fund, automation) and what each piece costs to
build.

It is organized as: where the app is today, the proposed experience, the
data model behind it, the philosophy layer, the engineering plan, and the
open questions.

## 1. Where the app is today

Facts that shape the redesign (file references are to the current tree):

- Three calculators, three unrelated Zustand stores. Paycheck
  (`lib/store/calculatorStore.ts`) and retirement
  (`lib/store/retirementStore.ts`) persist to localStorage; the rebalancer
  (`lib/store/portfolioRebalancingStore.ts`) does not. No field is shared
  between them, although several overlap (age, state, filing status,
  income, necessary monthly expenses, savings rate, account balances).
- Each calculator already accepts a URL hash that fully describes its inputs
  (`lib/utils/retirementState.ts`, `lib/utils/portfolioRebalancingState.ts`,
  paycheck codec in `lib/utils/index.ts`), with versioning and default
  elision. This is the cleanest integration point for an intake wizard: the
  wizard can produce a hash and hand off to the existing calculator with no
  store changes.
- The landing page (`app/page.tsx`) is a hero plus three link cards. There
  is no intent question and no cross-calculator state.
- `CalculatorLayout` (`components/ui/layouts/CalculatorLayout.tsx`) renders
  inputs in one column and results in a second column on `lg` screens. On a
  phone it collapses to a single column with every input card stacked above
  the Calculate button and the results below that. A phone user scrolls
  through roughly 20 to 30 fields before seeing a number, and after
  calculating must scroll back up to tweak anything.
- The inputs are already phone-aware at the primitive level (`type="text"`
  with `inputMode="decimal"` or `"numeric"` in
  `components/ui/inputs/*`), so the mobile problem is layout and sequencing,
  not keyboard handling.
- The paycheck allocator encodes a fixed financial order of operations
  (`lib/constants/financialSteps.ts`, `ALLOCATION_PRIORITY` in
  `lib/calculations/optimization.ts`): 1-month emergency fund first, full
  emergency fund at step 4, taxable investing last. The default emergency
  target is 3 months. The retirement Monte Carlo offers two risk profiles,
  `tdf` and `custom`, with volatility capped at 30% and annual returns drawn
  from a normal distribution.
- `CLAUDE.md` and `CONTRIBUTING.md` state a "neutral tone, no single right
  answer" rule for calculator copy. The philosophy goals below conflict with
  that rule as written; section 5 proposes how to reconcile them.
- Already-built pieces the redesign can reuse: `CalculatorTabs` + `TabPanel`
  (hash-aware tabs), `PayrollSetupGuide` and `QuickActions` (automation
  instructions), `OpportunityCostCard` (cost of a skipped step),
  `StepProgressBar`, `DollarModeToggle`, the retirement Web Worker.

## 2. Proposed experience

### 2.1 Flow overview

```
/  (landing)
|
|-- "What do you want to do?"  (single question, 4 to 6 large tap targets)
|      |
|      |-- Figure out where each paycheck should go  -> intake:paycheck
|      |-- See if I'm on track to retire             -> intake:retirement
|      |-- Rebalance my accounts with new cash       -> intake:portfolio
|      |-- Decide how big my emergency fund should be -> intake:emergency (new)
|      |-- Compare leveraged vs plain index investing -> intake:leverage (new)
|      |-- Build my full financial profile            -> intake:profile
|      `-- "Just show me the tools" (small text link)  -> /tools (current card list)
|
|-- intake:<x>   (2 to 5 screens, one question each, big inputs, Back/Next)
|      |  easy questions only: age, state, filing status, income, paycheck
|      |  frequency, take-home, rough balances, rough monthly must-pay costs
|      |
|      `-- "Good enough to start"  -> /tools/<calculator>#<hash>
|
|-- /tools/<calculator>
|      |  Results first (computed from intake seeds + defaults).
|      |  "Quick answers" card: collapsed summary of what intake collected, tap to edit.
|      |  "Details worth looking up" card group: everything else, expanded,
|      |     each field tagged with where to find it (pay stub, benefits portal,
|      |     ssa.gov, brokerage).
|      |  Sticky bottom bar on mobile: Recalculate / Share / Jump to results.
|      `-- "Save these answers to my profile" (writes back to the shared profile)
|
`-- /overview  (dashboard; requires a profile)
       |  One card per calculator plus philosophy cards (cash drag, automation
       |  checklist, leverage comparison), each deep-linking into its tool.
```

### 2.2 Landing page

- One question above the fold: "What do you want to do with your money
  today?" Options are full-width cards on mobile, a 2 or 3 column grid on
  desktop. Each card has a verb-first label and a one-line description of
  what the answer looks like ("A per-paycheck split you can set up in your
  payroll portal").
- Below the fold: a short statement of the site's point of view (section 5),
  a "how this site works" strip (runs in your browser, nothing uploaded,
  share by link), and the plain list of tools for returning users.
- Returning visitors with a saved profile see a second option at the top:
  "Continue with my profile" leading to `/overview`.

### 2.3 Intake wizard

One question per screen, large input, Next button pinned to the bottom of
the viewport, progress dots, Back always available. Every screen has a
"skip, use a typical value" link so nobody gets stuck. The wizard never asks
anything that requires a document. Each screen's answer is written to the
shared profile draft (section 3) and, on finish, encoded into the target
calculator's hash.

Design rules for the question set:

- Ask only what changes the first result materially. Everything else gets a
  defensible default and is surfaced later on the calculator.
- Ask in the user's units (per paycheck, not per month) and convert.
- Ask the same core questions regardless of which tool was chosen, so an
  intake for one tool already seeds the others. The order is: age, state,
  filing status, gross pay and frequency, take-home, must-pay monthly costs.
  Tool-specific questions follow.

Rough per-tool question sets (easy tier only):

| Tool | Shared core | Tool-specific easy questions | Screens |
|---|---|---|---|
| Paycheck | age, state, filing, gross pay + frequency, take-home, must-pay costs | fun-money range, does employer offer 401k match (yes/no/unsure) | 5 to 6 |
| Retirement | same | target retirement age, current invested balance (rough), monthly savings (rough) | 5 to 6 |
| Portfolio | age, state (for placement advice) | which account types you have (checkboxes), new cash this month, pick a target mix preset (e.g. 100/0, 80/20, 60/40, custom later) | 3 to 4 |
| Emergency fund (new) | age, must-pay costs, take-home | job stability self-rating, severance/notice, available credit line, Roth contribution basis (yes/no) | 4 to 5 |
| Leverage comparison (new) | age | monthly contribution, horizon in years, starting balance | 3 |
| Full profile | all of the above core | then one branch per tool, with "skip this section" | 10 to 14 |

### 2.4 Calculator page, second pass

Each calculator page is reorganized into three input groups instead of a
flat stack of cards:

1. **Quick answers** (collapsed). The intake fields. Shown as a one-line
   summary ("32, TX, single, $4,200 take-home every 2 weeks") with an Edit
   action that expands the same inputs inline.
2. **Details worth looking up** (expanded on first visit, collapsible). The
   fields that need a document or some thought. Each has a short "where to
   find this" hint. These are grouped, not one-per-screen, because the user
   is now at a desk with the documents open and wants to enter several at
   once.
3. **Assumptions** (collapsed). Returns, volatility, inflation, tax rate
   overrides, risk profile. Already exists as "Advanced" on the retirement
   calculator and `AdvancedSettingsCard` on the paycheck allocator.

Field tiering per calculator (current fields, grouped):

Retirement calculator

| Tier | Fields |
|---|---|
| Quick | current age, retirement age, income + period, monthly savings, current balance, state, filing status |
| Look up | target retirement income, necessary monthly expenses, Social Security benefit (ssa.gov estimate) and claiming age, annual healthcare cost or multiplier, life expectancy |
| Assumptions | risk profile, accumulation return, retirement return, volatility, inflation, effective tax rate override |

Paycheck allocator

| Tier | Fields |
|---|---|
| Quick | gross paycheck, frequency, take-home, age, state, filing status, necessary expenses, fun-money range |
| Look up | employer match % and limit, current 401k contribution % and type, after-tax 401k availability, HSA eligibility, coverage type and contributions, IRA contributions and balances, each debt (balance, rate, minimum), emergency fund balance and APY, bonus amount and frequency, withholding |
| Assumptions | risk tolerance, optimization goal, expected retirement bracket, emergency fund target months |

Portfolio rebalancer

| Tier | Fields |
|---|---|
| Quick | accounts (name, type), new cash per account, target mix preset |
| Look up | each holding's ticker, shares, price; custom asset classes; exact target percentages |
| Assumptions | whole vs fractional shares, allow taxable selling, show placement advice |

Results move above the look-up group on mobile, with the sticky bar's "Jump
to results" and "Edit inputs" actions toggling between the two. On desktop
the existing two-column layout stays.

### 2.5 Dashboard (`/overview`)

Available once a profile exists. A single scrollable column on mobile, a
card grid on desktop. Every card is computed from the profile through the
existing pure calculation modules and deep-links into the calculator with
the profile-derived hash.

Cards:

- **This paycheck**: the allocation split and the step progress bar, plus the
  automation checklist ("401k at 8%, Roth IRA auto-invest $583 on the 1st,
  brokerage auto-buy $900 on the 16th").
- **Retirement odds**: success probability, projected balance at retirement,
  the two or three biggest levers (savings rate, retirement age, return
  assumption) with one-tap "what if" deltas.
- **Portfolio drift**: drift by class and this month's buy list.
- **Cash drag**: emergency-fund months on hand versus the profile's target,
  and the expected cost of the excess (reuses `OpportunityCostCard`).
- **Leverage comparison**: the cash-flow DCA comparison for the profile's
  monthly taxable contribution (section 5.3).
- **Profile completeness**: which look-up fields are still defaults, with
  links to fill them.

## 3. Shared financial profile

### 3.1 Why a profile, and why it comes before any backend

The profile is first a single localStorage record plus a codec, so the
client has one record to persist, seed calculators from, and later sync.
Optional accounts (section 9) build on this record; they do not replace
it. Until section 9 lands, nothing leaves the browser.

### 3.2 Schema sketch

```ts
// lib/profile/types.ts
export interface FinancialProfile {
  version: 1;
  updatedAt: number;

  person: {
    age: number;
    state: string;             // 2-letter code, states-2026.ts
    filingStatus: FilingStatus;
    retirementAge?: number;
    lifeExpectancy?: number;
  };

  income: {
    grossPerPaycheck: number;
    netPerPaycheck: number;
    frequency: PayFrequency;
    bonus?: { amount: number; frequency: BonusFrequency };
  };

  spending: {
    necessaryMonthly: number;
    funMoney?: { min: number; max: number };
    targetRetirementIncome?: number;
  };

  cash: {
    emergencyFundBalance: number;
    emergencyFundApy: number;
    targetMonths?: number;     // undefined = let the strategy decide
    jobStability?: 'low' | 'medium' | 'high';
    severanceWeeks?: number;
    availableCredit?: number;
  };

  workplace: {
    has401k: boolean;
    matchPercent?: number;
    matchLimit?: number;
    contributionPercent?: number;
    contributionType?: 'traditional' | 'roth' | 'split';
    afterTax401kAvailable?: boolean;
    hsaEligible?: boolean;
    hsaCoverage?: 'individual' | 'family';
  };

  accounts: ProfileAccount[];  // { id, name, type, balance, monthlyContribution, holdings? }
  debts: ProfileDebt[];        // same shape as lib/types DebtData

  strategy: {
    preset: 'standard' | 'cashflow-investor';   // section 5.1
    taxableVehicle?: 'index' | 'leveraged-2x';
    leverageShare?: number;    // 0..1 of taxable contributions
    targetMix?: 'preset-100-0' | 'preset-80-20' | 'preset-60-40' | 'custom';
  };

  // Which fields the user actually entered vs. which are still defaults.
  // Drives the "profile completeness" card and the "Quick answers" summary.
  provided: Partial<Record<ProfileFieldPath, true>>;
}
```

The `accounts` list is the bridge to the rebalancer: an account with
holdings maps to a rebalancer account; one without holdings still
contributes its balance to the retirement starting balance.

### 3.3 Mapping layer

Pure functions, no React, tested like calculations:

```
lib/profile/
  types.ts                 FinancialProfile + field path types
  defaults.ts              getDefaultProfile(), per-field defaults with notes
  toPaycheckProfile.ts     FinancialProfile -> PaycheckProfile (lib/types)
  toRetirementInputs.ts    FinancialProfile -> RetirementInputs
  toRebalanceInputs.ts     FinancialProfile -> RebalanceInputsV2
  fromCalculator.ts        reverse maps: calculator inputs -> profile patch
                           (used by "Save these answers to my profile")
  codec.ts                 encode/decode profile <-> URL hash, v1
  completeness.ts          which fields are provided vs. defaulted
```

Mapping rules worth deciding up front:

- Retirement `monthlySavings` = sum of profile account contributions + the
  paycheck allocator's recommended taxable contribution when the user has
  not overridden it. Document which one wins.
- Retirement `startingBalance` = sum of account balances, excluding the
  emergency fund.
- Paycheck `preferences.emergencyFundMonths` comes from
  `cash.targetMonths` when set, otherwise from the strategy preset.
- The reverse map writes only fields the user touched, never the defaults,
  so a calculator visit does not overwrite real profile data with
  placeholders.

### 3.4 Store and persistence

`lib/store/profileStore.ts` (Zustand + persist, key `bufo-profile`). The
three calculator stores stay as they are. When a calculator mounts:

1. If the URL has a hash, use it (unchanged behaviour; shared links win).
2. Else if a profile exists, derive inputs from it and show a "Using your
   profile" banner with a link to `/overview`.
3. Else fall back to the store's own persisted or default inputs.

This keeps every existing test and link valid and makes the profile purely
additive.

## 4. Mobile overhaul

Concrete changes to the current layout system, independent of the guided
flow and worth doing first:

- `CalculatorLayout`: add a `mobileMode: 'tabs' | 'stacked'` prop. In `tabs`
  mode, below `lg`, render `CalculatorTabs` with Inputs and Results panels
  and a sticky bottom action bar (Calculate, Share, and a tab switch). The
  desktop grid is unchanged.
- Input cards get a `collapsible` prop with a one-line summary when
  collapsed (`BaseCard` already carries the header). The quick/look-up/
  assumptions grouping in section 2.4 is built from this.
- Field hints: a `lookupHint` prop on `BaseInput` ("Benefits portal, under
  Retirement plan") rendered as muted helper text. Add to `/demo`.
- Touch targets: option cards and the tab bar at 44px minimum height; the
  `Slider` thumb enlarged on coarse pointers via the `pointer-coarse`
  variant.
- Charts: `MonteCarloChart` and `SavingsRateChart` need a compact mode
  (fewer ticks, legend below, fixed aspect ratio) below `md`.
- Results summary first: on mobile, the top of the Results panel is a
  single `SummaryCard` with the headline number, then the detail cards.
- Landing page option cards and the intake wizard are new components:
  `components/guided/IntentPicker.tsx`, `components/guided/Wizard.tsx`,
  `components/guided/WizardStep.tsx`, `components/guided/OptionCards.tsx`.
  All go in `/demo`.

## 5. Philosophy layer: young high earners

### 5.1 How to present a point of view without breaking the site's rules

The repo's stated rule is "show the math, no single right answer." The
philosophy goals are opinionated. Two ways to reconcile:

- **Option A: strategy presets.** Add `strategy.preset` with two values,
  `standard` (today's order of operations and 3-month fund) and
  `cashflow-investor` (the site's recommended path). The landing page and
  intake default to `cashflow-investor` for users who match the target
  audience (stable income, no high-interest debt, long horizon) and explain
  why in one paragraph. Both presets run through the same math and the
  results pages always show the comparison. Copy says "this site's default
  for people in your situation" rather than "the right answer."
- **Option B: editorial pages plus calculator defaults.** Keep calculators
  neutral and put the opinion in a short "How we think about this" page
  linked from the landing page, with defaults tuned toward it.

Recommendation: Option A, because it makes the opinion testable (the
calculators show what the user gives up and gains under each preset) and
keeps the methodology-page honesty the site is built on. Update the
"neutral tone" line in `CLAUDE.md` and `CONTRIBUTING.md` to "opinionated
defaults, always shown alongside the alternative, never hidden math."

Whichever option, keep the educational disclaimer and add a specific
leveraged-ETF risk statement on every page that shows one.

### 5.2 Smaller emergency fund

New pure module `lib/calculations/emergencyFund.ts`:

- Inputs: necessary monthly expenses, job stability rating, expected weeks
  to re-employment distribution by stability, severance weeks, available
  credit, Roth contribution basis (withdrawable without penalty), taxable
  balance and its assumed drawdown haircut, HYSA APY, expected portfolio
  return.
- Outputs: recommended cash months under the chosen preset, the probability
  that a job loss exhausts cash before re-employment, the expected annual
  cost of each extra month of cash (return gap times balance), and the
  "backstop ladder" (cash, then Roth basis, then taxable at a haircut, then
  credit).
- The paycheck allocator's `emergency-1month` and `emergency-full` steps
  read the target from this module instead of the fixed 3 months when the
  `cashflow-investor` preset is active. The `ALLOCATION_PRIORITY` ordering
  constraint in `optimization.ts` must be respected (the two emergency
  steps stay at priorities 1 and 4).

Honest-modeling notes: the re-employment duration distribution is an
assumption and needs a cited source (BLS unemployment duration tables) in
`lib/constants/`. The output should show the shortfall probability, not
just the recommended months.

### 5.3 Leveraged ETFs via cash-flow DCA

Two pieces:

**A. A leveraged risk profile in the retirement calculator.** Add
`riskProfile: 'leveraged'` with a `leverageRatio` input (2.0 for an SSO-like
fund, 3.0 for UPRO-like). The simulation needs a leveraged-return model,
not just a higher mean:

- Daily-reset leverage over a year behaves approximately as
  `L * mu - (L^2 - L) / 2 * sigma^2 - (L - 1) * financingRate - expenseRatio`
  for the mean and `L * sigma` for volatility, where `mu` and `sigma` are
  the underlying index's annual mean and volatility. At L = 2 and
  sigma = 0.16 the volatility-decay term is about 2.6 percentage points a
  year; financing at a 4 to 5% short rate plus a spread costs another 4 to
  5 points. These must be shown on the methodology page.
- The current annual draws are normal; at 32% volatility a normal draw
  produces impossible returns (below -100%) often enough to matter. Switch
  the Monte Carlo to lognormal annual returns, or draw monthly, for every
  profile. That changes existing numeric tests and the seeded expectations
  in `test/lib/calculations/retirement.test.ts`, so it is its own PR.
- Raise `MAX_VOLATILITY` in `lib/constants/retirement.ts` or add a
  separate cap for the leveraged profile. Add `SHORT_RATE_ASSUMPTION`,
  `LEVERAGED_EXPENSE_RATIO`, and the glide-path rule for de-levering
  (for example, hold the leveraged share until age X, then step down) as
  cited constants.

**B. A new calculator: Leverage comparison** (`/tools/leverage-comparison`).
Inputs: monthly contribution, horizon, starting balance, leverage ratio,
leveraged share of contributions, index return and volatility assumptions.
Runs the same seeded engine for both paths and reports:

- Distribution of ending balances (median, 10th and 90th percentiles) for
  the plain index path and the leveraged path.
- Probability the leveraged path ends below the plain path.
- Worst drawdown distribution and the longest time underwater, because a
  2x fund's recovery time after a 2008-style year is the number most
  people underestimate.
- Dollar-cost-averaging effect: how much of the leveraged path's outcome
  comes from buying through drawdowns versus the leverage itself (compare
  against a lump-sum leveraged path).

This is the honest way to make the argument: the tool shows the upside
and the tail, and the user decides. The dashboard card is this calculator
run on the profile's taxable contribution.

**C. Cash-flow framing versus lump-sum framing.** The usual leveraged-vs-
index chart grows a single starting dollar over N years. That framing
answers the wrong question for someone investing out of each paycheck, and
it misstates the leveraged case in both directions:

- A deterministic CAGR line ignores volatility decay, so it flatters the
  leveraged fund.
- A single historical path starting at a bad date (2000, 2007) buries the
  leveraged fund under one drawdown it never recovers from within the
  window, so it punishes it.

With monthly contributions the terminal value is a sum of many small
positions, each compounding from its own entry date. Three things follow,
and the tool should show each of them separately rather than asserting a
net effect:

1. **Sequence exposure shrinks.** Early contributions are small relative to
   the eventual balance, so an early crash hurts less than in the lump-sum
   case, and a late crash hurts both paths roughly equally.
2. **Drawdown buying is convex in leverage.** A 2x fund falls further than
   the index in a drawdown, so a fixed monthly dollar buys proportionally
   more of it at the bottom. The recovery is also larger, so the
   contributions made during the drawdown carry more of the final value.
   This is the mechanism behind the "DCA helps leverage more" intuition.
3. **The left tail does not go away.** A long flat or falling decade (1966
   to 1982 in real terms, 2000 to 2012) still leaves the leveraged DCA path
   behind the index DCA path, sometimes badly. Decay is paid every year
   regardless of contribution timing.

Modeling requirements that follow from this:

- Equal dollars in on both paths, same dates. Compare money-weighted
  return (IRR) and ending balance, not CAGR; CAGR is undefined for a
  contribution stream.
- Two engines, both reported. A Monte Carlo engine with monthly lognormal
  draws (the leveraged return model from part A applied monthly, so decay
  is captured path by path), and a historical engine that replays a monthly
  S&P 500 total-return series through the same leverage model. The monthly
  series from 1871 (Shiller data) is about 1,900 rows and ships fine as a
  client-side constant with a citation; a daily series does not. Note that
  a monthly replay understates daily-reset decay in violent months, and say
  so on the methodology page.
- Rolling-window historical results: for every start month in the series,
  run the N-year DCA on both paths and report the share of windows where
  the leveraged path ends ahead, the median and worst gap, and the longest
  stretch the leveraged path spent behind. This is the chart that answers
  "does cash flow actually help" better than any single path can.
- The "DCA effect" decomposition from part B: leveraged DCA minus index
  DCA, compared with leveraged lump sum minus index lump sum on the same
  total dollars, so the reader can see how much of the advantage is the
  contribution pattern versus the leverage itself.
- Inputs that matter here and nowhere else: contribution growth rate
  (raises with income), whether contributions pause in a drawdown (the
  behavioral failure mode the automation section exists to prevent), and
  a de-leveraging rule by age or by balance.

The result cards for the comparison calculator are therefore: ending
balance distribution (both engines), probability leveraged ends behind,
rolling-window win rate and worst gap, longest time behind, max drawdown,
and the DCA-effect decomposition.

### 5.4 Automation

Mostly a presentation change over existing output. `PayrollSetupGuide` and
`QuickActions` already turn an allocation into instructions. Add:

- An "Automation checklist" result card listing every recurring transfer
  the plan implies (payroll deferral %, IRA auto-invest, brokerage
  auto-buy, emergency fund top-up) with amounts and dates aligned to the pay
  frequency.
- A checkbox state per item persisted in the profile so the dashboard can
  show "4 of 6 automations set up."
- Copy linking automation to the DCA argument: the leveraged path only
  works if contributions are mechanical and continue through drawdowns.

## 6. Engineering plan

### 6.1 New and changed files

```
app/
  page.tsx                               rewrite: intent picker + pitch + tool list
  start/[intent]/page.tsx                intake wizard route
  overview/page.tsx                      dashboard
  tools/page.tsx                         plain tool list (current landing content)
  tools/leverage-comparison/             new calculator (+ methodology/)
  tools/emergency-fund/                  new calculator
  sitemap.ts                             add routes
components/
  guided/                                IntentPicker, Wizard, WizardStep, OptionCards,
                                         ProfileBanner, LookupHint
  dashboard/                             one card component per dashboard card
  ui/layouts/CalculatorLayout.tsx        mobileMode, sticky action bar
  ui/cards/BaseCard.tsx                  collapsible + summary
  ui/inputs/BaseInput.tsx                lookupHint
lib/
  profile/                               types, defaults, mappers, codec, completeness
  store/profileStore.ts
  calculations/emergencyFund.ts
  calculations/leveragedReturns.ts       leverage drag model
  calculations/leverageComparison.ts     two-path seeded simulation
  calculations/retirement.ts             'leveraged' profile, lognormal draws
  constants/retirement.ts                leverage + financing constants (cited)
  constants/laborMarket.ts               unemployment duration assumptions (cited)
  constants/intake.ts                    question definitions per intent
  formulas/                              leverage and emergency-fund formulas
test/
  lib/profile/                           mapper round-trips, codec, completeness
  lib/calculations/                      emergencyFund, leveragedReturns, leverageComparison
  components/guided/                     wizard navigation, intent picker
```

### 6.2 Phases and rough size

Sizes are relative to the existing codebase (the rebalancer's v3 multi-account
change is a useful "large" reference point).

| Phase | Scope | Size | Depends on |
|---|---|---|---|
| 0. Mobile layout | `CalculatorLayout` tabs mode, sticky bar, collapsible cards, compact charts, results-summary-first | medium | nothing |
| 1. Guided entry | Landing page rewrite, intent picker, intake wizard producing calculator hashes, `/tools` list page, field tiering (quick / look-up / assumptions) on all three calculators, lookup hints | medium-large | phase 0 for the mobile layout, otherwise independent |
| 2. Shared profile | `lib/profile/*`, `profileStore`, calculator mount order (hash > profile > store), "save to profile", profile hash codec | large | phase 1 (wizard writes the profile draft) |
| 3. Dashboard | `/overview`, dashboard cards, completeness card | medium | phase 2 |
| 4a. Emergency fund | `emergencyFund.ts` + constants + tests, new calculator page, preset hook into the paycheck allocator | medium | phase 2 for the preset, else standalone |
| 4b. Leverage | lognormal Monte Carlo (own PR), `leveragedReturns.ts`, `'leveraged'` risk profile, leverage-comparison calculator + methodology page | large | lognormal PR first |
| 4c. Automation | checklist card, persisted checkbox state, copy | small-medium | phase 2 for persistence |
| 5. Tone and docs | Strategy presets, copy pass, `CLAUDE.md` / `CONTRIBUTING.md` rule update, disclaimers, methodology pages | small, but needs a decision first | section 5.1 decision |
| 6. Saved scenarios and optional accounts | Named scenarios in the profile, short links replacing visible hashes, auth, server-side storage (plain or end-to-end encrypted), privacy page, export and delete | large; first server-side code in the repo | phase 2, section 9 decisions |

Phases 0 and 1 give the mobile and landing-page wins without touching the
stores or calculations. Phase 2 is the structural change. Phase 4 is where
the math and the testing burden live.

### 6.3 Things that must not break

- Every existing share link: hash decoding is untouched; the profile is an
  additional source, never a replacement.
- Seeded Monte Carlo reproducibility: the lognormal change alters results,
  so it ships alone with updated numeric tests and a methodology note.
- Coverage floors in `vitest.config.ts`: every new `lib/` module needs
  numeric tests from day one.
- The design-system rules: new components use semantic tokens, charts use
  `getChartTheme()`, and every new shared component lands in `/demo`.

## 7. Risks and tradeoffs

- **Leverage is the liability hotspot.** A general-audience site that
  defaults to 2x funds should expect readers who do not match the target
  profile. The intake should gate the `cashflow-investor` preset behind the
  qualifying questions (stable income, no debt above a threshold, horizon
  over 15 years, can tolerate a 60% drawdown) and fall back to `standard`
  otherwise. The comparison tool and the drawdown statistics are the
  mitigation; they should not be optional.
- **The normal-return engine undersells leveraged tail risk.** Shipping a
  leveraged profile on the current engine would be misleading. The
  lognormal change is a prerequisite, not a nice-to-have.
- **Emergency fund sizing is assumption-heavy.** Re-employment durations
  vary by field and by cycle. Show the shortfall probability and cite the
  source; do not present the months figure alone.
- **Profile sync complexity.** Two-way mapping between a profile and three
  calculators invites drift. The "reverse map writes only touched fields"
  rule and round-trip tests are what keep it honest.
- **Wizard fatigue.** Six screens is the ceiling for the per-tool intake.
  Anything beyond that belongs in the look-up group on the calculator.
- **The site's stated neutrality.** This is a product decision, not a code
  one. Section 5.1 gives the two options; the code plan assumes Option A.

## 8. Assumptions and open questions

Assumptions made in this sketch:

1. Results stay free and account-less. Accounts are optional and exist only
   to save a profile and named scenarios across visits and devices (section
   9). Until that lands, client-side only remains the constraint.
2. The three existing calculators keep their routes and share-link formats.
3. The philosophy ships as a selectable preset with the comparison always
   visible (Option A), and the "neutral tone" rule is reworded rather than
   deleted.
4. The intake wizard produces calculator hashes in phase 1 and only starts
   writing a profile in phase 2.

Questions that change the plan materially:

1. Should `cashflow-investor` be the default for everyone, the default only
   when the intake's qualifying answers match, or opt-in? The sketch assumes
   the middle option.
2. Is a 2x fund (SSO-like) the only leverage case, or should the engine
   support 3x and a leveraged share of contributions rather than all-or-
   nothing? The sketch supports a ratio and a share; both add inputs.
3. Should the landing page keep a direct, one-tap path to each calculator
   above the fold for returning users, or is "Just show me the tools" as a
   secondary link enough?
4. Does the dashboard need its own share link (profile hash), or is the
   profile strictly per-device? The codec is cheap; the question is whether
   a profile URL containing debts and balances is something to encourage.
5. Which of the two new calculators (emergency fund, leverage comparison)
   matters more? They are independent and the second is roughly twice the
   work.
6. For saved data (section 9): is the server allowed to see plaintext
   financial data, or should saves be end-to-end encrypted so the server
   only ever holds ciphertext? This decides the auth and storage design and
   the privacy promise on the landing page.

## 9. Retiring visible hashes, saving results, optional accounts

The goal: anyone can run a calculator and see results with no account; an
account is optional and exists to keep a profile and named scenarios for
later, on any device. Visible URL hashes go away as the user-facing share
and save mechanism.

### 9.1 What the hashes do today, and what must replace each job

| Job the hash does now | Replacement |
|---|---|
| Seed a calculator from somewhere else (wizard, dashboard) | Keep the codecs as an internal transport in phase 1; in phase 2 the calculators read the profile store directly (mount order: explicit scenario > profile > store), so the URL can be clean |
| Persist across reloads on one device | Already localStorage; the profile store makes it one record instead of three |
| Share a scenario with someone else | Short link: an opaque id (`/s/ab12cd`) that resolves to the encoded scenario, with or without an account; the encoded payload is the same compressed JSON the codecs produce today |
| Reproducibility for bug reports and methodology | Unchanged: the codecs stay, and a short link or an exported JSON file carries the same inputs |

So the codecs and their tests do not get deleted; they stop being visible.

### 9.2 Data model

- `profiles`: one per account, the `FinancialProfile` JSON from section 3,
  versioned by the same codec version rules (never break an old payload).
- `scenarios`: name, calculator id, inputs JSON, created and updated
  timestamps, optional note. A scenario is a snapshot; the profile is the
  live record. "Save this result" on a calculator creates a scenario from
  the current inputs.
- `short_links`: id, payload, calculator id, optional owner, optional
  expiry. Created on "Copy link" whether or not the user is signed in.
- Accounts hold no results, only inputs. Results are recomputed on load,
  which keeps the methodology honest (same inputs, same seed, same numbers)
  and means a calculation-engine fix flows to every saved scenario.

### 9.3 Two ways to hold the data

**Plain server-side storage.** Standard auth (magic link or passkeys via
Auth.js or a hosted provider), Postgres via Drizzle on Vercel, scenario
rows in the clear, encryption at rest from the database provider. Simplest
to build and to support (password reset, cross-device, future features
like email summaries). Cost: the site now holds income, balances and debts
for real people, which means a privacy policy, deletion and export
endpoints, breach exposure, and the landing page can no longer say
"nothing leaves your browser."

**End-to-end encrypted storage.** The browser encrypts the profile and
scenarios with a key the server never sees, and the server stores
ciphertext blobs keyed by account. Key options: a user passphrase run
through PBKDF2 or Argon2 in WebCrypto (losing the passphrase loses the
data, which must be said plainly), or a passkey-derived key via the WebAuthn
PRF extension (cleaner, but browser support is still uneven). The site
keeps its privacy promise almost intact ("we store an encrypted copy you
can read; we cannot"). Cost: no server-side features that need plaintext,
a recovery story that is the user's responsibility, and more client code.

Recommendation: decide this before writing any server code. For a site
whose pitch is sober math and no data collection, the encrypted design
fits the brand and limits liability; the plain design is the better fit if
the roadmap includes anything that reads user data server-side.

### 9.4 Client behaviour

- Local-first. The profile store stays the source of truth in the browser.
  Signing in merges the local profile into the account (newest `updatedAt`
  per section wins; a conflict screen is not worth building for a demo,
  but a "keep local / keep account" choice is cheap). Signing out keeps a
  local copy unless the user asks to clear it.
- Sync. Push on change (debounced), pull on sign-in and on focus. Stamp
  each write with `updatedAt`; last write wins.
- UI. A "Save" action on every result page: without an account it saves to
  this device and offers "Create an account to keep this on other devices";
  with an account it names the scenario. A "Scenarios" list on the
  dashboard. "Copy link" produces a short link.

### 9.5 Engineering shape

```
app/api/
  auth/[...nextauth]/route.ts         Auth.js handlers (or provider SDK)
  profile/route.ts                    GET / PUT the account profile
  scenarios/route.ts, [id]/route.ts   list / create / rename / delete
  links/route.ts, [id]/route.ts       create a short link / resolve one
app/s/[id]/page.tsx                   resolve a short link and open the calculator
app/account/page.tsx                  sign in, export, delete
lib/server/                           db client (Drizzle), schema, validation (zod)
lib/sync/                             client sync engine, encryption (if 9.3 picks E2E)
test/lib/server/, test/lib/sync/      API handler tests with a mocked db; crypto round-trips
```

Also required: a privacy page, env vars in Vercel for the database and
mail provider, migrations in CI, rate limiting on the link and auth routes,
and the `npm audit` gate now covering server dependencies.

### 9.6 Risks

- Scope. This is the first server-side code in the repo and the first time
  the site is responsible for someone else's data. It should land after the
  profile layer (phase 2), never before, so the client has one record to
  sync rather than three stores.
- Promise drift. The current copy says scenarios are shareable by URL and
  nothing is uploaded. Both change. Update the landing page, the README and
  `CLAUDE.md` in the same PR.
- Auth cost and spam. Magic links need a mail provider and abuse controls;
  passkeys avoid mail but need a fallback.
- Lock-in. Keep export (JSON of profile plus scenarios) from day one so an
  account is never the only copy.
