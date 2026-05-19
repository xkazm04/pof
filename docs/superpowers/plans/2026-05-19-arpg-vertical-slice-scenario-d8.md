# ARPG Vertical-Slice D8 — Fix Dispatch Race Flake Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the double-click pattern (Strategy C) at 3 dispatch points in the live spec so the running-indicator race no longer flakes.

**Architecture:** Spec-level change: after each dispatch button click, sleep 1s + conditionally re-click if the button is still enabled. The button's existing `disabled` state (keyed on `isRunning` or `isGenerating`) makes the second click a safe no-op when the first succeeded.

**Tech Stack:** Playwright (existing).

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d8-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **3 dispatch click sites** in `e2e/arpg-vertical-slice-live-d2.spec.ts`:
   - Line 103: `await claudeBtn.click();` (Step 8 ih-1)
   - Line 167: `await generateBtn.click();` (Step 9 commandlet-assets)
   - Line 228: `await claudeBtn.click();` (Step 10 ag-1)

2. **`filenameSuffix`** is currently `'d7'`; bump to `'d8'`.

3. **PoF dev server** still on port 3010.

4. **Disabled-state semantics**:
   - Step 8 + Step 10 `claudeBtn` (RoadmapChecklist `AccentButton`): `disabled={isRunning}` per `RoadmapChecklist.tsx:651`.
   - Step 9 `generateBtn` (AnimationChecklist): `disabled={isGenerating}` per `AnimationChecklist.tsx:518`.
   - Both prevent the second click from triggering a duplicate dispatch when the first one succeeded.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | 3 click sites get +3 lines each (sleep + conditional re-click) + filenameSuffix bump |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d8.md` | Generated | — |

Total: **1 modified, 1 generated doc, 2 commits.**

---

## Task 1: Apply double-click pattern to 3 dispatch sites + bump filenameSuffix

**Files:**
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Apply pattern at Step 8 ih-1 (line 103 area)**

Use Edit tool. Replace:
```typescript
        await claudeBtn.click();
        const result = await waitForCliComplete(page, 'input-handling-ih-1', STEP_TIMEOUT_MS);
```
with:
```typescript
        await claudeBtn.click();
        // D8: re-click if first dispatch was lost in the 100ms mountDelay window.
        // Button is disabled if first dispatch succeeded → second click is a safe no-op.
        await page.waitForTimeout(1000);
        if (await claudeBtn.isEnabled().catch(() => false)) {
          await claudeBtn.click();
        }
        const result = await waitForCliComplete(page, 'input-handling-ih-1', STEP_TIMEOUT_MS);
```

- [ ] **Step 2: Apply pattern at Step 9 commandlet-assets (line 167 area)**

Use Edit tool. Replace:
```typescript
        await generateBtn.click();
        const result = await waitForCliComplete(page, 'arpg-animation-commandlet-assets', STEP_TIMEOUT_MS);
```
with:
```typescript
        await generateBtn.click();
        // D8: re-click if first dispatch was lost in the 100ms mountDelay window.
        // Button is disabled (isGenerating) if first dispatch succeeded → second click is a safe no-op.
        await page.waitForTimeout(1000);
        if (await generateBtn.isEnabled().catch(() => false)) {
          await generateBtn.click();
        }
        const result = await waitForCliComplete(page, 'arpg-animation-commandlet-assets', STEP_TIMEOUT_MS);
```

- [ ] **Step 3: Apply pattern at Step 10 ag-1 (line 228 area)**

Use Edit tool. Replace:
```typescript
        await claudeBtn.click();
        const result = await waitForCliComplete(page, 'arpg-gas-ag-1', STEP_TIMEOUT_MS);
```
with:
```typescript
        await claudeBtn.click();
        // D8: re-click if first dispatch was lost in the 100ms mountDelay window.
        // Button is disabled if first dispatch succeeded → second click is a safe no-op.
        await page.waitForTimeout(1000);
        if (await claudeBtn.isEnabled().catch(() => false)) {
          await claudeBtn.click();
        }
        const result = await waitForCliComplete(page, 'arpg-gas-ag-1', STEP_TIMEOUT_MS);
```

Note: Step 8 and Step 10 use the same `await claudeBtn.click();` text but in different scopes (separate `runLiveStep` blocks). The Edit tool with non-unique `old_string` will fail. Use the differing `waitForCliComplete` label (`input-handling-ih-1` vs. `arpg-gas-ag-1`) to make each Edit unique — the snippets shown above include the `waitForCliComplete` line which differs across the three sites.

- [ ] **Step 4: Bump filenameSuffix**

Use Edit tool. Replace:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd7' });
```
with:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd8' });
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Stub-mode parse check**

```bash
npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts
```
Expected: 1 test fails with the `HARNESS_MODE=live` assertion. Correct outcome.

- [ ] **Step 7: Commit**

