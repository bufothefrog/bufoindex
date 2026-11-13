# PR 4 hand-off: one account list as the single source of what the visitor owns

Branch claude/next-4-accounts. It was built from 90ef4ed (staging branch "next" after PR 3 merged) in three slices, one commit each,
then "next" at 8e70553 (the Node 26 change) was merged in; the comparison base for this PR is 8e70553. After review, one fix commit per
area followed:

    f78c68e s1-account-model-library: account kinds, derivations, v2 to v3 migration and account writes as pure, unwired modules
    949bd29 s2-profile-v3-switch: one account list feeds every calculator, form and page; profile v3 with a lossless v2 migration
    ab9f0cc s3-gallery-and-docs: accounts in the /demo gallery, architecture notes and this note
    584fd6a Merge branch 'next' (8e70553, Node 26 only) into claude/next-4-accounts
    eb8021d .. db5e4be  the review fixes (section "Review fixes" below), then a docs commit with this note

The project and CI run on Node 26 only since 8e70553.

The profile schema goes from version 2 to version 3 with a migration (lib/profile/migrateV2.ts, wired in lib/profile/migrate.ts). No existing
file under lib/calculations/ or test/lib/calculations/ changed. package.json and package-lock.json are unchanged; no new dependency.
docs/architecture.md, section "Accounts: one list of what the visitor owns", describes the model, the derivations, the emergency fund rule
and the migration.

## Where this came from

The site owner's feedback of 2026-11-12, in their words (typos included):

- "also certain things like account breakdowns conflict with user putting in how much they have in an account when it could be calc from
  this. i would think we can consolidate more. i said yes to hsa but it also doesnt appear here. or 401k even though i said yes to 401k, just
  shows roth and brokerage, no other option. for example i use a separate robinhood taxable investing account for holding my emergency fund in
  boxx. would think about supporting that kind of thing without making it overwhelming for people who do not know."
- "right now there are some things that i think are unneeded in full profile like the how much new cash are you investing this month, it can
  autofill from normal contrib and change if user is doing something specific."
- "certain other things like seeing the data in a compact fashion would be nice rather than having to click edit to see info."
- "we do not need to preserve any functionality from old version of website"

Everything below that is not one of those sentences is the orchestrating session's design (the build contract for PR 4), not an owner
decision.

## What each slice changed

### s1-account-model-library (f78c68e)
- New pure modules, nothing wired: lib/profile/accountTypes.ts (AccountKind, AccountRow, NewCashRow), lib/profile/accounts.ts (every
  derivation), lib/profile/migrateV2.ts (kindFromV2, migrateV2Payload), lib/calculators/portfolio/accountWrites.ts (every account action as
  whole-list writes), ACCOUNT_KIND_LABELS and ACCOUNT_KIND_OPTIONS in lib/constants/labels.ts.
- Fixtures: test/factories/profile-90ef4ed-v2.ts (the 90ef4ed default as localStorage holds it, and the payloads of migration examples 1 to 9
  with 3b, 4a and 4b), test/factories/accountsFixtures.ts (the v3 default, the owner, caps and beginner fixtures).

### s2-profile-v3-switch (949bd29)
- Storage: profile version 3, store persist version 3, migrateProfile runs migrateV2Payload for any payload older than 3.
- Removed members: investing.investedBalance, ira.traditionalBalance, ira.rothBalance, the per-account accountType and deposit,
  DEFAULT_NEW_CASH, the specs INVESTED_BALANCE, IRA_TRADITIONAL_BALANCE, IRA_ROTH_BALANCE, ACCOUNT_TYPE, ACCOUNT_DEPOSIT and the old portfolio
  ACCOUNTS, the retirement 'savings' screen, the old portfolio 'accounts' screen (deposits), addAccount in reducers.ts.
- Readers: paycheck (IRA balances, emergency fund), retirement (starting balance, monthly savings), leverage (Auto start and Auto monthly)
  and portfolio bindings read the derivations; lib/dashboard/derive.ts gains summarizeAccounts and heldIn on the cash buffer.
- Forms: the shared ACCOUNTS field and ACCOUNTS_SCREEN ("What do you have saved and invested?") on the retirement, portfolio and leverage
  forms; profile section "Accounts"; PROFILE_FORM_ORDER puts paycheck first; calculator-only screens 'monthly-investing' (retirement) and
  'new-cash' (portfolio).
- UI: the compact account list (components/calculators/renderers/accounts.tsx), the new-cash editor, the rebalancer empty state and
  not-rebalanced note, the overview AccountsCard, the cash card naming the accounts that hold the fund. The wizard stores the rows in effect
  on Next (acceptAccounts).

