# Open items

What is still open after the rebuild and the follow-up pull requests, in one place. Each line was re-checked against
the code when this list was written (staging branch `next`, commit 59a7597); a line that names a file gives the place
to look. Anything found fixed was left out. "Not re-checked" marks a line that needs a browser or a bundle
measurement to confirm.

Where a line came from: the hand-off notes of the rebuild (phases 1 to 5) and of the follow-up pull requests (PR 1 to
PR 6), and the production audit of 2026-10-08. Those files were deleted when this list was written; they are in git
history (for example `git show 7ae4bff:docs/production-audit.md`, or the folder `docs/agents/agent-communication/`
at that commit). A tag like (PR 5, Q3) names the note and its question number.

When an item is done, delete its line. When work leaves something open, add a line here, not a new note.

## 1. Likely defects still present

- On the portfolio rebalancer, the "What next?" card offers "Answer a few quick questions" and says they cover age,
  state, filing status, pay and must-pay costs, but its link (`coreStartLink('portfolio')`) goes to /start/portfolio,
  which asks none of the basics (components/guided/NextSteps.tsx:70-75, lib/constants/intake.ts:157). (rebuild 4)
- The header's "Calculators" list (below lg) closes on Escape, on a link and on a click outside, but stays open when
  keyboard focus tabs past it (components/shared/UtilityBar.tsx:62-80). (PR 1)
- The site name link in the header sits outside the "Site" navigation landmark (components/shared/UtilityBar.tsx:90).
  (PR 1)
- Next on the wizard's accounts screen marks the accounts, holdings and securities answered (the ACCOUNTS field covers
  all three, lib/fields/shared.ts:308), so a visitor who leaves after that screen has the holdings topic counted as
  answered, remaining mode does not ask the holdings screen, and the example holdings are stored as the visitor's.
  (PR 4)
- A generic collapsed summary prints the unit as is: an answered 1 month reads "Emergency fund target: 1 months"
  (lib/fields/runtime.ts:359-360 with the ' months' suffix of lib/fields/shared.ts:283). (PR 3)
- Red text in light mode (`--negative`, equal to `--destructive`, app/globals.css:113-115) measured 3.76:1 on white,
  3.43:1 on the light muted surface, and the filled destructive button 3.59:1, all under 4.5:1; the dark-mode fix of
  PR 1 left light mode as it was. Tokens unchanged; contrast not re-measured. (PR 1, audit W7)
- At 1024 px the open "Leverage ratio" select on the leverage page cuts off its value (seen before PR 6 as well).
  Not re-checked. (PR 6)

## 2. Open questions where a default is built

Each line states what the code does today. None of these defaults is an owner decision; each was chosen by the
session that built it, to be confirmed or changed.

### Guided intake and profile

- Basics need the visitor's own entry before Next; the three basics screens do not take the typical value
  (`nextNeedsOwnAnswer`, lib/constants/intake.ts:225). Not an owner decision. (PR 2)
- Back is a control beside the progress display, not a footer button (components/guided/BackControl.tsx, placed in
  components/guided/Wizard.tsx:568). Not an owner decision. (PR 2)
- Save on an unanswered review topic (/start/review/<topic>) stores the typical values of every field on it, as Next
  does, rather than only the fields the visitor touched. Not an owner decision. (PR 2)
- Slider fields are not blanked on an unanswered wizard screen; they show their typical value
  (`FieldDisplay` in components/fields/FieldInput.tsx:33-40). Not an owner decision. (PR 2)
- The grey placeholder uses the same token in dark mode (measured 3.81:1 on the dark background, above 3:1 for its
  large text); no lighter dark-mode placeholder token. Not re-measured. Not an owner decision. (PR 2)
- The dashboard's completeness card links no further once the required topics are done; the Optional section (Social
  Security and healthcare) is reached through /start/review and /start/profile only. Not an owner decision. (PR 2)
- A profile finished before PR 3 (16 of 16 topics) loads as one topic short and is asked the emergency fund months
  screen; it is not counted as complete. Not an owner decision. (PR 3)
- Answers to calculator-only questions (leverage ratio, claiming age, contribution timing, monthly investing, new cash)
  are asked on their calculator only and kept in the stored profile between visits until set back to Auto. Not an
  owner decision. (PR 3; PR 4, Q4; PR 5, Q9)
