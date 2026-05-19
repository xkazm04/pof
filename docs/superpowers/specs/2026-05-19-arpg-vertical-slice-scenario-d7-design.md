---
date: 2026-05-19
status: draft
sub_project: D (scenario execution)
sub_phase: D7 (add Step 10 ag-1 — 3rd live step)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d6-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d6.md
---

# Sub-project D7: ARPG vertical-slice — add Step 10 ag-1 (GAS) to live spec

## Context

D6 confirmed the harness works for two distinct module UI patterns:
- **RoadmapChecklist** (input-handling): Cards-switch + hover + Claude button.
- **AnimationChecklist** (animations): tab + expand-toggle + generate button.

D7 expands by one more dispatch step: **Step 10 ag-1 — add `UAbilitySystemComponent` to the character base class**. The `arpg-gas` module uses RoadmapChecklist, so this validates that the input-handling pattern repeats for *another* RoadmapChecklist-based module under a different sidebar category (core-engine vs. game-systems).

Crucial difference from prior live steps: **ag-1 is a code MODIFICATION** to existing `AARPGCharacterBase.h/.cpp` rather than a new asset file. The harness needs to verify by reading the file and grepping for `UAbilitySystemComponent` rather than just `fs.stat`.

## Goals

1. Add a Step 10 ag-1 block to `e2e/arpg-vertical-slice-live-d2.spec.ts`, inserted between the existing Step 9 commandlet-assets block and the `finally` block.
2. Add `readFile` to the existing `fs/promises` import.
3. Verify the artifact by reading the character base .h file and checking for `UAbilitySystemComponent` + `IAbilitySystemInterface` tokens.
4. Re-run live; expect dispatch count to go from 2 (D6) to 3 (D7).
5. Capture findings at `2026-05-19-live-d7.md`.

## Non-goals

- **No other new live steps.** Step 11+ deferred to D8.
- **No fix for Finding A** (Step 6 build verify).
- **No source-side edits**, no new helpers.
- **No verification of `.cpp` modification** — checking the `.h` for the member declaration is sufficient evidence the modification happened.

## Decision record (from brainstorming)

1. **D7 scope:** add Step 10 ag-1 only (recommended next step from D6 findings).
2. **Pattern:** RoadmapChecklist (same as Step 8 ih-1) — Cards-switch + hover + Claude button.
3. **Verification strategy:** read the file + grep for `UAbilitySystemComponent`. Try multiple candidate paths for `ARPGCharacterBase.h` since the exact subfolder isn't documented.
4. **Module navigation:** `core-engine` → `arpg-gas`.

## Critical implementation facts (verified during brainstorming)

1. **ag-1 prompt** at `src/lib/module-registry.ts:187`: *"Add UAbilitySystemComponent to my AARPGCharacterBase class. Implement the IAbilitySystemInterface to return the ASC. Initialize the ASC properly in BeginPlay and PossessedBy. Handle the owner actor and avatar actor setup for both player and AI characters."*
2. **Artifact location**: `AARPGCharacterBase` is defined under `Source/PoF/...` — exact subfolder unknown. Try `Characters/`, `Player/`, and root `Source/PoF/`.
3. **Module sidebar IDs**: `core-engine` (L1) and `arpg-gas` (L2) — both verified during sub-project C testId work.
4. **RoadmapChecklist pattern confirmed working** in D3 + D5 for input-handling; ag-1 reuses it identically.

## In-scope deliverables

### Files modified
- `e2e/arpg-vertical-slice-live-d2.spec.ts` — new Step 10 ag-1 block; add `readFile` to fs/promises import; bump filenameSuffix.

### Files generated
- `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d7.md`.

Total: **1 modified, 1 generated doc, 2 commits.**

## The Step 10 ag-1 block

Inserted after the existing Step 9 `runLiveStep(...)` call and before the `finally` block:

