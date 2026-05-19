# ARPG Vertical-Slice D6 — Fix Step 9 Animation Step ID + Paths Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incorrect `aa-1` step ID + wrong artifact paths in the Step 9 block with the actual `step-commandlet-assets` ID + correct `Content/Characters/Player/Animations/` paths; re-run the spec to confirm Step 9 dispatches.

**Architecture:** One edit to the existing live spec (replace the entire Step 9 block) + filenameSuffix bump. No helper changes. Investigation of root cause (registry-vs-component mismatch) already done during brainstorming.

**Tech Stack:** Playwright (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d6-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **Actual step ID** in `src/components/modules/content/animations/AnimationChecklist.tsx:32`: `id: 'step-commandlet-assets'`. NOT `aa-1`. The module-registry's `aa-1`..`aa-8` IDs are a parallel data structure for a different purpose; they don't appear in the rendered DOM.

2. **Actual artifact location**: `Content/Characters/Player/Animations/` per the prompt at `AnimationChecklist.tsx:40` (`"/Game/Characters/Player/Animations/"` translates to `Content/Characters/Player/Animations/` on disk). The commandlet creates 8 assets in one run (BS1D_Locomotion + AM_MeleeCombo + 4 dodge montages + AM_HitReact + AM_Death).

3. **Tab name is "Setup Guide"** — confirmed correct (`AnimationsView.tsx:93`). No change.

4. **Insertion point**: the existing Step 9 block in `e2e/arpg-vertical-slice-live-d2.spec.ts` starts with `await runLiveStep(harness, page, 'Step 9 aa-1 (LIVE): Locomotion blend space (BS1D)', async () => {` and ends with `});` immediately before `} finally {`.

5. **filenameSuffix line** is currently `'d5'`; bump to `'d6'`.

6. **PoF dev server still on port 3010** for the live run.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | Replace Step 9 block (~50 lines) + change `'d5'` → `'d6'` |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d6.md` | Generated | — |

Total: **1 modified file, 1 generated doc, 2 commits.**

---

## Task 1: Replace Step 9 block + bump filenameSuffix + commit

**Files:**
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Replace the existing Step 9 block**

Use Edit tool. Find this exact block (the existing Step 9 from D4/D5):

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

Replace it with:

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

- [ ] **Step 2: Bump filenameSuffix**

Use Edit tool. Replace:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd5' });
```
with:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd6' });
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Stub-mode parse check**

```bash
npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts
```
Expected: 1 test fails with the `HARNESS_MODE=live` assertion. Correct outcome — proves the spec parses and the guard works.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): D6 — correct Step 9 step id + artifact paths

D5 confirmed the harness is idempotent but Step 9 still failed identically.
Root cause: AnimationChecklist.tsx:30+ has its own ANIMATION_STEPS array
with descriptive IDs (step-commandlet-assets, step-mixamo, etc.), NOT
the registry's aa-1..aa-8. Sub-project A's analysis tracked registry IDs;
the spec inherited that assumption.

Three fixes in the Step 9 block:
- testId selector: aa-1 → step-commandlet-assets
- waitForCliComplete label: arpg-animation-aa-1 → arpg-animation-commandlet-assets
- artifact paths: Content/Animations/ → Content/Characters/Player/Animations/
  (per the prompt at AnimationChecklist.tsx:40)

Step label renamed to reflect the broader scope: the commandlet creates
all 8 animation assets in one run (BS1D_Locomotion + AM_MeleeCombo + 4
dodge montages + HitReact + Death), not just BS1D.

filenameSuffix bumped to 'd6'.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d6-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D6 live spec (controller-driven)

Run by the controller via Bash with `run_in_background: true`.

- [ ] **Step 1: Pre-flight**

```bash
git log --oneline -3
```
Expected: D6 commit + D5 commits visible.

```bash
netstat -ano | grep -E ":3010 " | head -2
curl -s -I http://localhost:3010 | head -2
```
Expected: PoF dev server alive on 3010 (PID 50132 from prior runs) responding 200 OK.

