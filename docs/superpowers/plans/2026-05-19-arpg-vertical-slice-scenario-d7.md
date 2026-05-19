# ARPG Vertical-Slice D7 — Add Step 10 ag-1 (GAS) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Step 10 ag-1 to the live spec — proves RoadmapChecklist pattern repeats for arpg-gas (under core-engine) and tests code-modification verification via grep rather than fs.stat.

**Architecture:** Same shape as D4 (insert one step block). Reuses the Cards-switch + hover + Claude-button sequence proven in D3+D5+D6. Verification uses `readFile` + `.includes()` because ag-1 modifies existing code rather than creating new files.

**Tech Stack:** Playwright (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d7-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **ag-1 prompt** at `src/lib/module-registry.ts:187`: *"Add UAbilitySystemComponent to my AARPGCharacterBase class. Implement the IAbilitySystemInterface to return the ASC. Initialize the ASC properly in BeginPlay and PossessedBy. Handle the owner actor and avatar actor setup for both player and AI characters."*

2. **Module navigation**: `core-engine` (L1) → `arpg-gas` (L2). Both testIds added by sub-project C; same pattern as Step 8 ih-1's `game-systems` → `input-handling`.

3. **`ARPGCharacterBase.h` exact path is unknown** — sub-project A's analysis didn't document the subfolder. Plan tries 3 candidates: `Source/PoF/Characters/`, `Source/PoF/Player/`, root `Source/PoF/`. If none match, the findings doc records all attempted paths for D8 to investigate.

4. **Insertion point in `e2e/arpg-vertical-slice-live-d2.spec.ts`:** after the existing Step 9 commandlet-assets `runLiveStep(...)` call's closing `});`, before `} finally {`.

5. **Import update needed:** existing `import { stat } from 'node:fs/promises';` must become `import { stat, readFile } from 'node:fs/promises';`.

6. **`filenameSuffix: 'd6'`** in the `finally` block — bump to `'d7'`.

7. **PoF dev server on port 3010**. Verify alive in pre-flight.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify | Update import + insert Step 10 block (~60 lines) + bump filenameSuffix |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d7.md` | Generated | — |

Total: **1 modified file, 1 generated doc, 2 commits.**

---

## Task 1: Add Step 10 ag-1 block + update import + bump filenameSuffix

**Files:**
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Update the fs/promises import**

Use Edit tool. Replace:
```typescript
import { stat } from 'node:fs/promises';
```
with:
```typescript
import { stat, readFile } from 'node:fs/promises';
```

- [ ] **Step 2: Insert the Step 10 block**

Use Edit tool. Find this exact block (the end of Step 9 + start of `finally`):

```typescript
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'd6' });
    }
