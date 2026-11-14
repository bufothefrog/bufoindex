# Agent communication notes

When parallel agents work in this repo, each one drops a short note here describing what it claimed, what it changed, and anything it left open. The integrator reads these to reconcile work afterward.

Keep notes short. A useful entry is a few sections, not a checklist:

```
# 2026-05-09 - refactor PortfolioRebalancing inputs

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
- Single-account mode has no test for the empty-holdings edge case; flagged for follow-up.
```

A note is working memory for work in flight, not a permanent record. When its work merges, move anything still open into `docs/open-items.md` (one line per item) and delete the note; git history keeps it.
