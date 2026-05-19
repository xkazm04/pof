# ARPG Vertical-Slice D5 — Idempotency Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `test.beforeEach` fixture that resets server-side checklist progress before each live run, then re-run the spec to confirm Step 8 ih-1 passes again.

**Architecture:** One new exported helper in `harness-mode.ts` + a `beforeEach` call in the live spec. Both leverage the existing `POST /api/project-progress` route (no new PoF source needed).

**Tech Stack:** Playwright (existing).

**Spec:** `docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d5-design.md`

---

## Critical implementation facts (verified before plan writing)

1. **`POST /api/project-progress` body shape** at `src/app/api/project-progress/route.ts:60-66`:
   - **Required:** `projectPath` (returns 400 if missing).
   - **Optional, default `{}`:** `checklistProgress`, `moduleHealth`, `checklistVerification`, `moduleHistory`.
   - Behaviour: upserts a row keyed by `sha256(projectPath.toLowerCase()).slice(0,16)`. Posting empty objects effectively resets.
2. **Project path** to reset: `C:\Users\kazda\Documents\Unreal Projects\PoF` (matches `PROJECT_PATH` constant already in the live spec).
3. **Helper location:** `e2e/helpers/harness-mode.ts` (alongside `seedPackagingProfile`).
4. **Spec changes:** import line, new `test.beforeEach`, `filenameSuffix: 'd4'` → `'d5'`.
5. **PoF dev server on port 3010** for the live run (vibeman on 3000); verify alive in pre-flight.

---

## File structure

| File | Action | Lines touched |
|------|--------|---------------|
| `e2e/helpers/harness-mode.ts` | Modify — add `resetProgressForTestProject` export | Append at module level |
| `e2e/arpg-vertical-slice-live-d2.spec.ts` | Modify — import, `test.beforeEach`, filenameSuffix bump | ~5 lines added, 1 changed |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d5.md` | Generated | — |

Total: **2 modified, 1 generated doc, 2 commits.**

---

## Task 1: Add `resetProgressForTestProject` + wire into spec

**Files:**
- Modify: `e2e/helpers/harness-mode.ts`
- Modify: `e2e/arpg-vertical-slice-live-d2.spec.ts`

- [ ] **Step 1: Append `resetProgressForTestProject` to `harness-mode.ts`**

Use Edit tool. Append the following at the end of the file (after any existing module-level exports, before any trailing newline-only EOF):

```typescript
const TEST_PROJECT_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';

/**
 * Reset all module progress (checklist progress, module health, verification,
 * history) for the PoF UE5 project at the documented path. POSTs an empty
 * progress blob to /api/project-progress — the route accepts the full snapshot
 * and overwrites the existing row keyed by sha256(projectPath).slice(0,16)
 * (per src/app/api/project-progress/route.ts).
 *
 * Call from a beforeEach so each test starts with a clean checklist DB
 * regardless of prior runs. Without this, completing a checklist item in
 * one run hides its "Run Claude" button in the next run because
 * RoadmapChecklist.tsx:648 only renders the AccentButton when !checked.
 * This was D4's regression cause.
 */