### s3-gallery-and-docs (ab9f0cc)
- /demo gains an "Accounts" tab (app/demo/sections/AccountsSection.tsx): the account list card, the "New cash this month" card and the
  AccountsCard on a synthetic sample profile in the tab's own state (it never writes the visitor's profile). Two samples: the default
  profile, and the default plus an added brokerage named "Savings brokerage" ticked "Holds my emergency fund" (built with the account
  actions, so it holds the copied 9,000). Test: test/components/demo/AccountsDemo.test.tsx.
- docs/architecture.md: the account section, the version 3 migration in the profile bullet, and the test list.

## Numbers that change, and why

Default profile, same answers, 90ef4ed -> this branch (8e70553 runs the same numbers as 90ef4ed). The "before" figures were measured on a copy of the 90ef4ed tree with the same
calls as the pinning tests; the "after" figures are pinned in the named tests.

Retirement (monthlySavings 1,500 -> 1,540: Auto is round2 of 693.33 own 401(k) + 346.67 match + 500 taxable; the match now counts, open
question 2). startingBalance 25,000 -> 25,000 (16,225 typed in the example 401(k) + 8,775 of example brokerage holdings). Pinned in
test/lib/calculators/retirement/bindings.test.ts ("pins the default projection"):
- projected balance (nominal) 5,662,079.84 -> 5,796,147.14;
- required balance 3,343,588.74 -> 3,343,588.74 (unchanged);
- withdrawal rate 2.362% -> 2.307%;
- success 100% -> 100%;
- "Retire 5 years early at 60": projected 4,006,208.56 -> 4,100,839.70, success 99.0% -> 99.4%;
- "Coast": name "Coast: Save only $750/month (enjoy extra $750/month now)" -> "Coast: Save only $770/month (enjoy extra $770/month now)",
  projected 3,148,317.92 -> 3,215,351.57, success 96.7% -> 97.3%;
- "Conservative" scenario name "Conservative: $2,700/month, leave $6,937,000 legacy" -> "Conservative: $2,700/month, leave $7,248,000
  legacy" (measured; no test pins this name).
