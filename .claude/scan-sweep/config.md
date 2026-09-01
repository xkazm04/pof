# scan-sweep overlay — pof

No key overrides. The skill's defaults are correct for this repo:
`context-map.json` at the root, `.personas/memory-outbox.jsonl`,
`.personas/backlog-digest.json`, depth 5 / 10, no `neverSweep`.

Gates are detected from `package.json` (there is no `.claude/conventions.json`):
`npm run typecheck` (tsgo), `npm run lint` (eslint), `npm test` (vitest),
composed as `npm run validate`.

## Skill improvement log

- 2026-09-01 — **A fresh worktree cannot typecheck until the generated pipeline
  registry exists.** `npm run typecheck` fails with ~20 `TS2882 Cannot find module
  '@/lib/catalog/pipelines/registry.generated'` errors, which look like real
  breakage in unrelated contexts. The file is gitignored and produced by the
  `prepare`/`predev`/`prebuild` hooks; a worktree created with `git worktree add`
  runs none of them. Run `node scripts/gen-pipeline-registry.mjs` once before
  treating any typecheck result as a verdict.
- 2026-09-01 — **The whole-tree test baseline is red before you touch anything,
  and the red is timeouts.** Two full runs on an unmodified tree returned 9 and 2
  failures respectively, all in `src/__tests__/components/layout-lab/*` and
  `src/__tests__/components/visual-gen/*`, all "Test timed out in 5000ms" on a
  ~330s suite. Take the baseline before the first edit and compare failing PATHS,
  not counts. A full run also rewrites four `__snapshots__` files as a side
  effect — `git checkout --` them before staging, or they ride along.
- 2026-09-01 — **`tools/pof-mcp` cannot be gated from a fresh worktree.** It is a
  separate npm package (own `node_modules`, own `tsc`, `node --test dist/*.test.js`),
  it is outside `vitest.config.ts`'s include globs so `npm run validate` never
  touches it, and the root install does not provide its dependencies. Any finding
  whose fix lands there is veto 3 until that is fixed — say so rather than
  committing an unverified change.
- 2026-09-01 — **Read `.ai/applied.jsonl` during §2, not at write-up.** It is this
  repo's record of registry techniques already experimented with, with measured
  before/after figures and an explicit `next_change` field naming what is still
  owed. The 2026-08-30 `verifier-coverage-review-agenda` row had already measured
  the visual gate returning 0 verdicts in 77/77 deciding iterations and had
  written down the exact remedy; a round that reads it first reports owed work as
  owed and inherits a Before figure instead of re-deriving one.
