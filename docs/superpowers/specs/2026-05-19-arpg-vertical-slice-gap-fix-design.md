---
date: 2026-05-19
status: draft
sub_project: B (gap-fix)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-analysis-design.md
analysis_outputs:
  - docs/features/arpg-vertical-slice/INDEX.md
  - docs/features/arpg-vertical-slice/gap-inventory.md
  - docs/features/arpg-vertical-slice/testid-coverage.md
---

# Sub-project B: ARPG vertical-slice — gap-fix wave

## Context

Sub-project A identified 20 gaps blocking a Playwright-driven build of an ARPG vertical slice; 11 are flagged as blocking and must close before sub-project D can execute. This spec covers closing those 11 blockers.

The 9 non-blocking testId/UI gaps stay deferred to sub-project C.

## Goals

1. Add a real cook-execution backend so the Package button in PoF actually packages the UE5 project end-to-end (closes GAP-001 + GAP-007).
2. Patch prompts so `arpg-loot`, `arpg-ui`, and `input-handling` checklist items produce slice-appropriate output without requiring out-of-scope modules (closes GAP-004, GAP-005, GAP-006, GAP-008).
3. Refactor `arpg-enemy-ai` checklist into per-feature toggles so the operator can request a minimal dummy enemy without generating full AI infrastructure.
4. Tighten evaluator prompts so quality checks catch the two behavior bugs identified in `arpg-combat` (closes GAP-002, GAP-003).
5. Add the minimum `data-testid` attributes needed for Playwright to navigate the sidebar and CLI panel (closes GAP-015, GAP-016, GAP-017).
6. Update `INDEX.md §2` (operator flow) to drop `(blocked by GAP-NNN)` annotations on now-closed gaps.

## Non-goals

- All 9 non-blocking gaps (GAP-009..GAP-014, GAP-018, GAP-019, GAP-020) stay open for sub-project C.
- No new Playwright test scenarios that drive the full vertical slice — that is sub-project D's deliverable. B's E2E only verifies that the new infra testIds are queryable.
- No changes to `arpg-character`, `arpg-animation`, `arpg-gas`, or `project-setup` — these had zero blocking gaps in A.
- No worktree, no feature branch. Work lands directly on `master` per the project's established pattern.

## Decision record (from brainstorming)

1. **Cook execution.** New `POST /api/packaging/execute` returning a Server-Sent Events stream. A `CookProgress` React component subscribes and renders phase + percent + tail of log + final exePath.
2. **Inventory dependency.** Patch `arpg-loot` and `arpg-ui` prompts in-place to add slice-mode variants; do not build an inventory stub, do not introduce a feature-flag dep system.
3. **Dummy enemy.** Refactor `ae-1..ae-8` so each item carries `dependsOn` + `features` metadata, letting the operator pick exactly which features to generate. `ae-1` stays as the minimal foundation; `ae-2..ae-8` each depend on `ae-1`.
4. **Sidebar testIds.** Inline in `SidebarL1.tsx` and `SidebarL2.tsx` (`data-testid={\`pof-sidebar-...-${id}\`}`). No registry plumbing, no helper utility.

## In-scope gaps

| ID | Module | Severity | Stream |
|----|--------|----------|--------|
| GAP-001 | packaging | L | A |
| GAP-007 | packaging | M | A |
| GAP-002 | arpg-combat | M | B |
| GAP-003 | arpg-combat | M | B |
| GAP-004 | arpg-loot | M | B |
| GAP-005 | input-handling | M | B |
| GAP-006 | input-handling | M | B |
| GAP-008 | arpg-ui | S | B |
| GAP-015 | infra (sidebar L1) | M | C |
| GAP-016 | infra (sidebar L2) | M | C |
| GAP-017 | infra (CLI panel) | M | C |

Plus the `arpg-enemy-ai` per-feature refactor (open question 2 from sub-project A; not a numbered gap but in scope per decision 3).

## Approach: three parallel streams

Streams touch zero overlapping files and can run as three independent subagent dispatches under `subagent-driven-development`.

### Stream A — Cook backend (~6-8 hrs)

**New files:**

