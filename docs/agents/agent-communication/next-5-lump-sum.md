# PR 5 hand-off: contribution timing, one compounding convention, engine texts

Branch claude/next-5-lump-sum, built from ec300fd (staging branch "next" after PR 1 to 4 and the Node 26 change) in five slices, one
commit each:

    0f6edcf s1-timing-and-retirement-engine: timing leaves on the Monthly investing card, schedule helper and retirement engine
    b69ffe3 s2-retirement-side-engines-and-titles: coast, breakeven and savings curve honor timing; titles follow the dollar mode
    8085f88 s3-leverage-start-of-year: monthly against the same yearly amount at the start of each year, lump sum removed
    d3b3927 s4-allocator-and-projection: single emergency step, neutral engine texts, invested net worth, effective monthly rate
    268df5b s5-docs-and-end-to-end: methodology entry, architecture notes, this note and the end-to-end test

Fixes after review (one commit per area):

    5f80909 contribution schedule: negative horizon keeps the ec300fd value; residue test with a real residue
    cce8cbd allocator step card: the transfer figure is the funded amount
    6be3ba4 allocator notes: a funded emergency step is not also listed as deprioritized
    19417d8 paycheck projection: extra debt principal earns the debt rate only until the balance is paid
    7dc30cb leverage texts: no timing attribution for a 0.0-point difference or a zero contribution
    f27ccd5 list card layout: the header wraps on a narrow screen
    6c1bdef methodology: the contribution timing formula in three rows

package.json and package-lock.json are unchanged; no new dependency. The stored profile version stays 3: a profile stored at ec300fd loads
with three 'monthly' timing leaves and the same provided list. docs/architecture.md, sections "Contribution timing" and "Paycheck
allocator", describe the model; the methodology page has a "Contribution Timing" entry.

## Where this came from

The site owner's feedback of 2026-11-12, in their words (typos included):

- "also considering thinking about supporting lump sum, for example i lump sum into roth start of every year rather than monthly contrib."
- "in the lump sum vs monthly, i am thinking more like someone investing 1 amount at the beginning of every year, not the whole balance
  from the get go, obviously thats better but nearly no one is in a position to do that."
- "i dont thinkwe should suggest 1 month, 3-6 is more reasonable for emergency fund.  just not suggest excessive."
- "i think todays dollars vs future dollars should be kept consistent across every calc too."
- "i dont think we need this many explainers in general ... the for mshould not be used for education."
- "also i want to minimize an abundance of options"
- "we do not need to preserve any functionality from old version of website"

Everything below that is not one of those sentences is the orchestrating session's design (the PR 5 build contract), not an owner
decision. Several points are defaults on open questions, listed at the end.

## What changed (orchestrating session's defaults)

- **Timing.** ira.traditionalTiming, ira.rothTiming and investing.taxableTiming ('monthly' | 'yearStart', default 'monthly'). 'yearStart'
  puts 12 x the part's monthly figure in at month 0 of each simulated year. The controls are three radio groups on the retirement page's
  calculator-only Monthly investing card, shown only on Auto and only for a part in use (the default visitor sees one: Taxable investing;
  the owner sees Roth IRA and Taxable investing). No wizard question, no screen, no explainer. 401(k), match and HSA stay monthly. A Custom
  figure is all monthly.
- **One reader.** yearStartInvesting(get) feeds RetirementInputs.yearStartSavings through the retirement binding. Projection,
  netWorthByAge, scenarios, coast, minimum savings, the savings-rate curve, the inflation breakeven and the "+$500" levers (calculator and
  overview) honor it through lib/calculations/contributionSchedule.ts.
- **Leverage card.** The lump sum (whole total at month 0) is gone. Row 2 is "Start of each year": the same yearly amount at the start of
  each year, on the same draws; the final partial year is prorated, so both rows put in the same total. The headline stays monthly.
- **One monthly-rate convention.** i = (1 + r)^(1/12) - 1 everywhere a balance compounds monthly. It moves only the savings-rate curve,
  the paycheck 10-year projection and FI ages, and the 20-year debt cost.
- **Allocator.** The one-month starter step is deleted; one emergency step funds the target months (3 by default) after the employer match
  and high-interest debt. FINANCIAL_STEPS has 8 entries.
- **Texts.** Neutral Roth/Traditional reasons that print both brackets; scenario titles follow the dollar mode (scenarioTitle in
  lib/calculators/retirement/headline.ts); "Why This Matters" texts carry no dollar figure.
- **Net worth.** Paycheck net worth = emergency fund + preferences.investedBalance (every invested account, IRAs included, emergency-fund
  accounts excluded) - debts; the IRA balances stand in when the field is absent.

## Numbers that change, and why

