# scan-sweep — project overlay (pof)

Runs on the skill defaults: `context-map.json` (grouped, 38 contexts), outbox
`.personas/memory-outbox.jsonl`, gates from `package.json` (`typecheck` = tsgo,
`lint` = eslint, `test` = vitest) plus `tools/pof-mcp` (`npm run build && npm test`).

## Skill improvement log

- 2026-09-01: Source files under `src/lib/harness` and `src/app/api/harness` are CRLF on disk while new test files land LF; any scripted edit must normalize EOL or its anchors miss silently, and `git diff --stat --ignore-all-space` must match the plain stat before staging.
- 2026-09-01: `tools/pof-mcp` has its own `node_modules` (absent in a fresh worktree); junction the main checkout's `tools/pof-mcp/node_modules` into the worktree to run `npm run build && npm test` there — the MCP Layer-0 suite is not part of the app's `validate`.
- 2026-09-01: A fresh worktree fails `npm run typecheck` until `node scripts/gen-pipeline-registry.mjs` writes the gitignored `registry.generated.ts` (the `predev`/`prebuild` hook); run it before trusting a red baseline.
- 2026-09-01: The registry-map join for `harness-autonomy` is a homonym band (test-harness/eval-harness at 390-410); read `game-production/unattended-build-loop` and `software-engineering/mcp-tools` as the governing subjects until the join is pinned.
