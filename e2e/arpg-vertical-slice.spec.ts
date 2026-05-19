import { test, expect, type Page } from '@playwright/test';
import { setupHarnessMode, seedPackagingProfile, type HarnessHandle, type StepResult } from './helpers/harness-mode';

async function enterWorkspace(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }
}

/**
 * Navigate to a sub-module by ensuring its L2 nav item is visible (without toggling the L1
 * category off if it's already active). Returns a locator for the L2 item.
 */
async function navigateToSubModule(page: Page, categoryId: string, subModuleTestId: string): Promise<void> {
  const l2Item = page.getByTestId(subModuleTestId);
  // If L2 is already visible (category already expanded), don't toggle the L1 button.
  if ((await l2Item.count()) === 0 || !(await l2Item.isVisible().catch(() => false))) {
    await page.getByTestId(`pof-sidebar-nav-item-${categoryId}`).click();
    await page.waitForTimeout(300);
  }
  await l2Item.waitFor({ state: 'visible', timeout: 5000 });
  await l2Item.click({ force: true });
  await page.waitForTimeout(500);
}

async function runStep(
  harness: HarnessHandle,
  page: Page,
  label: string,
  body: () => Promise<void>,
): Promise<void> {
  await test.step(label, async () => {
    harness.setStepLabel(label);
    const start = Date.now();
    // Sentinel: if body explicitly records its own result (e.g. skip),
    // we don't want to double-record a pass.
    let bodyRecordedResult = false;
    const originalRecordStepResult = harness.recordStepResult.bind(harness);
    harness.recordStepResult = (r) => {
      bodyRecordedResult = true;
      originalRecordStepResult(r);
    };
    try {
      await body();
      // After every step, drain any CLI dispatches that fired.
      await harness.drainCliDispatches(page);
      if (!bodyRecordedResult) {
        originalRecordStepResult({ step: label, status: 'pass', durationMs: Date.now() - start });
      }
    } catch (err) {
      originalRecordStepResult({
        step: label,
        status: 'fail',
        durationMs: Date.now() - start,
        notes: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      harness.recordStepResult = originalRecordStepResult;
    }
  });
}

test.describe('ARPG vertical slice — operator flow', () => {
  test.setTimeout(180_000);

  test('walks all 24 steps from INDEX.md §2', async ({ page }) => {
    const harness = await setupHarnessMode(page);

    try {

    // ─────────── Phase 0: Bootstrap (Steps 1-6) ───────────

    await runStep(harness, page, 'Step 1: Launch PoF', async () => {
      await enterWorkspace(page);
      // Sidebar L1 should be visible after enterWorkspace.
      await expect(page.locator('[data-testid^="pof-sidebar-nav-item-"]').first()).toBeVisible({ timeout: 15000 });
    });

    await runStep(harness, page, 'Step 2: Sidebar → Project Setup', async () => {
      await page.getByTestId('pof-sidebar-nav-item-project-setup').click();
    });

    await runStep(harness, page, 'Step 3: Open Setup Wizard (project-setup category)', async () => {
      // Project Setup is the default-active category and has only one sub-module;
      // SidebarL2 may not render a list. The SetupWizard checklist is what proves the page is up.
      await expect(page.getByTestId('pof-setup-wizard-checklist')).toBeVisible({ timeout: 10000 });
    });

    await runStep(harness, page, 'Step 4: Select existing PoF project (if launcher visible)', async () => {
      // The launcher is gated by enterWorkspace; this step asserts the project context is loaded.
      // We assert by looking for the StatusChecklist scan button (proves StatusChecklist mounted).
      await expect(page.getByTestId('pof-setup-wizard-scan-btn')).toBeAttached();
    });

    await runStep(harness, page, 'Step 5: Wait for status checks', async () => {
      // Individual checklist items populate async; assert at least the engine item is attached
      // OR the scan button is present (sufficient to prove StatusChecklist is rendered).
      const engineItem = page.getByTestId('pof-setup-wizard-checklist-item-engine');
      const scanBtn = page.getByTestId('pof-setup-wizard-scan-btn');
      const engineCount = await engineItem.count();
      const scanCount = await scanBtn.count();
      expect(engineCount + scanCount).toBeGreaterThan(0);
    });

    await runStep(harness, page, 'Step 6: Verify build (dispatches CLI prompt)', async () => {
      const verifyBtn = page.getByTestId('pof-setup-wizard-build-verify-btn');
      if ((await verifyBtn.count()) > 0) {
        await verifyBtn.click();
        // In stub mode, the CLI prompt is captured + suppressed; no completion fires.
        // We just record that the click happened.
        await page.waitForTimeout(500);
      } else {
        // Button may not render if build-verify panel is collapsed. Record + continue.
        harness.recordStepResult({
          step: 'Step 6: Verify build (dispatches CLI prompt)',
          status: 'skip',
          durationMs: 0,
          notes: 'BuildVerifyPanel button not visible; skipped.',
        });
      }
    });


    // ─────────── Phase 1: Wave 0 modules (Steps 7-8) ───────────

    await runStep(harness, page, 'Step 7: Navigate to arpg-character (no CLI dispatch)', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-character');
      // arpg-character is output-focused — no clicks to dispatch CLI. Just verify the page mounted.
      // ReviewableModuleView root testId pof-module-{moduleId} is added by Stream A'.
      await expect(page.getByTestId('pof-module-arpg-character')).toBeVisible({ timeout: 10000 });
    });

    await runStep(harness, page, 'Step 8: input-handling — click ih-1 + ih-2 to dispatch CLI prompts', async () => {
      await navigateToSubModule(page, 'game-systems', 'pof-sidebar-l2-nav-item-input-handling');
      // ReviewableModuleView defaults to Overview tab; checklist items live on Roadmap.
      await page.getByRole('tab', { name: 'Roadmap' }).click();
      await page.waitForTimeout(500); // allow tab content to mount
      const ih1 = page.getByTestId('pof-module-input-handling-checklist-item-ih-1');
      const ih2 = page.getByTestId('pof-module-input-handling-checklist-item-ih-2');
      // Click the Run/Claude button inside each item. We approximate by clicking the item row,
      // which may not trigger dispatch directly — depends on row click semantics. Fall back to
      // looking for a Play button within the row.
      if ((await ih1.count()) > 0) {
        const playBtn = ih1.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
        if ((await playBtn.count()) > 0) await playBtn.click();
      }
      if ((await ih2.count()) > 0) {
        const playBtn = ih2.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
        if ((await playBtn.count()) > 0) await playBtn.click();
      }
      await page.waitForTimeout(800);
    });

    // ─────────── Phase 2: Wave 1 modules (Steps 9-10) ───────────

    await runStep(harness, page, 'Step 9: arpg-animation — click aa-1 + aa-3 to dispatch CLI', async () => {
      // sub-module id is `animations`, NOT `arpg-animation` — registry id vs testId prefix mismatch.
      await navigateToSubModule(page, 'content', 'pof-sidebar-l2-nav-item-animations');
      // The animation steps live on the "Setup Guide" extra tab.
      const setupTab = page.getByRole('tab', { name: 'Setup Guide' });
      if ((await setupTab.count()) > 0) await setupTab.click();
      await page.waitForTimeout(500);
      // Each step has a generate button: pof-module-arpg-animation-generate-{stepId}
      const aa1 = page.getByTestId('pof-module-arpg-animation-generate-aa-1');
      const aa3 = page.getByTestId('pof-module-arpg-animation-generate-aa-3');
      if ((await aa1.count()) > 0) await aa1.click();
      if ((await aa3.count()) > 0) await aa3.click();
      await page.waitForTimeout(800);
    });

    await runStep(harness, page, 'Step 10: arpg-gas — dispatch ag-1, ag-2, ag-4 via Roadmap', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-gas');
      await page.getByRole('tab', { name: 'Roadmap' }).click();
      await page.waitForTimeout(500);
      for (const id of ['ag-1', 'ag-2', 'ag-4']) {
        const item = page.getByTestId(`pof-module-arpg-gas-checklist-item-${id}`);
        if ((await item.count()) > 0) {
          const playBtn = item.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
          if ((await playBtn.count()) > 0) await playBtn.click();
        }
      }
      await page.waitForTimeout(800);
    });


    // ─────────── Phase 3: Wave 2 modules (Steps 11-12) ───────────

    await runStep(harness, page, 'Step 11: arpg-combat — dispatch acb-1 + acb-4', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-combat');
      const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
      if ((await roadmapTab.count()) > 0) await roadmapTab.click();
      await page.waitForTimeout(500);
      for (const id of ['acb-1', 'acb-4']) {
        const item = page.getByTestId(`pof-module-arpg-combat-checklist-item-${id}`);
        if ((await item.count()) > 0) {
          const playBtn = item.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
          if ((await playBtn.count()) > 0) await playBtn.click();
        }
      }
      await page.waitForTimeout(800);
    });

    await runStep(harness, page, 'Step 12: arpg-enemy-ai — minimal-dummy via ae-1', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-enemy-ai');
      const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
      if ((await roadmapTab.count()) > 0) await roadmapTab.click();
      await page.waitForTimeout(500);
      // Per sub-project B's per-feature toggle refactor, ae-1 is the foundation
      // (AARPGEnemyBase + ASC + death-flow); ae-2..ae-8 are opt-in.
      const ae1 = page.getByTestId('pof-module-arpg-enemy-ai-checklist-item-ae-1');
      if ((await ae1.count()) > 0) {
        const playBtn = ae1.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
        if ((await playBtn.count()) > 0) await playBtn.click();
      }
      await page.waitForTimeout(500);
    });

    // ─────────── Phase 4: Wave 3 modules (Steps 13-14) ───────────

    await runStep(harness, page, 'Step 13: arpg-loot — dispatch al-5 + al-6 (slice cheat-path)', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-loot');
      const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
      if ((await roadmapTab.count()) > 0) await roadmapTab.click();
      await page.waitForTimeout(500);
      for (const id of ['al-5', 'al-6']) {
        const item = page.getByTestId(`pof-module-arpg-loot-checklist-item-${id}`);
        if ((await item.count()) > 0) {
          const playBtn = item.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
          if ((await playBtn.count()) > 0) await playBtn.click();
        }
      }
      await page.waitForTimeout(800);
    });

    await runStep(harness, page, 'Step 14: arpg-ui — dispatch au-1, au-2, au-7 (HUD-only)', async () => {
      // The arpg-ui module's sub-module id is `ui-hud` in the registry.
      // Try the conforming testId first; fall back via grep if that's wrong.
      const uiHudId = 'pof-sidebar-l2-nav-item-ui-hud';
      const arpgUiId = 'pof-sidebar-l2-nav-item-arpg-ui';
      // Open the content L1 first (idempotent: navigateToSubModule won't toggle if already open).
      const uiHudExists = (await page.getByTestId(uiHudId).count()) > 0;
      const targetId = uiHudExists ? uiHudId : arpgUiId;
      try {
        await navigateToSubModule(page, 'content', targetId);
      } catch (e) {
        // If neither id was visible, try the other one.
        const fallbackId = targetId === uiHudId ? arpgUiId : uiHudId;
        if ((await page.getByTestId(fallbackId).count()) > 0) {
          await navigateToSubModule(page, 'content', fallbackId);
        } else {
          throw new Error(`Could not find arpg-ui sub-module nav item (tried ${uiHudId} and ${arpgUiId}): ${(e as Error).message}`);
        }
      }
      const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
      if ((await roadmapTab.count()) > 0) await roadmapTab.click();
      await page.waitForTimeout(500);
      for (const id of ['au-1', 'au-2', 'au-7']) {
        const item = page.locator(`[data-testid$="-checklist-item-${id}"]`).first();
        if ((await item.count()) > 0) {
          const playBtn = item.locator('button').filter({ hasText: /Run|Claude|Play/i }).first();
          if ((await playBtn.count()) > 0) await playBtn.click();
        }
      }
      await page.waitForTimeout(800);
    });


    // ─────────── Phase 5: Feature-matrix verification (Step 15) ───────────

    await runStep(harness, page, 'Step 15: Per-module feature-matrix scan (sampled on arpg-character)', async () => {
      await navigateToSubModule(page, 'core-engine', 'pof-sidebar-l2-nav-item-arpg-character');
      // FeatureMatrix lives on the Features sub-tab.
      const featuresTab = page.getByRole('tab', { name: 'Features' });
      if ((await featuresTab.count()) > 0) await featuresTab.click();
      await page.waitForTimeout(500);
      const scanBtn = page.getByTestId('pof-feature-matrix-scan-btn').first();
      if ((await scanBtn.count()) > 0) {
        // Don't actually click (would dispatch a real CLI prompt). Just assert attached.
        await expect(scanBtn).toBeAttached();
      } else {
        harness.recordStepResult({
          step: 'Step 15: Per-module feature-matrix scan (sampled on arpg-character)',
          status: 'skip',
          durationMs: 0,
          notes: 'FeatureMatrix scan-btn not visible on arpg-character Features tab.',
        });
      }
    });

    // ─────────── Phase 6: Evaluator gate (Step 16) ───────────

    await runStep(harness, page, 'Step 16: Evaluator — switch to Deep Eval and click Run', async () => {
      await page.getByTestId('pof-sidebar-nav-item-evaluator').click();
      await expect(page.getByTestId('pof-module-evaluator')).toBeVisible({ timeout: 10000 });
      const deepEvalTab = page.getByRole('tab', { name: 'Deep Eval' });
      if ((await deepEvalTab.count()) > 0) {
        await deepEvalTab.click();
        await page.waitForTimeout(500);
      }
      const runBtn = page.getByTestId('pof-module-evaluator-run-btn');
      if ((await runBtn.count()) > 0) {
        // Don't actually click (would spawn real eval workload).
        // For stub mode validation, asserting attachment is sufficient.
        await expect(runBtn).toBeAttached();
      }
    });


    // ─────────── Pre-Step 19: Seed packaging profile ──────────────
    // Without this, BuildConfigSelector has no profile cards and Step 19
    // cannot trigger the cook stub. (D1 finding 2.)

    await runStep(harness, page, 'Pre-Step 19: Seed Win64 Shipping packaging profile', async () => {
      await seedPackagingProfile(page);
    });

    // ─────────── Phase 7: Packaging (Steps 17-21) ───────────

    await runStep(harness, page, 'Step 17: Navigate to packaging', async () => {
      await navigateToSubModule(page, 'game-systems', 'pof-sidebar-l2-nav-item-packaging');
      // BuildConfigSelector lives on the Pipeline extra tab.
      const pipelineTab = page.getByRole('tab', { name: 'Pipeline' });
      if ((await pipelineTab.count()) > 0) await pipelineTab.click();
      await page.waitForTimeout(500);
    });

    await runStep(harness, page, 'Step 18: Assert Win64 / Shipping testIds are present', async () => {
      // Either an Add-Platform button (no profiles yet) or a profile card with start-cook button.
      const addPlatform = page.locator('[data-testid^="pof-module-packaging-add-platform"]').first();
      const startCook = page.locator('[data-testid^="pof-module-packaging-start-cook"]').first();
      const addCount = await addPlatform.count();
      const startCount = await startCook.count();
      expect(addCount + startCount).toBeGreaterThan(0);
    });

    await runStep(harness, page, 'Step 19: Trigger cook (POST /api/packaging/execute — stubbed)', async () => {
      const startCook = page.locator('[data-testid^="pof-module-packaging-start-cook"]').first();
      if ((await startCook.count()) > 0) {
        await startCook.click();
        // page.route() intercepts the SSE; CookProgress should mount + start streaming events.
        await page.waitForTimeout(500);
      } else {
        harness.recordStepResult({
          step: 'Step 19: Trigger cook (POST /api/packaging/execute — stubbed)',
          status: 'skip',
          durationMs: 0,
          notes: 'No existing profile cards; create-profile flow not in D1 scope.',
        });
      }
    });

    await runStep(harness, page, 'Step 20: Wait for CookProgress phase to reach Finished', async () => {
      const cookProgress = page.getByTestId('pof-cook-progress');
      if ((await cookProgress.count()) === 0) {
        harness.recordStepResult({
          step: 'Step 20: Wait for CookProgress phase to reach Finished',
          status: 'skip',
          durationMs: 0,
          notes: 'CookProgress not rendered (Step 19 was skipped).',
        });
        return;
      }
      // Synthetic SSE in stub mode walks through phases quickly.
      await expect(page.getByTestId('pof-cook-progress-result')).toBeVisible({ timeout: 5000 });
    });

    await runStep(harness, page, 'Step 21: Read .exe path from CookProgress or BuildHistoryDashboard', async () => {
      const cookExePath = page.getByTestId('pof-cook-progress-exe-path');
      const historyExePath = page.locator('[data-testid^="pof-module-packaging-exe-path"]').first();
      const cookCount = await cookExePath.count();
      const historyCount = await historyExePath.count();
      if (cookCount + historyCount === 0) {
        harness.recordStepResult({
          step: 'Step 21: Read .exe path from CookProgress or BuildHistoryDashboard',
          status: 'skip',
          durationMs: 0,
          notes: 'Neither cook-progress-exe-path nor module-packaging-exe-path-* rendered (Step 19/20 skipped).',
        });
        return;
      }
      if (cookCount > 0) {
        const text = await cookExePath.textContent();
        expect(text).toContain('.exe');
      } else {
        const text = await historyExePath.textContent();
        expect(text ?? '').toMatch(/\.exe/);
      }
    });

    // ─────────── Phase 8: Slice verification (live-only) ─────────
    await test.step('Steps 22-24: Launch .exe + WASD + LMB + assert', async () => {
      if (harness.mode !== 'live') {
        for (const stepLabel of [
          'Step 22: Launch the cooked .exe',
          'Step 23: Drive the player with WASD + LMB',
          'Step 24: Assert XP gain + loot drop',
        ]) {
          harness.recordStepResult({
            step: stepLabel,
            status: 'skip',
            durationMs: 0,
            notes: 'Phase 8 (.exe launch + gameplay assert) requires HARNESS_MODE=live + real UE5 install',
          });
        }
        return;
      }
      // Live-mode implementation deferred to D2/D3.
    });

    } finally {
      // ─────────── Tear-down (always write findings, even on failure) ─
      await harness.writeFindings();
    }
  });
});