- Assumption screens are not asked in the /start intakes or the profile form; they stay as collapsed cards on the
  calculator pages (the tier check in lib/constants/intake.ts and lib/calculators/forms.ts). Not an owner decision.
  (PR 3)
- The worked example's take-home pay (2,550 per paycheck) was worked out with the site's own tax functions and
  stored as a fixed default (`DEFAULT_NET_PER_PAYCHECK`, lib/profile/defaults.ts:103); it does not follow other gross
  pay. Not an owner decision. (PR 3)
- Derived typical values while unanswered: emergency fund balance = 3 x must-pay; target retirement income = 12 x
  (must-pay + midpoint of fun money), rounded to 1,000; HSA coverage = family when married filing jointly, else
  individual; retirement bracket = the bracket of the target retirement income after the standard deduction (all in
  lib/profile/derived.ts). Not an owner decision. (PR 3)
- A stored retirement bracket that is not one of the seven federal rates is read as the nearest rate, ties to the
  lower, and is never rewritten (`retirementBracketFrom`, lib/calculators/paycheck/bindings.ts). Not an owner
  decision. (PR 3)
- The current federal bracket is computed from pay: yearly gross minus the traditional 401(k) share (capped at the
  402(g) limit) minus HSA payroll money (capped) minus the standard deduction (`currentBracketFrom` in
  lib/calculators/paycheck/bindings.ts, lib/calculations/taxBracket.ts). Not an owner decision. (PR 3)
- The Social Security Auto estimate treats current gross pay as the 35-year earnings average, counts one worker's own
  benefit (a joint filer's pay as one worker's pay), and models no spousal or survivor benefit and no bonus pay
  (lib/calculations/socialSecurityEstimate.ts, lib/calculators/retirement/income.ts; stated on the methodology page).
  Not an owner decision. (PR 3)
- An unanswered stored Social Security benefit loads as Auto, and an unanswered stored emergency fund target loads as 3
  months (`UNANSWERED_LOADS_AS`, lib/profile/defaults.ts:657). Not an owner decision. (PR 3)
- Old saved inputs of the previous site ('retirement-calculator', 'paycheck-allocator-storage') stay in localStorage
  unread, and a version 1 'bufo-profile' loses its new-cash value and its old displayMode. This reads the owner's
  "we do not need to preserve any functionality from old version of website"; the detail is not an owner decision.
  (PR 1)

### Accounts and the rebalancer

- Accounts that hold the emergency fund replace the typed emergency fund rather than add to it; the typed number counts
  again once no account holds it (`emergencyFundBalance`, lib/profile/accounts.ts:376). Not an owner decision.
  (PR 4, Q1)
- Employer money (401(k) match, employer HSA) counts in monthly investing and in an account's new cash
  (`contributionParts`, lib/profile/accounts.ts:454). Not an owner decision. (PR 4, Q2)
- The rebalancer's default new cash is every normal contribution, payroll money included, each routed to the first
  account of its kind (`normalNewCash`, lib/profile/accounts.ts:541). Not an owner decision. (PR 4, Q3)
- A cash or savings account always counts as the emergency fund; savings for other goals is not modeled
  (`isEmergencyFundAccount`, lib/profile/accounts.ts:362). Not an owner decision. (PR 4, Q5)
- Accounts known only by a typed balance are listed under "Not rebalanced: ... (no holdings entered)." and never sent
  to the engine (`rebalancedAccounts`, `notRebalancedNote` in lib/profile/accounts.ts). Not an owner decision.
  (PR 4, Q6)
- The leverage comparison starts from every invested account except the emergency fund, not only taxable ones
  (`derivedStartingBalance`, lib/calculators/leverage/bindings.ts:62). Not an owner decision. (PR 4, Q7)

### Contribution timing and the paycheck allocator

- A yearly contribution is entered as its monthly equivalent (625 for 7,500 a year), not typed as a yearly amount. Not
  an owner decision. (PR 5, Q1)
- The timing controls read "Start of each year" / "Once a year, at the start: $X" and sit on the retirement page's
  Monthly investing card, shown to every visitor, one radio group per part in use. Not an owner decision.
  (PR 5, Q2 and Q10)
- The leverage headline always uses monthly contributions; "Start of each year" is only the comparison row, whatever
  the taxable timing. Not an owner decision. (PR 5, Q3)
