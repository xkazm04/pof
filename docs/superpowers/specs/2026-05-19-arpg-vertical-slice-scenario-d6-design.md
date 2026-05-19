---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D6 (fix Step 9 animation step id + artifact paths)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d5-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d5.md
---

# Sub-project D6: ARPG vertical-slice — fix Step 9 animation step id + artifact paths

## Context

D5 confirmed harness idempotency: Step 8 ih-1 re-passes cleanly. D4 + D5 both showed Step 9 aa-1 failing with `pof-module-arpg-animation-generate-aa-1 not visible — Setup Guide tab may not have mounted or step ordering differs`. D5's findings doc confirmed this is **independent of the regression cascade**.

Investigation in D6 brainstorming revealed the actual root cause: **the step IDs in `AnimationChecklist.tsx` are NOT `aa-1`..`aa-8`** (those are the *module-registry* IDs from `src/lib/module-registry.ts:144-185`). The component uses its own `ANIMATION_STEPS` array (`AnimationChecklist.tsx:30+`) with descriptive IDs like `step-commandlet-assets`, `step-mixamo`, `step-animbp`, etc.

So the harness's `pof-module-arpg-animation-generate-aa-1` testId literally doesn't exist in the DOM. The actual selector for the first step is `pof-module-arpg-animation-generate-step-commandlet-assets`.

This is a real **registry-vs-component mismatch** finding. Sub-project A's analysis tracked module-registry IDs; AnimationChecklist authored its own parallel data structure. The two are conceptually related but not identical.

D6 corrects the step ID + artifact paths and re-runs.

## Goals

1. Replace `aa-1` with `step-commandlet-assets` in the Step 9 block of `e2e/arpg-vertical-slice-live-d2.spec.ts`.
2. Update the artifact-check paths to match the actual commandlet output location (`Content/Characters/Player/Animations/`, NOT `Content/Animations/`).
3. Rename the step label to reflect the broader scope (the commandlet creates **8 assets** in one run: BS1D_Locomotion + AM_MeleeCombo + 4 dodge montages + AM_HitReact + AM_Death).
4. Bump filenameSuffix to `'d6'`.
5. Re-run live; Step 9 should now dispatch.
6. Document the registry-vs-component mismatch as a generalizable finding for similar modules.

## Non-goals

