---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D3 (iteration on D2 findings)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d2-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d2.md
---

# Sub-project D3: ARPG vertical-slice — fix per-row Claude button locator

## Context

D2's live run completed in 6 seconds with both steps fast-failing **before any Claude Code dispatch fired**. The harness wiring (waitForCliComplete, page.route mocks, navigation, /pof/status mock, packaging seed) all worked. The actual blockers were upstream:

- **Finding A**: `pof-setup-wizard-build-verify-btn` doesn't render on the default project-setup screen (`BuildVerifyPanel` requires state the harness doesn't seed).
- **Finding B**: No `Run|Claude|Play`-text button found inside checklist item rows. The "Claude" `AccentButton` in Cards layout is hover-only; Compact layout default uses an icon-only Play button.
- **Finding C** (synthesized): D1's `/pof/status` theory was wrong; the actual blockers are A + B.

D3 closes Finding B only — the minimal change that unblocks any real dispatch test. Finding A and scope expansion are explicitly deferred.

## Goals

1. Fix the per-row "Claude" button locator in `e2e/arpg-vertical-slice-live-d2.spec.ts`'s Step 8 ih-1 block: switch to Cards layout → hover row → click by accessible name.
2. Re-run the live spec.
3. Capture findings at `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md` regardless of pass/fail.
4. Document whether the locator fix actually unblocked the dispatch path (success criterion: `waitForCliComplete` either reports "running indicator appeared then disappeared" or a specific timeout/abort reason — either outcome closes D3).

## Non-goals

- **Finding A is NOT fixed.** Step 6 stays expected-failure in D3.
- **No expansion to a 3rd live step.** D3 attempts only the two D2 steps.
- **No full 24-step live run.**
- **No source-file edits.** Spec change only.
- **No new harness helpers.** Existing `waitForCliComplete` is sufficient.

## Decision record (from brainstorming)

