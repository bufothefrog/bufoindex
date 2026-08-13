# BufoIndex

[![CI](https://github.com/bufothefrog/bufoindex/actions/workflows/test.yml/badge.svg)](https://github.com/bufothefrog/bufoindex/actions/workflows/test.yml)

**Live: https://bufoindex.com**

Interactive personal-finance calculators that show their work. Every number on screen traces back to a formula you can inspect — the retirement calculator ships a [methodology page](https://bufoindex.com/tools/retirement-calculator/methodology) with the actual equations. Everything runs client-side: no backend, no accounts, no data leaving the browser. Scenarios are encoded into the URL hash, so sharing a configuration is just sharing a link.

## Calculators

- **[Paycheck Allocator](https://bufoindex.com/tools/paycheck-allocator)** — allocates a monthly paycheck across fixed costs, tax-advantaged accounts, and flex spending, with bracket-aware federal and state tax math (2026 IRS and state figures, sourced in `lib/constants/`).
- **[Retirement Calculator](https://bufoindex.com/tools/retirement-calculator)** — Monte Carlo retirement modeling that genuinely models Social Security timing and benefits, healthcare cost growth, and a target-date-fund glide path, with side-by-side scenario comparison. Results can be viewed in today's dollars or future (nominal) dollars via a display toggle.
- **[Portfolio Rebalancer](https://bufoindex.com/tools/portfolio-rebalancing-calculator)** — multi-account rebalancing with custom asset classes, a securities registry shared across accounts, and tax-aware placement advice.

## How it works

- **Pure calculation layer.** All financial logic lives in `lib/calculations/` as pure TypeScript — no React, DOM, or storage imports — so every formula is unit-testable against hand-computed values.
- **Seeded Monte Carlo.** The retirement simulation draws normally distributed annual returns via a Box–Muller transform over a seeded LCG (`lib/utils/random.ts`). A fixed default seed makes results reproducible: the same inputs always give the same success probability.
- **Versioned URL-hash state.** Each calculator serializes its inputs to a compact, versioned, base64url-encoded hash — short keys, defaults elided. Decoders accept every prior schema version and migrate forward, so old shared links keep working.
- **Display-dollar boundary.** Simulations run in nominal dollars; the today's-dollars toggle converts at display time only (`lib/utils/displayDollars.ts`) and never feeds back into calculations.
- **Semantic-token theming.** Light and dark mode are driven by design tokens in `app/globals.css`; charts pull colors through `getChartTheme()` so they follow the active theme.

Details in [`docs/architecture.md`](./docs/architecture.md).

## Stack

- **Framework:** Next.js 16 (App Router), deployed on Vercel
- **Language:** TypeScript 6 (strict)
- **UI:** React 19 + Tailwind CSS 4
- **State:** Zustand
- **Charts:** Recharts 3
- **Tests:** Vitest 4 + Testing Library + jsdom

## Getting started

```bash
npm install
npm run dev   # http://localhost:3000
```

Node 22.22.2+ is required — see `engines` in `package.json` for the exact range.

## Scripts

| Script                  | What it does                     |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Next.js dev server               |
| `npm run build`         | Production build                 |
| `npm run start`         | Run the production build locally |
| `npm run lint`          | ESLint                           |
| `npm run type-check`    | `tsc --noEmit`                   |
| `npm run test`          | Vitest watch mode                |
| `npm run test:run`      | Vitest one-shot                  |
| `npm run test:ui`       | Vitest browser UI                |
| `npm run test:coverage` | Vitest one-shot + v8 coverage    |

Pre-commit (husky + lint-staged) runs `eslint --fix` and `tsc --noEmit` on staged TypeScript. CI runs type-check, a zero-warning lint gate (`--max-warnings=0`), and the tests on a Node 22/24 matrix (coverage on Node 22), plus separate Node 22 production-build and dependency-audit jobs.

## Project layout

```
app/                     # Next.js App Router routes
  tools/                 # Calculator pages, plus the components and charts
                         #   specific to each (paycheck-allocator,
                         #   retirement-calculator + methodology,
                         #   portfolio-rebalancing-calculator)
  demo/                  # Public component gallery
components/
  ui/                    # Primitives: button, card, input, slider, inputs/, cards/, layouts/
  shared/                # Tooltip, UtilityBar, DollarModeToggle, inputs/, layout/, cards/
  paycheck-allocator/    # Paycheck-allocator UI
  calculators/, retirement/, methodology/
contexts/                # ThemeContext (light/dark)
lib/
  calculations/          # Pure financial logic — no React
  constants/             # Sourced figures (irs-2026.ts, states-2026.ts, …)
  utils/                 # URL-hash codecs, seeded RNG, display-dollar conversion
  store/, types/, formulas/, chart-theme.ts
test/                    # Vitest suites, factories, helpers
docs/                    # architecture.md, agents.md, agents/ (patterns, coordination)
```

## Testing

Every module in `lib/calculations/` has a matching suite in `test/lib/calculations/`; codecs and utilities are covered in `test/lib/utils/`, stores in `test/lib/store/`, the formula registry in `test/lib/formulas/`, and components in `test/components/` (`npm run test:run`). Calculation tests assert real numeric values, hand-computed where practical. Coverage is instrumented across `lib/` (type-only modules excluded) with floors defined in `vitest.config.ts` — a higher bar for `lib/calculations/` than for the rest — and CI fails when they are not met.

## Development process

BufoIndex is built with Claude Code, using a multi-agent workflow for larger changes — parallel agents with exclusive file ownership, followed by a single integration pass. The process is documented in [`docs/agents.md`](./docs/agents.md).

## Contributing

Issues and pull requests are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Reports of calculation errors (with reproducing inputs) are the most valuable kind.

## License

Copyright (C) 2026 bufothefrog

Licensed under AGPL-3.0-only — see [LICENSE](./LICENSE).

Educational tool; not financial advice.
