# PR 2 of the follow-up stack: next-2-wizard

Branch claude/next-2-wizard, base 6291ddf (head of PR 1), target branch "next".
The site owner asked for the stack on 2026-11-12. Their words that this PR
answers:
- "i also want to minimize an abundance of options, for example in screenshot, it should just be skip or next. i dont think we should have people autofill a typical value since it may be bad for them, though if they click next it is the suggested typical if that makes sense."
- "i think social security benefit/annual healthcare cost should be auto by default for both and only offer to manually change it, but not necessarily a part of the form, maybe just an optional section for all optional info."
- "i dont think we need this many explainers in general (2nd screenshot about hsa). the for mshould not be used for education."
- "certain other things like seeing the data in a compact fashion would be nice rather than having to click edit to see info."
- "we do not need to preserve any functionality from old version of website."

Everything else here is the orchestrating session's design. Calculator numbers
for a stored profile do not change; lib/calculations/**, test/lib/calculations/**,
package.json, package-lock.json and the values in lib/profile/defaults.ts are
untouched (git diff --stat 6291ddf on those paths prints nothing).

Commits (git log --oneline 6291ddf..HEAD):
- 013aaba b1-fewer-explainers
- 8d7118b b2-skip-or-next
- a4f6abc b3-optional-section
- 9ae614f b4-review-page
- a45e3de this note (first version)
- review fixes: e84faba b1, c46dcbe b2, e92e82a b3, e417860 b4
- this note (updated for the review fixes)

## What changed per slice

### b1-fewer-explainers
- Each field keeps at most one supporting line (help or hint, never both), 12
  words or fewer. Screen descriptions stay only when they state a dollar or
  price basis.
- The HSA notes, taxable-account note and leverage seed note are removed. The
  HSA yearly limit is the help line of the monthly HSA contribution field.
- Coverage options are plain Individual / Family; coaching and purchase-mode
  option text is 8 words or fewer.
- A collapsed section with no summary and no description shows "Not answered yet".
- test/lib/calculators/explainerBudget.test.ts enforces a 30-word budget per
  screen over every calculator form and the profile form.

### b2-skip-or-next
- Every wizard screen has two footer actions, Skip and Next (Finish on the last
  screen). Back sits beside the progress display.
- Unanswered fields show empty with the typical value as a grey placeholder.
  Next takes the typical value; Skip keeps it unmarked.
- Each Next and Skip saves through the helpers in wizardProgress.ts, so leaving
  mid-flow keeps confirmed answers. The save is built from confirmedProfile
  (the arrival profile plus each answered screen's values as the visitor left
  it with Next, in form order), so an edit on an earlier screen that was not
  confirmed again with Next is neither saved nor fed to the derived writes.
- Skip reverts and unmarks the screen's visible paths, its coupled writes and
  the paths it gave when it was answered (fields hidden since by a toggle).
- A blank percent field with a slider puts the slider and its readout at the
  typical value (the minimum when there is none), not at 0.
- Input primitives gain value null, placeholderValue, showZero and onClear.

### b3-optional-section
- ScreenSpec.optional (lib/fields/types.ts) marks a screen optional. No list of
  ids exists in code. The retirement screen ss-healthcare (Social Security
  benefit, claiming age, annual healthcare cost) is marked in
  lib/calculators/retirement/form.ts.
- composeProfileForm (lib/calculators/forms.ts) asks optional screens last in a
  section "Optional". requiredScreens() drops them; profileCompleteness counts
  required screens only (17 topics become 16).
- intakeForm drops optional screens for /start/<intent>; remainingIntakeScreens
  returns required screens only, so isProfileFinished, the chooser counts and
  the dashboard card ignore them. /start/profile still asks an unanswered one.
- The calculator page is unchanged. No saved profile needs migration.

### b4-review-page
- /start/review is a read-only list: one group per profile section, one row per
  topic with a summary of answered values only ("Not answered" otherwise) and a
  link "Edit" or "Answer" (accessible name "Edit: <title>").
- Summary rules live in lib/calculators/profileReview.ts. "Answered" means the
  path is in profile.provided. A partly answered topic lists only answered
  fields as "Label: value", so no typical value is shown as an answer.
- New route /start/review/[screen] renders Wizard with the new onlyScreen prop:
  same fields, validation and save path as Next, with Save and Cancel, no Skip,
  Back or progress. Unknown ids are a 404; a topic hidden by saved answers
  returns to /start/review.
- ReviewTopicRow is in the /demo Guided section.

## What a visitor sees differently (before -> after)

### Explainers (b1)
| Screen / field | Before | After |
|---|---|---|
| Paycheck, HSA section | notes: three tax advantages; limit per year/month; reimbursement timing; held as investment; HSA and Roth compared | removed |
| Paycheck, taxable accounts | note: "Taxable accounts: No contribution limits..." | removed |
| HSA coverage options | "Individual ($X limit)" / "Family ($Y limit)" | "Individual" / "Family" |
| Monthly HSA contribution | no limit line | "Up to $X a year with employer money ($Y a month)." |
| Paycheck, age | "Used for catch-up contribution eligibility" | none |
| Paycheck, must-pay | "Rent, utilities, groceries, minimum debt payments, insurance, etc." | none |
| Paycheck, fun money screen | "Spending on things you enjoy, beyond the must-pay costs. A range is fine." | none |
| Paycheck, match screen | "Matches are often written as ..." | none |
| Paycheck, match option Yes | "Not sure? Pick Yes and check your benefits portal later." | "Yes" |
| Employer match rate | "What your employer adds per dollar you contribute. 50% means 50 cents per dollar." | "Per dollar you contribute; 50% means 50 cents." |
| Match limit | "In "50% of the first 6%", this is the 6%." | "The 6% in "50% of the first 6%"." |
| 401(k) share | "The share of each paycheck you put into the plan, all types together." | "Share of pay, all types together." |
| Roth share | "The rest of your contribution is traditional (pre-tax). A Roth part above the total counts as the whole contribution." | "Percent of pay; the rest is traditional." |
| 401(k) contribution type (wizard and paycheck page) | "Traditional reduces taxable income now, Roth is tax-free in retirement" | none |
| Emergency fund months | "Months of expenses to save (typically 3-6)" | "Months of expenses to hold in cash." |
| Retirement tax bracket | "The federal bracket you expect when you withdraw, weighed against the 22% bracket the allocator uses today." | "Federal bracket you expect when withdrawing, compared with today's 22%." |
| Fixed 22% note | "Tax savings in this allocator use a fixed 22% federal bracket plus one 2026 rate for your state. Brackets are not calculated from your income." | "Tax savings use a fixed 22% federal bracket and one 2026 state rate, whatever your income." |
| Savings and investing fields | "A rough total across 401(k), IRA, and brokerage accounts is fine. Leave out your emergency fund." / "What you put toward investing each month ..." / "The rate your savings account pays. A guess is fine." | "Total across 401(k), IRA and brokerage, not your emergency fund." / "All accounts together, including your own 401(k) contributions." / none |
| Core "A little about you" | "Age sets the time horizon. State and filing status set the tax estimate." | none (summary shows values once answered) |
| Core pay card | "A close guess is fine." | none |
| Emergency presets | "About 1 month in cash backed by a plan, automated contributions, and a leverage comparison for long horizons." / "About 3 months of must-pay costs in cash, then unleveraged index funds." and the line "This sets your starting emergency-fund target. Both presets run through ..." | "About 1 month of must-pay costs in cash." / "About 3 months of must-pay costs in cash." / removed |
| Target mix options | one-line descriptions per mix | none, except Custom: "Set a target for each asset class." |
| Portfolio, accounts screen | "List each account you invest through and the new cash going into it." | none |
| Portfolio, holdings screen | "A ticker, its current price and your shares. Prices are taken as current and executable." | "Prices are taken as current and executable." |
| Portfolio, new cash | "Money you are ready to put into your accounts now." | "Money to invest now." |
| Portfolio, share rounding | "Floor to integers; leftover kept as cash." / "Exact-to-penny splits. Requires broker support." | "Rounds down; leftover stays as cash." / "Exact amounts; your broker must allow fractions." |
| Leverage, starting balance | wizard: "What you already have invested. A rough number is fine."; calculator page: "Already invested at month 0. Use 0 to compare contributions only." | wizard: "Money already invested; 0 compares contributions only."; calculator page: "Invested at month 0; 0 compares contributions only." |
| Leverage, financing rate | "Short-term rate plus a swap spread, charged on the extra (L - 1) exposure." | "Short-term rate plus swap spread, charged on the extra (L-1) exposure." |
| Profile, leverage-ratio screen | "The leverage comparison runs a leveraged fund against a plain index fund that receives the same contributions." | none |
| Leverage, monthly amount | "Invested at the start of every month, in both funds." | "Added at each month's start, to both funds." |
| Leverage, years | "N to M years of monthly contributions." | "N to M years." |
| Leverage, ratio | "Compared against a plain index fund receiving the same dollars on the same dates." (and the 1x variant) | at 1x only: "At 1x, the funds differ only in expense ratio."; otherwise none |
| Leverage, volatility | "The Lx fund's volatility is about Lx this figure." | removed |
| Leverage, screens | timing/basis description; assumptions description; note on simulated paths and seed | removed |
| Retirement, age to live to / SS benefit / claiming age / healthcare | "Age you expect to live to"; "Annual benefit estimate"; "When to claim benefits"; "Override estimated annual cost" plus hints | age to live to: none; one line each: SS "A yearly amount; ssa.gov/myaccount shows your estimate."; claiming "Between 62 and 70."; healthcare "Premiums plus out-of-pocket costs for a year." |
| Retirement, spending | "Think about what you would spend per year; many people start near 70-80% of current income." | none |
| Retirement, other | "Essential monthly expenses" help on must-pay; "Estimates in today's dollars are fine."; TDF help sentence; "Custom: Set your own values" | none; "Amounts are in today's dollars."; none; "Custom" |
| Retirement, return/volatility/inflation | longer helps (dash text on today's-dollars view; "in the Monte Carlo draws"; "Grows spending in the simulation ...") | "Nominal (before inflation) annual return while saving"; "Annual standard deviation of returns"; none |
| Retirement, filing status note | "... Your saved status, X, runs here as single." | "... only single and married filing jointly, so X runs here as single." |
| Collapsed section, no summary | empty line | "Not answered yet" |

Removed texts (b1), as a list: the five HSA notes; the taxable-account note;
the leverage seed note; the leverage ratio comparison line and volatility
line; the leverage timing and assumptions descriptions; the paycheck age,
must-pay, fun-money and match-screen lines; the "Not sure?" option line; the
core age/state and pay "A close guess is fine" lines; the emergency preset
sentence; the target mix option descriptions (except Custom); the portfolio
accounts-screen line; the retirement spending and TDF helps.

### Skip and Next (b2)
- Footer before: Previous, a skip-style action and Next (see the b2 diff for
  the exact labels). After: Skip and Next only (Finish on the last screen); Back is a control beside
  the progress display.
- Fields before: filled with the typical value; after: empty, typical value as a
  grey placeholder. Next takes it; Skip leaves it unmarked.
- On the three basics (core) screens Next with a blank field shows a message
  asking for the visitor's own entry.
- Answers are saved on every Next and Skip, confirmed values only.
- Wizard header line: core "Every calculator shares these answers, so you only
  give them once." becomes "Every calculator uses these answers."; the intent
  line "Everything this calculator uses, a few related questions per screen."
  and the /start/profile line "Just the questions your profile still needs."
  are removed.
- A blank percent slider's readout shows the typical value (for example
  inflation "3.0%"), not "0.0%".
- Slider-kind fields (for example the healthcare cost multiplier) still show
  their typical value on an unanswered screen; see the open questions below.

### Optional section (b3)
- /start/retirement: "Step 1 of 4" to "Step 4 of 4" becomes "Step 1 of 3" to
  "Step 3 of 3" (Social Security and healthcare is not asked). In "all" mode
  "Step 1 of 7" becomes "Step 1 of 6".
- /start/profile and review flow: "Social Security and healthcare" moves from
  the Retirement section to the end, labeled "Optional - Step N of M".
- Completeness everywhere: "N of 17 topics answered" becomes "N of 16".
- Overview missing list never names "Social Security and healthcare".
- /start/choose: "14 more questions" becomes "13", "4 more questions" (retirement)
  becomes "3".
- "Profile complete" states (See your overview, "Edit the basics", "Every topic
  has an answer from you.") now appear while the optional screen is unanswered.
- Retirement calculator page: unchanged.

### Review page (b4)
- /start/review: before, the whole wizard re-ran with saved values; after, the
  list described above, eyebrow "Your profile", h1 "Review your answers", line
  "N of M topics answered", links "Answer the remaining questions" (only while a
  required topic is unfinished) and "Go to your overview".
- Page description: "Every saved profile answer at a glance, one line per topic,
  with a link to change any topic. Runs in your browser."
- /start/review/<topic>: eyebrow "Review your answers", h1 the section label, the
  topic's fields, "Cancel" link and "Save" button ("Saving" while it works).
  Save returns to /start/review#topic-<id> and focuses that row. The muted
  line names Save: "Grey values are typical. Save uses them for anything left
  blank."; on an example list "This is an example. Change it to match yours."
- Dashboard card button "Review all answers" becomes "Review your answers".
  Chooser footnote: "To change a saved answer, review all answers." becomes
  "To see or change a saved answer, review your answers."

## The three defaults on open questions (the owner has not answered them)
1. Basics need the visitor's own entry before Next: nextNeedsOwnAnswer(screen)
   in lib/constants/intake.ts (message from ownAnswerMessage). Wizard.tsx reads
   it for both the placeholder behavior and the Next check.
2. Previous is a Back control beside the progress display, not in the footer:
   components/guided/BackControl.tsx, placed in Wizard.tsx.
3. Example lists (accounts, holdings) stay until the accounts PR: no code
   change; the list defaults are as before.

## Deferred and why
- Social Security benefit and healthcare cost as "Auto" by default: the benefit
  has no sourced estimate formula in lib (no PIA or bend-point constants), and
  default values change in PR 3. This PR only moves them into the Optional
  section. The benefit stays a plain number (default 30000).
- A link to the Optional section from the dashboard card when required topics
  are done: today it is reachable through /start/review and /start/profile.
- The b3 commit alone leaves Wizard.test.tsx, LearnChooser.test.tsx and
  OverviewDashboard.test.tsx at their old text, since their edits for both
  slices sit in the b4 commit. The tree at HEAD is green.

## Open questions from the review (not changed; for the orchestrating session)
- Save on an unanswered optional topic (/start/review/ss-healthcare) with
  nothing typed marks the Social Security benefit, claiming age and healthcare
  cost as answered with their typical values, as Next does. Should Save on a
  review topic store only the fields the visitor touched?
- Slider-kind fields are not blanked on unanswered wizard screens (FieldDisplay
  in components/fields/FieldInput.tsx says slider fields ignore it). Should
  they show no value until the visitor moves them?
- Review rows use the screen question where a screen has one and the title
  otherwise, so the list reads unevenly. Should each screen get a short title
  for the review rows?
- The placeholder grey is the same token in dark mode (3.81:1 on the dark
  background, above the 3:1 large-text threshold at text-2xl). A lighter
  dark-mode placeholder token is optional.

## What the next PRs must know
- The optional rule is ScreenSpec.optional; the review page recognises an
  optional topic by the section id "optional" (OPTIONAL_SECTION in
  lib/calculators/profileReview.ts), a section built from ScreenSpec.optional.
  Rename both together.
- saveWrites (components/guided/wizardProgress.ts) takes the form's screens as
  its last argument, the order confirmedProfile applies answered screens in.
- Wizard has an onlyScreen prop (single-screen mode used by /start/review/[screen]).
- Profile completeness is out of 16, not 17; tests derive counts from the forms.
- PR 3 changes default values and may make the benefit and healthcare cost
  nullable; the optional screen and the review summaries read profile.provided.
- Gates at this commit: type-check, lint --max-warnings=0, test:coverage (119
  files, 2634 tests, thresholds hold), Node 24 suite (same counts), build.