```bash
git add e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
fix(e2e): D8 — double-click guard against dispatch race

D7 + D7.5 surfaced a timing race in useModuleCLI.sendPrompt: the 100ms
mountDelay window before dispatching pof-cli-prompt is sometimes shorter
than CompactTerminal's mount time. When that happens, the event fires
to a window without a terminal-side listener; harness records the
dispatch but the CLI session never starts.

Strategy C — spec-level fix at 3 dispatch sites (Step 8 ih-1, Step 9
commandlet-assets, Step 10 ag-1):

  await btn.click();
  await page.waitForTimeout(1000); // CompactTerminal mount window
  if (await btn.isEnabled().catch(() => false)) {
    await btn.click();  // re-fire dispatch only if first was lost
  }

The button's existing disabled state (RoadmapChecklist: isRunning;
AnimationChecklist: isGenerating) makes the second click a safe no-op
when the first one succeeded. If the first was lost, the second hits
a now-mounted terminal.

No helper-level change (Strategy B reserved for D9 if this proves
insufficient).

filenameSuffix bumped to 'd8'.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d8-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D8 live spec (controller-driven)

- [ ] **Step 1: Pre-flight**

```bash
git log --oneline -3
```
Expected: D8 commit + D7 commits visible.

```bash
netstat -ano | grep -E ":3010 " | head -2
curl -s -I http://localhost:3010 | head -2
```
Expected: PoF dev server alive on 3010 responding 200 OK.

- [ ] **Step 2: Fire the live spec in background**

```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list
```

Run with `run_in_background: true` and `timeout: 1800000` (30 min cap).

- [ ] **Step 3: Wait for completion notification**

Continue other work; notification arrives automatically.

- [ ] **Step 4: Read final output**

When notified, tail the background task's output to see per-step result.

---

## Task 3: Sanity-check findings + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d8.md` is the most recent file.

- [ ] **Step 2: Read findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d8.md`. Note Step 10 outcome — should be both `pass` AND artifact-verified for the first time.

- [ ] **Step 3: Enrich with D8-specific analysis**

Use Edit tool. Replace the auto-generated placeholder with D8-specific analysis answering:

1. **Did the double-click pattern fix the flake?** Step 10 outcome compared to D7/D7.5.
2. **Total dispatch count**: should still be 3 (the second click is dropped when not needed). If 4+, document — implies the double-click is firing duplicate Claude sessions.
3. **Steps 8 + 9 unaffected?** Verify-and-skip pattern should still work; both should pass quickly.
4. **Initiative-level note**: harness is now production-stable for the 3 currently-wired dispatch steps. Remaining 11 are mechanical pattern-extensions.
5. **Recommended D9 (or wrap)**.

Write with concrete sentences from the actual run.

- [ ] **Step 4: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d8.md
git commit -m "$(cat <<'EOF'
docs(features): D8 live-run findings — double-click flake-fix outcome

[One paragraph summary — did the double-click pattern stabilize Step 10?
 Total dispatch count, whether Steps 8/9 still pass cleanly.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d8-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `[One paragraph...]` with actual outcome.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D8 complete. 2 commits:
- <SHA_FIX>       fix(e2e): D8 — double-click guard against dispatch race
- <SHA_FINDINGS>  docs(features): D8 live-run findings — double-click flake-fix outcome

Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass + reason]
Step 9 commandlet-assets (LIVE): [pass + reason]
Step 10 ag-1 (LIVE): [pass/fail; key indicator vs D7]
Dispatch count: [N]

Recommended next step:
- If Step 10 finally lined up: harness is production-stable; wrap or D9 adds Step 11+.
- If flake persists: D9 promotes to Strategy B (helper-level retry).
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Pattern at 3 sites (Section 2 of spec) = T1 Steps 1-3. filenameSuffix bump = T1 Step 4. Live re-run (Section 3 of spec) = T2. Findings (Section 3) = T3. DoD reachable.
- [x] **Placeholder scan:** `[One paragraph...]` + per-step markers in T3's commit message + chat summary are explicit runtime substitutions. T3 Step 3 says "Write with concrete sentences from the actual run."
- [x] **Type consistency:** the double-click pattern is identical across all 3 sites except for the variable name (`claudeBtn` for Steps 8 + 10, `generateBtn` for Step 9). `waitForCliComplete` labels match existing distinct values per step. `filenameSuffix: 'd8'` matches findings filename.
- [x] **Bite-sized:** T1 is 7 steps (3 edits + filename bump + typecheck + parse check + commit). T2 is 4 steps. T3 is 5 steps. All single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 2 says "Run with run_in_background: true."
- [x] **Edit-tool uniqueness handled.** T1 Steps 1 + 3 both touch `await claudeBtn.click();` lines but use different `waitForCliComplete` labels in the old_string + new_string so the Edits are unique.
