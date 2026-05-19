# ARPG Vertical-Slice D4 — Add Step 9 aa-1 to Live Spec Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a Step 9 aa-1 block into the live spec to validate the harness pattern repeats for a second module (animation), and run it live.

**Architecture:** One file edit + two commits. Uses AnimationChecklist's direct per-step testIds (`pof-module-arpg-animation-generate-aa-1`) — simpler than D3's Cards-switch + hover pattern because AnimationChecklist has its own UI primitives.

**Tech Stack:** Playwright (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d4-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **Insertion point in `e2e/arpg-vertical-slice-live-d2.spec.ts`:** line 124 ends the existing Step 8 ih-1 block (`      });`). Line 125 begins `    } finally {`. New Step 9 block goes between them.

2. **AnimationChecklist exposes a direct per-step testId** at `pof-module-arpg-animation-generate-{stepId}` (added by sub-project C Stream B' commit bbca96c). Step 9 can click this directly — no Cards-layout switch or hover required.

3. **Animation sub-module sidebar id is `animations`** (registry id), not `arpg-animation` (testId prefix). Sidebar nav uses the registry id; on-page testIds use the `arpg-animation` prefix.

4. **AnimationChecklist lives on the "Setup Guide" extra tab** inside the animations module (verified during sub-project C work).

5. **aa-1's deliverable per sub-project A analysis:** `BS1D_Locomotion` blend space generated via commandlet. Likely paths: `Content/Animations/BS1D_Locomotion.uasset` or `Content/Animations/BlendSpaces/BS1D_Locomotion.uasset`.

6. **`filenameSuffix` is at line 126** of the current spec file; bump from `'d3'` to `'d4'`.

7. **PoF dev server on port 3010** (vibeman on 3000). `HARNESS_MODE=live PLAYWRIGHT_PORT=3010` for the live run, per D2 commit 0eb87cd.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | Insert new Step 9 block before line 125; change `'d3'` → `'d4'` on line 126 |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d4.md` | Generated | — |

Total: **1 modified, 1 generated doc, 2 commits.**

---

## Task 1: Insert Step 9 aa-1 block + bump filenameSuffix

**Files:**
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Insert the Step 9 block before the `} finally {`**

Use Edit tool. Find this exact block (lines 124-127 in the current file):

```typescript
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'd3' });
    }
```

Replace with:

```typescript
      });

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
    } finally {
      await harness.writeFindings({ filenameSuffix: 'd4' });
    }
```

This combined edit handles both the new Step 9 block and the `filenameSuffix` bump (`'d3'` → `'d4'`).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Stub-mode parse check**

```bash
npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts
```
Expected: 1 test fails with the `HARNESS_MODE=live` assertion. Correct outcome — proves the spec parses and the guard works.

- [ ] **Step 4: Commit**

```bash
git add e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): D4 — add Step 9 aa-1 (locomotion blend space) to live spec

