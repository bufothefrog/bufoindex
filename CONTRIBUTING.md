# Contributing to BufoIndex

Thanks for your interest. BufoIndex is a personal project, but issues and pull
requests are welcome.

## Setup

```bash
npm install
npm run dev   # http://localhost:3000
```

Node 22+ is required. Pre-commit hooks (husky + lint-staged) run `eslint --fix`
and `tsc --noEmit` on staged TypeScript files.

## Quality bar

Before opening a PR, make sure all four of these pass locally — CI runs the
same checks on Node 22 and 24:

```bash
npm run type-check
npm run lint
npm run test:run
npm run build
```

## Ground rules

- **Financial logic lives in `lib/calculations/`** as pure TypeScript — no
  React, DOM, or storage imports. Every calculation change needs a test that
  asserts real numeric values (hand-computed where practical), not just
  `toBeDefined`.
- **Cite your constants.** Tax brackets, contribution limits, and similar
  figures belong in `lib/constants/` with a source comment (e.g. the IRS
  Revenue Procedure number). See `lib/constants/irs-2026.ts` for the pattern.
- **Use semantic theme tokens**, never raw palette classes (`bg-blue-500`,
  `text-gray-600`, hex literals). Charts must use `getChartTheme()` from
  `@/lib/chart-theme`. Check both light and dark mode.
- **Compose existing components** from `components/ui/` before writing new
  ones. The `/demo` page catalogs what exists.
- **Neutral tone.** Calculators show the math and let the reader judge; copy
  should not assert a single "right answer."

## Reporting calculation errors

Math bugs are the highest-value reports. Please include the inputs that
reproduce the issue (a share URL is ideal), the value shown, and the value you
expected with your reasoning or a source.
