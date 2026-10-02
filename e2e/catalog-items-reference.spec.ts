import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { catalogManifest, itemsRegistrySteps } from '@/components/layout-lab/catalogManifest';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, type StepStatus,
} from './helpers/lab-mode';

/**
 * Items is the REFERENCE pipeline. It renders the ORDERED UNION of its two step specs
 * (ITEMS_SPEC_DUALITY): the 13 ITEM_STEP_NAMES labels in order, then the 5 registry-only
 * labels. Since 2026-09-29 every label the registry declares (the 5 + the 6 shared) is
 * registry-OWNED (itemsLabelOwner) and renders through the generic ArchetypeStep; the 7
 * bespoke-only labels keep their bespoke step UIs. Those five were invisible
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
    // Every registry-owned label is on screen, tagged as such (the duality stays visible).
    const tags = page.locator('[data-step-source="registry"]');
    await expect(tags).toHaveCount(itemsRegistrySteps().length);

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

  test('Test Gate grades through the registered L3 gate and reaches a terminal status', async ({ page }) => {
    await gotoLab(page);
    await openCatalog(page, 'items');
    // Test Gate is the 12th step (index 11) in ITEM_STEP_NAMES order. It is registry-owned
    // (2026-09-29): the registered `entityRuntimeDeferred` gate grades it exactly as the server
    // does — `deferred` at L3 until VSItemsDefinitionsTest reports. The bespoke per-check
    // breakdown (`Result={…}` log) is no longer on screen.
    await selectStep(page, 11);
    await produceStep(page, false);
    const status = await acceptanceStatus(page);
    expect(CONFIG_COMPLETE.has(status), `Test Gate reached "${status}"`).toBe(true);
    expect(status).toBe('deferred');
  });
});
