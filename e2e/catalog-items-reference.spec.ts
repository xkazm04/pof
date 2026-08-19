import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { catalogManifest, itemsRegistryOnlySteps } from '@/components/layout-lab/catalogManifest';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, type StepStatus,
} from './helpers/lab-mode';

/**
 * Items is the REFERENCE pipeline. It renders the ORDERED UNION of its two step specs
 * (ITEMS_SPEC_DUALITY): the 13 bespoke step UIs in ITEM_STEP_NAMES order, then the 5
 * registry-only labels routed to the generic ArchetypeStep. Those five were invisible
 * until 2026-08-19 while carrying 31 of the catalog's 90 persisted artifact rows — so the
 * walk covers the union, not the bespoke half. This deep-walks it with tailored assertions
 * the generic walker can't make, and is why `items` is in WALKER_SKIP. The default entity
 * is item-1 (Iron Longsword). Gallery steps (Icon 2D, 3D Generation, 3D Mesh) are detected
 * by the candidate-gallery test-id.
 *
 * The expected count is DERIVED from the manifest, not hardcoded, so adding a step to
 * either spec cannot leave this spec silently walking a stale subset.
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);
const ITEMS_STEPS = catalogManifest('items').steps;

test.describe('catalog pipeline: items (reference)', () => {
  test('walks every step of the union to config-complete acceptance', async ({ page }) => {
    await gotoLab(page);
    const entityId = await openCatalog(page, 'items');
    expect(entityId).not.toBe('');

    const stepCount = await page.locator('[data-testid^="step-dot-stamp-"]').count();
    expect(stepCount, 'Items should render the union of both step specs').toBe(ITEMS_STEPS.length);
    expect(ITEMS_STEPS.length).toBe(18);
    // The registry-only tail is on screen, tagged as such (the duality stays visible).
    const tags = page.locator('[data-step-source="registry"]');
    await expect(tags).toHaveCount(itemsRegistryOnlySteps().length);

    for (let i = 0; i < stepCount; i++) {
      await selectStep(page, i);
      const isGallery =
        (await page.getByTestId('candidate-gallery').count()) > 0 ||
        (await page.getByTestId('candidate-gallery-empty').count()) > 0;
      await produceStep(page, isGallery);

      const status = await acceptanceStatus(page);
      expect.soft(
        CONFIG_COMPLETE.has(status),
        `items step ${i + 1} ("${ITEMS_STEPS[i]}"): "${status}" not config-complete`,
      ).toBe(true);
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