Default = getDefaultFinancialProfile, nothing touched; today's dollars at 3%. Owner = ownerRaw (test/factories/accountsFixtures.ts);
"owner + Roth yearly" = ownerYearStartRaw (monthlySavings 3,195, yearStartSavings 7,500).

| Where | Before (ec300fd) | After | Why |
|---|---|---|---|
| Default retirement headline | 5,796,147.137288305 / $1,776,849; rate 2.307% | bit-identical | all monthly |
| Default scenario balances | early 60 4,100,839.70; coast 3,215,351.57 | identical | no yearly part |
| Default Conservative title | '...$2,700/month, leave $7,248,000 legacy' both modes | today '...leave $1,061,000 legacy'; future '$8,900/month, leave $7,248,000' | dollar mode |
| Default savings curve | 45: 1,542.35 / 17.796%; 55: 518.96; 65: 138.04 | 45: 1,596.62 / 18.423%; 55: 549.10; 65: 149.60 | convention |
| Default leverage headline, chart, overview | $776,692 / $922,371, 40% | identical | monthly stream untouched |
| Default leverage row 2 | Lump sum $2,093,096 / $2,297,150 (+9.7%), 45% | Start of each year $795,615 / $949,194 (+19.3%), 40% | timing |
| Default allocator | 288.46 / 622.31 / 116.15, 9 step cards | same amounts, 8 step cards, new texts | one emergency step |
| Default 10-year (nominal) | 227,023.55 / 559,032.79; improvement 332,009.24; 16 years 4 months | 282,835.96 / 625,367.05; 342,531.09; 16 years 3 months | convention + net worth 9,000 -> 34,000 |
| Owner + Roth yearly headline | 13,394,066.77; rate 0.9985% | 13,494,440.92; rate 0.9911% | timing |
| Owner + Roth yearly scenarios | early 9,494,975.09; coast 8,039,753.88; legacy $24,893,000 | 9,566,204.34; 8,089,940.96; $25,126,000 | timing |
| Owner + Roth yearly "+$500" | 15,069,908.04 ($4,619,783) | 15,170,282.20 ($4,650,554) | timing |
| Owner + Roth yearly savings curve | 45: 902.98 (6.95%); 50: 315.90 | 45: 927.07 (7.13%); 50: 327.80 | convention + share 0.19562 |
| Owner leverage row 2 | lump $2,352,166 / $2,581,476 (+9.7%), 45% | $1,328,840 / $1,507,679 (+13.5%), 43%; row 1 $1,316,924 / $1,502,882 unchanged | timing |
| Owner paycheck 10-year (nominal) | 378,771.03 / 711,911.84 | 577,857.79 / 921,556.31 | convention + net worth 20,400 -> 116,150 |
| Zero-cash default | '1-Month Emergency Fund' ($1,973 more needed), critical | 'Emergency Fund' ($7,973 more needed), important | one emergency step |
| Zero cash + 24% card (8,000, min 200) | starter step 1,026.92 only | 'Card (24%)' 934.62, then 'Emergency Fund' 92.31 ($8,908 more needed) | one step + known limit |
| 20-year debt cost, 100 a month at 3% | 8,830.20 | 8,685.44 | convention |
| Zero cash, below one month, target 0 months | one-month step funded anyway | no emergency step; the money flows to the later steps | one emergency step (0 target never reads as funded) |
| Below one month, employer match not filled | one-month step first | the match is funded before the emergency fund | one emergency step, after the match |
| Below one month, target above one month, money left after one month | one-month step, then HSA, Roth IRA, 401(k), taxable | the emergency step can take up to the whole remaining target, starving the later steps (pinned in core.test.ts) | one emergency step |
| Zero-cash default, Emergency Fund card, How to Implement | (starter card) | 'Set automatic transfer for $2,225/month' (the funded amount; the build first printed $750, the target gap / 12) | review fix |
| Zero cash (Z, ZD), Notes on This Allocation | 'Deprioritized: Insufficient Emergency Fund' | not listed when the emergency step is funded on the same page | review fix |
| Zero cash + 24% card, 10-year nominal (today's) | ec300fd: current 155,753 today; optimized 492,992 (366,833); improvement 283,673 (211,079) | current 249,394.38 (185,573); optimized 587,341.00 (437,037); improvement 337,946.62 (251,464). The build first showed optimized 1,090,910.44 (811,740), improvement 841,516 (626,167) | review fix: debt principal earns 24% only until the 8,000 is paid (3.95 months), then 7% |
| Any visitor with a debt_payoff allocation, 10-year optimized | the extra principal compounds at the debt rate for ten years | the debt rate only until the payments cover the highest-rate debt's balance, then 7%; e.g. default cash + 24% card (8,000): optimized 1,113,485.96 -> 609,916.53 nominal | review fix (the rule was already there at ec300fd) |

Also visible, not in the contract table: the Optimization Progress bar counts change with the starter step gone ('3 of 6' becomes '2 of 5'
for the default); the methodology page counts 11 formulas instead of 10. The savings-rate caption ('Your current savings rate is X%.
Retiring at N needs about Y%.') can round to a different whole percent for some inputs (about 1 in 9 in a seeded sample) as a result of the
convention change; the default sentence is unchanged.

The contract's section 10 sentence "For a visitor below one month without high-interest debt, the amount and category are unchanged" does
not hold for the three allocator classes in the table above (target 0, unfilled match, target above one month with money left over); the
code follows the section 8 rule as written.

Unchanged after review: a "Work until age X" scenario whose age falls below the current age (custom profile, falling short) shows the
ec300fd balance; the build had shown the starting balance there (165,764.68 against 364,246 in the pinned case, retirement.test.ts).

Review fixes with wording only: on the leverage card, a monthly contribution of 0 gives one sentence that the two timings are the same, and
a difference that prints as 0.0 points says the gaps are the same to one decimal place instead of attributing it to timing. A complete
1-month fund reads '(1 month)'. The step and opportunity cards' header row wraps at narrow widths, so the figures drop below the title.
The methodology Contribution Timing formula is three rows so it fits 360 px (other formulas on that page are wider and unchanged).

Pinned in test/lib/calculators/contributionTiming.test.ts (the end-to-end test): an ec300fd payload builds the ec300fd engine inputs of
every calculator, plus yearStartSavings 0 (retirement) and preferences.investedBalance 25,000 (paycheck); the default projection is
bit-identical; the owner + Roth yearly projection, overview lever and leverage card figures above; the owner paycheck allocation amounts
are the ec300fd ones and no calculator but retirement reads the timing leaves.

## Notes from the slices

- Compact figures on the leverage card: the helper prints '$6.0k/yr + $25.0k start' and '+$154k', not the contract's '$6K/yr + $25K start'.
- The debt step's account name is 'Card (24%)' (formatPercent drops a whole rate's decimals), not 'Card (24.0%)'.
- 'emergency-full' status now matches any allocation with category 'emergency_fund'.
- Newly exported for tests: calculateMinimumSavingsNeeded (retirement.ts), findCoastFireAge and calculateMonthlyContributionsForCoastFire
  (coastFire.ts), calculateFIAge and estimateCurrentNetWorth (projections.ts), bracketComparison (optimization.ts).
- findCoastFireAge at a 0% return now finds an age (it divided 0 by 0 before); not rendered.
- The default seeded leverage monthly stream is pinned with toBeCloseTo in the tests; a one-off bit-for-bit comparison with the ec300fd
  module was run by the S3 builder and is not a committed test.

## Known limit (not fixed here)

calculateHighInterestDebt removes only the extra payment from the money left; the card's minimum payment (92.31 per paycheck for 200 a
month bi-weekly) stays available and flows to the next step. With the starter step gone, the emergency step can be funded from dollars
the minimum payment already needs. Fixing it would move allocations for every visitor with high-interest debt (open question 4).

