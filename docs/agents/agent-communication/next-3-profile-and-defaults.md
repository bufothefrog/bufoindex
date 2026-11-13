# PR 3 hand-off: profile versus calculator questions, new defaults, Social Security estimate, computed bracket

Branch claude/next-3-profile-and-defaults, base 3bb0132 (head of PR 2). Four slices, one commit each, then one review fix per slice:

    04f1a42 c1-profile-versus-calculator
    670becc c2-defaults-and-derived-typicals
    30878ca c3-social-security-auto
    7e2f6ad c4-retirement-bracket-select
    76923cc fix c1, c6c9494 fix c2, 46dd8c4 fix c3, 6a1ceab fix c4 (see "Review fixes" below)

The profile schema version stays 2. No existing file under lib/calculations/ or test/lib/calculations/ changed; new pure modules were added
(socialSecurityEstimate.ts, taxBracket.ts, with tests of hand-computed values). package.json and package-lock.json are unchanged.

## Where this came from

The site owner's feedback of 2026-11-12, in their words (typos included):

- "leverage ratio question is def unneeded here. not a profile one. i think we should differentiate between completing profile and going to a calc which actually needs a 1 time question vs a perm profile one."
- "also i think realistically we need option to support more than 3 months of emergency fund since it depends on income/job stability. this is also a question for the calc. though the # of months can be an option for profile. i dont thinkwe should suggest 1 month, 3-6 is more reasonable for emergency fund.  just not suggest excessive."
- "i think social security benefit/annual healthcare cost should be auto by default for both and only offer to manually change it, but not necessarily a part of the form, maybe just an optional section for all optional info."
- "i think for the expected tax bracket in retirement it should be a drop down of existing us ones (incl state inc if that was selected) with it dynamically changing based on married/single status."

Cells the owner wrote in the shared document of defaults: age "25"; state "CA"; filing status "Single"; retirement age "65"; life expectancy "90";
gross pay per paycheck "4000"; take-home pay per paycheck "3000"; pay frequency "every two weeks"; has a bonus "no"; must-pay costs "$3000";
fun money "$300" and "$600"; emergency fund balance "Derive it when unanswered (for example three months of must pay) instead of a fixed number";
emergency fund interest "4%"; emergency fund target "Keep 3; allow up to 60; help text says 3 to 6 is common"; has a 401(k) "Yes"; employer match rate "100%";
matched up to "4%"; 401(k) contribution "8%"; HSA coverage "Can this be derived from tax status filing?"; Social Security claiming age "Show the two options,
early or late so they can see how it affects, should be calculator option to see change rather than a profile question"; securities "check current prices and
round to nearest 5". Every other cell was left as it was.

Everything below that is not one of those sentences or cells is the orchestrating session's design, not an owner decision.

## What each slice changed

### c1-profile-versus-calculator (04f1a42)
- Questions one calculator needs for one run (leverage ratio, Social Security claiming age) are asked only on that calculator. The claiming age is a
  three-choice control (62, 67, 70) with a table of the yearly benefit at each age.
- Assumption-tier screens are no longer asked in the /start intakes; they stay as collapsed cards on the calculator pages.
- strategy.preset is removed everywhere (leaf, labels, overview switch, preset cash lines, copy). An old stored profile keeps months the visitor
  entered; months it holds unanswered (the preset wrote 1 or 3) load as the typical 3 (review fix, see below).
- Emergency fund target moved to the emergency fund screen: whole months 0 to 60, typical 3, help says 3 to 6 is common.
- Profile completeness counts 14 topics instead of 16. A profile finished at 3bb0132 (16 of 16) loads as 13 of 14: its emergency fund topic
  now holds the months, which the 3bb0132 profile form never asked. /start/profile asks that one screen (months blank, grey 3), the overview lists
  "Emergency fund" among the illustrative defaults, and the footers read "13 of 14 topics answered" until it is answered.

### c2-defaults-and-derived-typicals (670becc)
- Worked example defaults: age 25, CA, single, retire at 65, plan to 90, $4,000 gross every two weeks, 100% match up to 4%, 8% traditional 401(k). The take-home
  figure is derived from the site's own tax functions.
- New pure module lib/profile/derived.ts fills unanswered emergency fund balance, target retirement income and HSA coverage from the visitor's own
  answers. The guards that tests pin are engineInputsFor and prepareRun (lib/calculators/runtime.ts), lib/dashboard/derive.ts,
  useCalculatorValues, the wizard and the rule itself. The calls in OverviewDashboard.tsx, CalculatorPage.tsx (ResultsBody) and
  useCalculatorBootstrap.ts are defence in depth: those paths derive again downstream, so removing one fails no test.