```typescript
await runLiveStep(harness, page, 'Step 10 ag-1 (LIVE): Add AbilitySystemComponent to character', async () => {
  // Navigate: Core Engine → arpg-gas.
  await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
  await page.getByTestId('pof-sidebar-l2-nav-item-arpg-gas').click();
  await page.getByRole('tab', { name: 'Roadmap' }).click();
  await page.waitForTimeout(500);

  // RoadmapChecklist pattern (same as Step 8 ih-1):
  // 1. Switch to Cards layout (Compact's Play button is icon-only, no accessible name).
  await page.getByRole('button', { name: 'Card view' }).click();
  await page.waitForTimeout(300);

  const ag1 = page.getByTestId('pof-module-arpg-gas-checklist-item-ag-1');
  const ag1Count = await ag1.count();
  if (ag1Count === 0) {
    return { success: false, durationMs: 0, timedOut: false, notes: 'pof-module-arpg-gas-checklist-item-ag-1 not visible after layout switch' };
  }

  // 2. Hover the row to reveal hover-only action buttons.
  await ag1.hover();

  // 3. Click the "Claude" button via accessible name.
  const claudeBtn = ag1.getByRole('button', { name: /^Claude$/i });
  const btnCount = await claudeBtn.count();
  if (btnCount === 0) {
    return { success: false, durationMs: 0, timedOut: false, notes: 'No "Claude" button inside ag-1 row (Cards layout); hover may not have triggered' };
  }
  await claudeBtn.click();
  const result = await waitForCliComplete(page, 'arpg-gas-ag-1', STEP_TIMEOUT_MS);

  // ag-1 is a code MODIFICATION to AARPGCharacterBase (not a new file).
  // Verify by reading the .h file and checking for UAbilitySystemComponent.
  // Try multiple plausible paths since AARPGCharacterBase's subfolder isn't documented.
  const candidatePaths = [
    join(PROJECT_PATH, 'Source', 'PoF', 'Characters', 'ARPGCharacterBase.h'),
    join(PROJECT_PATH, 'Source', 'PoF', 'Player', 'ARPGCharacterBase.h'),
    join(PROJECT_PATH, 'Source', 'PoF', 'ARPGCharacterBase.h'),
  ];

  let artifactCheck = '';
  let modificationFound = false;
  for (const p of candidatePaths) {
    try {
      const content = await readFile(p, 'utf-8');
      const hasASC = content.includes('UAbilitySystemComponent');
      const hasInterface = content.includes('IAbilitySystemInterface');
      artifactCheck += `Found ${p} — UAbilitySystemComponent:${hasASC} IAbilitySystemInterface:${hasInterface}\n`;
      if (hasASC) modificationFound = true;
      break; // first match wins; don't keep checking once we find the file
    } catch {
      artifactCheck += `Not at: ${p}\n`;
    }
  }
  if (!modificationFound) {
    artifactCheck += '(File not found OR file exists but UAbilitySystemComponent not added; check output excerpt.)';
  }

  return {
    success: result.success && modificationFound,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    notes: (result.outputExcerpt ?? '') + '\nArtifact check:\n' + artifactCheck,
  };
});
```

Also update the existing import line:
```typescript
// Before:
import { stat } from 'node:fs/promises';
// After:
import { stat, readFile } from 'node:fs/promises';
```

Plus bump `filenameSuffix: 'd6'` → `'d7'` in the `finally` block.

## Cross-cutting

- **Branching:** `master`. 2 commits.
- **Validation gate:** `npx tsc --noEmit` after the spec edit.
- **No worktree.**
- **Controller-driven live re-run.** Port 3010.
- **PoF source untouched.**
- **UE5 project WILL be modified** if Step 10 dispatches successfully — `ARPGCharacterBase.h` and `.cpp` get edited (UAbilitySystemComponent member added, IAbilitySystemInterface implementation, BeginPlay/PossessedBy lifecycle). Project is not a git repo; rollback is manual.

## Definition of done

1. Spec edit committed; typecheck clean.
2. Live re-run produced `2026-05-19-live-d7.md`.
3. Findings doc explicitly states:
   - Step 10 ag-1 outcome (pass with modification found, OR fail with specific reason).
   - Which candidate path matched (informs documentation for similar future steps).
   - Whether `UAbilitySystemComponent` + `IAbilitySystemInterface` both appear in the file.
4. Dispatch count ≥ 3 (Step 8 + Step 9 + Step 10).
5. 2 commits visible.
6. Chat summary.

**Success criterion:** Step 10 dispatches AND completes (RoadmapChecklist pattern repeats for arpg-gas). Even if the artifact-grep finds the file but not the token, that's an informative finding — D8 would investigate why Claude didn't make the expected modification.

## Risks & mitigations

- **`ARPGCharacterBase.h` is at a path none of the 3 candidates cover.** Mitigation: notes record "File not found" with all attempted paths; D8 first task is to find the actual location (likely a quick `find Source/PoF -name "ARPGCharacterBase.h"`).
- **Existing code already has `UAbilitySystemComponent`** (e.g., from prior manual work or earlier sub-project A's setup). Claude's adaptive verify-and-skip will succeed quickly; the artifact-grep will succeed too. This is fine — same idempotent behavior we saw for ih-1 (D5) and commandlet-assets (D6).
- **Run takes longer than 10-min cap.** ag-1 touches multiple files (header + cpp + possibly Build.cs for AbilitySystem module dependency). 10-min cap should still be plenty for a modification of this size. Overall test cap is 30 min.
- **Claude needs to add a new module dependency to PoF.Build.cs** (`GameplayAbilities`, `GameplayTags`, `GameplayTasks`). This is part of the implementation; harness doesn't need to verify it explicitly — if the modification doesn't compile, Claude would have surfaced the error during the live session.

## Hand-off to D8 (or wrap)

If D7 succeeds (Step 10 dispatches + completes + modification found):

- **D8 brainstorm** picks: add Step 11 acb-1 (arpg-combat melee ability — depends on GAS), OR fix Finding A (Step 6 build verify), OR wrap.
- **Wrap is even more strongly defensible** — 3 modules across 2 patterns is enough proof that the harness scales.

If D7 fails:

- **D8 picks up the specific failure mode** as its first task.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → minimal plan (3 tasks: edit + commit, live re-run, findings commit).
4. Execute D7 inline.
5. Brainstorm D8 (or wrap) once D7's findings doc is in hand.