- With no starter fund, the one emergency step comes after the employer match and high-interest debt; no emergency
  card is "critical" any more. Not an owner decision. (PR 5, Q4)
- The quick action "Emergency Fund Below One Month of Expenses" ("3-6 months" to implement) still compares cash with
  one month, while the step card compares it with the target months, so a visitor at 1.5 months sees no quick action
  but a "Building emergency fund" card (components/paycheck-allocator/QuickActions.tsx:166-172). Not an owner
  decision. (PR 5, Q4)
- The 3-month cash cap stays at 3 (`CASH_MONTHS_CAP`, lib/calculations/analysis.ts:56). Not an owner decision.
  (PR 5, Q5)
- The under-30 Roth rule and the "12% today and in retirement gives Roth" rule are unchanged; their texts print both
  brackets (lib/calculations/optimization.ts:303-318). Not an owner decision. (PR 5, Q6)
- "Start of the year" means the run's first day, not the calendar year; the methodology page states the error. Not an
  owner decision. (PR 5, Q7)
- The leverage noise threshold was not recalibrated for monthly against start of year. Not an owner decision.
  (PR 5, Q8)
- An emergency target of 0 months: the step card reads "Complete 0-month emergency fund"
  (lib/utils/stepStatusUtils.ts:343), the step is not counted done in the progress bar, and the card keeps its "High
  impact" note with nothing allocated. Not an owner decision. (PR 5, Q11)
- The debt badge on the paycheck page follows the engine's 7% high-interest line with two tiers ("High-interest (over
  7%)" / "7% or less", components/calculators/renderers/paycheck.tsx:48), not the old 8% and 5% tiers. Not an owner
  decision. (rebuild 3 and 5)

### Layout and display

- Retirement chart captions sit below each chart (a figcaption) rather than above right, and the retirement page
  header shows two tiles (withdrawal rate, scenario count) rather than the full headline
  (app/tools/retirement-calculator/components/ResultsSection.tsx:62). Not an owner decision. (rebuild 3 and 5)
- Leverage input cards start collapsed to their summary line at every width, phones included. Not an owner decision.
  (PR 6, Q1)
- Leverage "Model and caveats" is set in two text columns on desktop. Not an owner decision. (PR 6, Q2)
- Leverage "Monthly vs start of each year" and "Tail and drawdown" sit side by side on desktop. Not an owner decision.
  (PR 6, Q3)
- On /overview a last card alone in its row spans both columns. Not an owner decision. (PR 6, Q4)
- The disclaimer is narrowed to reading width (max-w-prose). Not an owner decision. (PR 6, Q5)
- The methodology page text is capped at reading width with its left edge in line with the calculators. Not an owner
  decision. (PR 6, Q6)
- The paycheck Financial Impact block shows label over value without bordered rows. Not an owner decision. (PR 6, Q7)
- Header and content edges are not lined up on wide screens. Not an owner decision. (PR 6, Q8)
- The leverage headline figures sit three in a row on desktop. Not an owner decision. (PR 6, Q9)
- On the leverage page the "What next?" card sets its links in two columns on desktop (with a filled profile it leaves
  about 250 px empty under its left column at 1440), and the methodology variable rows are capped at reading width.
  Not an owner decision. (PR 6, Q10)
- On the leverage page at 1024 to 1279 px the Assumptions card, alone in the second row, spans the row. Not an owner
  decision. (PR 6, Q11)
- The leverage input cards have uneven collapsed heights from 1280 px (Assumptions wraps Restore defaults above its
  title). Not an owner decision. (PR 6)
- The dashboard simulations (retirement and leverage cards) run on the main thread after first paint
  (`useDeferredResult`); the leverage card runs the calculator's 500 paths. Moving them to a worker is open. Not an
  owner decision. (rebuild 4 and 5)

## 3. Known limits

- Debt step: `calculateHighInterestDebt` removes only the extra payment from the money left, so a card's minimum
  payment stays available and can fund the emergency step (lib/calculations/optimization.ts:208-213). Fixing it moves
  allocations for every visitor with high-interest debt. (PR 5)
- Retirement withdrawal tax: the engine takes only single and married filing jointly (`retirementFilingStatus`,
  lib/calculators/retirement/bindings.ts:45; `calculateEffectiveTaxRate`, lib/calculations/retirement.ts:361), so
  married filing separately and head of household run as single, although lib/constants/irs-2026.ts has brackets and
  deductions for all four. The retirement page says so in a note (`filingStatusNote`). (rebuild 3, PR 2)
