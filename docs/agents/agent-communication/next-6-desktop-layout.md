# PR 6 hand-off: desktop layout, two small fixes, one test trim

Branch claude/next-6-desktop-layout, built from 1a031eb (staging branch "next" after PR 1 to 5) in seven slices, one commit each:

    8d0a95c slice 1: keep the Retire at N label right of the y axis
    a007825 slice 2: trim the savings-rate chart label matrix to 26 rows
    c38060a slice 3: print the paycheck Financial Impact as label over value
    458a3d8 slice 4: add the inputs-above layout variant
    f0e98d6 slice 5: put the leverage inputs in a row above the results
    17d187a slice 6: cap widths on overview, disclaimer and methodology
    (this commit) slice 7: docs and this note

Layout only: no file under lib/calculations changes, no number or text changes, package.json and package-lock.json are unchanged, no
new dependency, the stored profile and preferences are untouched, and there is no new toggle, mode or visitor setting. The one new
prop, `inputsPlacement`, is a developer prop fixed in code per calculator.

## Where this came from

The site owner's feedback of 2026-11-12, in their words (typos included):

- "also we should look at balancing it a bit better for desktop screens. for example th eleverage comparison uses space very
  inefficiently with the left column being mostly empty due to the inputs being hidden."
- "certain other things like seeing the data in a compact fashion would be nice rather than having to click edit to see info."
- "also i want to minimize an abundance of options"
- "we do not need to preserve any functionality from old version of website"

Nothing else was decided by the owner. Everything below that is not one of those sentences is the orchestrating session's design (the
PR 6 build contract, measured in a browser by two designers and challenged by a checker). The choices are defaults on the open
questions at the end.

## How it was measured

Playwright Chromium against production builds (`next build` / `next start` on Node 26), viewport height 900, with an empty profile (the
defaults) and a filled profile (defaults plus answers, two debts and the leverage inputs in `provided`). "Before" is a build of 1a031eb in
a scratch worktree, "after" the build of the slice. "cpl" is the longest line of an element in characters.

## What changed, per page

### Leverage comparison (slices 4 and 5)

- From 1024 the three input cards (Contributions, What do you have saved and invested?, Assumptions) form a row above the results: two
  across from 1024 to 1279, three from 1280. Each starts collapsed to its one-line summary, so the inputs can be read without opening a
  card; each keeps its Show / Hide (and Restore defaults). Below 1024 nothing changes.
- The results take the full width: the headline tiles three in a row, a full-width chart, "Monthly vs start of each year" and "Tail and
  drawdown" side by side, and "Model and caveats" prose in two text columns. The dollar caption and the chart caption are capped at
  reading width.
- In a strip card an opened account editor stacks Kind over Account name (container query; phones, 768 and the side columns unchanged).

| Check | Before (1a031eb) | After |
|---|---|---|
| Page height at 1440, empty / filled | 3583 / 3929 | 2669 / 2955 (limit 2750 / 3050) |
| Page height at 1024, empty / filled | 3883 / 4249 | 2952 / 3238 |
| Inputs height, empty / filled | side column 990 / 1286 at 1024, 882 / 1058 at 1440 | strip 182 at 1280, 1440 and 1920; 316 at 1024 (two rows) |
| Headline figures top | 346 at 1440 (tiles 2 + 1) | 510 at 1280 to 1920, 644 at 1024 (limit 600 at 1440); three tiles in one row, bottom 638 (788 at 1024) |
| Chart | 552x384 at 1440, top 672, half visible | 1180x384 at 1440, svg top 732 (limit 800); 892x384 at 1024 |
| Tab order at 1440 | inputs before results | the three card toggles and Restore defaults, then the dollar toggle |
| DataTables at 1024 | 416 wide, no sideways scroll | the same |
| Longest line in the results (empty profile) | figcaption 94, dollar caption 91 at 1440 | at most 86 at 1024 / 1280, 88 at 1440 / 1920 |
| Phones and 768, inputs and results tabs | | identical to base (0 px), empty and filled |

### Retirement calculator (slice 1)

At the first plotted age the "Retire at N" label on the savings-rate chart started 32.5 px left of the y-axis line, over the "20%" tick,
at 360, 390, 1024 and 1440. It now starts 4 px right of the line at all four widths (for example 126 against the axis at 122 at 360),
with no overlap with any y tick label. Label texts are unchanged. Nothing else changes on the page (page heights identical to base).

### Paycheck allocator (slice 3)