- The wizard shows derived values as grey typical values and saves them when accepted with Next.
- Example fund prices refreshed (VTI 375, VXUS 85, BND 70) and the T-bill citation updated; the financing rate is unchanged. See the c2 diff in
  lib/constants/ for the citation comments.

### c3-social-security-auto (30878ca)
- retirementIncome.socialSecurityBenefit is nullable; null means Auto and is the default. It uses the existing Auto/Custom switch (NullableField).
- lib/calculations/socialSecurityEstimate.ts: estimate of the yearly benefit at full retirement age with the SSA primary insurance amount formula, unrounded.
- lib/calculators/retirement/socialSecurity.ts: resolveSocialSecurityBenefit(get) is the only place the leaf becomes a number (the visitor's own, or
  the estimate rounded to the whole dollar). The retirement binding, dashboard, the field's Auto label and the claiming-age table use it.
- lib/calculators/retirement/income.ts: the yearly pay code moved out of bindings.ts so currentIncome and the estimate read the same figure.
- lib/constants/social-security-2026.ts: bend points and wage base with citations.
- Methodology page: new card "Social Security Benefit Estimate"; two wording changes on the claiming-age card.

### c4-retirement-bracket-select (7e2f6ad)
- lib/calculations/taxBracket.ts: taxable income = yearly gross minus pre-tax deductions minus the 2026 standard deduction, and the federal bracket for it.
  An income exactly on a bracket edge lands in the lower bracket. Zero or negative income gets 10%.
- lib/calculators/paycheck/bindings.ts currentBracketFrom(get) feeds taxes.federalBracket (was a fixed 22%). Inputs: yearly gross (paychecks plus
  a regular bonus), minus the traditional 401(k) share (only with a 401(k)), minus 12 x HSA monthly (only when HSA eligible).
- The expected retirement bracket is a select of the seven brackets for the filing status, with the state rate when the state has an income tax.
  The stored value stays the federal rate.
- lib/profile/derived.ts derivedRetirementBracket: typical value is the bracket of the target retirement income after the standard deduction.
- A stored value off the seven rates (old free percent) is read as the nearest rate (ties to the lower) in the binding and is never rewritten.
- lib/constants/states-2026.ts gained getStateTaxInfo; the table is unchanged. app/demo ResultsSection row now reads "22% (from your pay)".

## Text a visitor sees differently (before -> after)

- Retirement page card "Social Security and healthcare", the wizard Optional screen and /start/review/ss-healthcare: money input filled with $30,000 ->
  Auto/Custom switch reading "Estimate from your pay: $40,359" for the default profile. Custom starts at the estimate.
- Collapsed summary and review row: "Social Security $30,000/yr, typical healthcare cost" -> "Social Security estimate $40,359/yr, typical healthcare cost" on Auto.
  A Custom value still reads "Social Security $N/yr".
- Claiming-age table on Auto: caption "Yearly Social Security benefit at each claiming age" -> "Estimated yearly Social Security benefit at each claiming age".
  Rows 62 $21,000 / 67 $30,000 / 70 $37,200 -> $28,251 / $40,359 / $50,045.
- Methodology: new formula card (formula count 9 -> 10). Variable B_FRA: "Annual benefit at full retirement age, as entered" -> "Annual benefit at full
  retirement age: the one you enter, or the estimate from your pay on Auto". Assumption: "The benefit you enter is an annual amount stated in today's dollars" ->
  "The benefit (entered or estimated) is an annual amount stated in today's dollars".
- Paycheck allocator note: "Tax savings use a fixed 22% federal bracket and one 2026 state rate, whatever your income." -> "Tax savings use your N% federal
  bracket and one 2026 state rate." (N is computed; 22% for the worked example). In the wizard's "all" mode the note is on the first screen, before pay is
  asked, so it states the bracket of the typical values.
- "Expected tax bracket in retirement": free percent input 0% to 37% -> select. Worked example (single, CA): "10% federal + 9.3% CA" to
  "37% federal + 9.3% CA" (short, so a phone does not cut them off). A state with no income tax shows federal only.
- Help on that field: "Federal bracket you expect when withdrawing, compared with today's 22%." -> the taxable range of the selected bracket for the
  filing status, then today's bracket: "Taxable $12,400 to $50,400. Today: 22% federal; same state rate in both." First bracket "Taxable up to $N",
  last "Taxable over $N".
