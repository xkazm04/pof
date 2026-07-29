import { test, expect } from '@playwright/test';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { WALKER_SKIP } from './helpers/pipeline-coverage';
import { writeWalkStatus } from './helpers/walk-status';
import {
  gotoLab, openCatalog, selectStep, produceStep, acceptanceStatus, expectPersistedConfigComplete,
  expectPersistedDirection, type StepStatus,
} from './helpers/lab-mode';

/**
 * Data-driven walker: every registered catalog pipeline, walked through the real
 * /layout lab UI in stub mode, against a HERMETIC SQLite file (playwright.config.ts points
 * the server at `e2e/.tmp/e2e.db` via `POF_DB_PATH` and wipes it per run) — so the verdict
 * is a function of the code under test, never of this machine's judge/drain history.
 *
 * Per step it asserts the config-complete terminal rule — status ∈ {pass, deferred}, never
 * fail/pending — against BOTH truths SEPARATELY: the on-screen (judge-bridged) banner and
 * the persisted (pure-checker) row. It never asserts the two are equal: the POST route
 * deliberately stores the un-bridged checker verdict, so equality is unsatisfiable whenever
 * a judge verdict binds. A second test proves the persisted statuses hydrate from the
 * server after the local cache is wiped. Items is delegated to its bespoke reference spec
 * (WALKER_SKIP).
 */

const CONFIG_COMPLETE = new Set<StepStatus>(['pass', 'deferred']);

/** Pipelines whose walk test passed in THIS run — the walk-success signal the
 *  `validate`-time guard reads back (see helpers/walk-status.ts). */
const walkedGreen = new Set<string>();
const EXPECTED_WALKS = allCatalogPipelines()
  .map((p) => p.catalogId)
  .filter((id) => WALKER_SKIP[id] === undefined);

test.afterAll(() => {
  writeWalkStatus(walkedGreen, EXPECTED_WALKS, WALKER_SKIP);
});

for (const pipeline of allCatalogPipelines()) {
  const { catalogId, steps } = pipeline;

  test.describe(`catalog pipeline: ${catalogId}`, () => {
    test.skip(WALKER_SKIP[catalogId] !== undefined, WALKER_SKIP[catalogId]);

    // A walk test that finishes with no failed assertion (soft ones included) is what
    // "this pipeline walked green" means — recorded for the validate-time guard.
    // The empty destructuring pattern is REQUIRED by Playwright: it statically parses the
    // first arg to learn which fixtures a hook uses, and rejects a plain identifier.
    test.afterEach(({}, testInfo) => {
      if (testInfo.title.startsWith('walks ') && testInfo.status === 'passed') walkedGreen.add(catalogId);
    });

    test(`walks ${steps.length} steps to config-complete acceptance + persists`, async ({ page, request }) => {
      await gotoLab(page);
      const entityId = await openCatalog(page, catalogId);
      expect(entityId, `${catalogId}: no openable entity`).not.toBe('');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await selectStep(page, i);
        // Type a unique direction into every step and assert it lands VERBATIM on the
        // persisted artifact — the direction is a real produce input, not a write-only box.
        const direction = `walker direction ${catalogId} #${i}`;
        await produceStep(page, step.view.kind === 'gallery', direction);

        // Truth 1 — what the OPERATOR sees: the judge-bridged banner.
        const status = await acceptanceStatus(page);
        expect
          .soft(CONFIG_COMPLETE.has(status), `${catalogId} · ${step.label}: on-screen "${status}" is not config-complete (want pass|deferred)`)
          .toBe(true);

        if (status === 'deferred') {
          // Rule 4: a deferred gate must explain itself (StepSpec attaches L3/L4 + reason).
          await expect.soft(page.getByTestId('acceptance-banner')).toContainText(/L[34]/);
        }

        // Truth 2 — what the SERVER stored: the pure checker verdict, asserted against its
        // own rule (never against the banner — see expectPersistedConfigComplete).
        await expectPersistedConfigComplete(request, catalogId, entityId, step.label, CONFIG_COMPLETE);
        await expectPersistedDirection(request, catalogId, entityId, step.label, direction);
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