The expanded step card's Financial Impact block uses `KeyValueList layout="grid"`: "Monthly Impact" and "Annual Impact" print as a
muted label over a colored value, two columns, without the bordered rows. Before, at 360 the label ran into the value by 15.4 px
(Monthly) and 17.2 px (Annual), by 0.4 and 2.2 px at 390. After, at 360, 390, 1024 and 1440 in light and dark, each value sits directly
under its label inside its item. KeyValueList has no class hook for values, so the values take the grid variant's look: 14 px Inter
semibold with tabular numbers (tones kept) instead of 16 px monospace (contract amendment C10 allows this). No text or number changes.

### Portfolio rebalancer

No structural change. The Disclaimer below wraps to one more line from 1024 (page +20 px).

### /overview (slice 6)

The card grid's last card spans both columns when it sits alone in a row (`md:*:last:odd:col-span-2` on the grid, CSS only, no count
logic). With the filled profile (7 cards; with an empty profile the page shows no card grid):

| Width | Before: empty cells, last card width | After |
|---|---|---|
| 360 / 390 | one column, 0, 328 / 358 | unchanged |
| 768 | 1 empty cell, 356 | 0, 736 (grid 736) |
| 1024 | 1, 484 | 0, 992 (grid 992) |
| 1280 / 1440 / 1920 / 2560 | 1, 564 | 0, 1152 (grid 1152) |