- **No fix for other registry-vs-component mismatches** — only animation in scope. If a similar mismatch shows up later (e.g., in arpg-combat's own custom UIs), D7+ addresses it.
- **No new live steps beyond Step 9.** Step 10+ still deferred.
- **Finding A (Step 6 build verify) still not fixed.**
- **No source-side changes** — all work in `e2e/`.

## Decision record (from brainstorming)

1. **D6 scope:** Fix Step 9 aa-1 only (recommended option A from "Step 9 fix vs 3rd live step vs both").
2. **Step ID:** `step-commandlet-assets` (verified by reading `AnimationChecklist.tsx:30-46`).
3. **Artifact paths:** `Content/Characters/Player/Animations/BS1D_Locomotion.uasset` + `Content/Characters/Player/Animations/Montages/AM_MeleeCombo.uasset` (per the prompt at `AnimationChecklist.tsx:40` — `"/Game/Characters/Player/Animations/"` translates to `Content/Characters/Player/Animations/` on disk).
4. **Step label:** Renamed to reflect the actual 8-asset scope, not just BS1D.

## In-scope deliverables

### Files modified
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — Step 9 block: 3 string changes (step ID in testId + waitForCliComplete label; artifact paths; step label).

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d6.md`.

Total: **1 modified file, 1 generated doc, 2 commits.**

## The spec change

Replace the existing Step 9 block (now `'Step 9 aa-1 (LIVE): Locomotion blend space (BS1D)'`) with:

```typescript
await runLiveStep(harness, page, 'Step 9 commandlet-assets (LIVE): all 8 animation assets', async () => {
  // Navigate: Content → animations (registry id, not arpg-animation).
  await page.getByTestId('pof-sidebar-nav-item-content').click();
  await page.getByTestId('pof-sidebar-l2-nav-item-animations').click();

  // AnimationChecklist lives on the Setup Guide tab.
  await page.getByRole('tab', { name: 'Setup Guide' }).click();
  await page.waitForTimeout(500);

  // D6: the actual step ID is `step-commandlet-assets`, NOT `aa-1`. The
  // module-registry uses aa-1..aa-8 but AnimationChecklist.tsx has its own
  // ANIMATION_STEPS array with descriptive IDs. Verified at
  // src/components/modules/content/animations/AnimationChecklist.tsx:30+.
  const generateBtn = page.getByTestId('pof-module-arpg-animation-generate-step-commandlet-assets');
  const btnCount = await generateBtn.count();
  if (btnCount === 0) {
    return {
      success: false,
      durationMs: 0,
      timedOut: false,
      notes: 'pof-module-arpg-animation-generate-step-commandlet-assets not visible — Setup Guide tab may not have mounted or step has been renamed',
    };
  }
  await generateBtn.click();
  const result = await waitForCliComplete(page, 'arpg-animation-commandlet-assets', STEP_TIMEOUT_MS);

  // D6: the commandlet creates 8 assets at Content/Characters/Player/Animations/
  // (per prompt at AnimationChecklist.tsx:40 — "/Game/Characters/Player/Animations/").
  // Spot-check the two most slice-relevant outputs.
  const candidatePaths = [
    join(PROJECT_PATH, 'Content', 'Characters', 'Player', 'Animations', 'BS1D_Locomotion.uasset'),
    join(PROJECT_PATH, 'Content', 'Characters', 'Player', 'Animations', 'Montages', 'AM_MeleeCombo.uasset'),
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
    artifactCheck += '(Claude may have used a different filename or directory; check output excerpt for actual paths.)';
  }

  return {
    success: result.success && assetFound,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    notes: (result.outputExcerpt ?? '') + '\nArtifact check:\n' + artifactCheck,
  };
});
```

Plus bump `filenameSuffix: 'd5'` → `filenameSuffix: 'd6'` in the `finally` block.

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the edit.
- **No worktree.**
- **Controller-driven live re-run.** Port 3010 (PoF dev server still alive from prior runs).
- **PoF source untouched.**
- **UE5 project WILL be modified** if Step 9 dispatches successfully — the commandlet creates 8 new .uasset files plus likely a new `AnimAssetCommandlet.{h,cpp}` under `Source/PoFEditor/`. Project not a git repo; rollback is manual.

## Definition of done

1. Spec edit committed; typecheck clean.
2. Live re-run produced `2026-05-19-live-d6.md`.
3. Findings doc explicitly states:
   - Step 9's outcome (pass with new step ID, or fail with a NEW failure reason — must NOT be the same "Setup Guide tab" reason as D4/D5, since we've fixed that).
   - Asset verification result for `BS1D_Locomotion.uasset` + `AM_MeleeCombo.uasset`.
   - The registry-vs-component mismatch finding (sub-project A used registry IDs; AnimationChecklist has its own).
4. 2 commits visible.
5. Chat summary.

**Success criterion:** Step 9 either dispatches and creates the expected assets (animation module unblocked), OR fails with a specific new reason that informs D7.

## Risks & mitigations

- **`step-commandlet-assets` ID has changed** in the current code (it's a string literal in `ANIMATION_STEPS[0].id`). Mitigation: verified by direct read of `AnimationChecklist.tsx:32`. If the implementer encounters a different ID at write time, adapt.
- **Commandlet path differs from prompt's claim.** The prompt says `/Game/Characters/Player/Animations/`. Claude might choose a different path if existing code suggests otherwise. Mitigation: the `assetFound = false` branch records "check output excerpt for actual paths" so the next iteration can adapt.
- **Commandlet build fails** (e.g., new dependency issue surfaces). Mitigation: captured output excerpt names the symptom; D7 reads + fixes.
- **Run takes longer than the 10-min cap.** The commandlet creates 8 assets — more work than ih-1 (which created 2). 10 min should still be plenty, but the 30-min overall test cap is the backstop.
- **Existing animation assets in the project conflict.** Unlikely — the UE5 project at the documented path doesn't currently have a `Content/Characters/Player/Animations/` subtree (verified during sub-project A). If files exist, Claude's adaptive prompting will likely verify-and-skip (same pattern as D5's ih-1 re-run).

## Hand-off to D7 (or wrap)

If D6 succeeds:

- **D7 brainstorm** picks: add Step 10 ag-1 (GAS) — proves pattern repeats for RoadmapChecklist-based modules outside input-handling. OR fix Finding A. OR wrap.

If D6 fails with a new reason:

- **D7 picks up the new finding** as its first task.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live re-run, findings commit).
4. Execute D6 inline.
5. Brainstorm D7 (or wrap) once D6's findings doc is in hand.
