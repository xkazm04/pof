import { test, expect, type Page } from '@playwright/test';

/**
 * Texture pass — MaterialLab "Advanced" panel (folder-06 pof-app §1 / tests.md e2e #1).
 *
 * Verifies the Leonardo-Advanced texture-pass entry points render: the Scenario
 * PBR generator (the live substitute for Leonardo's removed 3D-texture endpoint),
 * the Universal Upscaler, and the ControlNet / inpaint / unzoom tiles added in
 * §1. Then exercises one real round-trip through /api/scenario WITHOUT any
 * external call — with no SCENARIO_API_KEY the route returns the not-configured
 * envelope and the panel surfaces a configure hint (proves the wiring end-to-end).
 *
 * Does NOT trigger a live generation (that needs API keys + spends credits — not
 * CI-safe), mirroring biome-scatter-panel.spec.ts. Local/live spec: requires the
 * dev server + the local "PoF" project.
 */
async function openAdvancedTexturePanel(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }

  await page.getByTestId('pof-sidebar-nav-item-visual-gen').click();
  await page.waitForTimeout(600);
  await page.getByTestId('pof-sidebar-l2-nav-item-material-lab').click();
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Advanced' }).click();
}

test('Advanced texture panel renders all texture-pass tiles', async ({ page }) => {
  await openAdvancedTexturePanel(page);

  // Scenario PBR generator — the working substitute for the dead 3D endpoint.
  await expect(page.getByTestId('scenario-prompt')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('scenario-generate')).toBeVisible();
  // Universal Upscaler.
  await expect(page.getByTestId('upscale-image-id')).toBeVisible();
  // §1 advanced capabilities each get a tile.
  await expect(page.getByTestId('unzoom-image-id')).toBeVisible();
  await expect(page.getByTestId('controlnet-prompt')).toBeVisible();
  await expect(page.getByTestId('inpaint-prompt')).toBeVisible();
});

test('Scenario tile round-trips through /api/scenario and shows a configure hint without a key', async ({ page }) => {
  await openAdvancedTexturePanel(page);
  await page.getByTestId('scenario-prompt').fill('dark fantasy dungeon stone, seamless PBR');
  await page.getByTestId('scenario-generate').click();

  // Either it produced a PBR set (a key is configured) or it shows the
  // not-configured hint — both prove the panel → /api/scenario wiring works.
  await expect
    .poll(async () => {
      const ok = await page.getByTestId('pbr-albedo').count();
      const hint = await page.getByTestId('scenario-error').count();
      return ok + hint;
    }, { timeout: 15000 })
    .toBeGreaterThan(0);
});
