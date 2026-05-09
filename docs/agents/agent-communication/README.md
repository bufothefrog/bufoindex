# Agent communication notes

When parallel agents work in this repo, each one drops a short note here describing what it claimed, what it changed, and anything it left open. The integrator reads these to reconcile work afterward.

Keep notes short. A useful entry is a few sections, not a checklist:

```
# 2026-05-09 — refactor PortfolioRebalancing inputs

## Claimed
- components/calculators/PortfolioRebalancing/*
- lib/calculations/portfolioRebalancing.ts

## Changed
- Extracted HoldingRow into a shared component.
- Updated calculation to support single-account mode.

## Tests
- test/lib/calculations/portfolioRebalancing.test.ts: passing
- test/components/HoldingRow.test.tsx: passing

## Open
- StateSelector still hardcodes 2024 tax brackets; flagged for follow-up.
```

If you delete or rename a note, that's fine — they're working memory for an in-flight session, not permanent records. Once the work merges, the note can go.
