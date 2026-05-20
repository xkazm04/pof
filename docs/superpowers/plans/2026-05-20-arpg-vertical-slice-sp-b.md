# SP-B: Gameplay Chain Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire operator-flow steps 11–16 (combat, dummy enemy, loot, HUD + verification) into a new live e2e spec so PoF drives autonomous Claude to build the ARPG gameplay chain.

**Architecture:** A new spec file `e2e/arpg-vertical-slice-sp-b.spec.ts` with two `test()` blocks (gated chunks: combat+enemy, then loot+ui+verify). The duplicated RoadmapChecklist dispatch pattern is extracted into `e2e/helpers/dispatch-helpers.ts` (`dispatchRoadmapChecklistItem`) alongside a glob-based artifact verifier (`verifyExpectedArtifacts`). The spec runs in both stub mode (wiring gate — no live Claude) and live mode (real generation); artifact checks run only in live mode.

**Tech Stack:** TypeScript, Playwright, the existing PoF e2e harness (`e2e/helpers/harness-mode.ts`).

**Spec:** `docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md`

---

## Planning-time facts (verified)

1. **Registry checklist items** (`src/lib/module-registry.ts`): `arpg-combat` has `acb-1` "Create melee attack ability" and `acb-4` "Apply damage via GAS" (lines 197, 200). `arpg-enemy-ai` `ae-2` "Create enemy character base" — its prompt creates **`AARPGEnemyCharacter` extending `AARPGCharacterBase`** (line 209; note: `AARPGEnemyCharacter`, not `AARPGEnemyBase`). `arpg-loot` `al-5`/`al-6` carry **SLICE MODE** prompt text already (lines 232–237). `arpg-ui` `au-1`/`au-2`/`au-7` (lines 242, 243, 252); `au-5`/`au-6` carry `[SLICE: skip]` and are simply not dispatched.

2. **`AARPGEnemyCharacter` likely already exists** — D9's Step 10 build output recompiled `ARPGEnemyCharacter`/`ARPGBossCharacter`/`ARPGPlayerCharacter`. So `ae-2` live will be mostly a Claude verify-and-fill (idempotent), not a from-scratch create. The artifact check just confirms the class file exists and carries an ASC.

3. **Checklist-item testId pattern** (shared `RoadmapChecklist.tsx`, used by D-spec Steps 8/10): `pof-module-{moduleId}-checklist-item-{itemId}`. The per-row dispatch button has accessible name "Claude". The module's checklist is on a tab named "Roadmap"; the Cards layout is toggled by a button named "Card view".

4. **Sidebar nav:** `pof-sidebar-nav-item-{categoryId}` (L1) → `pof-sidebar-l2-nav-item-{moduleId}` (L2). arpg-combat / arpg-enemy-ai / arpg-loot / arpg-ui all sit under category `core-engine`. The evaluator is its own L1 category `evaluator` (no L2).

5. **`harness-mode.ts` exports** (all already present, no modification needed): `setupHarnessMode`, `waitForCliComplete`, `completeSetupWizard`, `resetProgressForTestProject`, and types `HarnessHandle` (has a `mode: 'stub'|'live'` field), `StepResult`, `WaitResult`. `WaitResult` = `{ success: boolean; durationMs: number; timedOut: boolean; outputExcerpt?: string }`.

6. **Verification testIds** (best-known; the stub run confirms them): feature-matrix scan button `pof-feature-matrix-scan-btn`; evaluator module root `pof-module-evaluator`, run button `pof-module-evaluator-run-btn`, result summary `pof-module-evaluator-result-summary`, findings count `pof-module-evaluator-result-findings-count`.

7. **`playwright.config.ts`:** per-test `timeout: 30_000` (overridden per chunk via `test.setTimeout`); `webServer.reuseExistingServer` against `localhost:${PLAYWRIGHT_PORT ?? 3000}` — run with `PLAYWRIGHT_PORT=3010`.

