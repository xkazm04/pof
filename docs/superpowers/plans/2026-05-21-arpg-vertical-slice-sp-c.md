# SP-C: Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a packaged Win64 Shipping `.exe` of the ARPG project via PoF's packaging UI, gated by a build-verify pre-flight that confirms SP-B's generated C++ compiles.

**Architecture:** Part A — the controller runs `UnrealBuildTool` directly on the `PoFEditor` target to confirm a clean compile (fail-fast before the long cook). Part B — a new `e2e/arpg-vertical-slice-sp-c.spec.ts` drives the packaging UI (seed a Win64/Shipping profile → start cook → `waitForCookComplete` → read the `.exe` path); stub-tested, then one gated live cook.

**Tech Stack:** TypeScript, Playwright, UnrealBuildTool / RunUAT (UE 5.7), the PoF packaging module.

**Spec:** `docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-c-design.md`

---

## Planning-time facts (verified)

1. **UnrealBuildTool** is at `C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe` (confirmed present). The editor build command is `<UBT> PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex` — the form the harness's existing build-verify prompt uses.

2. **`harness-mode.ts` exports** (all present): `setupHarnessMode`, `completeSetupWizard`, `seedPackagingProfile(page, name?) → Promise<string>` (POSTs a Win64/Shipping profile to `/api/packaging/profiles`, returns the new profile id), `waitForCookComplete(page, timeoutMs = 600_000) → Promise<WaitResult>` (polls `pof-cook-progress-result` for `visible`, returns `{success: data-status === 'success', durationMs, timedOut, outputExcerpt}`), and the `HarnessHandle` (has `.mode`, `.recordStepResult`, `.writeFindings`).

3. **Packaging testIds:** the seeded profile's cook trigger is `pof-module-packaging-start-cook-${profileId}` (`PlatformProfileCard`); `CookProgress` exposes `pof-cook-progress-result` (carries `data-status`) and `pof-cook-progress-exe-path`. Packaging is reached via sidebar `pof-sidebar-nav-item-game-systems` → `pof-sidebar-l2-nav-item-packaging`.

4. **Stub mode** — `setupHarnessMode` mocks `/api/packaging/execute` with a synthetic SSE stream (cook→stage→package→done in ~2 s, `status: 'success'`, a stub `exePath`). So a stub run of the cook spec completes fast and `waitForCookComplete` returns success — proving the spec's wiring without a real cook.

5. **No app source change** — the cook backend and `CookProgress` UI were built in sub-project B.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `e2e/arpg-vertical-slice-sp-c.spec.ts` | Create | Drive the packaging UI: seed profile → cook → verify `.exe` |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-c-cook.md` | Generated | Cook findings |

Total: **1 created, 1 generated doc, ~2 commits.** (Task 1 is a verification gate — no commit unless a compile fix is needed.)

---

## Task 1: Part A — build-verify pre-flight (CONTROLLER-DRIVEN)

> **Controller-driven.** Runs `UnrealBuildTool` directly — no test file, no Claude. A gate for Task 3. Step 1 launches a long build; run it via the Bash tool with `run_in_background: true`.

**Files:** none created/modified (a verification gate). A compile fix, if needed, is a checkpoint.

- [ ] **Step 1: Run the editor build in the background**

Run via the Bash tool with `run_in_background: true` and `timeout: 1800000` (30 min cap):
```bash
"/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex 2>&1
```

- [ ] **Step 2: Wait for the build to complete**

Continue other work; the background-task completion notification arrives automatically. Do NOT poll.

- [ ] **Step 3: Evaluate the result**

When notified, read the build output. Determine:
- **Exit code 0 and no `error:` lines** → the project (with SP-B's generated C++) compiles clean. Record "build-verify: clean" and proceed to Task 2.
- **Compile errors** (non-zero exit, or `error` lines in the output) → **STOP**. Extract the error lines (file:line + message). These are a finding — most likely a defect in SP-B's autonomously-generated loot/HUD/damage-number C++. Report them to the user with the specific errors, and treat fixing them as a checkpoint before Task 3: a targeted fix (a Claude fix-dispatch against the specific files, or a direct edit), then re-run Step 1 to confirm clean. Do not proceed to the cook with a broken build.

---

## Task 2: Part B — the cook spec

**Files:**
- Create: `e2e/arpg-vertical-slice-sp-c.spec.ts`

- [ ] **Step 1: Create the cook spec**

Create `e2e/arpg-vertical-slice-sp-c.spec.ts` with exactly this content:

```typescript
import { test, expect, type Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
import {
  setupHarnessMode,
  completeSetupWizard,
  seedPackagingProfile,
  waitForCookComplete,
} from './helpers/harness-mode';

/** A Win64 Shipping cook of this project is long — generous live ceiling. */
const COOK_TIMEOUT_MS = 80 * 60_000;

async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);
}

