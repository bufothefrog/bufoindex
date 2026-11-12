# PR 1 of the follow-up stack: next-1-cleanup-and-fixes

Branch claude/next-1-cleanup-and-fixes, base 87e8bfb, target branch "next".
The site owner asked for the stack on 2026-11-12: "this was a lot of info at
once. create a stack for the PRs and we can merge to next and develop against
that for now", and said "we do not need to preserve any functionality from old
version of website." Old-site parity is not a goal. Calculator numbers for a
given profile do not change in this PR; lib/calculations/**,
test/lib/calculations/**, package.json and package-lock.json are untouched.

Commits (git log --oneline 87e8bfb..HEAD):
- 82470b4 a2-ticker-and-chart
- 0a9d19e a1-old-site-removal
- bb4a2ec a4-one-dollar-mode
- 630ee4c a5-navigation-and-entry
- df80630 a6-agreed-decisions
- 883ec03 a7-compact-summaries

## What changed per slice

### a1-old-site-removal
- The one-time import of the old site's localStorage keys and its per-calculator
  mappers are deleted; old keys are ignored.
- The write-back side of bindings (fromEngineInputs, write closures) is gone.
- migrateProfile only normalizes; the v1 new-cash leaf is dropped and the
  Brokerage deposit keeps its default.
- Golden fixtures kept; portfolio cases set the deposit directly.

### a2-ticker-and-chart
- Ticker box: picking an option sets the ticker at once and closes the list;
  Enter on a highlighted option no longer commits the typed text too; clicking
  elsewhere after typing a new ticker commits it.
- Savings Rate Impact chart: dashed line at the current savings rate, dot at the
  planned retirement age, caption sentence with both figures.

### a4-one-dollar-mode
- Leverage comparison, the /overview retirement and leverage cards and
  OpportunityCostCard follow the stored today's/future dollars mode (3% basis).
  One toggle at the top of the profile overview. Engine numbers unchanged.

### a5-navigation-and-entry
- Header with site name, Overview, the four calculators (a Calculators
  disclosure below lg) and the theme toggle.
- Home preview cards link to bare calculator paths; empty overview and What next
  list calculators through CalculatorLinks.

### a6-agreed-decisions
- CalculatorLayout provides useRevealInputs(); QuickActions calls
  revealInputs(() => focusScreen(screen)). CalculatorPage unchanged.
- New token --negative / class text-negative. Light mode equals --destructive
  (unchanged); dark mode is 0 91% 71%. TONE_TEXT.negative and every other
  text-destructive use now use it. bg-destructive / text-destructive-foreground
  pairs, borders and tints keep --destructive.
- docs/redesign-guided-flow.md sections 1, 2.5 and 6 start with a note that they
  are historical.
- test/lib/design-system/contrast.test.ts pins dark contrast (>= 4.5:1).

### a7-compact-summaries
- lib/fields/shared.ts has summary pieces (age, state, filing status, gross pay,
  pay frequency, take-home, monthly cost); the seven core specs and coreSummary
  in lib/constants/intake.ts use them, so the wording exists once.
- lib/fields/runtime.ts has fallbackSummary; summarizeScreen applies it for the
  whole screen only when no field gives its own summary.
- CollapsedSummaries.test.tsx covers all four calculators, default and rich
  profile: non-empty, not the description, at most 120 characters.
- EntryPoints and LearnChooser pins updated by the committer to the new recap.

## What a visitor sees differently (before -> after)

- Quick actions (paycheck): on a phone with Results open, a press did nothing
  visible -> selects Inputs, scrolls to the section and focuses it. Desktop:
  scrolled only -> scrolls and focuses.
- Dark mode red text (negative figures, error messages, asterisks, unbalanced
  total, remove hover, LaTeX errors): #7f1d1d -> #f87272. Light unchanged.
- /demo Colors: new "Negative text" swatch. /demo Typography: error sample uses
  text-negative.
- Collapsed paycheck "A little about you": "Age sets the time horizon. State and
  filing status set the tax estimate." -> "30, TX, single".
- Collapsed paycheck pay card: "A close guess is fine." -> "$3,500 gross every 2
  weeks, $2,600 take-home".
- Collapsed paycheck must-pay card: empty line -> "$3,000 a month".
- Retirement "A little about you": description -> "30, TX" (single filer);
  "30, TX, married filing separately, run here as single" when that applies.
- Retirement pay card -> "$3,500 gross every 2 weeks"; must-pay -> "$3,000 a month".
- Recap on /start/choose and the Continue card: "30, TX, single, $3,500 every 2
  weeks, $3,000/mo must-pay" -> "30, TX, single, $3,500 gross every 2 weeks,
  $2,600 take-home, $3,000 a month in must-pay costs". Gross alone: "$4,250 per
  paycheck" -> "$4,250 gross per paycheck". Frequency without gross: "$3,000/mo
  must-pay" -> "$3,000 a month in must-pay costs". Take-home alone: nothing ->
  "$2,600 take-home".
- Header, home cards, empty overview and What next (a5), dollar-mode toggle on
  leverage and overview (a4), ticker and savings chart (a2): see above.
- Old saved inputs from the previous site are no longer imported (a1).

## Deferred and why
- Light-mode contrast of red text (3.76:1 on white), red on light muted (3.43:1)
  and the filled light destructive button (3.59:1): the decision covered dark
  mode only.
- Wizard error box and the layout's "fields need attention" line keep their
  dark:text-foreground override; dropping it is a separate visual choice.
- Borders and tints keep --destructive (not text).
- Take-home is its own summary piece instead of "X gross and Y take-home every
  ..." because a summary cannot see which fields are on its screen and the
  retirement pay card has no take-home field.
- Optional: retirement FILING summary (lib/calculators/retirement/form.ts) could
  return filingStatusSummary(value) so its card reads "30, TX, single"; pin in
  test/lib/calculators/retirement/form.test.ts would change.
- Optional: doc comment in lib/constants/frequency.ts line 28 still shows the
  old "$3,500 every 2 weeks" example.
- The a6 builder had no map file; none was read.

## For the next PRs of the stack
- Use text-negative for red text, never text-destructive; keep bg-destructive
  only with text-destructive-foreground.
- To add a collapsed-card line, add a piece in lib/fields/shared.ts and use it in
  coreSummary too; the CollapsedSummaries test will fail for an empty card or a
  line over 120 characters.
- Any change to recap wording must update EntryPoints.test.tsx and
  LearnChooser.test.tsx pins.
- Components that need the phone Inputs tab opened use useRevealInputs() from
  components/ui/layouts/CalculatorLayout.tsx.
- Gates on this tree: type-check, lint --max-warnings=0, test:coverage (111
  files, 2094 tests), Node 24 suite and build all pass.
