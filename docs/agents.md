# Working in BufoIndex

This is reference material for engineers (and Claude Code agents) working in this repo. For design-system rules and the project layout, read `CLAUDE.md` first — this file only covers process and coordination.

## What the project actually is

- **Next.js 16 App Router** app under `app/`, deployed via Vercel (`vercel.json`).
- **TypeScript 6 + React 19 + Tailwind 4 + Recharts 3**.
- **Vitest 4** with jsdom for tests; `@testing-library/react` for component tests.
- **husky + lint-staged** for pre-commit; **GitHub Actions** (`.github/workflows/test.yml`) for CI.

There is no static-site generator, no `content/` directory of markdown articles, no separate quality-gates script, and no philosophy-compliance grep. If you find prose elsewhere in the repo describing those, treat it as stale.

## Quality bar

Locally:

```bash
npm run type-check    # tsc --noEmit
npm run lint          # eslint .
npm run test:run      # vitest run
npm run build         # next build (catches a different class of issues)
```

Pre-commit (husky → lint-staged) runs `eslint --fix` and `tsc --noEmit` on staged TS/TSX. CI re-runs type-check, lint with `--max-warnings=0`, and the tests on a Node 22 + 24 matrix (coverage on Node 22), then runs a production build and an `npm audit --audit-level=high` scan as separate Node 22 jobs.

A change is ready when:

- type-check is clean,
- lint passes with zero warnings,
- relevant tests pass and you've added tests for new logic,
- `npm run build` succeeds,
- the design-system rules in `CLAUDE.md` are respected (semantic classes, `getChartTheme()`, `/demo` parity for new shared components).

Coverage floors are enforced in `vitest.config.ts` — a global floor across the covered `lib/` code and a higher bar for `lib/calculations/` — and CI runs `npm run test:coverage`, so an unmet floor fails the build. Above those floors, cover what's load-bearing — financial calculations and user-visible behaviors — and skip exhaustive coverage of trivial code.

## Tests

- Calculation tests live in `test/lib/calculations/*.test.ts`. They import from `@/lib/calculations/*` and assert numeric results.
- Component tests live in `test/components/`.
- Shared mocks live in `test/factories/test-data-factory.ts`. It is imported by multiple test files — if you change a factory signature, update the callers.
- Vitest config: `vitest.config.ts`. Tests run with `pool: 'threads'`, max 4 threads, 10s timeout. The `@/` and `@/test` aliases resolve to repo root and `./test`.
- Setup: `test/setup.ts`.

## Multi-agent coordination

Most tasks are best done by a single agent. Reach for parallelism only when:

- the work splits cleanly along file boundaries,
- the integration contract is obvious (no negotiation needed),
- and you actually save wall time after coordination overhead.

When you do run agents in parallel, follow these rules:

1. **Define file ownership up front.** Each agent gets an exclusive list of files it may modify. Anything else is read-only for that agent.
2. **Pin shared interfaces before forking.** If two agents touch a shared type or function signature, settle the signature first; one agent owns the definition, others import.
3. **Drop a short note in `docs/agents/agent-communication/`** describing what you took, what you produced, and any follow-ups. These notes are how the next session knows what's in flight.
4. **Integrate sequentially.** After parallel agents finish, one agent reads everyone's diffs, reconciles imports, runs `type-check + lint + test:run + build`, and fixes the seams.

A useful agent-communication entry is just a few sections: claimed files, what was changed, what tests pass, anything still open. The historical templates in this repo are far more elaborate than necessary — keep it short.

### When file ownership conflicts arise

- Pause both agents.
- Decide: split the file into separate modules, sequence the work, or hand it to one agent and have the other consume the output.
- Document the resolution in the agent-communication note so it isn't replayed.

## Calculator additions / changes

A new calculator typically touches:

- `app/tools/<calculator-name>/page.tsx` (and any subroutes) — the page shell.
- `lib/calculations/<calculator-name>.ts` — pure logic, no React.
- `lib/types/` — shared input/output types.
- `components/calculators/` or a calculator-specific subdir — UI specific to this tool.
- `test/lib/calculations/<calculator-name>.test.ts` — unit tests for the logic.
- Optionally `test/components/<Component>.test.tsx`.

Reuse existing inputs from `components/ui/inputs/` and `components/shared/inputs/` (see `CLAUDE.md` for the hierarchy). Chart components live with their calculator (e.g. `app/tools/retirement-calculator/components/`) and must pull theme via `getChartTheme()`.

## What not to recreate

- Orchestration shell scripts that wrap `npm run` commands. The husky hook and CI workflow already invoke type-check, lint, test, and build directly — adding a wrapper layer just hides what's happening.
- A benchmark CI job that does not run real benchmarks. If you need perf data, write actual benchmarks in `test/` and run them deliberately; a job that reports numbers it never measured is worse than no job at all.
- An editorial-language grep gate. Voice and tone belong in code review, not in a CI step that fails the build over a word list.
- Sprint-numbered process documents. Documentation should describe what's true, not what someone planned to do six months ago.

## Quick references

- Design system, component hierarchy, theming rules: `CLAUDE.md`.
- Calculation layer, Monte Carlo engine, URL-hash state, theming architecture: `docs/architecture.md`.
- TypeScript / React conventions: `docs/agents/code-patterns.md`.
- Resolving conflicts between parallel agents: `docs/agents/conflict-resolution.md`.

## Reminders

- Read existing code before writing new code. The repo is medium-sized and most patterns already exist.
- Pure functions in `lib/calculations/`; keep them free of React, DOM, or storage access so they stay easy to test.
- Don't introduce new build/test infrastructure casually. The current toolchain (Next, TS, Vitest, ESLint, Husky, lint-staged) covers what's needed.