- `src/lib/packaging/cook-executor.ts` — async generator that spawns `RunUAT.bat`, parses cook output into `{ type: 'phase' | 'log' | 'progress' | 'done' | 'error', ... }` events, exits with `{exePath, durationMs, sizeBytes, status}`.
- `src/app/api/packaging/execute/route.ts` — POST endpoint; body `{ profileId: string; mapName?: string }`; returns SSE `Response`; calls `cookExecutor()` and writes each event as `data: {JSON}\n\n`. On client disconnect, abort the child process via the request's `AbortSignal`. On final event, write a build record via the existing `build-history-store.ts`.
- `src/components/modules/game-systems/CookProgress.tsx` — renders the SSE stream: phase chip + percent bar + tail (last 50 lines) of the cook log + final result card with exePath + status. Exposes these testIds (specified here so sub-project D can rely on them): `pof-cook-progress`, `pof-cook-progress-phase`, `pof-cook-progress-percent`, `pof-cook-progress-log`, `pof-cook-progress-result`, `pof-cook-progress-exe-path`.
- `src/__tests__/packaging/cook-executor.test.ts` — unit test with `child_process.spawn` mocked (e.g., via `vi.mock('node:child_process')`). Feeds canned UE5 cook output, asserts events.
- `src/__tests__/api/packaging-execute.test.ts` — route test with the executor injected (module-level setter for tests). Verifies SSE stream produces the expected event sequence and writes a build record.

**Modified files:**

- `src/components/modules/game-systems/PackagingView.tsx` — render `<CookProgress />` when a cook is running (state managed via a small Zustand slice or `useState` lifted from the parent).
- `src/components/modules/game-systems/BuildConfigSelector.tsx:120-124` — Package button currently dispatches via `useModuleCLI.sendPrompt()`. Replace with `fetch('/api/packaging/execute', { method: 'POST', body: JSON.stringify({ profileId, mapName }) })` and pipe to `CookProgress`.
- `src/components/modules/game-systems/PlatformProfileCard.tsx` — wire the green Package button to the new flow.

**Parser strategy:** UE5 cook output has predictable markers (`***** UAT *****`, `BUILD COMMAND STARTED`, `Cook commandlet successful`, `Stage`, `Package`). The parser uses a small state machine:
- Match phase markers → emit `{type: 'phase', phase: 'cook' | 'stage' | 'package' | 'done'}`
- Extract optional `progress=NN%` if UAT emits it → emit `{type: 'progress', percent}`
- Pass through every line as `{type: 'log', line}` (rate-limited to 1 line per 100ms to avoid SSE spam)
- On exit `code === 0` → emit `{type: 'done', exePath, durationMs, sizeBytes}`
- On non-zero or stderr containing `error` → emit `{type: 'error', message}`

Test surface: feed canned cook logs (committed under `src/__tests__/packaging/fixtures/cook-success.log` and `cook-fail.log`), assert generator output.

### Stream B — Prompt + registry edits (~3 hrs)

**Modified files:** `src/lib/module-registry.ts`, `src/lib/evaluator/module-eval-prompts.ts`.

Edits:

1. **al-5** (loot): append explicit slice cheat-path. After the existing prompt, add a `SLICE MODE` section: spawn `AARPGWorldItem` with `Lifetime=60s` self-destruct; do not require an inventory component on the player.
2. **al-6** (pickup): rewrite primary prompt to overlap-destroy with "+gold" Niagara effect; mention the full-inventory variant only as a follow-up under `// LATER:`.
3. **ih-1** (input actions): narrow primary prompt to `IA_Move` + `IA_Attack`; list the other 6 actions in a follow-up `// LATER:` block with a clear "skip for vertical slice" note.
4. **ih-2** (mapping context): same narrowing for `IMC_Default`.
5. **au-5** + **au-6** (inventory screen, character stats): prepend `[SLICE: skip — requires arpg-inventory]` annotation; prompt body unchanged.
6. **ae-1..ae-8** (enemy AI): refactor each item to add `dependsOn?: string[]` and `features: string[]` fields. `ae-1` stays as `{Health attribute, ASC, death flow}`. `ae-2..ae-8` each declare `dependsOn: ['ae-1']` and a `features` list (`['ai-controller']`, `['behavior-tree']`, `['perception']`, etc.). UI in `EnemyBestiaryPanel` / `EnemyAITreePanel` is not changed by this spec; the metadata is consumed later by sub-project C/D when the operator picks which features to generate.
7. **evaluator GAP-002 fix:** in `src/lib/evaluator/module-eval-prompts.ts` under the `arpg-combat` quality pass, add the check: "Verify `GA_MeleeAttack` keeps a `TSet<AActor*> HitActors` on the ability instance (not on the notify) and clears it at ability activation."
8. **evaluator GAP-003 fix:** in the same file under `arpg-combat` structure pass, add: "On death, the character must apply `State.Dead` via `GE_Death` and block all subsequent ability activations via the tag (not by disabling input)."

**Type changes (TS):** the registry item type needs optional `dependsOn?: string[]` and `features?: string[]` fields. Existing items unaffected (both optional). Add a vitest test that the new fields are correctly typed (`expectTypeOf` from vitest).

**Regression test:** `src/__tests__/registry/slice-prompts.test.ts` loads the registry, finds each modified item by id, asserts the new strings appear (e.g., `expect(getChecklistItem('al-5').prompt).toContain('Lifetime=60s')`).

