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
