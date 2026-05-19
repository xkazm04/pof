---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D4 (expand live scope by one step)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d3-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md
---

# Sub-project D4: ARPG vertical-slice — add Step 9 aa-1 to live spec

## Context

D3 proved the harness works end-to-end: Step 8 ih-1 ran live in ~3 minutes, a real Claude Code session built an `InputAssetCommandlet` and produced both `IA_Move.uasset` + `IA_Attack.uasset`. The Strategy 1 locator fix (Card-view switch + hover + `getByRole`) unblocked the dispatch path.

D4 expands the live spec by one step — **Step 9 aa-1 (locomotion blend space generation)** — to validate the pattern repeats across module boundaries. Adding only one step keeps the increment small and informative.

## Goals

1. Add a Step 9 aa-1 block to `e2e/arpg-vertical-slice-live-d2.spec.ts`, inserted between the existing Step 8 ih-1 block and the `finally` block.
2. Re-run the live spec. Step 9 should fire a real Claude Code dispatch (new dispatch count = 2; was 1 in D3).
3. Capture findings at `2026-05-19-live-d4.md` regardless of outcome.
4. Document whether the per-module-UI pattern variance (AnimationChecklist has direct testIds vs. RoadmapChecklist needs Cards-switch + hover) matters in practice.

## Non-goals

- **Step 6 Finding A is not fixed.** Stays expected-failure.
- **No helper extraction.** Per "Literal copy-paste, no helper yet" decision — wait until N≥3 module-step patterns before DRY-ifying.
- **No new live steps beyond Step 9.** Step 10+ remain deferred to D5+.
- **No PoF source edits.** Spec change only.
- **No new harness helpers.** Existing `waitForCliComplete` is sufficient.

## Decision record (from brainstorming)

