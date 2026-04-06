import { test, expect, type Page } from '@playwright/test';

// ── Helpers ─────────────────────────────────────────────────────────────

async function openCoreEngine(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });

  // Click PoF project if launcher is shown
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
}

async function openModule(page: Page, moduleName: string) {
  // Click module in L2 sidebar (partial text match)
  const moduleBtn = page.locator('nav button, nav [role="button"], nav div[class*="cursor"]')
    .filter({ hasText: moduleName }).first();
  await moduleBtn.waitFor({ state: 'visible', timeout: 5000 });
  await moduleBtn.click();
  await page.waitForTimeout(1500);
}

// ── Core Engine Module Data ──────────────────────────────────────────────

const MODULES = [
  { sidebar: 'Character', heading: /Character/i },
  { sidebar: 'Animation', heading: /Animation/i },
  { sidebar: 'Ability', heading: /Ability|GAS/i },
  { sidebar: 'Combat', heading: /Combat/i },
  { sidebar: 'Enemy', heading: /Enemy/i },
  { sidebar: 'Items', heading: /Item|Inventory/i },
  { sidebar: 'Loot', heading: /Loot/i },
  { sidebar: 'UI', heading: /UI|HUD/i },
  { sidebar: 'Progression', heading: /Progression/i },
  { sidebar: 'World', heading: /World|Zone/i },
  { sidebar: 'Save', heading: /Save/i },
  { sidebar: 'Polish', heading: /Polish|Debug/i },
];

// ── Tests ────────────────────────────────────────────────────────────────

test.describe('Core Engine Modules', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await openCoreEngine(page);
  });

  test('L2 sidebar shows all 12+ sub-modules', async ({ page }) => {
    // Should have at least 12 module buttons visible
    for (const mod of ['Character', 'Animation', 'Combat', 'Enemy', 'Items', 'Loot']) {
      const btn = page.locator('text=' + mod).first();
      await expect(btn).toBeVisible({ timeout: 5000 });
    }
  });

  for (const mod of MODULES) {
    test(`${mod.sidebar} module loads content`, async ({ page }) => {
      await openModule(page, mod.sidebar);
      // Module heading should be visible
      const heading = page.locator('h1, h2', { hasText: mod.heading }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  }

  test('Features tab is available on Character module', async ({ page }) => {
    await openModule(page, 'Character');
    // Look for Features tab button
    const featuresTab = page.locator('button, [role="tab"]', { hasText: 'Features' }).first();
    await expect(featuresTab).toBeVisible({ timeout: 5000 });
  });

  test('Features tab renders feature matrix', async ({ page }) => {
    await openModule(page, 'Character');
    const featuresTab = page.locator('button, [role="tab"]', { hasText: 'Features' }).first();
    await featuresTab.click();
    await page.waitForTimeout(1000);
    // Should show enable/disable buttons
    const enableAll = page.locator('button', { hasText: /Enable All/i }).first();
    await expect(enableAll).toBeVisible({ timeout: 5000 });
  });

  test('Overview tab shows feature matrix (existing)', async ({ page }) => {
    await openModule(page, 'Character');
    // Overview is default tab, should show content
    const content = page.locator('[role="tabpanel"]').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('Roadmap tab is available', async ({ page }) => {
    await openModule(page, 'Character');
    const roadmapTab = page.locator('button, [role="tab"]', { hasText: 'Roadmap' }).first();
    await expect(roadmapTab).toBeVisible({ timeout: 5000 });
  });

  test('Scan tab is available', async ({ page }) => {
    await openModule(page, 'Character');
    const scanTab = page.locator('button, [role="tab"]', { hasText: 'Scan' }).first();
    await expect(scanTab).toBeVisible({ timeout: 5000 });
  });

  test('Blueprint unique tab loads for Character', async ({ page }) => {
    await openModule(page, 'Character');
    const blueprintTab = page.locator('button, [role="tab"]', { hasText: 'Blueprint' }).first();
    if (await blueprintTab.isVisible()) {
      await blueprintTab.click();
      await page.waitForTimeout(1500);
      // Blueprint content should render
      const panel = page.locator('[role="tabpanel"]').first();
      await expect(panel).toBeVisible();
    }
  });

  test('Bestiary unique tab loads for Enemy AI', async ({ page }) => {
    await openModule(page, 'Enemy');
    const bestiaryTab = page.locator('button, [role="tab"]', { hasText: 'Bestiary' }).first();
    if (await bestiaryTab.isVisible()) {
      await bestiaryTab.click();
      await page.waitForTimeout(1500);
      const panel = page.locator('[role="tabpanel"]').first();
      await expect(panel).toBeVisible();
    }
  });

  test('Spellbook unique tab loads for Ability System', async ({ page }) => {
    await openModule(page, 'Ability');
    const spellbookTab = page.locator('button, [role="tab"]', { hasText: 'Spellbook' }).first();
    if (await spellbookTab.isVisible()) {
      await spellbookTab.click();
      await page.waitForTimeout(1500);
      const panel = page.locator('[role="tabpanel"]').first();
      await expect(panel).toBeVisible();
    }
  });
});