1. **D3 scope:** "Fix Finding B only + re-run; bail after one successful dispatch" (per the recommended scope decision).
2. **Locator strategy:** Strategy 1 — switch to Cards layout, hover row, click by accessible name `getByRole('button', { name: 'Claude' })`. Rejected alternatives: Strategy 2 (Compact icon-only button, brittle) and Strategy 3 (Space-key shortcut; can be future fallback if hover proves unreliable).
3. **Findings filename:** `2026-05-19-live-d3.md` (preserves D2's findings as historical record).
4. **Success criterion:** Step 8 ih-1's notes contain *evidence about the dispatch path* — either it fired and `waitForCliComplete` exercised, or a specific failure reason. Either outcome is a successful D3.

## In-scope deliverables

### Files modified
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — Step 8 ih-1 body rewritten + `writeFindings` suffix changed to `'d3'`.

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md` — D3 live-run findings.

Total: **1 modified file, 1 generated doc, 2 commits.**

## The spec change

Inside `e2e/arpg-vertical-slice-live-d2.spec.ts`, inside the `runLiveStep(..., 'Step 8 ih-1 (LIVE): Input Actions', async () => { ... })` body, replace the current button-locating block with:

```typescript
// D3: switch to Cards layout (per-row Claude button only exists there + has accessible name).
// Toggle button has title="Card view" per RoadmapChecklist.tsx:331-337.
await page.getByRole('button', { name: 'Card view' }).click();
await page.waitForTimeout(300); // allow layout switch to render

const ih1 = page.getByTestId('pof-module-input-handling-checklist-item-ih-1');
const ih1Count = await ih1.count();
if (ih1Count === 0) {
  return { success: false, durationMs: 0, timedOut: false, notes: 'pof-module-input-handling-checklist-item-ih-1 not visible after layout switch' };
}

// Hover the row to reveal hover-only action buttons.
// Cards layout: opacity-30 → group-hover:opacity-100 at RoadmapChecklist.tsx:613.
await ih1.hover();

// Locate the Claude button by accessible name (AccentButton at RoadmapChecklist.tsx:649).
const claudeBtn = ih1.getByRole('button', { name: /^Claude$/i });
const btnCount = await claudeBtn.count();
if (btnCount === 0) {
  return { success: false, durationMs: 0, timedOut: false, notes: 'No "Claude" button inside ih-1 row (Cards layout); hover may not have triggered the visibility change' };
}
await claudeBtn.click();
const result = await waitForCliComplete(page, 'input-handling-ih-1', STEP_TIMEOUT_MS);
```

The artifact-verification block that follows (`expectedPaths`, `fs.stat`, `artifactCheck`) stays unchanged.

The Step 6 block stays untouched — Finding A still blocks it, expected ❌ fail with the same "button not visible" note as D2.

### `writeFindings` filename suffix

In the `finally` block:

```typescript
// Before:
await harness.writeFindings({ filenameSuffix: 'd2' });
// After:
await harness.writeFindings({ filenameSuffix: 'd3' });
```

## Execution

### Commit 1 — spec change

After the edit, run:
1. `npx tsc --noEmit` — clean.
2. `npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts` (stub mode; should still fail on `HARNESS_MODE=live` assertion — proves the spec parses and the guard works).
3. `git add e2e/arpg-vertical-slice-live-d2.spec.ts`.
4. Commit with message: `feat(e2e): D3 — fix per-row Claude button locator (Strategy 1)`.

### Commit 2 — live run + findings

After commit 1:
1. Run live spec via Bash background: `HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list`. Timeout cap: 1800000ms (30 min).
2. Read `2026-05-19-live-d3.md` once the run completes.
3. Enrich with D3-specific analysis sections:
   - Did the locator fix unblock the dispatch path?
   - If Step 8 ih-1 fired: did Claude Code actually create the expected UE5 assets?
   - If dispatch fired but timed out: what was the last visible terminal output?
   - If dispatch failed: what was the new failure mode (different from D2's "button not found")?
4. `git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md`.
5. Commit with a message summarizing the actual outcome.

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the spec edit; `npm run validate` not required (no source change).
- **No worktree.**
- **Controller-driven live run** (same shape as D2's T6). PoF dev server on port 3010 to avoid vibeman conflict on 3000.
- **PoF source untouched.** All work in `e2e/`.
- **Real UE5 project at `C:\Users\kazda\Documents\Unreal Projects\PoF` WILL be modified** if Step 8 ih-1 dispatches successfully — Claude Code will create `IA_Move.uasset` + `IA_Attack.uasset` (or similar). Project is not a git repo; rollback is manual.

## Definition of done

1. Spec edit committed; typecheck clean.
2. One live-mode run executed; `2026-05-19-live-d3.md` exists.
3. Findings doc shows per-step outcomes for Step 6 + Step 8 ih-1, with explicit notes about whether the dispatch fired and (if applicable) whether UE5 artifacts were created.
4. Step 8 ih-1's notes contain **evidence about the dispatch path** — either "running indicator appeared then disappeared" (success) OR a specific timeout/abort reason (informative failure). Either outcome closes D3.
5. `git log --oneline` shows 2 new commits.
6. Chat summary: SHAs, per-step outcome, whether dispatch fired, whether UE5 assets created, recommended D4 (or "done" if vertical-slice work wraps here).

## Risks & mitigations

- **Hover doesn't trigger the visibility change in headless Playwright.** Mitigation: spec falls through to "No 'Claude' button" failure note with diagnostic; D4 could add the Space-key Strategy 3 fallback.
- **Cards layout toggle button has different `title`.** Mitigation: verified at write time by reading RoadmapChecklist.tsx:331-337 — it's literally `title="Card view"`.
- **Layout switch persists across renders** and breaks Compact-layout assumptions in OTHER spec runs. Mitigation: each Playwright test gets a fresh browser context; the layout state in `useState` doesn't persist between runs.
- **Real Claude Code dispatch fires successfully and runs for the full 10-min timeout.** This is the *desired* outcome of D3 — the harness was built for this. The whole test is capped at 30 min via `test.setTimeout`. If it takes too long the controller can Ctrl+C; partial findings persist via the `try/finally` in the spec.
- **ih-1 prompt produces unexpected output** (Claude creates files in different paths, or doesn't create the expected files). Mitigation: `fs.stat` check captures missing-paths in the notes; D4 would investigate prompt clarity if assets are missing.
- **Stubbed cook in stub-mode runs persists "seed" packaging profiles into the real DB.** Acknowledged side-effect; benign (just leaves dead profiles in `~/.pof/pof.db`).

## Hand-off to D4 (or wrap)

If D3 succeeds (Step 8 ih-1 dispatches, runs, completes — success or failure):

- **D4 brainstorm** picks: expand to 3rd live step, fix Finding A (Step 6 build verify), or wrap the vertical-slice initiative as "first dispatch path proven; remaining scenario steps are mechanical extensions of the same pattern."

If D3 fails in a new way (hover doesn't reveal button, layout switch doesn't work, dispatch fires but never completes):

- **D4 picks up the new finding** as its first task — same iterative pattern as A→B→C→D1→D2→D3.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live run, findings commit).
4. Execute D3 — likely inline by controller (small enough to not justify subagent overhead for the spec edit; live run is controller-driven anyway).
5. Brainstorm D4 (or wrap) once D3's findings doc is in hand.