8. **Artifact paths are best-guesses.** The verifier is **glob-based** (recursively find a file by name-substring under a root, optional symbol grep) rather than exact-path — far more robust to PoF's unknown `Source/PoF/` sub-layout. The chunk-1 live run validates them; a path/expectation-correction follow-up is budgeted (the D6.5/D7.5 norm).

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `e2e/helpers/dispatch-helpers.ts` | Create | `dispatchRoadmapChecklistItem` + `verifyExpectedArtifacts` + types |
| `e2e/arpg-vertical-slice-sp-b.spec.ts` | Create | Two-chunk live spec, steps 11–16 |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md` | Generated | Chunk 1 findings |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk2.md` | Generated | Chunk 2 findings |

Total: **2 created, 0 modified, 2 generated docs, ~4 commits.**

---

## Task 1: `dispatch-helpers.ts` — RoadmapChecklist dispatch + artifact verifier

**Files:**
- Create: `e2e/helpers/dispatch-helpers.ts`

This is Playwright Node-side harness code that drives a browser; like `completeSetupWizard` it has no meaningful standalone unit test — its behavioral proof is the stub run in Task 2. Verification here is `tsc`.

- [ ] **Step 1: Create the helper file**

Create `e2e/helpers/dispatch-helpers.ts` with exactly this content:

```typescript
import { type Page } from '@playwright/test';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { waitForCliComplete, type WaitResult } from './harness-mode';

/** Identifies one RoadmapChecklist item to dispatch. */
export interface RoadmapDispatchTarget {
  /** L1 sidebar nav testId, e.g. 'pof-sidebar-nav-item-core-engine'. */
  categoryTestId: string;
  /** L2 sidebar nav testId, e.g. 'pof-sidebar-l2-nav-item-arpg-combat'. */
  moduleTestId: string;
  /** Module id used in the checklist-item testId, e.g. 'arpg-combat'. */
  moduleId: string;
  /** Checklist item id, e.g. 'acb-1'. */
  itemId: string;
  /** Session label passed to waitForCliComplete. */
  sessionLabel: string;
}

/**
 * Navigate to a module, open its Roadmap tab in Cards layout, hover the
 * checklist row, click its "Claude" button, and wait for the CLI to complete.
 * Encapsulates the RoadmapChecklist dispatch pattern proven by D-spec Steps
 * 8/10. On a locator miss it returns a synthetic failure WaitResult (rather
 * than throwing) so the caller records a `fail` step and the run continues.
 */
export async function dispatchRoadmapChecklistItem(
  page: Page,
  target: RoadmapDispatchTarget,
  timeoutMs: number,
): Promise<WaitResult> {
  const start = Date.now();
  const fail = (msg: string): WaitResult => ({
    success: false,
    durationMs: Date.now() - start,
    timedOut: false,
    outputExcerpt: `dispatchRoadmapChecklistItem(${target.sessionLabel}): ${msg}`,
  });

  await page.getByTestId(target.categoryTestId).click();
  await page.getByTestId(target.moduleTestId).click();

  const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
  if ((await roadmapTab.count()) === 0) return fail('no "Roadmap" tab');
  await roadmapTab.click();
  await page.waitForTimeout(500);

  const cardViewBtn = page.getByRole('button', { name: 'Card view' });
  if ((await cardViewBtn.count()) === 0) return fail('no "Card view" button');
  await cardViewBtn.click();
  await page.waitForTimeout(300);

  const row = page.getByTestId(`pof-module-${target.moduleId}-checklist-item-${target.itemId}`);
  if ((await row.count()) === 0) {
    return fail(`checklist row pof-module-${target.moduleId}-checklist-item-${target.itemId} not found`);
  }
  await row.hover();

  const claudeBtn = row.getByRole('button', { name: /^Claude$/i });
  if ((await claudeBtn.count()) === 0) return fail(`no "Claude" button in row ${target.itemId}`);
  await claudeBtn.click();

  return waitForCliComplete(page, target.sessionLabel, timeoutMs);
}

/** One expected artifact: a file found by name-substring under a root. */
export interface ArtifactExpectation {
  /** Human label for the findings note. */
  label: string;
  /** Substring matched against file names during a recursive search. */
  fileNameContains: string;
  /** Absolute directory to search recursively. */
  searchRoot: string;
  /** Optional symbol the matched file's content must contain. */
  mustContain?: string;
}

/** Recursively find the first file under `root` whose name includes `needle`. */
async function findFileByName(root: string, needle: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    let st;
    try {
      st = await stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const nested = await findFileByName(full, needle);
      if (nested) return nested;
    } else if (entry.includes(needle)) {
      return full;
    }
  }
  return null;
}

/**
 * Verify each expected artifact exists (by recursive name search) and, if
 * `mustContain` is set, contains the symbol. Returns an overall ok flag and a
 * human-readable note for the findings doc. Best-effort: intended for live mode
 * only — the chunk-1 run validates the expectations.
 */
export async function verifyExpectedArtifacts(
  expectations: ArtifactExpectation[],
): Promise<{ ok: boolean; note: string }> {
  let ok = true;
  const lines: string[] = [];
  for (const exp of expectations) {
    const found = await findFileByName(exp.searchRoot, exp.fileNameContains);
    if (!found) {
      ok = false;
      lines.push(`MISSING ${exp.label}: no file matching "*${exp.fileNameContains}*" under ${exp.searchRoot}`);
      continue;
    }
    if (exp.mustContain) {
      const content = await readFile(found, 'utf-8').catch(() => '');
      if (!content.includes(exp.mustContain)) {
        ok = false;
        lines.push(`PARTIAL ${exp.label}: found ${found} but missing symbol "${exp.mustContain}"`);
        continue;
      }
    }
    lines.push(`OK ${exp.label}: ${found}`);
  }
  return { ok, note: '\nArtifact check:\n' + lines.join('\n') };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Lint**

```bash
npm run lint
```
Expected: 0 errors (pre-existing warnings elsewhere are fine; no new errors/warnings in `dispatch-helpers.ts`).

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/dispatch-helpers.ts
git commit -m "$(cat <<'EOF'
test(e2e): add SP-B dispatch helpers — RoadmapChecklist dispatch + artifact verifier

dispatchRoadmapChecklistItem encapsulates the navigate -> Roadmap tab -> Card
view -> hover -> click "Claude" -> waitForCliComplete pattern that D-spec Steps
8/10 inline-duplicated; SP-B has 8 call sites. On a locator miss it returns a
synthetic failure WaitResult so a step records fail without aborting the run.
verifyExpectedArtifacts does a glob-style recursive file search (robust to the
UE project's unknown sub-layout) with an optional symbol grep.

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: SP-B spec file — two chunks, steps 11–16

**Files:**
- Create: `e2e/arpg-vertical-slice-sp-b.spec.ts`

The task is done only when the spec **passes in stub mode** (the wiring gate). No live run here.

- [ ] **Step 1: Create the spec file**

Create `e2e/arpg-vertical-slice-sp-b.spec.ts` with exactly this content:

```typescript
import { test, type Page } from '@playwright/test';
import { join } from 'node:path';
import {
  setupHarnessMode,
  waitForCliComplete,
  completeSetupWizard,
  resetProgressForTestProject,
  type HarnessHandle,
} from './helpers/harness-mode';
import {
  dispatchRoadmapChecklistItem,
  verifyExpectedArtifacts,
  type RoadmapDispatchTarget,
} from './helpers/dispatch-helpers';

