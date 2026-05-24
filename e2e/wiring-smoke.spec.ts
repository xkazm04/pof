import { test, expect, type Page } from '@playwright/test';
import {
  setupHarnessMode,
  completeSetupWizard,
  resetProgressForTestProject,
} from './helpers/harness-mode';
import {
  dispatchRoadmapChecklistItem,
  type RoadmapDispatchTarget,
} from './helpers/dispatch-helpers';

/**
 * Wiring-smoke (live UI path) — improvements/01 §tests.md "wiring smoke run".
 *
 * The deterministic counterpart lives in `src/__tests__/registry/wiring-smoke.test.ts`:
 * it calls `buildTaskPrompt` directly for every module. THIS spec is the e2e
 * complement — it drives a real checklist dispatch through the actual UI
 * (sidebar → Roadmap → "Claude" button → the `pof-cli-prompt` CustomEvent) and
 * asserts the dispatched prompt carries the Wiring Requirements block. That
 * guards the wiring the unit test cannot see: the UI → TaskFactory →
 * buildTaskPrompt path with real UE ProjectContext.
 *
 * Runs in STUB mode: `setupHarnessMode` installs a capture-phase listener that
 * records the dispatched prompt and stops propagation, so NO Claude CLI is
 * spawned (harness-mode.ts) — the captured `detail.prompt` is the fully-built
 * prompt. Needs the dev server + the PoF UE project discoverable (like the other
 * stub-mode e2e specs); it is not part of `npm run validate` (vitest-only).
 */

const STUB_DISPATCH_TIMEOUT_MS = 60_000; // stub mode short-circuits in ~200ms; this is a ceiling.

/** All slice gameplay modules live under the core-engine sidebar category. */
function coreEngineTarget(moduleId: string, itemId: string, sessionLabel: string): RoadmapDispatchTarget {
  return {
    categoryTestId: 'pof-sidebar-nav-item-core-engine',
    moduleTestId: `pof-sidebar-l2-nav-item-${moduleId}`,
    moduleId,
    itemId,
    sessionLabel,
  };
}

/** The prompt of the most-recently dispatched pof-cli-prompt event (stub-captured). */
async function lastDispatchedPrompt(page: Page): Promise<string> {
  const dispatches = await page.evaluate(() => window.__pofHarnessDispatches ?? []);
  const detail = dispatches.at(-1)?.detail as { prompt?: string } | undefined;
  return detail?.prompt ?? '';
}

test.beforeEach(async ({ page }) => {
  await setupHarnessMode(page); // stub
  await page.goto('/', { waitUntil: 'networkidle' });
  await completeSetupWizard(page);
  // Clear checklist progress so the per-item "Claude" dispatch button renders
  // (RoadmapChecklist hides it once an item is checked).
  await resetProgressForTestProject(page);
});

test('checklist dispatch carries the Wiring Requirements block + the module wiring asset (arpg-ui)', async ({ page }) => {
  const result = await dispatchRoadmapChecklistItem(
    page,
    coreEngineTarget('arpg-ui', 'au-1', 'wiring-ui-au-1'),
    STUB_DISPATCH_TIMEOUT_MS,
  );
  expect(result.success, result.outputExcerpt ?? 'dispatch failed').toBe(true);

  const prompt = await lastDispatchedPrompt(page);
  expect(prompt, 'no pof-cli-prompt was captured — the UI dispatch path did not fire').not.toBe('');
  expect(prompt).toContain('## Wiring Requirements');
  // Proves the dispatch path feeds MODULE_WIRING_ASSETS (arpg-ui → WBP_ARPGHUD),
  // i.e. #5's data reaches #1's prompt through the real UI, not just the unit test.
  expect(prompt).toContain('WBP_ARPGHUD');
});

test('checklist dispatch carries the Wiring Requirements block for a module without binary content (arpg-combat)', async ({ page }) => {
  const result = await dispatchRoadmapChecklistItem(
    page,
    coreEngineTarget('arpg-combat', 'acb-1', 'wiring-combat-acb-1'),
    STUB_DISPATCH_TIMEOUT_MS,
  );
  expect(result.success, result.outputExcerpt ?? 'dispatch failed').toBe(true);

  const prompt = await lastDispatchedPrompt(page);
  expect(prompt, 'no pof-cli-prompt was captured — the UI dispatch path did not fire').not.toBe('');
  // The block is emitted for every UE generation dispatch, not gated on binary content.
  expect(prompt).toContain('## Wiring Requirements');
});