Screenshots at 1440 and 390, light and dark, checked by eye: "Profile completeness" spans the grid, its progress bar runs the full
width, nothing is cut off, dark mode readable. Page height with the filled profile: 768 2856 to 2804; 1024 2532 to 2552; 1280 and up
2388 to 2428 (the disclaimer's extra lines).

### Disclaimer, every calculator and /overview (slice 6)

`max-w-4xl` became `max-w-prose` (still centered); amendment C9 accepts the reflow from 768 up.

| Page | cpl before at 1440 and 1920 | after | lines before / after at 1440 |
|---|---|---|---|
| /overview | 135 | 83 | 3 / 5 (+40 px from 1024, +20 at 768) |
| Retirement | 127 | 76 | 2 / 2 |
| Paycheck | 132 | 87 | 2 / 2 |
| Portfolio | 114 | 85 | 1 / 2 (+20 px from 1024) |
| Leverage | 131 | 87 | 2 / 3 |

The limit is 90 cpl. At 360 and 390 the disclaimer is unchanged (51 to 55 cpl, same lines).

### Methodology (/tools/retirement-calculator/methodology, slice 6)

The page uses the shared `Container` (from `@/components/ui/layouts/ResponsiveGrid`, `px-4 py-8 sm:px-6`), so its left edge matches the
calculator grid; description paragraphs, purpose and explanation paragraphs and the assumption, limitation and step lists are capped at
`max-w-prose`. KaTeX display blocks keep the card width, their sideways scroll and their tab stop (11 blocks, 11 tab stops, before and
after).

| Width | p / li over 90 cpl, before -> after | longest line | content left edge, before -> after (calculator grid) | blocks that scroll, before / after |
|---|---|---|---|---|
| 360 | 0 -> 0 | 42 -> 42 | 32 -> 32 | 8 / 8, same blocks |
| 390 | 0 -> 0 | 47 -> 47 | 32 -> 32 | 8 / 8, same blocks |
| 768 | 10 -> 0 | 101 -> 90 | 32 -> 40 (40) | 2 / 2, same blocks |
| 1024 | 31 -> 0 | 140 -> 90 | 32 -> 40 (40) | 0 / 0 |
| 1280 | 31 -> 0 | 178 -> 90 | 32 -> 40 (40) | 0 / 0 |
| 1440 | 31 -> 0 | 195 -> 90 | 52 -> 104 (104) | 0 / 0 |
| 1920 | 31 -> 0 | 195 -> 90 | 292 -> 344 (344) | 0 / 0 |

Page height: identical at 360 and 390 (25278, 23218); it grows on desktop as prose wraps (14678 to 15462 at 1440). Display blocks are
1164 wide at 1440 (1268 before, the old 1368 px container). The variable rows under "Variables" are div elements, not p or li, and are
not capped; a few run to about 100 characters at 1440.

### No sideways scroll

scrollWidth == innerWidth on all four calculators, /overview, /demo, /start/profile and the methodology page at 360, 390, 768, 1024,
1280, 1440, 1920 and 2560, empty and filled.

## What the measurements ruled out

From the designers' browser measurements of 1a031eb (1440, height 900; "empty" is the empty share of the two-column area):

- **Results-weighted grid (5fr:7fr or 2fr:3fr).** Retirement goes from 0.17 to 0.22-0.23 empty (inputs +184 to 212 px), portfolio 0.10
  to 0.14-0.16, paycheck unchanged (0.02 to 0.00), leverage only 0.35 to 0.26-0.28 with results prose at 96 to 98 cpl. It hurts two
  pages and helps none enough.
- **Sticky inputs column.** The inputs are 2544-3122 px (retirement), 2718-3520 (paycheck) and 1804-2431 (portfolio) against a 900 px
  viewport; only a nested scroll box would make them sticky. On leverage the default inputs are 882 (empty) and 1104 (filled) against
  about 868 usable; they fit only collapsed (438-458), and then the strip uses the space better. A sticky results column does not fit
  either (results 1548-3531 px).
- **Wider content than 1280 (1440 or 1536).** The empty shares do not change (retirement 0.17 at 1536, leverage 0.35) and leverage prose
  rises to 88 to 98 cpl.
- **Leverage strip with today's open cards.** Strip 476 px (688 filled), headline figures at y=839 to 1051, below the fold (base 387).
- Also rejected: narrowing the methodology container to max-w-4xl (2 formula blocks overflowed, 15 elements still over 90 cpl); moving
  "Model and caveats" under the leverage inputs (visual order no longer matches the DOM and tab order); a visitor toggle for the layout
  (against minimizing options).

## Test trim (slice 2)

test/components/retirement/SavingsRateChart.test.tsx went from 396 tests (6 named plus 3 widths x 5 profiles x 26 ages) to 32: the 6
named tests unchanged plus one table of 26 rows (296 px x 5 profiles x ages 45, 67, 68, 70, plus (296, 2.4%, 64), (326, 2.4%, 67),
(326, 2.4%, 69), (900, 24%, 45), (900, 24%, 50), (900, no savings, 70)). Every row also asserts that the label's left edge is at or right
of the y-axis line; against the pre-fix helper 6 rows fail. The file runs in 3.9 s alone (17.7 s before).

Suite counts: 3171 tests in 141 files at 1a031eb; 2810 after slices 1 to 3 (-364 chart rows, +2 helper tests, +1 paycheck test); 2818 in
142 files after slice 5 (+4 useMediaQuery, +1 CalculatorLayout, +3 leverage); slices 6 and 7 add none (slice 6 is CSS only, which jsdom
cannot see; it was checked in the browser).

Mutation re-run, one mutation at a time against the committed files. Failed tests in the trimmed chart file (of 32) / the helper file
(of 17) / the untrimmed 1a031eb chart file (of 396):

| Mutation | Trimmed | Helper | Untrimmed |
|---|---|---|---|
| M01 GAP 0 | 3 | 5 | 3 |
| M02 DOT_GAP 0 | 0 | 1 | 0 |
| M03 LINE_CLEARANCE 0 | 0 | 1 | 0 |
| M04 CHAR_WIDTH 0.45 | 1 | 0 | 10 |
| M05 ASCENT 0.4 | 0 | 1 | 0 |
| M06 no left-edge anchoring | 2 | 2 | 12 |
| M07 no right-edge anchoring | 1 | 2 | 5 |
| M08 dotUnderLine inverted | 2 | 2 | 2 |
| M09 insideChart ignores the x axis | 7 | 5 | 83 |
| M10 no right bound | 0 | 0 | 0 (known gap) |
| M11 offLine always true | 0 | 0 | 0 (known gap) |
| M12 rate side not opposite | 2 | 2 | 2 |
| M13 rate overlaps the dot label | 0 | 1 | 0 |
| M14 rate overlaps the dot | 0 | 0 | 0 (known gap) |
| M15 rate label past the plot edge | 32 | 8 | 396 |
| M16 first candidate unchecked | 7 | 4 | 83 |
| M17 beside-right overlaps the dot | 0 | 1 | 0 |
| M18 no lifted candidate | 0 | 2 | 0 |
| M19a below baseline ignores the radius (dot.y + ASCENT) | 1 | 1 | 1 |
| M20 every label middle-anchored | 19 | 0 | 31 |
| M21a line read off (rate + 5 points) | 8 | 0 | 92 |
| M22 dot read at the next age | 7 | 0 | 16 |
| M23 label font 16 | 6 | 0 | 15 |
| M24 line discarded out of domain | 5 | 0 | 79 |
| M25 start-of-year share ignored | 1 | 1 | 1 |
| M26 dot radius doubled | 0 | 0 | 0 (known gap) |
| M27a above baseline ignores the radius (bottomAt = dot.y) | 1 | 0 | 1 |
| M28 insideChart left bound back to 0 | 0 | 1 | 0 |

The mutation list gave one-line descriptions, so the builder wrote each mutation. The weakest readings of M19, M21 and M27 (below
baseline dot.y + DOT_GAP + ASCENT, the line at rate + 1 point, above bottomAt dot.y - DOT_GAP) are caught by neither the trimmed nor the
untrimmed file; the stronger readings above are caught by both. The trimmed file never misses a mutation the untrimmed file catches.
M10, M11, M14 and M26 stay known gaps, as the contract allows.

## Differences from the contract

- Helper file: 15 to 17 tests, not 16 (section 7 adds one, amendment C6 adds M28). M06 is caught in the trimmed file by two named tests,
  not by a table row, because the fixed insideChart already rejects labels left of the plot.
- Paycheck values: 14 px proportional instead of 16 px monospace (no value class hook in KeyValueList; C10). The paycheck test checks
  terms and definitions and that each term holds only its label (no row wrapper), which fails with the old rows layout.
- Leverage headline: the "behind" tile keeps fullWidth (col-span-full), so the StatGrid className also carries `lg:*:col-span-1`;
  otherwise C2's three-in-a-row is impossible. 768 is unchanged.
- Leverage chart caption: ChartFrame has no caption prop, and `max-w-prose` on its shared figcaption would reflow the retirement and
  paycheck chart captions, so the cap is leverage only (`lg:[&>figcaption]:max-w-prose` through ChartFrame's className). The dollar caption
  uses `lg:max-w-prose` so 768 is unchanged. Pages checked: leverage at 768 to 1920.
- Caveats: one `*:break-inside-avoid` on the wrapper instead of a class on each child (same effect).
- /demo "Inputs above" entry: the gallery column is narrow, so the demo row follows its own width (container query) and shows two cards;
  CalculatorLayout itself takes `inputsPlacement="above"` as specified. /demo FieldSection cards at 1024 go from two field columns to one
  (C8 expects this).
- Phone heights were compared against the base build, not the contract's absolute G2 numbers, which measure something else.
- Methodology Container: `px-4 py-8 sm:px-6` instead of Container's `p-6`, so phones keep their 16 px padding (page identical at 360 and
  390) and the left edge matches the calculator grid from 640 up.
- Disclaimer at most 87 cpl at 1440 and 1920, not the section 4 target of 80; C9 sets the limit at 90.
- Methodology "no p or li over 90 cpl": the longest lines are exactly 90 characters (two paragraphs at 1440).

## Open issues found while building

- **Layout shift on leverage (C11, fails).** Cumulative layout shift at 1440 with a 4x CPU throttle is 0.1034 on every run against
  0.0000 at 1a031eb: the server and first client render show the tier defaults (Contributions open) and the cards fold once
  `useMediaQuery` reports lg after hydration. The contract forbids an option to fix it; removing it needs collapsed cards on every width
  (question 1's alternative).
- **"What next?" on leverage, filled profile.** The one-line link descriptions of the shared NextSteps footer are 101 cpl at 1024 to
  1920 (every other results line is 88 or under). Fixing it touches NextSteps or CalculatorPage on every calculator; left open.
- CalculatorPage now subscribes to the lg media query on every calculator, which adds one render after hydration on desktop with no
  visible change on the "beside" pages.
- At 1024 the leverage Assumptions card sits alone at half width in the strip's second row (about 130 px of empty half row).
- Pre-existing: at 1024 the open Contributions card's "Leverage ratio" select cuts off its value, as the base's 460 px side column does.

## Open questions for the owner (default built meanwhile)

1. Should the leverage input cards start collapsed on desktop only, showing their summary line? They fold just after the page loads.
   Default: yes, desktop only. Alternative: collapsed on every width, which changes phones and removes the fold.
2. Should the leverage "Model and caveats" text sit in two text columns on desktop? Default: yes. Alternative: one column at reading
   width.
3. Should the leverage "Monthly vs start of each year" and "Tail and drawdown" cards sit side by side on desktop? Default: yes.
4. On /overview, should a last card that is alone in its row span both columns? Default: yes.
5. Should the disclaimer be narrowed to reading width (about 65 to 87 characters per line)? Default: yes.
6. On the methodology page, should the text be capped to reading width with its left edge lined up with the calculators? Default: yes.
7. Should the paycheck Financial Impact show as label over value, without the bordered rows? Default: yes.
8. Should the header and content edges line up on wide screens (touches every page)? Default: not in PR 6.
9. On the leverage page, should the headline figures sit three in a row on desktop? Default: yes.
