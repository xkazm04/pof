import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { WALKER_SKIP } from './helpers/pipeline-coverage';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, expectPersisted, type StepStatus,
} from './helpers/lab-mode';

/**
 * Data-driven walker: every registered catalog pipeline, walked through the real
 * /layout lab UI in stub mode. Per step it asserts the config-complete terminal
 * rule — status ∈ {pass, deferred}, never fail/pending — and that the artifact
 * persisted to SQLite. A second test proves the persisted statuses hydrate from
 * the server after the local cache is wiped. Items is delegated to its bespoke
 * reference spec (WALKER_SKIP).
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);

for (const pipeline of allCatalogPipelines()) {
  const { catalogId, steps } = pipeline;

  test.describe(`catalog pipeline: ${catalogId}`, () => {
    test.skip(WALKER_SKIP[catalogId] !== undefined, WALKER_SKIP[catalogId]);

    test(`walks ${steps.length} steps to config-complete acceptance + persists`, async ({ page, request }) => {
      await gotoLab(page);
      const entityId = await openCatalog(page, catalogId);
      expect(entityId, `${catalogId}: no openable entity`).not.toBe('');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await selectStep(page, i);
        await produceStep(page, step.view.kind === 'gallery');

        const status = await acceptanceStatus(page);
        expect
          .soft(CONFIG_COMPLETE.has(status), `${catalogId} · ${step.label}: "${status}" is not config-complete (want pass|deferred)`)
          .toBe(true);

        if (status === 'deferred') {
          // Rule 4: a deferred gate must explain itself (StepSpec attaches L3/L4 + reason).
          await expect.soft(page.getByTestId('acceptance-banner')).toContainText(/L[34]/);
        }

        await expectPersisted(request, catalogId, entityId, step.label, status);
      }
    });

    test('persisted statuses hydrate from the server after a cache wipe + reload', async ({ page }) => {
      await gotoLab(page);
      const entityId = await openCatalog(page, catalogId);
      expect(entityId).not.toBe('');

      // Produce every step so the server holds this entity's full pipeline.
      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        await produceStep(page, steps[i].view.kind === 'gallery');
        await expect(page.getByTestId('acceptance-banner')).toBeVisible();
      }
      const before: StepStatus[] = [];
      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        before.push(await acceptanceStatus(page));
      }

      // Wipe the local pipeline cache → the only source left is the server.
      await page.evaluate(() => localStorage.removeItem('pof-lab-pipeline'));
      await gotoLab(page);
      await openCatalog(page, catalogId);

      for (let i = 0; i < steps.length; i++) {
        await selectStep(page, i);
        // Hydrate is async on entity open; poll until it settles to the stored value.
        await expect
          .poll(() => acceptanceStatus(page), {
            timeout: 10_000,
            message: `${catalogId} · ${steps[i].label} did not hydrate from server`,
          })
          .toBe(before[i]);
      }
    });
  });
}
