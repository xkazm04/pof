import { test, expect, type Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
import {
  setupHarnessMode,
  completeSetupWizard,
  seedPackagingProfile,
  waitForCookComplete,
} from './helpers/harness-mode';
import { openSidebarCategory } from './helpers/dispatch-helpers';

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

      await openSidebarCategory(page, 'pof-sidebar-nav-item-game-systems');
      await page.getByTestId('pof-sidebar-l2-nav-item-packaging').click();

      // Build profiles live on the packaging module's "Pipeline" tab.
      await page.getByRole('tab', { name: 'Pipeline' }).click();
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