- Overview retirement card (test/components/dashboard/OverviewCards.test.tsx, today's dollars): projected $1,735,749 -> $1,776,849; the
  "$500 more per month" lever $2,249,490 -> $2,290,589; required $1,025,000 unchanged. In future dollars (measured in review, a core-only
  profile) the "$500 more" figure $7,337,921 -> $7,471,988.
- Retirement page (measured in review; they follow the monthly savings above): "Your savings rate: 17%" -> "18%" and the sentence "Your
  current savings rate is 17%" -> "18%"; the chart axis $600k..$2.4M -> $650k..$2.6M (today's dollars) and $4.0M..$16.0M -> $4.5M..$18.0M
  (future dollars).

Portfolio rebalancer (the inputs change: [Roth IRA tax-free deposit 0 with VTI 10 + BND 5, Brokerage taxable deposit 1,000 with VTI 20 +
VXUS 15] -> [acc-brok "Brokerage (taxable)" taxable deposit 500 with VTI 20, VXUS 15, BND 0]; the v3 default has no Roth IRA row, the 401(k)
is a typed balance and is not rebalanced, and the new cash is the taxable 500 a month routed to the brokerage). Pinned in
test/lib/calculators/portfolio/bindings.test.ts ("pins the default rebalance"):
- totalValueBefore 12,875 -> 8,775;
- totalDeposit 1,000 -> 500;
- totalSpent 3,485 -> 495;
- cashLeftover 140 -> 5;
- totalDriftBefore 0.5476 -> 0.5094;
- totalDriftAfter 0.0559 -> 0.4181 (the inputs above changed; the engine did not).
- On the page (measured in review; they follow the inputs above): "This deposit closes 90% of the gap" -> "18%"; "Starting portfolio value:
  $12,875 -> After: $13,735" -> "$8,775 -> $9,270"; the placement advice "BND (Bonds, in tax-free) -> consider moving to tax-deferred"
  becomes "BND (Bonds, in taxable) ...", and the VTI-in-taxable line goes away.

Unchanged for the default profile: paycheck inputs (emergency fund 9,000, IRA balances 0 and 0, 401(k) 8% traditional, match 100% up to 4%,
taxable 500, federal bracket 22%); leverage inputs (monthly 500, 40 years, start 25,000); overview cash card 9,000 of 9,000.

Migrated profiles: the engine inputs before and after for each migration example are in the PR 4 contract section 8 and asserted by
test/lib/profile/migrateV2.test.ts and test/lib/profile/migrate.test.ts. The ones a visitor would notice:
- A profile that typed IRA balances and left the lists unanswered (example 4a): retirement start 25,000 (the example money) -> the typed IRA
  total (26,000 in the example). The leverage start follows it: "What you already have invested" and the overview "starting from" $25,000 ->
  $26,000, and the leverage median (today's dollars) $776,692 / $922,371 -> $783,766 / $936,154 (measured in review).
- A profile that answered has401k No, or taxable 0, with the example lists still unanswered: the example filter (contract section 5) hides
  the example row that answer rules out, so its money leaves the retirement and leverage start. has401k No: 25,000 -> 8,775 (the example
  401(k) 16,225 goes); taxable 0: 25,000 -> 16,225 (the example brokerage 8,775 goes); both: 25,000 -> 0. The same holds for a version 3
  profile.
- A profile whose answered lists hold a Roth IRA account (examples 3, 6, 8): the paycheck allocator's Roth IRA balance 0 -> the value of
  those holdings (4,100 or 10,050). An answered account the migration reads as a traditional IRA (a tax-deferred account named "IRA")
  moves the traditional IRA balance the same way. Nothing doubles: the invested total stays max(typed invested balance, holdings).
- A v2 account with a blank name is named by its kind label on the rebalancer ("Brokerage (taxable)", "401(k) or similar", ...).
- A profile that typed an invested balance below its holdings (example 3b): retirement start 10,000 -> 12,875 (the holdings win).
- An answered 0 deposit becomes Auto: in example 6 the Robinhood row gets the typical taxable 500 as new cash where v2 sent 0.

Profile completeness: the default total goes from 14 to 13 topics (11 for a beginner with no holdings, 13 while the targets and holdings
screens show). A profile completed at 90ef4ed loads as N of N.

## Text a visitor sees differently (before -> after)

- Completeness copy for the default form: "1 of 14 topics answered." -> "1 of 13 topics answered."; "3 of 14 topics answered" -> "3 of 13
  topics answered"; "0 of 14 topics answered, saved in this browser." -> "0 of 13 ..."; the overview "1 of 14" -> "1 of 13".
- Entry points: "Answer the rest once; every calculator and your overview use it. 11 more questions." -> "... 10 more questions."; the
  portfolio entry "3 more questions." -> "2 more questions." in the pinned EntryPoints scenario.
- Overview: "Also seeded from this profile: the portfolio rebalancer, <mix> target mix and this month's new cash." -> "... <mix> target mix
  and your accounts." The portfolio intent hint "Opens the Portfolio Rebalancer with your target mix and new cash." -> "Opens the Portfolio
  Rebalancer with your accounts and target mix."
- Overview: a new Accounts card (one line per account, "Invested $X", and "Emergency fund: <names> $X" when accounts hold it). The cash
  card hint "Earning N% APY" -> "Held in <names>" while accounts hold the fund.
- Overview missing-topic list in the pinned fixture: "What are you investing today?" and "When would you like to retire?" -> "401(k) or
  similar plan" and "Health savings account" (paycheck screens now come first).
- Retirement page and /start/retirement: the card "What are you investing today?" (inputs "Monthly investing contribution" with help "All
  accounts together, including your own 401(k) contributions." and "Invested balance" with help "Total across 401(k), IRA and brokerage, not
  your emergency fund.") -> the account list card "What do you have saved and invested?" plus, on the page only, "Monthly investing" with
  Auto line "From your answers: $1,540" for the default. Its summary reads "saving $1,540/mo" on Auto.
- Leverage intake: "Starting balance" (help "Money already invested; 0 compares contributions only.") is no longer asked; the leverage
  intake has a second step, the account list ("Step 1 of 1" -> "Step 1 of 2").
- Portfolio rebalancer and /start/portfolio: the "Accounts" card with the question "How much new cash are you investing this month?" (inputs
  Account name, Type, New cash with help "Money to invest now.") -> the account list card "What do you have saved and invested?"; new cash is
  the page-only card "New cash this month" with one Auto/Custom row per account the rebalancer can work on (no cash, emergency-fund or
  typed-balance account; "Normal contributions: $500" for the default brokerage, the only such row).
  Collapsed summary "2 accounts, $1,000 new cash" -> the accounts summary "401(k) or similar $16,225; Brokerage (taxable) $8,775 (3
  holdings)" and the new cash summary "Brokerage (taxable) $500".
- Rebalancer: new note "Not rebalanced: 401(k) or similar (no holdings entered)." for the default; new empty state "Add holdings to an
  account, or new cash to an empty one, to rebalance." when no account is rebalanced; the "Target allocation" card and the "Holdings" card
  are then hidden (both show only while an account is rebalanced or has holdings; example 4a shows neither, where 90ef4ed showed both).
  Holdings regions are named by the account's display name ("Brokerage holdings" -> "Brokerage (taxable) holdings").
- Holdings editor (rebalancer page and the wizard's "What does each account hold today?"): every account but cash accounts has a section,
  so an account known only by a typed balance shows "No holdings yet. Add one below." and "Add holding" (the default's "401(k) or similar").
- Paycheck intake: "Traditional IRA balance" and "Roth IRA balance" are no longer asked.
- Emergency fund screens: while an account holds the fund, the balance input is hidden and the note "Held in your accounts: <name> $X." shows.
- Account labels: "401(k) or similar", "Roth 401(k)", "Traditional IRA", "Roth IRA", "HSA", "Brokerage (taxable)", "Cash or savings".
- /demo: a new "Accounts" tab.
- Account list controls (review fix): the accessible names are "<name> balance", "Edit <name>", "Done editing <name>" (the open editor's
  toggle, which shows "Done") and "Remove <name>"; rows that share a display name are numbered ("Brokerage (taxable) 1 balance",
  "Brokerage (taxable) 2 balance"), and so are their rows in "New cash this month". The Kind select of an account with holdings does not
  offer "Cash or savings".

## The v2 double count that only the tick removes (example 6)

A v2 visitor who kept the emergency fund in a brokerage account (the BOXX case) typed it twice: once as cash.emergencyFundBalance and once
as that account's holdings, which also fed the invested total. Migration cannot know which account holds the fund, so it migrates the
account as an ordinary brokerage row: in example 6 (emergency fund answered 10,000, invested 40,000, a Fidelity Roth IRA worth 10,050 and a
Robinhood brokerage holding BOXX worth 10,350) the paycheck emergency fund stays 10,000, the invested total stays 40,000 (10,050 + 10,350 +
19,600 "Other investments"), and the rebalancer still receives the Robinhood account with BOXX. The double count is the same as in v2,
neither added nor removed. Once the visitor ticks "Holds my emergency fund" on Robinhood: emergency fund 10,350, invested 29,650, and the
rebalancer receives only the Roth IRA (BOXX is not sent).

## A typical value accepted with Next is migrated as money the visitor entered (example 8)

In v2, Next on a screen saved its typical values as answers (the PR 3 rule). A v2 visitor who pressed Next on the savings screen and the
portfolio screens therefore has investing.investedBalance 25,000 and the example account lists marked answered, although they typed none of
it. Migration cannot tell the two apart and treats them as the visitor's own: the example Roth IRA (4,100) and Brokerage (8,775) rows are
kept and an "Other investments" 401(k) row of 12,125 is added, so the invested total stays 25,000. The paycheck allocator's Roth IRA balance
goes from 0 to 4,100 even when ira.roth was answered No, because the stored Roth IRA row is now the visitor's list.

## Open questions for the owner, with the defaults built

1. When accounts hold the emergency fund, do they replace the typed emergency fund or add to it? Built: replace. The typed number is kept
   and counts again when no account holds the fund. Code: emergencyFundBalance in lib/profile/accounts.ts.
2. Does employer money (401(k) match, employer HSA) count in monthly investing and in an account's new cash? Built: yes, which moves the
   default monthly savings from 1,500 to 1,540. Code: contributionParts in lib/profile/accounts.ts.
3. Is payroll money (401(k), match, HSA) the rebalancer's default new cash, or only money the visitor moves (IRA, taxable)? Built: all
   normal contributions, each routed to its account. Code: normalNewCash.
4. Is a custom "new cash this month" remembered between visits? Built: yes, until set back to Auto (the PR 3 rule for calculator-only
   values). Stored as portfolio.newCash.
5. Does a cash or savings account always count as the emergency fund? Built: yes; savings for other goals is not modeled. Code:
   isEmergencyFundAccount.
6. Do accounts known only by a typed balance appear on the rebalancer? Built: listed in "Not rebalanced: ... (no holdings entered)", never
   sent to the engine. Code: rebalancedAccounts, notRebalancedNote.
7. Does the leverage comparison start from all invested accounts or only taxable ones? Built: all invested accounts except the emergency
   fund, as before. Code: derivedStartingBalance in lib/calculators/leverage/bindings.ts.

## Files that needed an owner the contract did not name

- test/factories/profile-3bb0132.ts was listed as owned by nobody. s2 edited it because profile v3 removed the investedBalance leaf it relied
  on: it now sets the example 401(k) balance to 19,100 and investing.monthlyContribution to 1,500 (Custom), so at the 3bb0132 prices the
  invested total stays 25,000 and the 3bb0132 goldens are unchanged. Its header comment says so.
- No other file outside the slices' ownership was edited. explainerBudget.test.ts and formBindings.test.ts pass unedited.

## Where the build differs from the contract (s2)

- The rebalancer's "New cash this month" card renders open, not collapsed; collapsing it needs a calculator-page affordance that does not
  exist yet. Its collapsed summary does read the new-cash rows.
- When no account can take new cash, that card stays and reads "No account can take new cash." instead of hiding.
- The holdings editor has no per-account target column; targets stay portfolio-wide in the class-targets editor.
- Next on the accounts screen marks portfolio.accounts, portfolio.holdings and portfolio.securities answered (the screen covers all three).
  So a visitor who leaves right after the accounts screen has the holdings topic counted in "N of M", and "remaining" mode does not ask
  the holdings screen later; the example holdings in effect are then stored as the visitor's.
- RETIREMENT_ENGINE_ONLY gains startingBalance and monthlySavings, which are derived and no longer profile leaves.
- The overview note keeps "with the": "the portfolio rebalancer, with the <mix> target mix and your accounts."

## Review fixes

Three reviews checked the branch; the fixes, one commit per area:

- Migration (eb8021d): a v2 payload with a null entry in the accounts, holdings or answered securities list made migrateV2Payload throw,
  and the store then overwrote the stored profile with an empty v3 state. The lists are read through a records-only filter now (the null
  row is dropped, as normalization drops it at 8e70553); every other answer loads. A test now pins the IRA half of the max rule (a typed
  IRA balance at or below its holdings adds no row).
- Account writes (8675ca7): changing the kind of an account that held the copied emergency fund (a cash row to brokerage, a ticked
  brokerage to 401(k)) kept the copied balance, which then counted as invested while the typed fund counted again (default: invested
  25,000 -> 34,000). The untick rule applies now: no holdings and a balance equal to the typed fund gives 0.
- Account list (f1a8b55): distinct accessible names, "Done editing", no cash kind for an account with holdings, Remove closes the editor.
- Wizard (5f04c29): Next on the emergency fund screen while an account held the fund saved the arrival value (9,000) over a typed 10,000.
  A field of the screen hidden since its last Next keeps its answer now.
- Rebalancer editors (9c09ed8): "Remove holding N" and the class target Remove button had no type and submitted the wizard screen (older
  than PR 4); both are type="button".
- Completeness (7d10461): a Custom new cash on the rebalancer changed "N of M" (the targets screen shows while an account is rebalanced);
  completeness reads the calculator-only portfolio.newCash as unset.
- Field specs (d47a497, db5e4be): the monthly investing Auto line read "From your answers: $1,540 a month: $1,540" and now reads "From your
  answers: $1,540"; the unrendered account balance hint "Today's balance." is gone from the row spec.
- Cash card test (dedd765), 3bb0132 fixture header (a846b90), card header icon (c7a1969), CLAUDE.md (a78e382).

## Known behavior left as built

- contributionParts caps the 401(k) deferral at the 402(g) limit and computes the match on the capped deferral, and caps the own HSA at the
  limit less the employer's part, as the bracket model does. The paycheck allocator's current-path model (projections.ts) does not cap the
  deferral, so the two can differ for a high election (75% of $59,797: 44,848 a year there, 24,500 here). IRA monthly amounts are not
  capped at the IRA limit in either.
- An account with a typed balance above 0 and holdings worth 0 (0 shares, or a 0 or missing price) counts its typed balance in the
  invested total but is sent to the rebalancer with a value of 0 (hasHoldings counts a 0-share row, as the contract says).

## Deferred / not done

- PR 5 (contract section 12): contribution timing; estimateCurrentNetWorth still counts only the emergency fund plus IRAs minus debts (401(k),
  HSA and brokerage are missing); a native rebalancer option to exclude accounts; stronger rebalancer example numbers.
- Not in this stack: per-account yields, cash accounts that are not the emergency fund, routing new cash to more than the first account of
  each kind, importing holdings.
- The "Conservative" scenario name with the legacy figure is not pinned by a test.

## For the next PRs of the stack

- Read balances only through lib/profile/accounts.ts over a withDerivedValues get; never store a derived figure back into the profile.
- Account writes go through lib/calculators/portfolio/accountWrites.ts; the caller marks the written list paths answered.
- New tests of migrated payloads can start from test/factories/profile-90ef4ed-v2.ts; v3 fixtures from test/factories/accountsFixtures.ts.
- Tests that compare computed doubles use toBeCloseTo; the project and CI run Node 26 only.