- [ ] **Step 2: Fire the live spec in background**

```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list
```

Run with `run_in_background: true` and `timeout: 1800000` (30 min cap).

- [ ] **Step 3: Wait for completion notification**

Continue other work; the notification arrives automatically when the test completes.

- [ ] **Step 4: Read final output**

When notified, tail the background task's output file to see the per-step result line.

---

## Task 3: Sanity-check findings + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d6.md` is the most recent file.

- [ ] **Step 2: Read findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d6.md`. Capture:
- Step 9's outcome (pass/fail + duration)
- Whether the `step-commandlet-assets` testId was found
- If dispatch fired: did Claude actually run the commandlet + create the assets?
- Asset-check result for `BS1D_Locomotion.uasset` + `AM_MeleeCombo.uasset`
- Captured CLI dispatch count (should be ≥1 if step 9 dispatched; ≥2 if both step 8 and step 9 dispatched)

- [ ] **Step 3: Enrich findings doc**

Use Edit tool. Replace the auto-generated placeholder section with D6-specific analysis answering:

1. **Did the step-ID fix work?** Compare to D4/D5 "Setup Guide tab may not have mounted" failure note.
2. **If Step 9 dispatched:** time + Claude's actions + asset verification result.
3. **If still failing:** new failure reason; what to investigate in D7.
4. **Registry-vs-component mismatch finding restated:** sub-project A's analysis tracked module-registry IDs; AnimationChecklist has its own. Similar mismatches likely exist in other custom-UI modules — check before extending to new modules in D7+.
5. **Total dispatch count:** should be 1 (Step 8) + 1 (Step 9) = 2.
6. **Initiative-level note:** two distinct module patterns now proven end-to-end (RoadmapChecklist for input-handling + AnimationChecklist for animations). Remaining ~12 dispatch steps fall into one of these two patterns OR introduce a new custom UI (which would need its own per-module investigation).
7. **Recommended D7 (or wrap):** based on actual outcome.

Write with concrete sentences from the actual run; don't use template language.

- [ ] **Step 4: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d6.md
git commit -m "$(cat <<'EOF'
docs(features): D6 live-run findings — step-id fix outcome

[One paragraph summary — Step 9 outcome, dispatch count, asset
 verification, whether AnimationChecklist's commandlet ran cleanly.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d6-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `[One paragraph...]` with the actual outcome before running.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D6 complete. 2 commits:
- <SHA_FIX>       feat(e2e): D6 — correct Step 9 step id + artifact paths
- <SHA_FINDINGS>  docs(features): D6 live-run findings — step-id fix outcome

Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass/fail + reason]
Step 9 commandlet-assets (LIVE): [pass/fail + reason; was Step 9 aa-1 in prior runs]
Dispatch count: [N]
Assets created: [list]

Recommended next step:
- If Step 9 closed cleanly: D7 adds 3rd live step (e.g., ag-1) OR wrap.
- If new failure: D7 investigates [specific failure mode].
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Step 9 fix (Section 2 of spec) = T1 Step 1. filenameSuffix bump = T1 Step 2. Live run (Section 3 of spec) = T2. Findings (Section 3) = T3. DoD reachable.
- [x] **Placeholder scan:** the `[One paragraph...]` + per-step pass/fail markers in T3's commit message + chat summary are explicit runtime substitutions. T3 Step 3 says "Write with concrete sentences from the actual run."
- [x] **Type consistency:** new step-ID string `step-commandlet-assets` matches AnimationChecklist's actual data (verified at AnimationChecklist.tsx:32 during brainstorming). Artifact paths match the prompt's claim at AnimationChecklist.tsx:40. `filenameSuffix: 'd6'` matches findings filename `2026-05-19-live-d6.md`.
- [x] **Bite-sized:** T1 is 5 steps. T2 is 4 steps. T3 is 5 steps. All single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 2 says "Run with run_in_background: true."
