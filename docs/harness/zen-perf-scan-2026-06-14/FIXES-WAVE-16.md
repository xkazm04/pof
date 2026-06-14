# Zen-Perf Fix Wave 16 — Deferred Highs (all 4, owner-approved)

> The 4 decision-laden highs that were deferred from earlier waves, all approved by the owner.
> Baseline preserved: tsc 0→0; tests 15 fail / 3976 pass (identical); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| #24 (ctx 32) | extract `createConnectionLifecycle` — pof-bridge (client/fetch) + ue5-bridge (server/SSE) now share the health-check/backoff/reconnect state machine; each keeps its own transport. Behavior identical (backoff sequence, state transitions, cadence; ue5 reconnectAttempts-reset preserved) | 28 |
| #21 (ctx 29) | wire Ability-Forge through the shared PromptBuilder/buildProjectContextHeader — it now emits the standard guardrails (build cmd, error memory, UE gotchas, wiring requirements, known-asset paths); ability-specific content preserved; auditPromptString now passes 7/7 | 6 |
| #17 (ctx 11) | unify the materials-tab post-process stack builder onto DEFAULT_EFFECTS (10 effects + GPU cost) — deleted the bespoke 7-effect PP_EFFECTS; extracted a pure reorderByPriority shared by the store + builder | 32 |
| #18 (ctx 14) | extract `useModuleReviewCli` — AudioView + LevelDesignView (the 2 multi-tab views that couldn't use ReviewableModuleView) dropped ~95 LOC each of verbatim-duplicated review/fix/checklist plumbing; toast left per-view via onToast | 21 |
| (bonus) | memoize LevelDesignView's `ctx` object (same fix as AudioView's earlier ctx) — silenced 4 exhaustive-deps warnings | — |

Approved behavior changes: the post-process materials tab now shows all 10 effects + a GPU budget readout; Ability-Forge's emitted prompt gains the shared guardrails. Both are intended improvements.

## ⚠ Process incident + lesson (concurrent agents on a shared worktree)

The first attempt ran all 4 fixes as **concurrent** subagents on the same `pof` checkout. One subagent (#24) ran `git stash pop` during its work, which accidentally applied a pre-existing foreign WIP stash and dumped conflict markers across ~30 files; its cleanup (`revert to HEAD`) then **discarded the uncommitted edits of #17 and #18** (which had no git protection). I detected this by inspecting the tree (0 conflict markers, stash list intact, but #17/#18 files missing), committed the surviving #21/#24, then **re-ran #17 and #18 serially** (no git ops) to recover.

**Lesson (recorded for future waves):** never run multiple file-editing subagents concurrently on one shared working tree when any of them may run `git` mutating commands (stash/reset/checkout). Either run such agents serially, give each its own worktree (isolation), or forbid git ops in subagent prompts. Concurrent **read-only** fan-out (the scan) is fine; concurrent **write + git** is not.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3976 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (PostProcessStackBuilder hex warnings mirror the studio view's existing style) |

## Cumulative (all merged PRs + this branch)
**93 / 176 closed — 62 of 67 high + 31 medium** (+#37). ~5 highs remain (lower-value / larger-refactor): #36 combat per-action tick allocation, #53 inventory dual-source-of-truth, #67 buildTaskPrompt 540-line switch, and a couple of scattered ones. Plus ~45 mediums + 27 lows.