## Open questions for the owner (default built meanwhile)

1. Type the yearly amount (7,500) or keep the monthly equivalent (625) and show $7,500 in the option? Default: monthly equivalent.
2. Wording and placement: 'Start of each year', 'Once a year, at the start: $X', the controls on the Monthly investing card. Default: as built.
3. Should the leverage headline follow a taxable timing of once a year? Default: always monthly, start of each year only as row 2.
4. Without a starter fund, where should the emergency step sit for someone with little cash? Default: after the match and high-interest
   debt. Related: the known limit above; no emergency card is 'critical' any more; QuickActions still describes cash under one month
   ('Emergency Fund Below One Month of Expenses', 'Time to implement 3-6 months'), so a visitor at 1.5 months sees no QuickAction while
   the step card reads 'Building emergency fund'; comparing against the target months instead is left to this question.
5. Should the 3-month cash cap (CASH_MONTHS_CAP, analysis.ts) rise to 6? Default: unchanged.
6. Should the under-30 Roth rule and the 12/12 gives Roth rule change? Default: rules unchanged, texts print both brackets.
7. Should 'start of the year' follow the calendar? Default: the run's first day, with the error stated on the methodology page.
8. Recalibrate the leverage noise threshold for monthly against start of year? Default: unchanged.
9. Remember calculator-only answers (now the timing choices) between visits? Default (from PR 3): remembered.
10. Show the timing controls to every visitor or only on request? Default: shown, one radio group per part in use.

## Left in the docs on purpose

docs/redesign-guided-flow.md keeps its design history: line 55 (the one-month step in the old allocator order) and the
`emergency-1month` paragraph of the cash-flow investor proposal describe the code as it was when the plan was written. The leverage
"DCA effect" lines gained one note that the built card compares the same yearly amount at the start of each year.