1. **D4 scope:** "Add Step 9 aa-1 only — prove pattern repeats" (recommended option).
2. **Code shape:** Literal copy-paste — no helper extraction yet (recommended option; YAGNI at N=2).
3. **Filename:** `2026-05-19-live-d4.md` (preserves D3's findings).
4. **Artifact-check tolerance:** try two plausible paths for `BS1D_Locomotion.uasset` — `Content/Animations/` and `Content/Animations/BlendSpaces/` — since aa-1's prompt is less prescriptive than ih-1's about target directory.

## Critical finding discovered during planning

**AnimationChecklist uses a different UI pattern than RoadmapChecklist.** Sub-project C Stream B' (commit bbca96c) added direct testIds to per-step buttons in `AnimationChecklist.tsx`: `pof-module-arpg-animation-generate-{stepId}`, `pof-module-arpg-animation-toggle-{stepId}`, etc. So Step 9 aa-1 can click the generate button directly via testId without the Cards-layout switch + hover that Step 8 ih-1 needed.

**This is itself a D4 finding:** the harness pattern is module-dependent. Modules using `RoadmapChecklist` (most slice modules) need Strategy 1. Modules with custom UIs (animation, possibly others) have their own dispatch primitives.

Implication for D5+: each new live step needs to be authored according to its module's actual UI, not the assumption that everything uses RoadmapChecklist.

## In-scope deliverables

### Files modified
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — new Step 9 aa-1 block; `filenameSuffix: 'd4'`.

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d4.md` — D4 live-run findings.

Total: **1 modified file, 1 generated doc, 2 commits.**

## The Step 9 aa-1 block

Inserted after the existing Step 8 ih-1 `runLiveStep(...)` call and before the `finally` block:

```typescript
await runLiveStep(harness, page, 'Step 9 aa-1 (LIVE): Locomotion blend space (BS1D)', async () => {
  // Navigate: Content → animations (registry id, not arpg-animation).
  await page.getByTestId('pof-sidebar-nav-item-content').click();
  await page.getByTestId('pof-sidebar-l2-nav-item-animations').click();

  // AnimationChecklist lives on the Setup Guide tab.
  await page.getByRole('tab', { name: 'Setup Guide' }).click();
  await page.waitForTimeout(500);

  // Direct testId on per-step "Execute Process" button (sub-project C bbca96c).
  // No Cards-layout switch / hover needed — AnimationChecklist exposes per-button testIds.
  const generateBtn = page.getByTestId('pof-module-arpg-animation-generate-aa-1');
  const btnCount = await generateBtn.count();
  if (btnCount === 0) {
    return {
      success: false,
      durationMs: 0,
      timedOut: false,
      notes: 'pof-module-arpg-animation-generate-aa-1 not visible — Setup Guide tab may not have mounted or step ordering differs',
    };
  }
  await generateBtn.click();
  const result = await waitForCliComplete(page, 'arpg-animation-aa-1', STEP_TIMEOUT_MS);

  // aa-1 deliverable per sub-project A analysis: BS1D_Locomotion blend space.
  // Try multiple plausible paths since aa-1's prompt is less prescriptive than ih-1's.
  const candidatePaths = [
    join(PROJECT_PATH, 'Content', 'Animations', 'BS1D_Locomotion.uasset'),
    join(PROJECT_PATH, 'Content', 'Animations', 'BlendSpaces', 'BS1D_Locomotion.uasset'),
  ];

  let artifactCheck = '';
  let assetFound = false;
  for (const p of candidatePaths) {
    try {
      await stat(p);
      artifactCheck += `Found: ${p}\n`;
      assetFound = true;
    } catch {
      artifactCheck += `Not at: ${p}\n`;
    }
  }
  if (!assetFound) {
    artifactCheck += '(Claude may have used a different filename or directory; check output excerpt for the actual path.)';
  }

  return {
    success: result.success && assetFound,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    notes: (result.outputExcerpt ?? '') + '\nArtifact check:\n' + artifactCheck,
  };
});
```

## `filenameSuffix` bump

Inside the `finally` block at the end of the test:

```typescript
// Before:
await harness.writeFindings({ filenameSuffix: 'd3' });
// After:
await harness.writeFindings({ filenameSuffix: 'd4' });
```

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the spec edit; `npm run validate` not required (no source change).
- **No worktree.**
- **Controller-driven live run.** PoF dev server on port 3010 to avoid vibeman conflict on 3000.
- **PoF source untouched.** All work in `e2e/`.
- **UE5 project WILL be modified** if Step 9 aa-1 dispatches successfully. New asset (likely `BS1D_Locomotion.uasset`) + possibly a new commandlet under `Source/PoFEditor/`. Project is not a git repo; rollback is manual.

## Definition of done

1. Spec edit committed; typecheck clean.
2. One live-mode run executed; `2026-05-19-live-d4.md` exists.
3. Findings show Step 9 aa-1 outcome:
   - Whether `pof-module-arpg-animation-generate-aa-1` testId was found.
   - If dispatch fired: what Claude actually did + whether `BS1D_Locomotion.uasset` (or alternative) was created.
4. `git log --oneline` shows 2 new commits.
5. Chat summary: outcomes for all 3 live steps (Step 6, Step 8 ih-1, Step 9 aa-1), captured dispatch count, recommended D5 or wrap.

**Success criterion:** Step 9's notes contain evidence about the dispatch path (success OR specific failure reason). Either outcome closes D4.

## Risks & mitigations

- **"Setup Guide" tab name differs from expected.** Mitigation: the run will fast-fail with `pof-module-arpg-animation-generate-aa-1 not visible` and the notes will name the symptom. Cheap to adapt in a D4 follow-up.
- **AnimationChecklist step ordering differs from `aa-1` registry id.** Same fast-fail mode; same fix.
- **Claude doesn't produce a `BS1D_Locomotion.uasset` exactly at either candidate path.** Mitigation: the `assetFound = false` branch records the symptom in notes; D5 can investigate the actual filename/path Claude chose.
- **aa-1 prompt produces a different deliverable than expected** (e.g., generates source files but not the .uasset). Mitigation: this surfaces as `success: false, assetFound: false`; D5 either tightens the prompt or expands the artifact-path search.
- **Run takes longer than ih-1.** ih-1 took ~3 min. aa-1's commandlet may be more complex (reflection over BlendParameters). 10-min per-step cap protects. Whole test capped at 30 min via `test.setTimeout`.
- **AnimationChecklist's testIds rely on the "Setup Guide" tab being mounted.** If the tab name has changed in the codebase since sub-project C, the navigation fails. Mitigation: fast-fail with diagnostic.

## Hand-off to D5 (or wrap)

If D4 succeeds (Step 9 aa-1 dispatches + completes + artifact found):

- **D5 brainstorm** picks the next live step. Natural candidates: Step 10 ag-1 (GAS), Step 11 acb-1 (combat), Step 12 ae-1 (enemy-ai). Each unlocks more downstream slice steps. Per-step time budgets will keep growing.
- **Alternative:** wrap the initiative as "harness is proven for two different module patterns; the rest is iterative extension at the user's pace."

If D4 fails:

- **D5 picks up the new finding.** Whichever failure mode surfaced (testId not found, dispatch timeout, asset not created) becomes the first task.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live run, findings commit).
4. Execute D4 inline (same pattern as D3 — too small for subagent overhead).
5. Brainstorm D5 (or wrap) once D4's findings doc is in hand.
