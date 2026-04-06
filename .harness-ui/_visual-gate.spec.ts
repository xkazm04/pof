
import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/kazda/kiro/pof/.harness-ui/screenshots/1';
const MODULES = [
  'Character', 'Animation', 'Ability', 'Combat',
  'Enemy', 'Items', 'Loot',
];

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Visual Gate', () => {
  test.setTimeout(120000);

  test('all core modules render without errors', async ({ page }) => {
    const errors: string[] = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text().slice(0, 200));
      }
    });

    // Collect page crashes
    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message.slice(0, 200));
    });

    // Navigate to app
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    // Click PoF project if launcher shown
    try {
      const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
      await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
      await pofBtn.click();
      await page.waitForTimeout(2000);
    } catch { /* already past launcher */ }

    // Click Core Engine in L1 sidebar
    const coreBtn = page.getByRole('button', { name: 'Core Engine' });
    await coreBtn.waitFor({ state: 'visible', timeout: 15000 });
    await coreBtn.click();
    await page.waitForTimeout(1000);

    let modulesChecked = 0;

    for (const mod of MODULES) {
      // Click module in sidebar
      const moduleBtn = page.locator('nav button, nav [role="button"], nav div[class*="cursor"]')
        .filter({ hasText: mod }).first();

      try {
        await moduleBtn.waitFor({ state: 'visible', timeout: 5000 });
        await moduleBtn.click();
        await page.waitForTimeout(1500);
      } catch {
        errors.push('MODULE_NOT_FOUND: ' + mod);
        continue;
      }

      // Check for React error boundaries
      const errorBoundary = page.locator('[class*="error"], [data-error], text="Something went wrong"');
      const hasError = await errorBoundary.count() > 0;
      if (hasError) {
        errors.push('ERROR_BOUNDARY: ' + mod);
      }

      // Check page is not blank (has at least some content)
      const bodyText = await page.locator('main, [role="main"], #__next').first().innerText().catch(() => '');
      if (bodyText.trim().length < 10) {
        errors.push('BLANK_SCREEN: ' + mod);
      }

      // Screenshot
      await page.screenshot({
        path: SCREENSHOT_DIR + '/' + mod.toLowerCase() + '.png',
        fullPage: false,
      });

      modulesChecked++;
    }

    // Write results file for harness to read
    const result = {
      passed: errors.length === 0,
      modulesChecked,
      errors,
    };
    fs.writeFileSync(SCREENSHOT_DIR + '/result.json', JSON.stringify(result, null, 2));

    // Assert no critical errors (error boundaries, blank screens)
    const criticalErrors = errors.filter(e =>
      e.startsWith('ERROR_BOUNDARY') || e.startsWith('BLANK_SCREEN') || e.startsWith('PAGE ERROR')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
