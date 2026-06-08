import { test, expect } from '@playwright/test';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, type StepStatus,
} from './helpers/lab-mode';

/**
 * Items is the REFERENCE pipeline (13 bespoke step UIs, ITEM_STEP_NAMES order). This
 * deep-walks it with tailored assertions the generic walker can't make, and is why
 * `items` is in WALKER_SKIP. The default entity is item-1 (Iron Longsword). Steps 4
 * (Icon 2D) and 5 (3D Mesh) are gallery; detected by the candidate-gallery test-id.
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);

test.describe('catalog pipeline: items (reference)', () => {
  test('walks all 13 steps to config-complete acceptance', async ({ page }) => {
    await gotoLab(page);
    const entityId = await openCatalog(page, 'items');
    expect(entityId).not.toBe('');

    const stepCount = await page.locator('[data-testid^="step-dot-stamp-"]').count();
    expect(stepCount, 'Items should render its full bespoke pipeline').toBe(13);

    for (let i = 0; i < stepCount; i++) {
      await selectStep(page, i);
      const isGallery =
        (await page.getByTestId('candidate-gallery').count()) > 0 ||
        (await page.getByTestId('candidate-gallery-empty').count()) > 0;
      await produceStep(page, isGallery);

      const status = await acceptanceStatus(page);
      expect.soft(CONFIG_COMPLETE.has(status), `items step ${i + 1}: "${status}" not config-complete`).toBe(true);
    }
  });

  test('Test Gate renders its functional-test breakdown and reaches pass', async ({ page }) => {
    await gotoLab(page);
    await openCatalog(page, 'items');
    // Test Gate is the 12th step (index 11) in ITEM_STEP_NAMES order. Unlike the generic
    // registry items.ts (runtimeDeferred), the bespoke reference ItemTestGate simulates a
    // green gate (data.pass === true) so the full reference pipeline reads end-to-end pass.
    await selectStep(page, 11);
    await produceStep(page, false);
    expect(await acceptanceStatus(page)).toBe('pass');
    // The bespoke gate surfaces its per-check breakdown + the functional-test log.
    await expect(page.locator('#lab-canvas')).toContainText('Result={Success}');
  });
});
