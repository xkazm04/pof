# SP-B Single-Dispatch Rework + Layer-6 Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the layer-6 `isRunning`-stuck bug (`onTaskComplete` gated on a hangable callback POST) and rework SP-B so every gameplay dispatch runs as an isolated single-dispatch test — eliminating the chained-dispatch failure class.

**Architecture:** Part A — `useTaskQueue`'s `result` handler races the callback POST against a bounded timeout so `onTaskComplete` (and the `isRunning` release) always fires. Part B — `arpg-vertical-slice-sp-b.spec.ts` is rewritten from 2 chained chunk tests into 10 isolated per-step `test()` blocks generated from a `STEPS` array; each test gets a fresh Playwright page, so no chained-`isRunning` collision is possible and no single test can hang the whole run.

**Tech Stack:** React 19, TypeScript, Playwright, the PoF CLI terminal subsystem.

**Spec:** `docs/superpowers/specs/2026-05-21-sp-b-single-dispatch-rework-design.md`

---

## Planning-time facts (verified)

1. **`useTaskQueue.ts` `result` handler** (lines 310-338): builds `cbPromise` (`resolveCallback(...).then(...)` or `Promise.resolve()` — type `Promise<void>`, never rejects — `resolveCallback` returns `{success,error}` and does not throw), then `cbPromise.finally(() => { if (currentTaskIdRef.current) { registerTaskComplete(...); onTaskComplete?.(...); } })`. `onTaskComplete` is what releases `session.isRunning`.

2. **`UI_TIMEOUTS`** (`constants.ts:62-`) — a flat object of ms constants. The new `callbackSettleMax` is added alongside `terminalReadyFallback`.

3. **Current SP-B spec** `e2e/arpg-vertical-slice-sp-b.spec.ts`: 2 `test()` blocks ("chunk 1", "chunk 2") that chain steps in one page. It already defines `enterWorkspace`, `runLiveStep`, `dispatchStep` and the step-15/16 inline logic — all reused by the rewrite. Helpers `dispatchRoadmapChecklistItem`, `verifyExpectedArtifacts`, `openSidebarCategory` (and types `RoadmapDispatchTarget`, `ArtifactExpectation`) are exported from `e2e/helpers/dispatch-helpers.ts`; `setupHarnessMode`, `waitForCliComplete`, `completeSetupWizard`, `resetProgressForTestProject`, `HarnessHandle` from `e2e/helpers/harness-mode.ts`.

4. **Playwright** gives each `test()` a fresh browser context/page by default; `playwright.config.ts` runs `workers: 1` (tests sequential, file order). `--grep` filters by test title.

5. The dispatch-helpers Send-click workaround is `HARNESS_MODE==='live'`-gated, so stub runs are unaffected. All four gameplay modules (arpg-combat, arpg-enemy-ai, arpg-loot, arpg-ui) sit under sidebar category `core-engine`.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/constants.ts` | Modify | Add `UI_TIMEOUTS.callbackSettleMax` |
| `src/components/cli/useTaskQueue.ts` | Modify | Layer-6: race the callback POST against the timeout |
| `e2e/arpg-vertical-slice-sp-b.spec.ts` | Rewrite | 10 isolated per-step `test()` blocks via a `STEPS` loop |
| `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-*.md` | Generated | Per-step + aggregated findings |

Total: **2 modified, 1 rewritten, ~4 commits.**

---

## Task 1: Layer-6 fix — bounded callback settle

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/cli/useTaskQueue.ts`

- [ ] **Step 1: Add the `callbackSettleMax` constant**

Use the Edit tool on `src/lib/constants.ts`. Replace:
```typescript
  /** Safety fallback: dispatch a CLI prompt anyway if the terminal never
   *  announces readiness (loud-failure backstop, not the normal path). */
  terminalReadyFallback: 5000,
```
with:
```typescript
  /** Safety fallback: dispatch a CLI prompt anyway if the terminal never
   *  announces readiness (loud-failure backstop, not the normal path). */
  terminalReadyFallback: 5000,
  /** Max time the result handler waits for the callback POST before firing
   *  onTaskComplete anyway — bounds a hung POST so session.isRunning is always
   *  released (a ceiling; a healthy POST settles well within it). */
  callbackSettleMax: 10000,
```

