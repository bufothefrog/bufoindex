# Guided flow

Status: what remains of the guided-flow redesign sketch of 2026-10-03, cut to
the sections that still describe the code (their numbers are kept, because
docs/rebuild-plan.md cites them). The rest of the sketch (the original
proposal, the philosophy layer and the unbuilt accounts proposal) is in git
history. docs/architecture.md covers the profile, the field schema and the
calculators; this page covers the visitor's path through them.

## 2.1 Flow overview

Everyone who takes the guided path answers the same short core intake first,
then chooses what to learn, then answers only the questions that calculator
still needs. The rebalancer is the one exception (O5): it needs none of the
core facts.

```
/  (landing)
|   hero + one primary action "Get started" -> /start
|   preview cards, one per calculator -> /tools/<calculator> (no questions;
|      the page runs from the saved profile or the defaults)
|   "Continue with my profile" (returning visitor) -> /start/choose
|   "Just show me the tools" -> /tools
|
|-- /start   (core intake: seven shared fields on three topic screens)
|      age, state, filing status; gross pay, frequency, take-home;
|      must-pay monthly costs. Shared by every calculator.
|      finish -> /start/<next> when ?next=<intent> set one, else:
|
|-- /start/choose   "What do you want to learn?"
|      1. Finish your profile            -> /start/profile
|         (becomes "See your overview"   -> /overview once nothing is left)
|      2. Figure out where each paycheck should go   -> /start/paycheck
|      3. See if I am on track to retire             -> /start/retirement
|      4. Rebalance my accounts with new cash        -> /start/portfolio
|      5. Compare leveraged vs plain index investing -> /start/leverage
|      one-line summary of the core answers + "Edit the basics" -> /start
|
|-- /start/<intent>   (only the screens this calculator still needs;
|      answered ones are not asked again)
|      finish -> /tools/<calculator>?from=profile   (reads the profile, runs)
|
|-- /start/review   (read-only list of every topic; Edit or Answer opens
|      /start/review/<topic>, one topic with Save and Cancel)
|
|-- /tools/<calculator>
|      Quick answers collapsed once answered; details expanded;
|      assumptions collapsed.
|      "What next?" card at the end of the results:
|         Finish your profile (or See your overview) -> /start/profile | /overview
|         Try another calculator                     -> the other calculator pages
|
`-- /overview  (dashboard; needs the profile)
```

Rules that fall out of this:

- A calculator intake never re-asks a question the profile already holds.
  A skipped screen keeps its typical values, is not marked answered, and
  comes back the next time a calculator needs it.
- `/start/choose` redirects to `/start` when the core is incomplete, and
  `/start/<intent>` sends a visitor without the basics through the core
  first (`coreStartLink` in `lib/constants/intake.ts`), so a bookmarked
  chooser cannot show an empty summary.
- Saved answers are seen and changed at `/start/review`, linked from the
  chooser and the overview's completeness card. Edits on a calculator page
  also write through to the profile (O1), so the calculators and the
  overview always agree.
- Links into a calculator carry at most `?from=profile`; there is no URL-hash
  state (section 9.1).

## 2.3 Intake wizard

One topic screen at a time (O2): a few related fields under one question,
with progress dots and, after the first screen, a Back control beside them.
A bar pinned to the bottom of the viewport holds the two actions, "Skip"
(keeps the typical values without marking them answered) and "Next" ("Finish"
on the last screen; takes the typical value for each blank field and marks
it answered; on the three basics screens it asks for the visitor's own entry
instead, see `nextNeedsOwnAnswer` in `lib/constants/intake.ts`). Nothing is
pre-filled: typical values show as grey placeholders. Each Next and Skip
saves.

One component (`components/guided/Wizard.tsx`) runs every flow, and every
screen is a `ScreenSpec` from a FormSpec (`lib/calculators/<id>/form.ts`),
so the wizard and the calculator page ask the same fields with the same
validation:

- **Core** (`/start`): the seven shared fields on three screens
  (`CORE_SCREENS` in `lib/fields/shared.ts`). Heading "A few basics" and a
  line saying every calculator uses these answers. Finishes to the
  chooser, or to the intent `?next` named.
- **Calculator** (`/start/<intent>`): the intent's screens after the core
  whose fields are not all answered yet; a partly answered screen shows all
  of its fields, the answered ones with their saved values. Assumption
  screens, calculator-only screens (`surface: 'calculator'`) and optional
  screens are not asked. Finishes to the calculator at `?from=profile`.
- **Profile** (`/start/profile`): the profile form (`PROFILE_FORM` in
  `lib/calculators/forms.ts`): the core screens, then the non-core,
  non-assumption screens of the paycheck, retirement, portfolio and leverage
  forms in that order, each field asked once, then the optional screens in a
  section "Optional"; screens already answered are not asked again.
  Finishes on the overview.

Intake screens per calculator after the core:

| Tool | Intake screens |
|---|---|
| Paycheck | fun money and bonuses; emergency fund; 401(k) or similar plan; health savings account; IRAs and taxable investing; debts |
| Retirement | what you have saved and invested (the account list); when you would like to retire |
| Portfolio | target allocation; the account list; holdings (no core screens, O5) |
| Leverage comparison | what goes into the comparison (age, stop age, taxable monthly contribution); the account list |

Optional screens: a screen with `optional: true` (`ScreenSpec` in
`lib/fields/types.ts`) is not asked on the way into a calculator and does not
count toward profile completeness. The profile form asks it last, in the
section "Optional" (`composeProfileForm` in `lib/calculators/forms.ts`).
Today the one optional screen is the retirement screen with the Social
Security benefit and the annual healthcare cost
(`lib/calculators/retirement/form.ts`); the calculator page still shows it.

## 2.4 Calculator page, second pass

Every calculator page is a `CalculatorPage`
(`components/calculators/shared/CalculatorPage.tsx`): the form's screens
render as one `FieldSection` card each, in three tiers (`Tier` in
`lib/fields/types.ts`), with the results beside them in `CalculatorLayout`:

1. **Quick answers** (`core`, collapsed once every field on the screen is
   answered). The intake fields, shown as a one-line summary with an Edit
   action that expands the same inputs inline.
2. **Details** (`details`, expanded). The fields that need a document or
   some thought, grouped by topic, plus the calculator-only screens (for
   example the retirement page's monthly investing and claiming age).
3. **Assumptions** (`assumption`, collapsed). Returns, volatility,
   inflation, rate overrides and similar settings, with a restore-defaults
   action.

Results follow the inputs live (O8): there is no Calculate button. On
invalid inputs the last results stay on screen, marked stale (O17). Below
`lg` the layout shows an Inputs | Results tab bar and a sticky bar whose one
action is See results / Edit inputs; on desktop the two-column layout stays,
except on the leverage comparison, whose few inputs sit as a row of collapsed
cards (each showing its one-line summary) above full-width results; those
cards start collapsed on phones too.

## 3.4 Store and persistence

`lib/store/profileStore.ts` (Zustand + persist, localStorage key
`bufo-profile`, versioned; older payloads go through
`lib/profile/migrate.ts`). The profile is the only record of inputs: the
calculator stores are run stores made by `createCalculatorStore`
(`lib/store/createCalculatorStore.ts`) that hold results and persist
nothing. When a calculator mounts:

1. The page reads its inputs from the profile through the calculator's
   bindings (`lib/calculators/<id>/bindings.ts`), defaults and derived
   typical values filling anything unanswered, and runs.
2. Each edit writes through to the profile (O1) and re-runs.

There is no hash step: old share links are not supported (O6). The dollar
display mode is one site-wide preference (`lib/store/preferencesStore.ts`,
O15).

## 9.1 What the hashes did, and where each job went

The rebuild removed URL-hash state (O6). Each job the hash used to do:

| Job the hash did | Where it is now |
|---|---|
| Seed a calculator from somewhere else (wizard, dashboard) | The calculators read the shared profile directly; links carry at most `?from=profile`. |
| Persist across reloads on one device | localStorage, one profile record (`bufo-profile`) instead of per-calculator stores, plus the display-mode preference. |
| Share a scenario with someone else | Dropped. The Share buttons and the codecs are gone, and old links are not decoded. |
| Reproducibility for bug reports and methodology | Not replaced. |
