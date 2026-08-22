# ship-loop overlay - pof

Read by `/ship-loop` at the start of every run. Hand-maintained; the loop proposes edits at CPn.
Lifted from the PoF bare-file copy of ship-loop (`.claude/skills/ship-loop.md`, unversioned, PoF-tuned) when the skill moved to the registry lane (2.1.0).

## Stack
Profile `stack-pof-ue`: Next.js 16 (app router) + React 19 + Zustand 5 + better-sqlite3 (WAL, `~/.pof/pof.db`) + Tailwind 4 + Vitest + Playwright + a live UE5/Blender/MCP bridge (`pof-mcp`, `mcp-unreal`). A **local, single-user dev tool**, not a hosted SaaS - no auth boundary and no billing to certify; dimensions 5 and 6 are re-pointed at PoF's real value/trust surfaces. Large codebase: 33 contexts, ~60 routes, mid-refactor modularization.

## Cadence
milestone (CP0 options: *milestone* - batch 5-8 items -> full gate -> check in / *autonomous until ship bar* - stop only for product decisions that can't be auto-decided / *per-item* check-ins)

## Ship bar (default answer at CP0)
Options offered: "internal tool that reliably drives the UE5 loop for me" / "shareable dev-tool others could run" / "public product path".

## Gates (ordered - run top to bottom, sequentially; hold each as a ratchet - never let a green dim go red without filing a backlog item)
| step      | command | ratchet | when / notes |
|-----------|---------|---------|--------------|
| typecheck | `npm run typecheck` | 0 errors | |
| lint      | `npm run lint` | 0 **errors** | warnings tracked, not blocking |
| unit      | `npm run test` (vitest run) | 0 failed | |
| build     | `npm run build` | exits 0 | Next prod build - separate and slower than the fast gate |
| gen       | `node scripts/gen-pipeline-registry.mjs` (runs in pre* hooks) | registry current | |
| e2e       | `npm run test:e2e` (Playwright catalog-pipeline-walker over a real dev server + SQLite, stub mode) | green | **milestone-gate step** - slow, run at milestone boundaries, not every boot; fast proxy at validate time: `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` |
Notes: `npm run validate` = typecheck + lint + test (the fast gate). Boot runs the gate first (BOOT -> GATE -> AUDIT).

## Value journeys
(none declared - scorecard alone; dimension 9 via the value-market lens -> `.claude/ship-loop/value-case.md`)

## Dimensions (PoF-adapted)
| # | name | what it means here |
|---|------|--------------------|
| 1 | Build & types | typecheck 0 - build 0 - registry gen current |
| 2 | Functional completeness | modules/pipelines actually *produce* (not stubs); NBA/eval/CLI-task paths real |
| 3 | Tests | vitest suite green + meaningful coverage of stores/lib/API |
| 4 | Simulated UAT / e2e | Playwright catalog-pipeline-walker + infra specs green; every registered pipeline e2e-walked |
| 5 | **Pipeline & UE-bridge integrity** *(replaces Billing/value-capture)* | the L0-L4 acceptance ladder derives from UE/DB truth (never a manual toggle); data contract UE<->SQLite locked; ground-truth verification (Tiers-of-Truth) - no "done" without an observation; MCP bridge honest about degrade paths |
| 6 | **Security & secrets** *(replaces Auth/RBAC - no auth surface exists)* | API keys (Leonardo/ElevenLabs/Gemini) never logged/committed; file/script/CLI-spawn paths can't traverse or exec arbitrary input; SQLite/WAL integrity; no secret in prompts or artifacts |
| 7 | UX/UI polish | shared primitives reused (not hand-rolled); a11y floor (WCAG 1.4.1 status not hue-only, 12px text floor, focus-ring); reduced-motion; suspend/LRU correctness |
| 8 | Ops readiness | CI story; docs in sync with code (`docs/` is source-of-truth per CLAUDE.md); scripts/hooks; scoped-check; nightly-build cron |
| 9 | Value & market reality | genuinely useful vs alternatives (Epic's first-party MCP, turnkey AI-anim)? defensible moat (verification/ground-truth, the acceptance ladder)? -> `value-case.md` |

## Conventions
- **Shared-tree hygiene:** re-read before edit; targeted `git add` (author your own files or `git add -p`); never `git add -A`; commit **path-scoped and locally only - the user pushes, never push**.
- The `.claude/ship-loop/` state overlay is **gitignored** (untracked scratch) so it never rides along in a shared-tree commit.
- **Docs-in-sync:** per CLAUDE.md, any structural change updates the matching `docs/` file in the same batch - a stale doc after a landed change is a dim-8 finding.
- **Ground-truth for dim 5:** a pipeline/UE claim is not "done" until an observation confirms it (Tiers-of-Truth) - a green artifact status that isn't derived from UE/DB truth is a finding, not a pass.
- **Impact over label:** rank the backlog by frequency x reachability x cost.
- CLAUDE.md out-of-scope boundaries (anything the user must push, destructive git, external publishing) are never crossable via AFK timeout - explicit consent required.
- Use `context-map.json` to target files; milestone items stay small and reversible.
- UAT depth options at CP0: deterministic e2e only (Playwright stub each gate) / e2e + a live-UE spot check / full character-driven UAT run (if a `/uat` overlay is adopted).
- Milestone-1 cluster options at CP0: build/refactor green first - tests & e2e - pipeline/UE integrity - product decisions.

## Lenses (parallel, read-only subagents; scoped: "verdict + top gaps + evidence, do not fix anything, be concise")
- functional -> dim 2 (+ spot-checks 1)
- tests -> dim 3 (+ e2e coverage feeding 4)
- pipeline-ue-integrity -> dim 5 (acceptance ladder, data contract, MCP/UE bridge, Tiers-of-Truth)
- security-secrets -> dim 6
- ux -> dim 7
- architecture-ops -> dims 1, 8 (module registries, store/persist patterns, docs-sync, CI, the mid-refactor modularization state)
- value-market -> dim 9 (competitor map + honest moat + production-reality checklist -> `value-case.md`)

## History
- PoF ran the loop from a bare `.claude/skills/ship-loop.md` (not loaded by the harness as a skill; invoked by prompt: "run ship-loop" / "ship-loop boot | gate | audit | milestone | checkpoint | recall"). Its `recall` verb and the one-line flow were folded into the generic skill.
