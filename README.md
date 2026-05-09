# BufoIndex

Interactive personal-finance calculators for people who'd rather pressure-test decisions with math than rely on folk wisdom. Everything runs in the browser; scenarios are sharable via URL hash and no data leaves your machine.

## Calculators

- **Paycheck Allocator** (`/tools/paycheck-allocator`) — monthly allocation across fixed costs, tax-advantaged accounts, and flex spending, with bracket-aware tax modeling.
- **Retirement Calculator** (`/tools/retirement-calculator`) — Monte Carlo retirement modeling with Social Security, healthcare, and side-by-side scenario comparison.
- **Portfolio Rebalancer** (`/tools/portfolio-rebalancing-calculator`) — multi-account rebalancing with custom asset classes and tax-aware placement advice.

## Stack

- **Framework:** Next.js 16 (App Router) on Vercel
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

## Scripts

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Next.js dev server                              |
| `npm run build`     | Production build                                |
| `npm run start`     | Run the production build locally                |
| `npm run lint`      | ESLint                                          |
| `npm run type-check`| `tsc --noEmit`                                  |
| `npm run test`      | Vitest watch                                    |
| `npm run test:run`  | Vitest one-shot                                 |
| `npm run test:coverage` | Vitest + v8 coverage                        |

Pre-commit (husky + lint-staged) runs `eslint --fix` and `tsc --noEmit` on staged TS/TSX. CI runs type-check, lint, tests, coverage, and a production build.

## Project layout

```
app/                     # Next.js App Router routes
  tools/                 # Calculator pages
  demo/                  # Component gallery (dev only)
components/              # ui/ primitives, shared/ cross-cutting, charts/, calculator-specific
lib/
  calculations/          # Pure financial logic (no React)
  chart-theme.ts         # Theme-aware chart colors
  constants/, types/, utils/, store/, formulas/, design-system/
test/                    # Vitest tests + factories + setup
```

For contributor conventions and the design-system rules, see [`CLAUDE.md`](./CLAUDE.md). For multi-agent / process notes, see [`docs/agents.md`](./docs/agents.md).

## License

Educational use only. Not financial advice.