- [ ] **Step 2: Race the callback POST against the timeout in the `result` handler**

Use the Edit tool on `src/components/cli/useTaskQueue.ts`. Replace:
```typescript
        assistantOutputRef.current = '';

        cbPromise.finally(() => {
          const tid = currentTaskIdRef.current;
          if (tid) {
            registerTaskComplete(tid, instanceId, !data.isError);
            onTaskComplete?.(tid, !data.isError);
          }
        });

        break;
```
with:
```typescript
        assistantOutputRef.current = '';

        // Complete the task once the callback POST settles — but never wait on
        // it indefinitely. resolveCallback's POST can hang; gating onTaskComplete
        // on it alone strands session.isRunning forever (the SP-B chunk-1 run #4
        // hang). Race it against callbackSettleMax so the completion — and the
        // isRunning release — always fires within a bounded window.
        Promise.race([
          cbPromise,
          new Promise<void>((resolve) => setTimeout(resolve, UI_TIMEOUTS.callbackSettleMax)),
        ]).finally(() => {
          const tid = currentTaskIdRef.current;
          if (tid) {
            registerTaskComplete(tid, instanceId, !data.isError);
            onTaskComplete?.(tid, !data.isError);
          }
        });

        break;
```

- [ ] **Step 3: Validate**

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Expected: `tsc` clean (`UI_TIMEOUTS` is already imported in `useTaskQueue.ts`); `lint` 0 errors, no new warnings; `vitest` suite all green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/components/cli/useTaskQueue.ts
git commit -m "$(cat <<'EOF'
fix(cli): bound the callback-POST wait so isRunning always releases

useTaskQueue's result handler fired onTaskComplete (which releases
session.isRunning) only after the callback POST promise settled. When that POST
hangs, onTaskComplete never runs and isRunning is stuck true forever — SP-B
chunk-1 run #4: acb-1 reached "Done" but combat's isRunning stayed set, hanging
the next same-module step.

The callback POST is now raced against UI_TIMEOUTS.callbackSettleMax (10s): a
healthy POST still settles first (data-in-DB-before-complete intent preserved),
but a hung POST can no longer strand the session — the completion fires within
a bounded window regardless.

Spec: docs/superpowers/specs/2026-05-21-sp-b-single-dispatch-rework-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 2: Rewrite the SP-B spec — 10 isolated per-step tests

**Files:**
- Rewrite: `e2e/arpg-vertical-slice-sp-b.spec.ts`

- [ ] **Step 1: Replace the spec file**

Use the Write tool to overwrite `e2e/arpg-vertical-slice-sp-b.spec.ts` with exactly this content:

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
  openSidebarCategory,
  type RoadmapDispatchTarget,
  type ArtifactExpectation,
} from './helpers/dispatch-helpers';

const PROJECT_PATH = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const SRC = join(PROJECT_PATH, 'Source');
const STEP_TIMEOUT_MS = 10 * 60_000;

type StepOutcome = { success: boolean; durationMs: number; timedOut: boolean; notes?: string };

/**
 * Single-dispatch SP-B. Each step is rendered as its own isolated Playwright
 * test (a fresh page), so every dispatch runs alone — no chained session-state
 * collision is possible, and no single test can hang the whole run. Test titles
 * carry a "chunk 1"/"chunk 2" tag for --grep grouping.
 */
type SpbStep =
  | { kind: 'dispatch'; findingsId: string; title: string; target: RoadmapDispatchTarget; liveExpectations: ArtifactExpectation[] }
  | { kind: 'feature-matrix'; findingsId: string; title: string }
  | { kind: 'evaluator'; findingsId: string; title: string };

/** All four gameplay modules sit under the core-engine sidebar category. */
function dispatchTarget(moduleId: string, itemId: string, sessionLabel: string): RoadmapDispatchTarget {
  return {
    categoryTestId: 'pof-sidebar-nav-item-core-engine',
    moduleTestId: `pof-sidebar-l2-nav-item-${moduleId}`,
    moduleId,
    itemId,
    sessionLabel,
  };
}