```

Replace with:

```typescript
      });

      await runLiveStep(harness, page, 'Step 10 ag-1 (LIVE): Add AbilitySystemComponent to character', async () => {
        // Navigate: Core Engine → arpg-gas.
        await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
        await page.getByTestId('pof-sidebar-l2-nav-item-arpg-gas').click();
        await page.getByRole('tab', { name: 'Roadmap' }).click();
        await page.waitForTimeout(500);

        // RoadmapChecklist pattern (same as Step 8 ih-1):
        // 1. Switch to Cards layout (Compact's Play button is icon-only).
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
            break; // first match wins
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
    } finally {
      await harness.writeFindings({ filenameSuffix: 'd7' });
    }
```

This combined edit handles both the new Step 10 block AND the `filenameSuffix` bump (`'d6'` → `'d7'`).

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Stub-mode parse check**

```bash
npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts
```
Expected: 1 test fails with the `HARNESS_MODE=live` assertion. Correct outcome — proves the spec parses + guard works.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): D7 — add Step 10 ag-1 (GAS) to live spec

Third dispatch step, proving the RoadmapChecklist pattern repeats for
arpg-gas under core-engine (after Step 8 ih-1 under game-systems).
Same Cards-switch + hover + Claude button sequence; no new harness
helpers needed.

Key difference from prior live steps: ag-1 is a code MODIFICATION to
AARPGCharacterBase.h/.cpp rather than a new asset file. Verification
uses readFile + .includes() rather than fs.stat — reads the .h and
greps for UAbilitySystemComponent + IAbilitySystemInterface tokens.

Tries 3 candidate paths for ARPGCharacterBase.h since the exact
subfolder isn't documented (Characters/, Player/, root Source/PoF/).

Adds readFile to the fs/promises import.

filenameSuffix bumped to 'd7'.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d7-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D7 live spec (controller-driven)

Run by the controller via Bash with `run_in_background: true`.

- [ ] **Step 1: Pre-flight**

```bash
git log --oneline -3
```
Expected: D7 commit + D6 commits visible.

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

When notified, tail the background task's output file to see the per-step result line.

---

## Task 3: Sanity-check findings + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d7.md` is the most recent file.

- [ ] **Step 2: Read findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d7.md`. Note Step 10 outcome, which `ARPGCharacterBase.h` path matched (if any), whether `UAbilitySystemComponent` + `IAbilitySystemInterface` tokens were found, captured CLI dispatch count.

- [ ] **Step 3: Enrich with D7-specific analysis**

Use Edit tool. Replace the auto-generated placeholder section with D7-specific analysis answering:

1. **Did Step 10 dispatch?** Compare to Step 8 + Step 9 patterns.
2. **Which path matched** for `ARPGCharacterBase.h` (informs documentation for future similar steps).
3. **Modification verified or not?** If yes — UAbilitySystemComponent + IAbilitySystemInterface tokens present. If file found but token missing — Claude didn't make the expected change; capture what it did do via the output excerpt.
4. **Dispatch count progression**: D4=0, D5=1, D6=2, D7 should be 3.
5. **Pattern-repeat confirmation**: RoadmapChecklist works for arpg-gas (same as input-handling). Implication: Steps 11 acb-1, 12 ae-1, 13 al-5, 14 au-1 should all just work with the same pattern (each needs a ~30-line copy with different testIds + verification).
6. **Recommended D8 (or wrap)**: based on actual outcome.

Write with concrete sentences from the actual run.

- [ ] **Step 4: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d7.md
git commit -m "$(cat <<'EOF'
docs(features): D7 live-run findings — Step 10 ag-1 outcome

[One paragraph summary — Step 10 dispatch result, which path matched,
 whether UAbilitySystemComponent was added, total dispatch count.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d7-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `[One paragraph...]` with the actual outcome before running.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D7 complete. 2 commits:
- <SHA_FIX>       feat(e2e): D7 — add Step 10 ag-1 (GAS) to live spec
- <SHA_FINDINGS>  docs(features): D7 live-run findings — Step 10 ag-1 outcome

Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass/fail]
Step 9 commandlet-assets (LIVE): [pass/fail]
Step 10 ag-1 (LIVE): [pass/fail + which path matched for ARPGCharacterBase.h]
Dispatch count: [N]

Recommended next step:
- If Step 10 passed: 3 modules across 2 patterns proven; wrap or D8 adds Step 11.
- If new failure: D8 first task = [specific finding].
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Import + Step 10 block + filenameSuffix (Section 2 of spec) = T1. Live run (Section 3 of spec) = T2. Findings (Section 3) = T3. DoD reachable.
- [x] **Placeholder scan:** `[One paragraph...]` + per-step pass/fail markers in T3's commit message + chat summary are explicit runtime substitutions. T3 Step 3 says "Write with concrete sentences from the actual run."
- [x] **Type consistency:** new testIds match the convention from sub-project C (`pof-sidebar-nav-item-core-engine`, `pof-sidebar-l2-nav-item-arpg-gas`, `pof-module-arpg-gas-checklist-item-ag-1`). Helper signatures match existing usage (`waitForCliComplete`, `runLiveStep`). `readFile` added to import matches usage.
- [x] **Bite-sized:** T1 is 5 steps (2 edits + typecheck + parse check + commit). T2 is 4 steps. T3 is 5 steps. All single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 2 says "Run with run_in_background: true."