### Stream C — Infra testIds (blocking only, ~1.5 hrs)

**Modified files (6):**

1. `src/components/layout/SidebarL1.tsx:30` — add `data-testid={\`pof-sidebar-nav-item-${cat.id}\`}` to the button.
2. `src/components/layout/SidebarL2.tsx` — locate the sub-module nav button, add `data-testid={\`pof-sidebar-l2-nav-item-${subModule.id}\`}`.
3. `src/components/cli/TerminalInput.tsx` — `data-testid="pof-cli-panel-input"` on the textarea; `data-testid="pof-cli-panel-send-btn"` on the submit button.
4. `src/components/cli/TerminalOutput.tsx` — `data-testid="pof-cli-panel-output"` on the outermost output container.
5. `src/components/cli/TerminalHeader.tsx` — `data-testid="pof-cli-panel-running-indicator"` on the running-state element.
6. `src/components/layout/CLITabBar.tsx` — `data-testid={\`pof-cli-panel-tab-${tab.id}\`}` on each tab button.

**New file:** `e2e/infra-testids.spec.ts` — navigates the app, asserts each new testId is queryable. `await expect(page.getByTestId('pof-cli-panel-input')).toBeVisible()` style. ~20 lines.

## Cross-cutting

- **Branching:** `master`. Three commits, one per stream, in any order: `feat(packaging): cook execute backend + SSE`, `feat(registry): vertical-slice prompt fixes + enemy-ai per-feature toggles`, `feat(infra): blocking testIds for sidebar + CLI panel`.
- **TDD:** strict for Stream A (cook executor + route both pure logic); test-after for Stream B (regression guard); E2E for Stream C.
- **Validation gate:** `npm run validate` (typecheck + lint + test) passes before each commit.
- **No worktree.** Per project pattern.

## Definition of done

1. All 11 blocking gaps in `docs/features/arpg-vertical-slice/gap-inventory.md` have an inline `(closed in <SHA>)` annotation.
2. `npm run validate` green.
3. `e2e/infra-testids.spec.ts` green (`npm run test:e2e -- infra-testids.spec.ts`).
4. Cook backend covered by unit + route tests; canned-log fixtures committed.
5. Dev-server smoke: opening the app, navigating to packaging, clicking Package on a Win64 Shipping profile triggers a cook (using a real local UE project if available, or against a recorded fixture in tests).
6. `docs/features/arpg-vertical-slice/INDEX.md §2` updated: closed gaps' `(blocked by GAP-NNN)` annotations removed; remaining (non-blocking) gaps still annotated.
7. Single chat summary at end: gaps closed, files touched, time spent, recommended sub-project C scope refinement.

## Risks & mitigations

- **SSE through Next.js App Router route handlers needs explicit `ReadableStream`.** Mitigation: the route handler returns `new Response(readable, { headers: { 'Content-Type': 'text/event-stream', ... } })`; pattern documented in Next.js docs.
- **UE5 cook output format may vary by engine version.** Mitigation: parser is heuristic — unknown phases pass through as `log` events; the UI degrades gracefully (no progress bar, but log still streams). Add a `cook-fail.log` fixture so parser failure modes are tested.
- **Cancel/abort during cook.** Mitigation: route uses `req.signal.addEventListener('abort', () => child.kill('SIGTERM'))`. Unit-tested by aborting the test stream and asserting `child.kill` was called.
- **Dummy-enemy refactor changes a public registry type.** Mitigation: both new fields are optional; existing 27 modules' checklist items unaffected. Type test in vitest catches any accidental breaking change.
- **Sidebar testId interpolation breaks if a registry id contains characters not safe for selectors.** Mitigation: registry ids are already kebab-case throughout (verified during sub-project A); add a lint-style runtime assertion at SidebarL1 mount if paranoid (skipped for YAGNI).

## Hand-off to sub-projects C and D

- **Sub-project C:** scope tightens to the 9 non-blocking testId/UI gaps (GAP-009, 010, 011, 012, 013, 014, 018, 019, 020) plus the per-module testId rows in `testid-coverage.md` that are still missing. Estimated ~half day.
- **Sub-project D:** can begin once C is done. D's operator flow in `INDEX.md §2` now executes unblocked (B closes the 11 blockers; C closes the remaining quality-of-assertion gaps). D's brainstorm picks execution mode (open question 5 from sub-project A — scripted vs. vision-assisted vs. hybrid).

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan: per-stream task list, with full file contents and test code spelled out per the writing-plans no-placeholder rule.
4. Execute B under `subagent-driven-development` — three streams in parallel.
5. Brainstorm sub-project C (smaller scope) once B lands.