- Assumptions card summary for an old stored value off the list: "15% retirement bracket" -> "12% retirement bracket" (nearest rate).
- QuickActions detail "deferred tax at your N% federal bracket" and the HSA tax-savings step status use the computed bracket instead of 22%.
- /overview "rich" fixture (joint, CA, $2,400 weekly, 8% traditional): recommendation wording changes with the same amounts. "Roth IRA: Tax diversification
  recommended - consider splitting with Traditional" -> "Roth IRA: Low tax bracket makes Roth optimal for tax-free growth"; "401k (Roth + Traditional) $279: ..."
  -> "Roth 401k $279: Roth 401k recommended for tax-free growth and retirement flexibility"; "Increase 401k (Roth + Traditional) contribution by $279 per paycheck" ->
  "Increase Roth 401k contribution by $279 per paycheck".
- For c1 and c2 text changes (leverage screen, emergency fund target, preset removal, grey typical values), see the diffs of 04f1a42 and 670becc.

## Numbers that change, and why

Social Security (c3). Default profile: engine benefit 30,000 -> 40,359. AIME 104,000 / 12 = 8,666.67; 0.9 x 1,286 + 0.32 x (7,749 - 1,286) + 0.15 x (8,666.67 - 7,749)
= 3,363.21 a month, x 12 = 40,358.52, rounded to 40,359.
- Default profile headline figures do not move: success 100% -> 100%, projected balance $1,735,749 (today's dollars), required balance $1,025,000, implied
  withdrawal rate 2.36% (the benefit only enters the withdrawal phase and the plan already succeeds on every path).
- Scenario success rates that move: "Retire 5 years early at 60" 95.6% -> 99.0%; "Coast: Save only $750/month" 82.5% -> 96.7%.
- Any stored profile with the benefit answered: no change. A stored profile that left it unanswered (including the old 30,000 default never confirmed) now
  runs the estimate from its own pay. Dashboard test fixtures basics/rich/lean set 30000 explicitly; without that basics would show 5% -> 9.4% and rich 8.3% -> 20.3%.

Computed bracket (c4). Default profile: 104,000 - 8,320 - 16,100 = 79,580 single, so 22% as before; typical retirement bracket 41,000 - 16,100 = 24,900, so 12%,
same as stored 0.12. No figure changes for the default profile. Others (before -> after):
- 12% profile (single TX, $2,000 every two weeks, 6% traditional): bracket 22% -> 12%; allocations identical; a new skipped item "Traditional vs Roth Strategy"
  appears (opportunity cost $0).
- 24% profile (single CA, $6,500 every two weeks, HSA $300/mo): HSA tax impact -$11.98 -> -$12.60; annual tax savings $311.60 -> $327.60; 10-year optimized path
  $1,299,755 -> $1,299,976; taxes owed $28,982.40 -> $28,966.40.
- 32% profile (single NY, $23,000 monthly, 10% traditional, HSA $100/mo): HSA tax impact -$80.93 -> -$107.60; annual tax savings $971.20 -> $1,291.20; 10-year
  optimized path $1,435,288 -> $1,439,709; taxes owed $58,763.05 -> $58,443.05.
- Joint 12% profile (like the "rich" fixture): bracket 22% -> 12%; today and retirement both 12%, so the Roth-or-traditional choice moves from the split to Roth; 401(k)
  tax impact -$43.69 -> $0; annual tax savings $2,271.75 -> $0; 10-year path $791,283 -> $759,895; taxes owed $8,344.25 -> $10,616. Amounts per step unchanged.
- Golden fixture "a custom profile (weekly pay, joint filing)": federalBracket 0.22 -> 0.12.
- Stored retirement bracket off the seven rates: the engine reads the nearest rate (0.15 -> 0.12, 0.20 -> 0.22). A stored 0 reads as 0.10; before, the engine read 0
  as 80% of 22% = 17.6%.

- Head of household 24%/32% edge (review fix): $201,775 -> $201,750 (Rev. Proc. 2025-32 Table 2). Every reader of the HoH table moves for taxable
  income from $201,750.01 to $201,775: the bracket reads 32% instead of 24%, and the federal tax in the allocator's projections takes 32% on that
  slice. Before PR 3 the allocator used a fixed 22%, so only the projections' tax math read this edge.
- Capped deductions in the current bracket (review fix): the traditional 401(k) share is capped at the 402(g) limit for the age (24,500, plus
  8,000 at 50+, 11,250 at 60 to 63) and HSA payroll money at the coverage limit (4,400 / 8,750, plus 1,000 at 55+) less the employer's HSA money.
  Example: single, $9,500 every two weeks, 30% traditional: 32% (was 24%); at 55, 24%.

c2 number changes (new defaults, derived typicals, fund prices) are in the diff of 670becc; fixtures with explicit answers keep their expected values.

Unanswered emergency fund months (review fix of c1). A stored profile whose cash.targetMonths is not in provided loads it as 3
(UNANSWERED_LOADS_AS in lib/profile/defaults.ts, the same rule that loads the old Social Security default as Auto). Before PR 3 the default
cash-flow investor preset wrote 1 there on every intake finish, so most saved profiles hold an unanswered 1. For them: the allocator's
emergencyFundMonths 1 -> 3 (the full emergency fund step targets 3 months of must-pay costs), the overview cash card target 1 month -> 3 months,
and the wizard's grey value 1 -> 3. A profile that answered its months keeps them, 1 included; a profile that already held 3 does not change.

## Outside sources (read 2026-11-13)

- https://www.ssa.gov/oact/cola/bendpoints.html - 2026 PIA bend points 1,286 and 7,749.
- https://www.ssa.gov/oact/cola/cbb.html - 2026 contribution and benefit base 184,500.
- https://www.ssa.gov/oact/cola/piaformula.html - factors 90/32/15 only.
- https://www.irs.gov/pub/irs-drop/rp-25-32.pdf - Rev. Proc. 2025-32 section 4.01 Tables 1 to 4 (review fix of c4): head of household 24%/32%
  edge $201,750 and 32% ceiling $256,200; every single, joint and separate edge in lib/constants/irs-2026.ts matched. State rates are STATE_TAX_RATES_2026.
- c2 fund prices: lib/constants/example-prices.ts (moved there from lib/profile/defaults.ts by the review fix), with the citation. T-bill citation:
  lib/constants/ in commit 670becc.

## Orchestrating session's defaults on open questions, and where each lives

- Calculator-only answers stay in the stored profile: leverage ratio and claiming age are asked on their calculator only but saved in the profile. Screens are
  marked calculator-only in the form specs; the intake filter is lib/constants/intake.ts and lib/calculators/forms.ts. Test: test/lib/calculators/calculatorOnly.test.ts.
- Assumption screens left the intakes: the rule is the tier check in lib/constants/intake.ts (line ~276) and lib/calculators/forms.ts (line ~135).
- The take-home figure is derived from the site's own tax functions (c2); see lib/constants/intake.ts takeHomeSummary and the c2 diff.
- Derived typical formulas live only in lib/profile/derived.ts: emergency fund balance = 3 x must-pay; target retirement income = 12 x (must-pay + midpoint of fun
  money) rounded to 1,000; HSA coverage = family when married filing jointly, else individual; retirement bracket as above. Order matters: withDerivedValues runs
  each rule over the profile as filled so far.
- Typical retirement bracket: derivedRetirementBracket in lib/profile/derived.ts. Old off-list values: retirementBracketFrom in lib/calculators/paycheck/bindings.ts.
- Current bracket from pay: currentBracketFrom in lib/calculators/paycheck/bindings.ts and lib/calculations/taxBracket.ts.
- Social Security simplification: current pay stands for the 35-year average of indexed earnings; one worker's own benefit; for married filing jointly the household
  pay counts as one worker's pay; spousal and survivor benefits and bonus pay are not modeled. Rule in lib/calculations/socialSecurityEstimate.ts and
  lib/calculators/retirement/socialSecurity.ts; stated on the methodology page (lib/formulas/retirement-formulas.ts).
- Unanswered benefit loads as Auto: UNANSWERED_LOADS_AS_AUTO and loadUnansweredAsAuto in lib/profile/defaults.ts. A stored payload with its own provided list that lacks the
  leaf loads it as null; answered numbers (including 0) and an answered null are kept; a partial patch over a base is left alone.

## Review fixes

Three reviewers checked the four slices; one commit per slice fixes what was real.

- c1: unanswered stored months load as 3 (above). The allocator display no longer names a 1-month fund: the step "1-Month Emergency Fund" ->
  "Starter Emergency Fund" (lib/constants/financialSteps.ts), its unreachable status "Build 1-month emergency fund" -> "Build starter
  emergency fund", and the quick action "Emergency Fund Below One Month of Expenses" shows the months on hand, rounded down ("0.3 months of
  necessary expenses on hand", was "1 month of necessary expenses covered"), with the description "Cash on hand covers less than one month of
  necessary expenses, so a minor emergency may mean borrowing at credit-card rates." (was "A month of necessary expenses on hand covers a minor
  emergency without borrowing at credit-card rates."). A precision-0 field rejects a fraction: a stored 2.5 months (steps of 0.5 before) now
  shows "Emergency fund target must be a whole number." on the emergency fund field and the allocator waits for a whole number. The claiming-age
  control shows "Saved age 65 is used until you pick one." under it for a stored age that is not 62, 67 or 70 (the control still shows the
  nearest choice and the run still uses the stored age), and the radio group is described by that note or the error. intakeDerivedWrites lost
  its unused parameter.
- c2: example prices moved to lib/constants/example-prices.ts. The target retirement income has no fixed "41,000" placeholder. A select in the
  wizard marks its typical option in the label: "Family (typical)" for HSA coverage when filing jointly (choices keep their "Typical" tag).
- c3: methodology limitations "One worker's own benefit only: no spousal, survivor, earnings test or WEP/GPO adjustments" -> "... no spousal,
  survivor or earnings test adjustments", and on the claiming-age card "No earnings test, spousal, survivor, or WEP/GPO adjustments" -> "No
  earnings test, spousal or survivor adjustments" (the Social Security Fairness Act of 2025 repealed WEP and GPO). The custom benefit input has
  no "30,000" placeholder. estimateSocialSecurityBenefit(+Infinity) is the capped maximum (52,433.52), not 0.
- c4: head of household edge, capped deductions and the short select labels with the range in the help (above).

Not changed, by design: a stored retirement bracket of 0.5 failed validation at 3bb0132 ("must be between 0% and 37%"); it now rides the 37%
option and passes, read as 0.37 like the 0, 0.15 and 0.2 reads above. Typing 61 months clamps to 60 with no message, like the other numeric
inputs.

## Deferred

- Social Security figures stay at 2026 although SSA already shows 2027 figures (bend points 1,340 and 8,077, base 192,300). Changing years means editing only
  lib/constants/social-security-2026.ts. Reason: the task asked for 2026 to match the other 2026 tax constants.
- Healthcare cost was already Auto (null) before this PR; nothing changed.
- lib/fields/runtime.ts fallbackSummary lists "Social Security benefit: Auto" (not "estimate") when only one fact of the optional screen is answered. Change wording there if wanted.
- docs/rebuild-plan.md O9 rows (about lines 62, 172, 266, 1003, 1234, 1254) still describe a fixed 22%; this note supersedes them for the allocator.
- docs/architecture.md does not yet describe the Auto benefit modules.
- The engine's own first step still carries 1-month wording, which lib/calculations/optimization.ts writes and this PR may not change: the
  allocation account "1-Month Emergency Fund", its reason "Build basic financial security before optimization. One month of expenses provides
  essential protection." and "Save $N per paycheck to complete 1-month emergency fund". They show on the overview paycheck card, the automation
  checklist and the payroll setup guide. A later PR allowed to touch lib/calculations can rename them (or the display can map the account name).
- Engine copy and behavior with a real current bracket (lib/calculations/optimization.ts, frozen here): the currentBracket <= 0.12 branch gives
  the Roth recommendation and the Roth IRA reason "Low tax bracket makes Roth optimal for tax-free growth" for more profiles than the fixed 22%
  did. The reason is advice wording, and the branch ignores the retirement bracket, so it can name Roth when the stored retirement bracket is
  lower (12% today, 10% in retirement). Reword and condition it in a PR that may edit the engine.
- lib/fields/runtime.ts fallbackSummary prints the unit suffix as is, so an answered 1 month on a partly answered emergency fund screen reads
  "Emergency fund target: 1 months".

## For the next PRs of the stack

- PR 4 rebuilds the account list and moves "new cash this month" out of the profile. It must go through withDerivedValues and resolveSocialSecurityBenefit like the
  existing call sites, and must not rename or move profile leaves (schema stays 2 unless a migration is added).
- test/factories/profile-3bb0132.ts now sets socialSecurityBenefit: 30000, so it describes 3bb0132 accurately; use it for "old stored profile loads" tests.
- Dashboard fixtures in test/components/dashboard/OverviewCards.test.tsx set the benefit explicitly; new fixtures should do the same if their figures must not move.
- Tests that compare computed doubles must use toBeCloseTo; CI runs Node 22 and 24.
