import { test, expect } from '@playwright/test';

/**
 * Level Design → "Dungeon (UE)" driver panel (folder-05 pof-app §4).
 *
 * Verifies the panel renders, reads the latest generator run from
 * /api/level-design/procgen-result, and exposes the Generate control. Does NOT
 * click Generate (that spawns a real Claude CLI session that runs UE — not
 * CI-safe). Local/live spec: requires the dev server + the local "PoF" project
 * (consistent with the repo's other machine-specific e2e specs).
 */
test('Dungeon (UE) panel renders + reads the latest run from the API', async ({ page, request }) => {
  // Seed a known latest run so the result line is deterministic.
  await request.post('/api/level-design/procgen-result', { data: { roomCount: 12, seed: 4242 } });

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

  // Tabs are plain buttons (not role=tab). Open the Dungeon (UE) tab.
  await page.getByRole('button', { name: 'Dungeon (UE)' }).first().click();

  await expect(page.getByText('Procedural Dungeon (UE)')).toBeVisible();
  await expect(page.getByText(/12 rooms \(seed 4242\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate Dungeon/ })).toBeVisible();
});