Expands the live spec by one step to validate the harness pattern repeats
across module boundaries. Step 9 uses AnimationChecklist's direct per-step
testId (pof-module-arpg-animation-generate-aa-1, added by sub-project C
Stream B' commit bbca96c) — no Cards-layout switch or hover needed, unlike
the RoadmapChecklist-based Step 8 ih-1.

This documents a real pattern variance for D5+: each new live step must
be authored according to its module's actual UI primitives, not assume
RoadmapChecklist's Strategy 1.

Artifact check tries two plausible paths since aa-1's prompt is less
prescriptive than ih-1's:
- Content/Animations/BS1D_Locomotion.uasset
- Content/Animations/BlendSpaces/BS1D_Locomotion.uasset

filenameSuffix bumped to 'd4' so D3's findings doc stays as a historical
record at 2026-05-19-live-d3.md.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d4-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D4 live spec (controller-driven)

Run by the controller via Bash with `run_in_background: true`. Subagents do not supervise live UE5 modifications.

- [ ] **Step 1: Pre-flight checks**

```bash
git log --oneline -3
```
Expected: D4 commit + D3 commits visible.

```bash
netstat -ano | grep -E ":3000 |:3010 "
```
Confirm port 3010 has PoF dev server (likely PID 50132 from D3 still alive).

- [ ] **Step 2: Confirm PoF dev server still responds on 3010**

```bash
curl -s -I http://localhost:3010 | head -3
```
Expected: HTTP/1.1 200 OK with `X-Powered-By: Next.js`. If dead, start a fresh one via `PORT=3010 npm run dev &` in another background task; otherwise Playwright would block on `reuseExistingServer: true`.

- [ ] **Step 3: Fire the live spec in background**

```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list
```

Run with `run_in_background: true` and `timeout: 1800000` (30 min cap).

- [ ] **Step 4: Wait for completion notification**

Continue with other work; the notification arrives automatically when the test completes (or times out at 30 min).

- [ ] **Step 5: Read final output**

When notified, tail the background task's output file. Expect a summary like `1 passed (Xs)` or `1 failed (Xs)` depending on test-level outcome.

---

## Task 3: Sanity-check findings doc + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d4.md` is the most recent file.

- [ ] **Step 2: Read the findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d4.md`. Note the per-step status, captured dispatches count, and Step 9 aa-1 notes (especially whether the testId was found and whether `BS1D_Locomotion.uasset` was created).

- [ ] **Step 3: Enrich with D4-specific analysis**

Use Edit tool. Replace the `_See above per-step notes for D3 input._` placeholder (or `_Empty in stub run; D2 will populate after first live run._` — depends on harness-mode.ts's default) with a real D4-specific findings section answering:

1. **Did Step 9 aa-1 dispatch?** (testId found vs. not found, then dispatch fired vs. not)
2. **If dispatched: did Claude Code complete?** Duration, captured output highlights.
3. **Artifact verification:** which candidate path matched? Did Claude create files elsewhere (visible in output excerpt)?
4. **Pattern-variance confirmation:** for AnimationChecklist, did the direct testId approach work without Cards-switch + hover?
5. **Net dispatch count:** D3 was 1; D4 should be 2 (Step 8 ih-1 + Step 9 aa-1). If different, why?
6. **What this means for D5 (or wrap):**
   - If success: harness pattern proven for 2 different module UI types; pattern-based extension to remaining modules is mechanical.
   - If new failure: capture the specific finding for D5's first task.

Write with concrete sentences derived from what the run actually surfaced.

- [ ] **Step 4: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d4.md
git commit -m "$(cat <<'EOF'
docs(features): D4 live-run findings — Step 9 aa-1 outcome

[One paragraph summary of actual outcome — pass/fail per step, dispatch
 counts, asset verification result.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d4-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `[One paragraph...]` with the actual outcome before running the commit.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D4 complete. 2 commits:
- <SHA_FIX>       feat(e2e): D4 — add Step 9 aa-1 (locomotion blend space) to live spec
- <SHA_FINDINGS>  docs(features): D4 live-run findings — Step 9 aa-1 outcome

Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass/fail + reason]
Step 9 aa-1 (LIVE): [pass/fail + reason]
Dispatch count: [D3=1 → D4=?]
UE5 artifacts created: [list]

Recommended next step:
- If D4 closed both dispatches successfully: D5 expands to a third step (e.g., Step 10 ag-1) OR initiative wraps.
- If Step 9 surfaced a new finding: D5 first task = address [specific finding].
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Spec edit (Section 2 of spec) = T1. Live run (Section 4 of spec) = T2. Findings + commit (Section 4 of spec) = T3. DoD all reachable.
- [x] **Placeholder scan:** the `[One paragraph summary...]` and per-step pass/fail markers in T3's commit message + T3's chat summary are explicit runtime substitutions. T3 step 3 says "Write with concrete sentences derived from what the run actually surfaced" — no template language survives to the artifact.
- [x] **Type consistency:** `filenameSuffix` value `'d4'` matches findings filename `2026-05-19-live-d4.md` throughout. The new Step 9 block uses the same `runLiveStep`/`harness`/`waitForCliComplete`/`STEP_TIMEOUT_MS`/`PROJECT_PATH`/`join`/`stat` names already in scope from the existing spec.
- [x] **Bite-sized:** T1 is 4 steps (1 edit + typecheck + parse check + commit). T2 is 5 steps. T3 is 5 steps. All single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 3 says "Run with run_in_background: true."
- [x] **Scope discipline:** plan doesn't touch Finding A, doesn't extract a helper, doesn't add other live steps.