const STEPS: SpbStep[] = [
  {
    kind: 'dispatch', findingsId: 'acb-1',
    title: 'SP-B chunk 1 — Step 11a acb-1: Create melee attack ability',
    target: dispatchTarget('arpg-combat', 'acb-1', 'combat-acb-1'),
    liveExpectations: [{ label: 'GA_MeleeAttack ability', fileNameContains: 'MeleeAttack', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'acb-4',
    title: 'SP-B chunk 1 — Step 11b acb-4: Apply damage via GAS',
    target: dispatchTarget('arpg-combat', 'acb-4', 'combat-acb-4'),
    liveExpectations: [{ label: 'GE_Damage / damage application', fileNameContains: 'Damage', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'ae-2',
    title: 'SP-B chunk 1 — Step 12 ae-2: Create enemy character base',
    target: dispatchTarget('arpg-enemy-ai', 'ae-2', 'enemy-ae-2'),
    liveExpectations: [{ label: 'ARPGEnemyCharacter class', fileNameContains: 'EnemyCharacter', searchRoot: SRC, mustContain: 'UAbilitySystemComponent' }],
  },
  {
    kind: 'dispatch', findingsId: 'al-5',
    title: 'SP-B chunk 2 — Step 13a al-5: Loot drop on death',
    target: dispatchTarget('arpg-loot', 'al-5', 'loot-al-5'),
    liveExpectations: [{ label: 'AARPGWorldItem (loot drop)', fileNameContains: 'WorldItem', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'al-6',
    title: 'SP-B chunk 2 — Step 13b al-6: Item pickup (overlap-destroy)',
    target: dispatchTarget('arpg-loot', 'al-6', 'loot-al-6'),
    liveExpectations: [{ label: 'AARPGWorldItem pickup overlap', fileNameContains: 'WorldItem', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'au-1',
    title: 'SP-B chunk 2 — Step 14a au-1: Set up HUD framework',
    target: dispatchTarget('arpg-ui', 'au-1', 'ui-au-1'),
    liveExpectations: [{ label: 'HUD widget', fileNameContains: 'HUD', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'au-2',
    title: 'SP-B chunk 2 — Step 14b au-2: Bind HUD to GAS attributes',
    target: dispatchTarget('arpg-ui', 'au-2', 'ui-au-2'),
    liveExpectations: [{ label: 'HUD widget (GAS-bound)', fileNameContains: 'HUD', searchRoot: SRC }],
  },
  {
    kind: 'dispatch', findingsId: 'au-7',
    title: 'SP-B chunk 2 — Step 14c au-7: Floating damage numbers',
    target: dispatchTarget('arpg-ui', 'au-7', 'ui-au-7'),
    liveExpectations: [{ label: 'Floating damage number widget', fileNameContains: 'DamageNumber', searchRoot: SRC }],
  },
  { kind: 'feature-matrix', findingsId: 'feature-matrix', title: 'SP-B chunk 2 — Step 15: Feature-matrix scan (arpg-combat)' },
  { kind: 'evaluator', findingsId: 'evaluator', title: 'SP-B chunk 2 — Step 16: Evaluator deep-eval' },
];

async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);
}

/** Run one labelled step: execute body, drain dispatches, record the result. */
async function runLiveStep(
  harness: HarnessHandle,
  page: Page,
  label: string,
  body: () => Promise<StepOutcome>,
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

/** A RoadmapChecklist dispatch + live artifact check. */
async function dispatchStep(
  harness: HarnessHandle,
  page: Page,
  target: RoadmapDispatchTarget,
  liveExpectations: ArtifactExpectation[],
): Promise<StepOutcome> {
  const result = await dispatchRoadmapChecklistItem(page, target, STEP_TIMEOUT_MS);
  if (harness.mode !== 'live') {
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

/** Step 15 — feature-matrix scan. INFORMATIONAL: always records pass. */
async function featureMatrixStep(page: Page): Promise<StepOutcome> {
  const start = Date.now();
  await openSidebarCategory(page, 'pof-sidebar-nav-item-core-engine');
  await page.getByTestId('pof-sidebar-l2-nav-item-arpg-combat').click();
  const scanBtn = page.getByTestId('pof-feature-matrix-scan-btn');
  if ((await scanBtn.count()) === 0) {
    return { success: true, durationMs: Date.now() - start, timedOut: false, notes: 'INFO: pof-feature-matrix-scan-btn not located — feature-matrix scan skipped' };
  }
  await scanBtn.first().click();
  const result = await waitForCliComplete(page, 'feature-matrix-scan', STEP_TIMEOUT_MS);
  return { success: true, durationMs: result.durationMs, timedOut: false, notes: 'INFO (feature-matrix scan): ' + (result.outputExcerpt ?? '') };
}

/** Step 16 — evaluator deep-eval. INFORMATIONAL: always records pass. */
async function evaluatorStep(page: Page): Promise<StepOutcome> {
  const start = Date.now();
  await openSidebarCategory(page, 'pof-sidebar-nav-item-evaluator');
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
}

test.describe('ARPG vertical slice — SP-B gameplay chain (single-dispatch)', () => {
  test.beforeEach(async ({ page }) => {
    // Reset PoF-side checklist progress so a prior step's completed item does
    // not hide another item's "Claude" button.
    await resetProgressForTestProject(page);
  });

  for (const step of STEPS) {
    test(step.title, async ({ page }) => {
      test.setTimeout(12 * 60_000);
      const harness = await setupHarnessMode(page);
      try {
        await runLiveStep(harness, page, step.title, async () => {
          await enterWorkspace(page);
          if (step.kind === 'dispatch') {
            return dispatchStep(harness, page, step.target, step.liveExpectations);
          }
          if (step.kind === 'feature-matrix') {
            return featureMatrixStep(page);
          }
          return evaluatorStep(page);
        });
      } finally {
        await harness.writeFindings({ filenameSuffix: `sp-b-${step.findingsId}` });
      }
    });
  }
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Run the spec in STUB mode — wiring gate for all 10 tests**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --reporter=list
```
(No `HARNESS_MODE` → stub.) Expected: **10 passed.** Each test is one isolated step; in stub mode `waitForCliComplete` short-circuits and artifact checks are skipped, so every step should record `pass` — proving navigation + the dispatch-trigger wiring for all 10.

If a step fails, the failure note names the missing locator. Fix it in the spec file, verifying the real value against `src/components/modules/` / `src/lib/module-registry.ts` / the sidebar components. Do NOT weaken the spec. Re-run until all 10 pass.

- [ ] **Step 4: Lint**

```bash
npm run lint
```
Expected: 0 errors; no new warnings in the spec file.

- [ ] **Step 5: Commit**

```bash
git add e2e/arpg-vertical-slice-sp-b.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): SP-B single-dispatch rework — one isolated test per step

Replaces the two chained chunk tests with 10 isolated per-step test() blocks
generated from a STEPS array (8 gameplay dispatches + 2 informational). Each
test runs in a fresh Playwright page, so every dispatch runs alone — the
chained-isRunning-collision class that failed four chunk-1 runs is structurally
eliminated, and no single test can hang the whole run (each is bounded at
12 min and fails only itself). Test titles keep a "chunk 1"/"chunk 2" tag for
--grep grouping. Stub run passes all 10.

Spec: docs/superpowers/specs/2026-05-21-sp-b-single-dispatch-rework-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

---

## Task 3: Chunk 1 live run — combat + enemy, isolated (CONTROLLER-DRIVEN)

> **Controller-driven.** Step 4 launches a live process; run it via the Bash tool with `run_in_background: true`. Do NOT start the live run until the Step 1 gate holds.

**Files:**
- Generated: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-{acb-1,acb-4,ae-2}.md`

- [ ] **Step 1: Confirm the gate**

```bash
git log --oneline -3
npx tsc --noEmit
PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --reporter=list
```
Expected: Task 1 + Task 2 commits present; `tsc` clean; the stub run passes all 10. Also confirm the Claude CLI is healthy: `claude --version` returns a version cleanly. If any fails, STOP.

- [ ] **Step 2: Apply the keep-awake pre-flight**

```bash
powershell -Command "powercfg /change standby-timeout-ac 0; powercfg /change monitor-timeout-ac 0"
```

- [ ] **Step 3: Confirm the dev server on 3010**

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: `200`.

- [ ] **Step 4: Fire chunk 1 live (background)**

Run via the Bash tool with `run_in_background: true` and `timeout: 2700000` (45 min — 3 isolated tests, each capped at 12 min):
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --grep "chunk 1" --reporter=list
```

- [ ] **Step 5: Wait for the completion notification**

Do not poll. When notified, read the task output — per-test pass/fail for acb-1, acb-4, ae-2.

- [ ] **Step 6: Read the per-step findings**

The three steps wrote `2026-05-21-live-sp-b-acb-1.md`, `-acb-4.md`, `-ae-2.md` in `docs/features/arpg-vertical-slice/scenario-runs/`. Read each — note status, dispatch count, and the artifact-check lines.

- [ ] **Step 7: Artifact-inspection checkpoint**

For acb-1 / acb-4 / ae-2, confirm from the findings (and, if needed, by listing `C:\Users\kazda\Documents\Unreal Projects\PoF\Source`) what files were produced. If a step recorded `fail` only because `verifyExpectedArtifacts` searched for the wrong `fileNameContains` substring (the file exists under another name), correct that step's `liveExpectations` in `e2e/arpg-vertical-slice-sp-b.spec.ts` and commit `fix(e2e): SP-B — correct chunk-1 artifact expectations`. If a step's dispatch genuinely failed (CLI error/timeout), record that as the real outcome — and note that with isolated tests, the other two steps still ran regardless.

- [ ] **Step 8: Aggregate + commit chunk-1 findings**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk1-summary.md` with a `## SP-B chunk 1 (single-dispatch) — combat + enemy` section: per-step outcome (acb-1/acb-4/ae-2 — dispatched? artifact-verified?), whether the isolation held (no chained hang — acb-1 and acb-4 are the same module but separate isolated tests; confirm acb-4 was not blocked), total dispatch count across the 3 runs, any artifact-expectation corrections, and readiness for chunk 2. Then:
```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-acb-1.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-acb-4.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-ae-2.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk1-summary.md
git commit -m "$(cat <<'EOF'
docs(features): SP-B chunk 1 single-dispatch live-run findings

[One paragraph from the actual run: acb-1/acb-4/ae-2 outcomes, whether isolated
 same-module dispatch worked (no chained hang), dispatch count, any artifact
 corrections, readiness for chunk 2.]

Spec: docs/superpowers/specs/2026-05-21-sp-b-single-dispatch-rework-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```
Substitute `[One paragraph...]` with the actual outcome. (If Step 7 corrected the spec, that commit is separate and precedes this one.)

---

## Task 4: Chunk 2 live run — loot + UI + verification, isolated (CONTROLLER-DRIVEN)

> **Controller-driven.** Same pattern as Task 3. Start only after Task 3's chunk-1 findings are committed and the foundation was judged sound.

**Files:**
- Generated: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-{al-5,al-6,au-1,au-2,au-7,feature-matrix,evaluator}.md`

- [ ] **Step 1: Confirm the gate + keep-awake**

```bash
git log --oneline -3
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://localhost:3010
```
Expected: Task 3's findings commit present; server `200`. Re-apply keep-awake if the session is fresh:
```bash
powershell -Command "powercfg /change standby-timeout-ac 0; powercfg /change monitor-timeout-ac 0"
```

- [ ] **Step 2: Fire chunk 2 live (background)**

Run via the Bash tool with `run_in_background: true` and `timeout: 5400000` (90 min — 7 isolated tests, each capped at 12 min):
```bash
HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-sp-b.spec.ts --grep "chunk 2" --reporter=list
```

- [ ] **Step 3: Wait for the completion notification**

Do not poll. When notified, read the final output.

- [ ] **Step 4: Read the per-step findings**

Read the 7 `2026-05-21-live-sp-b-{al-5,al-6,au-1,au-2,au-7,feature-matrix,evaluator}.md` files — per-step outcomes for the 5 loot/UI dispatches and the 2 informational steps.

- [ ] **Step 5: Path-correction check (if needed)**

As in Task 3 Step 7: if a loot/UI step recorded `fail` only due to a wrong `fileNameContains`, correct its `liveExpectations` and commit `fix(e2e): SP-B — correct chunk-2 artifact expectations`.

- [ ] **Step 6: Aggregate + commit chunk-2 findings**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk2-summary.md` — `## SP-B chunk 2 (single-dispatch)` section: per-step outcome for the 5 dispatch steps, the feature-matrix + evaluator informational results, total dispatch count, and an initiative-level note (after SP-B the gameplay systems are generated; only packaging SP-C and PIE verification SP-E remain). Then:
```bash
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-al-5.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-al-6.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-au-1.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-au-2.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-au-7.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-feature-matrix.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-evaluator.md docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk2-summary.md
git commit -m "$(cat <<'EOF'
docs(features): SP-B chunk 2 single-dispatch live-run findings

[One paragraph from the actual run: al-5/al-6/au-1/au-2/au-7 outcomes,
 feature-matrix + evaluator signals, dispatch count, initiative status.]

Spec: docs/superpowers/specs/2026-05-21-sp-b-single-dispatch-rework-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

- [ ] **Step 7: Final chat summary**

Post a single message with the commit SHAs and per-step results:
```
SP-B (single-dispatch) complete. Commits:
- <SHA_T1>       fix(cli): bound the callback-POST wait
- <SHA_T2>       test(e2e): SP-B single-dispatch rework
- <SHA_CHUNK1>   docs(features): SP-B chunk 1 findings
- <SHA_CHUNK2>   docs(features): SP-B chunk 2 findings
  (+ any fix(e2e) artifact-expectation corrections)

Stub run: 10/10 green.
Chunk 1 (isolated): acb-1 [..], acb-4 [..], ae-2 [..] — chained-hang eliminated: [..]
Chunk 2 (isolated): al-5 [..], al-6 [..], au-1 [..], au-2 [..], au-7 [..]
Informational: feature-matrix [..], evaluator [..]

Initiative status: [gameplay systems generated / next is SP-C packaging].
Recommend refreshing SCENARIO-REPORT.md before SP-C.
```

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Part A (layer-6 race) → Task 1. Part B (10 isolated `test()` via `STEPS` loop, fresh page, bounded, `chunk` tags, per-step findings) → Task 2's rewritten file. "stub run all 10" → Task 2 Step 3. "gated live: chunk 1 then chunk 2, artifact checkpoint" → Tasks 3 & 4 (Task 3 Step 7 is the checkpoint). Spec DoD 1-5 all map.
- [x] **Placeholder scan:** the only bracketed text is `[One paragraph...]` in Task 3/4 commit messages and `<SHA_*>` / `[..]` in Task 4's summary — explicit runtime substitutions, each labelled "from the actual run". Task 2's spec file and Task 1's edits show complete code.
- [x] **Type consistency:** `SpbStep` discriminated union (`kind: 'dispatch'|'feature-matrix'|'evaluator'`) is matched by the `STEPS` entries and the loop's `if (step.kind === ...)` branches. `StepOutcome` is the return type of `dispatchStep`/`featureMatrixStep`/`evaluatorStep` and the `body` of `runLiveStep`. `dispatchTarget` returns `RoadmapDispatchTarget` (fields match `dispatch-helpers.ts`). `ArtifactExpectation` fields (`label`, `fileNameContains`, `searchRoot`, `mustContain?`) match. `harness.mode`, `setupHarnessMode`, `waitForCliComplete`, `completeSetupWizard`, `resetProgressForTestProject`, `writeFindings` all match `harness-mode.ts` exports. `UI_TIMEOUTS.callbackSettleMax` defined in Task 1 Step 1, used in Task 1 Step 2.
- [x] **Isolation correctness:** each `test()` gets a fresh page (Playwright default); `beforeEach` resets PoF progress; `test.setTimeout(12min)` bounds each; a failed test fails only itself (Playwright continues). No single 40-min test exists.
- [x] **Stub/live duality:** `dispatchStep` branches on `harness.mode`; the stub run skips artifact checks → 10 green proves wiring. Spec does not assert `HARNESS_MODE=live` (runs in both).
- [x] **Bite-sized + controller-driven flagged:** T1 = 4 steps, T2 = 5, T3 = 8, T4 = 7. T3/T4 headers + background-run steps say `run_in_background: true` with timeouts.
