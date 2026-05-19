# ARPG Vertical-Slice D3 — Fix Per-Row Claude Button Locator Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle per-row button locator in Step 8 ih-1 with a Cards-layout-aware locator (`getByRole('button', { name: 'Claude' })`), re-run the live spec, capture findings.

**Architecture:** One file edit + two commits. No new files, no new helpers. The change exercises an existing harness path (`waitForCliComplete`) end-to-end for the first time.

**Tech Stack:** Playwright (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d3-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **Current code** at `e2e/arpg-vertical-slice-live-d2.spec.ts:74-85` uses `ih1.locator('button').filter({ hasText: /Run|Claude|Play/i }).first()`. This misses the "Claude" `AccentButton` because the button is hover-hidden (`opacity-30 → group-hover:opacity-100` per `RoadmapChecklist.tsx:613`).

2. **Cards-layout toggle button** at `RoadmapChecklist.tsx:331-337` has `title="Card view"`. Playwright resolves `title` as the accessible name when no text content is present, so `getByRole('button', { name: 'Card view' })` works.

3. **"Claude" button text** is literal — `AccentButton` children at `RoadmapChecklist.tsx:656`: `<AccentButton ...>Claude</AccentButton>`.

4. **`writeFindings` accepts `{ filenameSuffix: string }`** — added in D2 commit e21be15.

5. **Port 3000 is occupied** by an unrelated dev server (vibeman). Use `PLAYWRIGHT_PORT=3010` for the live run; this is supported by D2's commit 0eb87cd to `playwright.config.ts`.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | 74-85 (button locator block), 114 (filenameSuffix) |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md` | Generated | — |

Total: **1 modified, 1 generated doc, 2 commits.**

---

## Task 1: Replace per-row Claude button locator + update filename suffix

**Files:**
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Replace lines 74-85 (button locator block)**

Use Edit tool. Replace this exact block:

```typescript
        const ih1 = page.getByTestId('pof-module-input-handling-checklist-item-ih-1');
        const ih1Count = await ih1.count();
        if (ih1Count === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'pof-module-input-handling-checklist-item-ih-1 not visible' };
        }

        const playBtn = ih1.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
        const btnCount = await playBtn.count();
        if (btnCount === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'No Run/Claude/Play button inside ih-1 row' };
        }
        await playBtn.click();
```

…with this exact block:

```typescript
        // D3: switch to Cards layout — per-row "Claude" button only renders there
        // and has an accessible name. Compact layout (default) uses an icon-only
        // Play button with no text/aria-label that's hard to locate uniquely.
        // Cards toggle has title="Card view" per RoadmapChecklist.tsx:331-337.
        await page.getByRole('button', { name: 'Card view' }).click();
        await page.waitForTimeout(300);

        const ih1 = page.getByTestId('pof-module-input-handling-checklist-item-ih-1');
        const ih1Count = await ih1.count();
        if (ih1Count === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'pof-module-input-handling-checklist-item-ih-1 not visible after layout switch' };
        }

        // Hover the row to reveal hover-only action buttons.
        // Cards: opacity-30 → group-hover:opacity-100 at RoadmapChecklist.tsx:613.
        await ih1.hover();

        // Locate by accessible name (AccentButton text "Claude" at RoadmapChecklist.tsx:656).
        const claudeBtn = ih1.getByRole('button', { name: /^Claude$/i });
        const btnCount = await claudeBtn.count();
        if (btnCount === 0) {
          return { success: false, durationMs: 0, timedOut: false, notes: 'No "Claude" button inside ih-1 row (Cards layout); hover may not have triggered the visibility change' };
        }
        await claudeBtn.click();
```

- [ ] **Step 2: Update filenameSuffix from 'd2' to 'd3'**

Use Edit tool. Replace:

```typescript
      await harness.writeFindings({ filenameSuffix: 'd2' });
```

with:

```typescript
      await harness.writeFindings({ filenameSuffix: 'd3' });
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Stub-mode parse check**

Run:
```bash
npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts
```
Expected: 1 test **fails** with the `HARNESS_MODE=live` assertion. This is the CORRECT outcome — proves the spec parses and the guard still works.

- [ ] **Step 5: Commit Phase 1**

```bash
git add e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): D3 — fix per-row Claude button locator (Strategy 1)

D2 finding B: the harness's button locator missed the per-row "Claude"
AccentButton because:
1. Compact layout (default) uses an icon-only Play button with no text.
2. Cards layout's "Claude" button is hover-hidden (opacity-30 → group-hover).

Fix: switch to Cards layout via getByRole('button', { name: 'Card view' }),
hover the row to reveal the action buttons, then click via
getByRole('button', { name: /^Claude$/i }).