export async function resetProgressForTestProject(page: Page): Promise<void> {
  const res = await page.request.post('/api/project-progress', {
    data: {
      projectPath: TEST_PROJECT_PATH,
      checklistProgress: {},
      moduleHealth: {},
      checklistVerification: {},
      moduleHistory: {},
    },
  });
  if (!res.ok()) {
    throw new Error(
      `resetProgressForTestProject: POST /api/project-progress returned ${res.status()} — ${await res.text()}`,
    );
  }
}
```

If `TEST_PROJECT_PATH` (or an equivalently-named constant) already exists at module level in `harness-mode.ts`, reuse it rather than declaring a duplicate.

- [ ] **Step 2: Update the import in the live spec**

Use Edit tool on `e2e/arpg-vertical-slice-live-d2.spec.ts`. Find the existing import line:

```typescript
import { setupHarnessMode, waitForCliComplete, seedPackagingProfile, type HarnessHandle, type StepResult } from './helpers/harness-mode';
```

Replace with:

```typescript
import { setupHarnessMode, waitForCliComplete, seedPackagingProfile, resetProgressForTestProject, type HarnessHandle, type StepResult } from './helpers/harness-mode';
```

If the import line is shaped differently in the actual file (the spec implementer may have already adjusted it across D2-D4), find the line containing `from './helpers/harness-mode'` and add `resetProgressForTestProject` to the named-imports list.

- [ ] **Step 3: Add `test.beforeEach` to the live spec**

Use Edit tool. Find the `test.describe('ARPG vertical slice — D2 live attempt', () => {` line. Immediately after that opening + the existing `test.setTimeout(...)` call (if any), add:

```typescript
  test.beforeEach(async ({ page }) => {
    // D5: reset checklist progress so prior-run state doesn't hide
    // already-completed items' "Run Claude" buttons. (D4 finding.)
    await resetProgressForTestProject(page);
  });
```

The result around the start of the describe block should look like:

```typescript
test.describe('ARPG vertical slice — D2 live attempt', () => {
  test.setTimeout(30 * 60_000);

  test.beforeEach(async ({ page }) => {
    // D5: reset checklist progress so prior-run state doesn't hide
    // already-completed items' "Run Claude" buttons. (D4 finding.)
    await resetProgressForTestProject(page);
  });

  test('attempts Step 6 + Step 8 ih-1 in live mode', async ({ page }) => {
    ...
```

- [ ] **Step 4: Bump filenameSuffix**

Use Edit tool. Replace:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd4' });
```
with:
```typescript
      await harness.writeFindings({ filenameSuffix: 'd5' });
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
Expected: 1 test fails with the `HARNESS_MODE=live` assertion. The `beforeEach` will fire first and reset progress (harmless — empty progress is the desired state for tests). The assertion failure proves the spec still guards live mode correctly.

If the test fails with a different error (e.g., the POST returns 400 or 404), the `/api/project-progress` body shape may differ from the helper's assumption — adapt the helper at write time. The Next.js route handler at `src/app/api/project-progress/route.ts:60-66` shows the actual destructure: `{ projectPath, checklistProgress, moduleHealth, checklistVerification, moduleHistory } = body`.

- [ ] **Step 7: Commit Phase 1**

```bash
git add e2e/helpers/harness-mode.ts e2e/arpg-vertical-slice-live-d2.spec.ts
git commit -m "$(cat <<'EOF'
feat(e2e): D5 — resetProgressForTestProject + beforeEach fixture

Fixes D4's regression. D3's success auto-marked ih-1 complete in
~/.pof/pof.db, so D4's run loaded checked=true and the Claude button
wasn't rendered (per RoadmapChecklist.tsx:648, button only shows for
!checked items).

resetProgressForTestProject(page) POSTs empty progress to the existing
/api/project-progress route (no new PoF endpoint needed — the route
already accepts the full snapshot and overwrites the row keyed by
sha256(projectPath).slice(0,16)).

beforeEach fires before each test so every run starts from a clean
checklist state regardless of prior live runs.

filenameSuffix bumped to 'd5'.

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d5-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Capture SHA via `git log --oneline -1`.

---

## Task 2: Run the D5 live spec (controller-driven)

Run by the controller (not subagent). Live runs against the real UE5 project need supervision.

- [ ] **Step 1: Pre-flight**

```bash
git log --oneline -3
```
Expected: the D5 commit + D4 commits visible.

```bash
netstat -ano | grep -E ":3010 " | head -3
curl -s -I http://localhost:3010 | head -3
```
Expected: PoF dev server still alive on 3010 (PID 50132 from D3/D4) responding 200 OK with `X-Powered-By: Next.js`. If dead, start a fresh one: `PORT=3010 npm run dev` in background.

- [ ] **Step 2: Fire the live spec in background**

```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list
```

Run with `run_in_background: true` and `timeout: 1800000` (30 min cap).

- [ ] **Step 3: Wait for completion notification**

Continue other work while the run executes; notification arrives automatically on completion.

- [ ] **Step 4: Read final output**

When notified, tail the background task's output file to see the per-step result line.

---

## Task 3: Sanity-check findings + enrich + commit

- [ ] **Step 1: Verify findings doc exists**

```powershell
Get-ChildItem docs\features\arpg-vertical-slice\scenario-runs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | Format-Table Name, Length, LastWriteTime
```
Expected: `2026-05-19-live-d5.md` is the most recent file.

- [ ] **Step 2: Read the findings doc**

Read `docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d5.md`. Note per-step status, captured dispatches count, and the critical question: **did Step 8 ih-1 pass again?**

- [ ] **Step 3: Enrich findings doc**

Use Edit tool. Replace the auto-generated placeholder (`_See above per-step notes for D3 input._` or similar) with a D5-specific analysis section answering:

1. **Idempotency confirmed? (yes/no)** — explicit statement based on Step 8 ih-1's outcome compared to D4's regression.
2. **Step 8 ih-1 outcome** — pass means the reset fix worked; fail means the symptom is deeper than just `project_progress` (additional reset needed).
3. **Step 9 aa-1 outcome** — fail with the *same* "Setup Guide tab" reason means it's independent of D4's regression (was always broken). Fail with a *new* reason means D5 unmasked a different bug. Pass means... unexpected success worth investigating.
4. **Dispatch count** — should be ≥1 (Step 8 ih-1's prompt) if idempotency was the only blocker.
5. **Side-effect note** — Claude likely re-ran on existing files. Document what happened: silent skip, overwrite, or error.
6. **What this means for D6 (or wrap)** — concrete recommendation based on the run.

Write with concrete sentences from what actually happened, not template language.

- [ ] **Step 4: Commit**

```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-19-live-d5.md
git commit -m "$(cat <<'EOF'
docs(features): D5 live-run findings — idempotency fix outcome

[One paragraph summary of actual outcome — idempotency confirmed?,
 Step 8 ih-1 pass/fail, Step 9 aa-1 root cause, dispatch count.]

Spec: docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d5-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Substitute `[One paragraph...]` with real outcome before running.

- [ ] **Step 5: Final chat summary**

Post a single message:

```
Sub-project D5 complete. 2 commits:
- <SHA_FIX>       feat(e2e): D5 — resetProgressForTestProject + beforeEach fixture
- <SHA_FINDINGS>  docs(features): D5 live-run findings — idempotency fix outcome

Idempotency confirmed: [yes/no]
Step 6 (LIVE): [pass/fail + reason]
Step 8 ih-1 (LIVE): [pass/fail + reason — compare to D4's regression]
Step 9 aa-1 (LIVE): [pass/fail + reason]
Dispatch count: [N]

Recommended next step:
- If idempotency confirmed: D6 picks the next issue (Step 9 aa-1 testId visibility, Finding A for Step 6, or add a 3rd live step). Or wrap.
- If idempotency NOT confirmed: D6 expands reset scope (additional DB tables, cruder cleanup, or alternate strategy).
```

---

## Self-review of this plan (writer's checklist)

- [x] **Spec coverage:** every spec section maps to a task. Helper (Section 2 of spec) = T1 Steps 1-2. beforeEach + filenameSuffix (Section 3) = T1 Steps 3-4. Live run (Section 4) = T2. Findings (Section 4) = T3. DoD reachable.
- [x] **Placeholder scan:** the `[One paragraph...]` and per-step pass/fail markers in T3's commit message + chat summary are explicit runtime substitutions. T3 Step 3 says "Write with concrete sentences from what actually happened."
- [x] **Type consistency:** `resetProgressForTestProject` helper signature matches the import; `Page` parameter type matches Playwright's convention used elsewhere in `harness-mode.ts`; `filenameSuffix: 'd5'` matches the expected findings filename.
- [x] **Bite-sized:** T1 is 7 steps (4 edits + typecheck + parse check + commit). T2 is 4 steps. T3 is 5 steps. All single-action.
- [x] **Controller-driven steps (T2 + T3) explicitly flagged.** T2 step 2 says "Run with run_in_background: true."
- [x] **Adaptation path documented.** T1 Step 1 says "If TEST_PROJECT_PATH already exists, reuse it." T1 Step 2 says "If the import line is shaped differently, find the line containing './helpers/harness-mode' and adapt." T1 Step 6 says "If the test fails with a different error, the POST body shape may differ — adapt the helper at write time."