test.describe('ARPG vertical slice — SP-C packaging', () => {
  test('cook a Win64 Shipping build', async ({ page }) => {
    test.setTimeout(90 * 60_000);
    const harness = await setupHarnessMode(page);
    try {
      await enterWorkspace(page);

      // Seed a Win64 / Shipping packaging profile, then open the packaging
      // module so it picks the profile up.
      const profileId = await seedPackagingProfile(page, 'SP-C-Win64-Shipping');
      expect(profileId, 'seedPackagingProfile must return a profile id').not.toBe('');

      await page.getByTestId('pof-sidebar-nav-item-game-systems').click();
      await page.getByTestId('pof-sidebar-l2-nav-item-packaging').click();
      await page.waitForTimeout(500);

      // Trigger the cook for the seeded profile.
      const startBtn = page.getByTestId(`pof-module-packaging-start-cook-${profileId}`);
      await startBtn.waitFor({ state: 'visible', timeout: 15_000 });
      await startBtn.click();

      // Wait for the cook to finish (CookProgress → pof-cook-progress-result).
      const result = await waitForCookComplete(page, COOK_TIMEOUT_MS);

      let exePath = '';
      let exeOnDisk = false;
      if (harness.mode === 'live') {
        try {
          exePath = (await page.getByTestId('pof-cook-progress-exe-path').first().textContent({ timeout: 5_000 })) ?? '';
        } catch { /* no exe-path element */ }
        if (exePath.trim()) {
          try {
            await stat(exePath.trim());
            exeOnDisk = true;
          } catch { /* not on disk */ }
        }
      }

      harness.recordStepResult({
        step: 'SP-C: Win64 Shipping cook',
        status: result.success && (harness.mode !== 'live' || exeOnDisk) ? 'pass' : 'fail',
        durationMs: result.durationMs,
        notes: harness.mode === 'live'
          ? `exePath="${exePath.trim()}" onDisk=${exeOnDisk}\n${result.outputExcerpt ?? ''}`
          : (result.outputExcerpt ?? 'stub cook'),
      });

      expect(result.success, 'cook must report success').toBe(true);
      if (harness.mode === 'live') {
        expect(exeOnDisk, `packaged .exe must exist on disk (path: "${exePath.trim()}")`).toBe(true);
      }
    } finally {
      await harness.writeFindings({ filenameSuffix: 'sp-c-cook' });
    }
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Run the spec in STUB mode — wiring gate**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-c.spec.ts --reporter=list
```
(No `HARNESS_MODE` → stub.) Expected: **1 passed.** Stub mode's synthetic `/api/packaging/execute` SSE drives `CookProgress` to a `success` result in ~2 s; the test seeds the profile, navigates, clicks start-cook, `waitForCookComplete` returns success, and the live-only `.exe` check is skipped. This proves navigation + the seeded profile's start-cook trigger + the cook-progress wiring.

If it fails: the failure names the missing locator (seeded profile button, sidebar nav, or cook-progress). Fix in the spec, verifying real testIds against `src/components/modules/game-systems/` and the sidebar components. Do NOT weaken the assertions.

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: 0 errors; no new warnings in the spec file.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-sp-c.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): SP-C packaging cook spec

Drives PoF's packaging UI to cook a Win64 Shipping build: seeds a Win64/Shipping
profile, navigates to the packaging module, clicks the seeded profile's
start-cook button, waits for CookProgress to report a result, and (in live
mode) verifies the produced .exe exists on disk. Stub mode's synthetic cook SSE
makes the stub run a fast wiring gate; the live run does the real cook.

Spec: docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-c-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Part B — gated live cook (CONTROLLER-DRIVEN)

> **Controller-driven.** Start only after Task 1 reported a clean build and Task 2 is committed. Step 4 launches the long live cook; run it via the Bash tool with `run_in_background: true`.

**Files:**
- Generated: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-c-cook.md`

- [ ] **Step 1: Confirm the gate**

```bash
git log --oneline -2
npx tsc --noEmit
```
Expected: the Task 2 commit present; `tsc` clean. Confirm Task 1 reported a **clean** editor build — if it did not, do not proceed.

- [ ] **Step 2: Apply the keep-awake pre-flight**

```bash
powershell -Command "powercfg /change standby-timeout-ac 0; powercfg /change monitor-timeout-ac 0"
```

- [ ] **Step 3: Confirm the dev server on 3010**

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: `200`. If not, start `npm run dev -- -p 3010` separately — do not kill any process.

- [ ] **Step 4: Fire the live cook (background)**

Run via the Bash tool with `run_in_background: true` and `timeout: 5400000` (90 min):
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-c.spec.ts --reporter=list
```

- [ ] **Step 5: Wait for the completion notification**

Do not poll. When notified, read the task output — the test pass/fail line.

- [ ] **Step 6: Read the findings doc**

Confirm `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-c-cook.md` exists (it is the most recent file in `scenario-runs/`) and read it — the cook step's status, the `exePath`/`onDisk` note, and the output excerpt.

- [ ] **Step 7: Restore power settings**

```bash
powershell -Command "powercfg /change standby-timeout-ac 30; powercfg /change monitor-timeout-ac 10"
```

- [ ] **Step 8: Enrich + commit the findings**

Append a `## SP-C findings` section to the cook findings doc covering, from the actual run: whether the cook succeeded, the produced `.exe` path and whether it exists on disk, the cook duration, and — if it failed — the failure phase and the cook-log excerpt (a triage finding). Then:
```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-c-cook.md
git commit -m "$(cat <<'EOF'
docs(features): SP-C live cook findings — packaged Win64 Shipping build

[One paragraph from the actual run: cook success/failure, the .exe path + on-disk
 status, cook duration, and any failure-phase triage notes.]

Spec: docs/superpowers/specs/2026-05-21-arpg-vertical-slice-sp-c-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Substitute `[One paragraph...]` with the actual outcome.

- [ ] **Step 9: Final chat summary**

Post a single message:
```
Sub-project SP-C complete. Commits:
- <SHA_T2>      test(e2e): SP-C packaging cook spec
- <SHA_T3>      docs(features): SP-C live cook findings
  (+ any compile-fix commit from Task 1's checkpoint)

Part A build-verify: [clean / errors found + fixed].
Stub run: cook spec green.
Live cook: [success — .exe at <path>, <N> min | failed at <phase> — triage notes].

Initiative status: [packaged .exe produced / cook blocked].
Next: SP-E (PIE verification) — or refresh SCENARIO-REPORT.md first.
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Part A (direct UBT build-verify pre-flight) → Task 1. Part B (cook spec — seed profile, navigate, start-cook, `waitForCookComplete`, verify `.exe`) → Task 2's spec file. "stub-test the cook wiring" → Task 2 Step 3. "one gated live cook" → Task 3. Spec DoD 1–5 all map (DoD 1 → Task 1; 2 → Task 2; 3 → Task 3; 4 → Task 2/3 `.exe` assertion; 5 → Task 3 Steps 8–9).
- [x] **Placeholder scan:** the only bracketed text is `[One paragraph...]` / `[clean / errors...]` in Task 3's commit + summary — explicit runtime substitutions labelled "from the actual run". Task 1's "compile fix" is deliberately a checkpoint (a failure that may not happen — the plan cannot pre-write a fix for unknown errors; it says exactly what to do if it occurs). Task 2's code step shows the complete file.
- [x] **Type consistency:** `seedPackagingProfile(page, name) → Promise<string>` (profile id), used as `pof-module-packaging-start-cook-${profileId}`. `waitForCookComplete(page, timeoutMs) → WaitResult` (`success`, `durationMs`, `timedOut`, `outputExcerpt`) — all fields used match. `harness.mode`, `harness.recordStepResult` (`StepResult`: `step`/`status`/`durationMs`/`notes`), `harness.writeFindings({filenameSuffix})` match `harness-mode.ts`. testIds (`pof-sidebar-nav-item-game-systems`, `pof-sidebar-l2-nav-item-packaging`, `pof-cook-progress-result`, `pof-cook-progress-exe-path`) match the verified facts.
- [x] **Stub/live duality:** `harness.mode === 'live'` gates the `.exe`-on-disk check; stub mode's synthetic cook SSE makes the stub run a fast green wiring gate. The spec asserts `result.success` in both modes; the disk check only live.
- [x] **Controller-driven flagged:** Task 1 + Task 3 headers and their background-run steps say `run_in_background: true` with timeouts; wait-for-notification, no polling.
- [x] **Bite-sized:** T1 = 3 steps, T2 = 5, T3 = 9. All single-action.