const PROJECT_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const SRC = join(PROJECT_PATH, 'Source');
const STEP_TIMEOUT_MS = 10 * 60_000;

async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);
}

/** Run one labelled step: execute body, drain dispatches, record the result. */
async function runLiveStep(
  harness: HarnessHandle,
  page: Page,
  label: string,
  body: () => Promise<{ success: boolean; durationMs: number; timedOut: boolean; notes?: string }>,
): Promise<void> {
  await test.step(label, async () => {
    harness.setStepLabel(label);
    const result = await body();
    await harness.drainCliDispatches(page);
    harness.recordStepResult({
      step: label,
      status: result.timedOut ? 'fail' : result.success ? 'pass' : 'fail',
      durationMs: result.durationMs,
      notes: result.notes,
    });
  });
}

/** A combat/enemy/loot/ui RoadmapChecklist dispatch step + live artifact check. */
async function dispatchStep(
  harness: HarnessHandle,
  page: Page,
  target: RoadmapDispatchTarget,
  liveExpectations: Parameters<typeof verifyExpectedArtifacts>[0],
): Promise<{ success: boolean; durationMs: number; timedOut: boolean; notes?: string }> {
  const result = await dispatchRoadmapChecklistItem(page, target, STEP_TIMEOUT_MS);
  if (harness.mode !== 'live') {
    // Stub mode: no real generation — the wiring (dispatch fired) is the check.
    return { success: result.success, durationMs: result.durationMs, timedOut: result.timedOut, notes: result.outputExcerpt };
  }
  const artifacts = await verifyExpectedArtifacts(liveExpectations);
  return {
    success: result.success && artifacts.ok,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    notes: (result.outputExcerpt ?? '') + artifacts.note,
  };
}