- `contributionParts` caps the 401(k) deferral at the 402(g) limit and computes the match on the capped deferral; the
  paycheck allocator's ten-year projection (lib/calculations/projections.ts) does not cap it, so the two differ for a
  high election. IRA monthly amounts are capped in neither. (PR 4)
- An account with a typed balance above 0 and holdings worth 0 counts the typed balance in the invested total but goes
  to the rebalancer with a value of 0. (PR 4)
- The rebalancer's "New cash this month" card renders open; collapsing it needs a calculator-page affordance that does
  not exist. When no account can take new cash it stays and reads "No account can take new cash."
  (components/calculators/renderers/portfolio.tsx:141). (PR 4)
- The holdings editor has no per-account target column; targets are portfolio-wide. (PR 4)
- A version 2 profile that typed the emergency fund and also held it in a brokerage account keeps that double count
  after migration: the account migrates as an ordinary brokerage row, so the emergency fund and the invested total
  stay as in version 2 until the visitor ticks "Holds my emergency fund" on that account (lib/profile/migrateV2.ts,
  run from lib/profile/migrate.ts:33). (PR 4, example 6)
- Typical values a version 2 visitor accepted with Next migrate as money the visitor entered: the example Roth IRA
  (4,100) and Brokerage (8,775) rows become the visitor's own account rows, so the paycheck allocator's Roth IRA
  balance can read 4,100 with ira.roth answered No (lib/profile/migrateV2.ts). (PR 4, example 8)
- Not in the account model: per-account yields, cash accounts that are not the emergency fund, routing new cash to
  more than the first account of each kind, importing holdings, a rebalancer option to exclude an account, stronger
  rebalancer example numbers. (PR 4)
- Social Security figures stay at 2026 (bend points 1,286 and 7,749, base 184,500) although SSA already lists 2027
  figures; a year change edits only lib/constants/social-security-2026.ts. (PR 3)
- A generic summary of a partly answered optional screen reads "Social Security benefit: Auto", not "estimate"
  (lib/fields/runtime.ts:355). (PR 3)
- A blank wizard state field shows its empty "Select" option; no state has a typical value. A blank select's
  placeholder option ("Family") is what a screen reader reads as its value; the field stays unanswered. (PR 3)
- Quick actions scroll to their input section by its title (`section[aria-label="<title>"]`,
  components/paycheck-allocator/QuickActions.tsx:84), so screen titles must stay unique; a stable screen id would be
  sturdier. (rebuild 3)
- The wizard error box and the calculator layout's "fields need attention" line keep a `dark:text-foreground` override
  instead of `text-negative` (components/guided/Wizard.tsx:614, components/ui/layouts/CalculatorLayout.tsx:382).
  Borders and tints keep `--destructive`. (PR 1)
- Take-home pay is its own summary piece instead of "X gross and Y take-home every ...", because a summary cannot see
  which fields share its screen. (PR 1)
- The header is tight at 320 px. Not re-checked. (PR 1)
- The /demo ChartTooltipCard sample has no dollar-mode suffix, unlike the production chart tooltip
  (app/demo/sections/ChartsSection.tsx:46-55). (PR 1)
- Test gaps found by mutation that no test catches: the 1.25 enhanced-lifestyle multiplier
  (lib/calculations/retirement.ts:657), the 0.90 multiplier of the on-track conservative scenario
  (lib/calculations/retirement.ts:767), and the `Math.max` in `fiYearsEarlier` (lib/calculations/projections.ts:215).
- Test gaps in the savings-rate label placement (savingsRateLabelPositions): mutations M10 (no right bound), M11
  (offLine always true), M14 (rate label overlaps the dot) and M26 (dot radius doubled) fail no test, and neither do
  the weakest readings of M19, M21 and M27 (below baseline at dot.y + DOT_GAP + ASCENT, the line read at rate + 1
  point, above with bottomAt at dot.y - DOT_GAP). (PR 6)
- Some PR 6 layout rules are checked only in a browser, and no unit test fails when one is reverted: the NextSteps
  columns layout (components/guided/NextSteps.tsx), the rule that lets a last input card alone span the row from lg
  to below xl and the results skeleton's `lg:min-h-screen` (components/calculators/shared/CalculatorPage.tsx), and the
  account editor's container query (components/calculators/renderers/accounts.tsx). (PR 6)
