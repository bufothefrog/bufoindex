# Resolving Conflicts Between Parallel Agents

Short playbook for when two agents (or two engineers) collide while working in parallel. Most conflicts are avoidable with up-front file ownership; this doc is for when that wasn't enough.

## File-level conflict

**Symptom:** two agents have edited the same file.

1. Stop both agents.
2. Read both diffs end-to-end. Determine whether the changes are:
   - **Independent** — different functions / sections in the same file. Merge by hand, run `npm run type-check && npm run lint && npm run test:run`.
   - **Overlapping** — same lines or interdependent logic. Pick one as the base, port the other's intent on top, then re-test.
   - **Architecturally divergent** — the file has been pulled in incompatible directions. Discard one branch of work and redo it on top of the other, or split the file into two modules.
3. Document the decision in a short note under `docs/agents/agent-communication/` so it isn't relitigated.
4. Update the file-ownership plan so this can't happen again in the same session.

## Interface conflict

**Symptom:** two agents shipped incompatible signatures for a shared type or function (e.g. `lib/types/`, a calculation, or a shared component prop).

1. The agent that owns the definition (or the integrator) picks the final signature.
2. All call sites are updated to match.
3. Run `npm run type-check` — TypeScript will surface anything missed.
4. Re-run the relevant tests.

If neither agent owned the definition, that's the bug. Assign ownership before resuming.

## Test breakage from another agent

**Symptom:** your changes pass locally, but another agent's changes have broken tests you depend on.

1. Don't mask the failure. Read the failing test and the change that broke it.
2. If the breakage is intentional (the other agent updated a contract), update your code to match.
3. If the breakage is accidental, flag it — open a quick note in `agent-communication/` and either fix it yourself or hand back to the original agent.

## Build is broken

**Symptom:** `npm run build` or `npm run type-check` fails on `main` (or the integration branch).

1. Pause new feature work in the same branch.
2. Identify the breaking commit (`git log`, `git bisect` if needed).
3. Either fix forward (preferred for small fixes) or revert (preferred when the change is large and the fix isn't obvious in minutes).
4. Re-run the full local quality suite before resuming.

## Avoiding conflicts in the first place

- Carve up work along clear file boundaries. One owner per file per session.
- If two agents must touch the same file, sequence them — finish one, then start the other.
- Pin shared types and function signatures **before** spawning parallel agents.
- Keep parallel sessions short. Long-running parallel work accumulates merge debt fast.

## Note format

A useful conflict note is a few lines, not a checklist with a hundred boxes. Example:

```
### 2026-05-09: ExampleCard prop conflict

- Agent A added `variant?: 'default' | 'highlighted'` to ExampleCard.
- Agent B renamed the prop to `emphasis`.
- Resolution: kept `variant`, removed `emphasis`. Updated three call sites.
- Tests: passing. Type-check: clean.
```

That's all that's needed. Skip the elaborate templates.