test.describe('ARPG vertical slice — SP-B gameplay chain', () => {
  test.beforeEach(async ({ page }) => {
    await resetProgressForTestProject(page);
  });

  // ─── Chunk 1: combat + enemy foundation ──────────────────────────────────
  test('SP-B chunk 1: combat + enemy', async ({ page }) => {
    test.setTimeout(40 * 60_000);
    const harness = await setupHarnessMode(page);
    try {
      await runLiveStep(harness, page, 'Step 11a acb-1: Create melee attack ability', async () => {
        await enterWorkspace(page);
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-combat',
            moduleId: 'arpg-combat',
            itemId: 'acb-1',
            sessionLabel: 'combat-acb-1',
          },
          [{ label: 'GA_MeleeAttack ability', fileNameContains: 'MeleeAttack', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 11b acb-4: Apply damage via GAS', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-combat',
            moduleId: 'arpg-combat',
            itemId: 'acb-4',
            sessionLabel: 'combat-acb-4',
          },
          [{ label: 'GE_Damage / damage application', fileNameContains: 'Damage', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 12 ae-2: Create enemy character base', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-enemy-ai',
            moduleId: 'arpg-enemy-ai',
            itemId: 'ae-2',
            sessionLabel: 'enemy-ae-2',
          },
          [{ label: 'ARPGEnemyCharacter class', fileNameContains: 'EnemyCharacter', searchRoot: SRC, mustContain: 'UAbilitySystemComponent' }],
        );
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'sp-b-chunk1' });
    }
  });

  // ─── Chunk 2: loot + UI + verification ───────────────────────────────────
  test('SP-B chunk 2: loot + ui + verify', async ({ page }) => {
    test.setTimeout(45 * 60_000);
    const harness = await setupHarnessMode(page);
    try {
      await runLiveStep(harness, page, 'Step 13a al-5: Loot drop on death', async () => {
        await enterWorkspace(page);
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-loot',
            moduleId: 'arpg-loot',
            itemId: 'al-5',
            sessionLabel: 'loot-al-5',
          },
          [{ label: 'AARPGWorldItem (loot drop)', fileNameContains: 'WorldItem', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 13b al-6: Item pickup (overlap-destroy)', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-loot',
            moduleId: 'arpg-loot',
            itemId: 'al-6',
            sessionLabel: 'loot-al-6',
          },
          [{ label: 'AARPGWorldItem pickup overlap', fileNameContains: 'WorldItem', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 14a au-1: Set up HUD framework', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-ui',
            moduleId: 'arpg-ui',
            itemId: 'au-1',
            sessionLabel: 'ui-au-1',
          },
          [{ label: 'HUD widget', fileNameContains: 'HUD', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 14b au-2: Bind HUD to GAS attributes', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-ui',
            moduleId: 'arpg-ui',
            itemId: 'au-2',
            sessionLabel: 'ui-au-2',
          },
          [{ label: 'HUD widget (GAS-bound)', fileNameContains: 'HUD', searchRoot: SRC }],
        );
      });

      await runLiveStep(harness, page, 'Step 14c au-7: Floating damage numbers', async () => {
        return dispatchStep(
          harness,
          page,
          {
            categoryTestId: 'pof-sidebar-nav-item-core-engine',
            moduleTestId: 'pof-sidebar-l2-nav-item-arpg-ui',
            moduleId: 'arpg-ui',
            itemId: 'au-7',
            sessionLabel: 'ui-au-7',
          },
          [{ label: 'Floating damage number widget', fileNameContains: 'DamageNumber', searchRoot: SRC }],
        );
      });

      // Step 15 — feature-matrix scan (INFORMATIONAL: never fails the chunk).
      await runLiveStep(harness, page, 'Step 15: Feature-matrix scan (arpg-combat)', async () => {
        const start = Date.now();
        await page.getByTestId('pof-sidebar-nav-item-core-engine').click();
        await page.getByTestId('pof-sidebar-l2-nav-item-arpg-combat').click();
        const scanBtn = page.getByTestId('pof-feature-matrix-scan-btn');
        if ((await scanBtn.count()) === 0) {
          return { success: true, durationMs: Date.now() - start, timedOut: false, notes: 'INFO: pof-feature-matrix-scan-btn not located — feature-matrix scan skipped' };
        }
        await scanBtn.first().click();
        const result = await waitForCliComplete(page, 'feature-matrix-scan', STEP_TIMEOUT_MS);
        return { success: true, durationMs: result.durationMs, timedOut: false, notes: 'INFO (feature-matrix scan): ' + (result.outputExcerpt ?? '') };
      });

      // Step 16 — evaluator deep-eval (INFORMATIONAL: never fails the chunk).
      await runLiveStep(harness, page, 'Step 16: Evaluator deep-eval', async () => {
        const start = Date.now();
        await page.getByTestId('pof-sidebar-nav-item-evaluator').click();
        const runBtn = page.getByTestId('pof-module-evaluator-run-btn');
        if ((await runBtn.count()) === 0) {
          return { success: true, durationMs: Date.now() - start, timedOut: false, notes: 'INFO: pof-module-evaluator-run-btn not located — evaluator step skipped' };
        }
        await runBtn.first().click();
        const summary = page.getByTestId('pof-module-evaluator-result-summary');
        let note = 'INFO (evaluator): ';
        try {
          await summary.first().waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
          const findings = page.getByTestId('pof-module-evaluator-result-findings-count');
          note += (await findings.first().textContent().catch(() => '')) ?? 'summary rendered';
        } catch {
          note += 'result summary did not render within the timeout';
        }
        return { success: true, durationMs: Date.now() - start, timedOut: false, notes: note };
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'sp-b-chunk2' });
    }
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Run the spec in STUB mode — the wiring gate**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --reporter=list
```
(No `HARNESS_MODE` → stub. A PoF dev server should be on port 3010; `webServer.reuseExistingServer` starts one otherwise.)

Expected: **both `test()` blocks pass.** In stub mode `waitForCliComplete` short-circuits to success, artifact checks are skipped (`harness.mode !== 'live'`), so every step should record `pass` — proving navigation, the Roadmap-tab/Card-view/hover/"Claude"-button chain, and the feature-matrix/evaluator controls are all locatable.

If a step fails, the failure note names the missing locator (e.g. `no "Roadmap" tab`, or `checklist row ... not found`). Fix the cause:
- Wrong tab name / testId → correct it in the spec (verify the real value in `src/components/modules/...` or `src/lib/module-registry.ts`).
- Do NOT weaken the spec to make a step pass — the stub run must legitimately go green.
Re-run until both chunks pass in stub mode.

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: 0 errors; no new warnings in the spec file.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-sp-b.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): SP-B gameplay-chain spec — operator steps 11-16, two gated chunks

New two-chunk live spec. Chunk 1: combat acb-1/acb-4 + enemy ae-2. Chunk 2:
loot al-5/al-6 + HUD au-1/au-2/au-7 + informational feature-matrix scan and
evaluator deep-eval. Runs in both stub mode (wiring gate — artifact checks
skipped) and live mode (real generation + glob-based artifact verification).
Steps 15-16 never fail a chunk. Stub run passes both chunks.

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Chunk 1 live run — combat + enemy (CONTROLLER-DRIVEN)

> **Controller-driven task.** Step 4 launches a long live process; run it via the Bash tool with `run_in_background: true`. Do NOT start the live run until the Step 1 gate holds.

**Files:**
- Generated: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md`

- [ ] **Step 1: Confirm the gate holds**

```bash
git log --oneline -3
npx tsc --noEmit
PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --reporter=list
```
Expected: Task 1 + Task 2 commits present; `tsc` clean; the stub run passes both chunks. If any fails, STOP — do not run live.

- [ ] **Step 2: Apply the keep-awake pre-flight**

```powershell
powershell -Command "powercfg /change standby-timeout-ac 0; powercfg /change monitor-timeout-ac 0"
```
Expected: no error (prevents machine sleep during the live run, per the D8/D9 lesson).

- [ ] **Step 3: Confirm the PoF dev server is alive on 3010**

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: `200`. If not, start `npm run dev -- -p 3010` in a separate terminal first. Do NOT kill any process already on a port.

- [ ] **Step 4: Fire Chunk 1 live in the background**

Run via the Bash tool with `run_in_background: true` and `timeout: 2400000` (40 min):
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --grep "chunk 1" --reporter=list
```

- [ ] **Step 5: Wait for the completion notification**

Do other work; the background-task completion notification arrives automatically. Do NOT poll. When notified, read the task's final output.

- [ ] **Step 6: Read the findings doc**

Confirm `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md` exists (most recent in that folder) and read it. Note each step's pass/fail and the artifact-check lines.

- [ ] **Step 7: Artifact-inspection checkpoint**

For each of acb-1 / acb-4 / ae-2, confirm from the findings doc's artifact-check note (and, if needed, by listing `C:\Users\kazda\Documents\Unreal Projects\PoF\Source`) what files were actually produced and their real paths. If a step recorded `fail` purely because `verifyExpectedArtifacts` looked for the wrong `fileNameContains` substring (the file exists under a different name), that is a **path-correction follow-up**: update the relevant `liveExpectations` in `e2e/arpg-vertical-slice-sp-b.spec.ts`, commit it (`fix(e2e): SP-B — correct chunk-1 artifact expectations`), and note in the findings doc that the dispatch itself succeeded. If a step failed because the CLI genuinely errored or timed out, record that as the real outcome.

- [ ] **Step 8: Enrich + commit the findings**

Append a `## Findings for SP-B chunk 1` section to the chunk-1 findings doc covering: per-step outcome (acb-1, acb-4, ae-2 — dispatched? artifact-verified?), total CLI dispatch count, whether any path-correction was needed, and whether the combat + enemy foundation is sound enough for Chunk 2 to build on. Then:
```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md e2e/arpg-vertical-slice-sp-b.spec.ts
git commit -m "$(cat <<'EOF'
docs(features): SP-B chunk 1 live-run findings — combat + enemy foundation

[One paragraph from the actual run: acb-1/acb-4/ae-2 outcomes, dispatch count,
 any artifact-expectation corrections, readiness for chunk 2.]

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Substitute the `[One paragraph...]` with the actual outcome. (If no spec edit was needed in Step 7, drop the spec path from `git add`.)

---

## Task 4: Chunk 2 live run — loot + UI + verification (CONTROLLER-DRIVEN)

> **Controller-driven task.** Same pattern as Task 3. Only start after Task 3's chunk-1 findings are committed and the foundation was judged sound.

**Files:**
- Generated: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk2.md`

- [ ] **Step 1: Confirm the gate + keep-awake still hold**

```bash
git log --oneline -3
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: Task 3's findings commit present; server `200`. Re-apply keep-awake if the session is fresh:
```powershell
powershell -Command "powercfg /change standby-timeout-ac 0; powercfg /change monitor-timeout-ac 0"
```

- [ ] **Step 2: Fire Chunk 2 live in the background**

Run via the Bash tool with `run_in_background: true` and `timeout: 2700000` (45 min):
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --grep "chunk 2" --reporter=list
```

- [ ] **Step 3: Wait for the completion notification**

Do not poll; the notification arrives automatically. When notified, read the final output.

- [ ] **Step 4: Read the findings doc**

Confirm `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk2.md` exists and read it — per-step outcomes for al-5/al-6/au-1/au-2/au-7 and the informational notes from steps 15–16.

- [ ] **Step 5: Path-correction check (if needed)**

As in Task 3 Step 7: if a loot/UI step recorded `fail` only due to a wrong `fileNameContains` substring, correct the `liveExpectations` in the spec and commit `fix(e2e): SP-B — correct chunk-2 artifact expectations`.

- [ ] **Step 6: Enrich + commit the findings**

Append a `## Findings for SP-B chunk 2` section: per-step outcome for the 5 dispatch steps, the feature-matrix + evaluator informational results, total dispatch count, and an initiative-level note (after SP-B the gameplay systems are generated; only packaging SP-C and PIE verification SP-E remain). Then:
```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk2.md
git commit -m "$(cat <<'EOF'
docs(features): SP-B chunk 2 live-run findings — loot + UI + verification

[One paragraph from the actual run: al-5/al-6/au-1/au-2/au-7 outcomes,
 feature-matrix + evaluator signals, dispatch count, initiative status.]

Spec: docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
(Add the spec file to `git add` only if Step 5 corrected it.)

- [ ] **Step 7: Final chat summary**

Post a single message with the commit SHAs and per-step results:
```
Sub-project SP-B complete. Commits:
- <SHA_T1>       test(e2e): SP-B dispatch helpers
- <SHA_T2>       test(e2e): SP-B gameplay-chain spec
- <SHA_CHUNK1>   docs(features): SP-B chunk 1 findings
- <SHA_CHUNK2>   docs(features): SP-B chunk 2 findings
  (+ any fix(e2e) artifact-expectation corrections)

Stub run: both chunks green (wiring verified).
Chunk 1 (combat + enemy): acb-1 [..], acb-4 [..], ae-2 [..]
Chunk 2 (loot + UI): al-5 [..], al-6 [..], au-1 [..], au-2 [..], au-7 [..]
Steps 15-16 (informational): feature-matrix [..], evaluator [..]

Initiative status: gameplay systems generated; next is SP-C (packaging).
Recommend refreshing SCENARIO-REPORT.md before SP-C.
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec §"Architecture / new spec file" → Task 2; "new helper `dispatchRoadmapChecklistItem`" → Task 1; the 8 dispatch steps + steps 15–16 → Task 2's two `test()` blocks; "stub-test before live" → Task 2 Step 3 (the gate); "two gated chunks + artifact-inspection checkpoint" → Tasks 3 & 4 (Task 3 Step 7 is the checkpoint); per-step artifact gating + informational 15–16 → `dispatchStep` / the inline steps; findings docs → Task 3 Step 8 + Task 4 Step 6. Spec DoD items 1–7 all map.
- [x] **Placeholder scan:** the only bracketed text is the `[One paragraph...]` in Task 3/4 commit messages and `<SHA_*>` / `[..]` in Task 4's chat summary — all explicit runtime substitutions, each labelled "from the actual run". Every code step shows complete code. No "TBD"/"handle edge cases"/"similar to Task N".
- [x] **Type consistency:** `RoadmapDispatchTarget` (fields `categoryTestId`, `moduleTestId`, `moduleId`, `itemId`, `sessionLabel`) defined in Task 1, used verbatim at all 8 call sites in Task 2. `ArtifactExpectation` (`label`, `fileNameContains`, `searchRoot`, `mustContain?`) defined in Task 1, used in Task 2's `liveExpectations` arrays. `dispatchRoadmapChecklistItem` and `verifyExpectedArtifacts` signatures match between Task 1 and Task 2's imports/calls. `harness.mode` is the `HarnessHandle.mode` field (confirmed exported). `waitForCliComplete`, `setupHarnessMode`, `completeSetupWizard`, `resetProgressForTestProject` are all confirmed `harness-mode.ts` exports.
- [x] **Stub/live duality handled:** `dispatchStep` branches on `harness.mode` — artifact checks only in live; stub run therefore goes green on wiring alone. Steps 15–16 always return `success: true` (informational). The spec does NOT assert `HARNESS_MODE=live` (unlike the D-spec) so it runs in both modes.
- [x] **Bite-sized:** T1 = 4 steps, T2 = 5 steps, T3 = 8 steps, T4 = 7 steps. All single-action.
- [x] **Controller-driven flagged:** T3 + T4 headers and the background-run steps explicitly say `run_in_background: true` with timeouts; wait-for-notification, no polling.
- [x] **Honest about uncertainty:** artifact `fileNameContains` substrings are best-guesses; Task 3 Step 7 / Task 4 Step 5 are the budgeted path-correction follow-ups. The stub run proves wiring independent of artifacts.