- The leverage page at 1280 px logs a Recharts "width(0) and height(0)" console warning now and then.
- Shared-layer constraints (rebuild 1): a list row's field callbacks see only that row, so a row whose options depend
  on another list needs a custom renderer; `validateFields` has no surface filter, so a page validates per screen; a
  derived binding with an `errorPath` maps row errors to that one path (the row index is lost); dynamic options that
  resolve to an empty list switch off the option check; `toEngineInputs` does not clone, so engines must not mutate
  their inputs; `setAt` throws a RangeError for a numeric-keyed record entry in a missing record; a later binding with
  a shorter engine path that overwrites a longer one ('a' after 'a.b') is not detected (lib/fields/binding.ts:72-75).
- Shared-layer constraints (rebuild 1): zustand persist calls `migrate` for any stored version other than the current
  one, newer ones included (the store reads a newer payload and never writes it back); a class target's `accountId`
  of '' counts as dangling; `SegmentedControl` has no disabled option; a StatTile tone colours its border and surface,
  never the figure; `KeyValueList` prints the prefix before the missing-value glyph, so callers omit it for null;
  DataTable numeric cells are not monospace; `useChartTheme` throws outside `ThemeProvider` (chart tests need it and a
  matchMedia stub); `CHART_FONT_MONO_FALLBACK` (lib/chart-theme.ts:27) repeats `--font-mono` in app/globals.css, so
  change both together.
- Test helpers (rebuild 1): mock next/navigation in the order-independent form
  `vi.mock('next/navigation', async () => (await import('@/test/utils/navigation')).nextNavigationFactory())`;
  `resetProfileStore` and `renderWithProfile` mark every seeded leaf as provided.

## 4. Still open from the production audit (2026-10-08)

The audit measured an older build; its numbers are not current. Items it raised that are done since (M1 to M3, H1 to
H6, H8, W12, and the typography plugin of W10) are left out, and so is what this pull request adds (baseline security
headers, /demo noindex).

- W1: /start is the one dynamic route, only because it awaits `searchParams` for `?next`
  (app/start/page.tsx:22-25).
- W2 (rest): beyond the baseline headers, there is no script-src or style-src content security policy, no HSTS
  header from the app and no Cross-Origin-Opener-Policy; whether Vercel adds HSTS is unverified.
- W3: `compiler.removeConsole` strips every console call in production, error and warn included (next.config.js);
  app/error.tsx does not log the error it receives; there is no app/global-error.tsx.
- W4: no real-user measurement (no Speed Insights, no web-vitals reporting); adding it touches the privacy copy, so it
  is the owner's call.
- W5: the formula side-effect import and the eager ContinueProfileCard are gone, but app/page.tsx still imports
  lib/constants/intake.ts, which imports the calculator forms; whether engine code still reaches the landing page was
  not re-measured.
- W6: the Radix slider ships with every PercentInput (components/ui/inputs/PercentInput.tsx:9), and /start/choose loads
  the whole Wizard because LearnChooser imports `isCoreReady` from it (components/guided/LearnChooser.tsx:21).
- W7 (rest): light `--muted-foreground` is unchanged at 46.9% lightness (app/globals.css:110) and dark mode has no
  separate primary text token; `CardTitle` always renders an h3 (components/ui/card.tsx:31), which breaks heading
  order on some pages. Contrast and heading order not re-measured.
- W8: skeleton heights (components/dashboard/OverviewSkeleton.tsx, the Wizard loading state) against the content that
  replaces them. Not re-checked.
- W9: inline CSS (`experimental.inlineCss`) was proposed as a preview A/B test; not tried.
- W10 (rest): Tailwind still scans docs and tests (no `@source not` in app/globals.css).
- W13: the leverage engine still sorts every month's values for its bands (lib/calculations/leverageComparison.ts:
  289, 295); bands only at the plotted months, or quickselect, would cut engine time with the same output.
- W14: the Greek sigma in the leverage results (app/tools/leverage-comparison/components/LeverageResults.tsx:257)
  makes the page download the Inter Greek subset late.
- W15: Recharts' Redux DevTools hook stays on in production (no `Global.devToolsEnabled = false`), and
  next.config.js does not set `agentRules: false`.
- H7 (rest): the leverage engine has no option to skip the per-month bands the dashboard card does not show.
