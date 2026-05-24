import { test, expect, type Page } from '@playwright/test';

async function openCombat(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }
  const coreBtn = page.getByRole('button', { name: 'Core Engine' });
  await coreBtn.waitFor({ state: 'visible', timeout: 15000 });
  await coreBtn.click();
  await page.waitForTimeout(1000);
  const combatBtn = page.locator('nav button, nav [role="button"], nav div[class*="cursor"]')
    .filter({ hasText: 'Combat' }).first();
  await combatBtn.waitFor({ state: 'visible', timeout: 5000 });
  await combatBtn.click();
  await page.waitForTimeout(1500);
}

test.describe('Combat loop', () => {
  test.setTimeout(60000);

  test('combat module renders its action-map subtabs', async ({ page }) => {
    await openCombat(page);
    await expect(page.getByTestId('pof-module-arpg-combat-tab-flow')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('pof-module-arpg-combat-tab-feedback')).toBeVisible();
    await expect(page.getByTestId('pof-module-arpg-combat-tab-attributes')).toBeVisible();
  });

  test('the attribute-defaults tab emits a DataTable Python builder', async ({ page }) => {
    await openCombat(page);
    await page.getByTestId('pof-module-arpg-combat-tab-attributes').click();
    const panel = page.getByTestId('combat-attribute-defaults');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel.locator('pre')).toContainText('DT_AttributeDefaults');
    await expect(panel.locator('pre')).toContainText('ARPGAttributeInitRow');
  });
});
