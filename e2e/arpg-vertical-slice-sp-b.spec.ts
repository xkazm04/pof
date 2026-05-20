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
        await openSidebarCategory(page, 'pof-sidebar-nav-item-core-engine');
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
      });
    } finally {
      await harness.writeFindings({ filenameSuffix: 'sp-b-chunk2' });
    }
  });
});
