import { test, expect } from '@playwright/test';

/**
 * Level Design → "Scatter (UE)" panel (folder-05 pof-app §4 / game §4).
 *
 * Verifies the panel renders, reads the latest scatter run from
 * /api/level-design/scatter-result, and exposes the Scatter control. Does NOT
 * click Scatter (that spawns a real Claude CLI session that runs UE — not
 * CI-safe). Local/live spec: requires the dev server + the local "PoF" project.
 */
test('Scatter (UE) panel renders + reads the latest run from the API', async ({ page, request }) => {
  await request.post('/api/level-design/scatter-result', { data: { instanceCount: 57, seed: 4242 } });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByText(/Unreal Projects[\\/]+PoF/).first().click();
  await page.waitForTimeout(2500);
  await page.getByTestId('pof-sidebar-nav-item-content').click();
  await page.waitForTimeout(800);
  await page.getByTestId('pof-sidebar-l2-nav-item-level-design').click();
  await page.waitForTimeout(1500);

  // The level-design tab bar needs an active design doc — select one or create it.
  const existing = page.getByText('ProcGen Smoke').first();
  if (await existing.count()) {
    await existing.click();
  } else {
    const input = page.getByPlaceholder(/New level design/i);
    await input.fill('ProcGen Smoke');
    await input.press('Enter');
    await page.waitForTimeout(1000);
    await page.getByText('ProcGen Smoke').first().click();
  }
  await page.waitForTimeout(1200);

  // Tabs are plain buttons (not role=tab). Open the Scatter (UE) tab.
  await page.getByRole('button', { name: 'Scatter (UE)' }).first().click();

  await expect(page.getByText('Biome Scatter (UE)')).toBeVisible();
  await expect(page.getByText(/57 instances \(seed 4242\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Scatter Props/ })).toBeVisible();
});
