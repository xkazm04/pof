import { test, expect } from '@playwright/test';
import { setupHarnessMode, completeSetupWizard } from './helpers/harness-mode';

/**
 * SP-A / Finding A: prove the build-verify button is deterministically
 * reachable. Stub mode — no live Claude. The project-setup filesystem scan is
 * NOT mocked by setupHarnessMode, so it runs for real; this requires the PoF
 * UE project on disk and at least one installed UE engine (button is
 * disabled={engines.length === 0}).
 */
test('build-verify button is reachable + enabled after the setup wizard', async ({ page }) => {
  await setupHarnessMode(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);

  await page.getByTestId('pof-sidebar-nav-item-project-setup').click();

  // Deterministic wait: the SP-A scanState signal — no blind timeout.
  await page
    .locator('[data-testid="pof-project-setup-content"][data-scan-state="settled"]')
    .waitFor({ state: 'attached', timeout: 30_000 });

  const btn = page.getByTestId('pof-setup-wizard-build-verify-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
});