filenameSuffix bumped from 'd2' to 'd3' so D2's findings doc stays as a
historical record.

Step 6 block unchanged — Finding A (BuildVerifyPanel not rendered) is
explicitly out of D3 scope.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d3-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D3 live spec

This task is run by the controller (me) via the Bash tool with `run_in_background: true`. Subagents cannot supervise long-running live processes against the UE5 project.

- [ ] **Step 1: Pre-flight checks**

Run:
```bash
git log --oneline -3
```
Expected: the new D3 commit + the D2 commits visible.

```bash
netstat -ano | grep ":3000 \|:3010 "
```
Confirm port 3000 is occupied (by vibeman or whatever) and port 3010 is free. Live run uses 3010 via `PLAYWRIGHT_PORT`.

- [ ] **Step 2: Fire the live spec in background**

```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list
```

Run with `run_in_background: true` and `timeout: 1800000` (30 min).

- [ ] **Step 3: Wait for completion notification**

Continue with other work while the run executes. The notification arrives automatically when the test completes (or times out at 30 min).

- [ ] **Step 4: Read the final output**

When notified, read the tail of the background task's output file to see the test result (pass/fail + per-step status if Playwright printed it).

---

## Task 3: Sanity-check findings doc + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

Run (PowerShell):
```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d3.md` is the most recent file.

- [ ] **Step 2: Read the findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md` to see per-step outcomes.

- [ ] **Step 3: Enrich the findings doc with D3-specific analysis**

The auto-generated doc covers per-step status + captured dispatches + the standard D2-prereqs checklist. Append additional analysis sections after "## Findings for sub-project D3 (iteration)" replacing the placeholder paragraph. Use Edit tool. The new content should answer:

1. **Did the locator fix unblock the dispatch path?** (Compare to D2 finding "No Run/Claude/Play button inside ih-1 row".)
2. **If Step 8 ih-1 fired:** did Claude Code complete? How long did it take? Did the expected UE5 artifacts (`IA_Move.uasset`, `IA_Attack.uasset`) appear?
3. **If dispatch fired but timed out:** what was captured in the output excerpt?
4. **Step 6:** confirmed still failing for Finding A reason (no change expected, but record it).
5. **What this means for sub-project D4 (or wrap):**
   - If success: vertical-slice harness is **proven end-to-end** for at least one dispatch type. Remaining scenario steps are pattern-extensions.
   - If new failure mode: capture the new finding for D4's first task.

Write the appended content with concrete sentences derived from what the run actually surfaced — do NOT use placeholder text.

- [ ] **Step 4: Commit the enriched findings doc**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d3.md
git commit -m "$(cat <<'EOF'
docs(features): D3 live-run findings — Strategy 1 locator outcome

[Real one-paragraph summary of the actual outcome — pass/fail per step,
 whether dispatch fired, whether UE5 artifacts created.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d3-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute the `[Real one-paragraph summary...]` block with the actual outcome at commit time.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D3 complete. 2 commits:
- <SHA_FIX>       feat(e2e): D3 — fix per-row Claude button locator (Strategy 1)
- <SHA_FINDINGS>  docs(features): D3 live-run findings — Strategy 1 locator outcome

Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass/fail + reason]
Dispatch fired: [yes/no]
UE5 artifacts: [created/missing]

Recommended next step:
- If D3 closed the dispatch path: vertical-slice initiative wraps OR brainstorm D4 to expand live scope.
- If new blocker surfaced: D4 first task = address [specific finding].
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Spec edit (Section 2 of spec) = T1. Live run (Section 4 of spec) = T2. Findings + commit (Section 4 of spec) = T3. DoD criteria all reachable.
- [x] **Placeholder scan:** the `[Real one-paragraph summary...]` and per-step pass/fail markers in T3's commit message + T3's chat summary template are explicit runtime substitutions, not plan placeholders. T3 step 3 explicitly says "do NOT use placeholder text."
- [x] **Type consistency:** filenameSuffix value 'd3' matches the findings filename `2026-05-19-live-d3.md` throughout. The locator `getByRole('button', { name: /^Claude$/i })` uses the exact accessible name documented in the spec.
- [x] **Bite-sized:** T1 is 5 steps (2 edits + typecheck + parse check + commit). T2 is 4 steps (pre-flight + fire + wait + read). T3 is 5 steps (verify + read + enrich + commit + summary). All steps single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 2 says "Run with run_in_background: true."
- [x] **Scope discipline:** plan doesn't touch Finding A or expand to a 3rd live step. Spec's non-goals respected.
