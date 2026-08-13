# Contributing to BufoIndex

Thanks for your interest. BufoIndex is a personal project, but issues and pull
requests are welcome.

## Setup

```bash
npm install
npm run dev   # http://localhost:3000
```

Node 22.22.2+ is required — see `engines` in `package.json` for the exact
range. Pre-commit hooks (husky + lint-staged) run `eslint --fix` and
`tsc --noEmit` on staged TypeScript files.

## Quality bar

Before opening a PR, make sure all four of these pass locally. CI runs
type-check, lint and tests on a Node 22 + 24 matrix, and the production build
in a separate Node 22 job:

```bash
npm run type-check
npm run lint
npm run test:run
npm run build
```

CI lints with `--max-warnings=0`, so leave no warnings behind. It also runs
`npm run test:coverage`, which enforces the coverage floors in
`vitest.config.ts`.

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

## License

By submitting a pull request, you agree that your contribution is licensed
under the AGPL-3.0-only terms in [LICENSE](./LICENSE) — the same license the
project ships under.
