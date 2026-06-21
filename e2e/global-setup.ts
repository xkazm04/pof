import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { POF_READY_TESTID, pofNotDetectedMessage } from './helpers/pof-identity';

const READY_TIMEOUT = 90_000;

/** Storage state every spec context starts from: a completed project so the gated
 *  homepage (`/`) renders the lab. Regenerated each run; resolved from the repo root
 *  (Playwright runs from there) to match `use.storageState` in playwright.config.ts. */
export const SEEDED_STORAGE_STATE = resolve(process.cwd(), 'e2e', '.auth', 'project-seeded.json');

/**
 * Runs once before the whole Playwright suite. Three jobs:
 *
 *  1. IDENTITY GUARD — confirm the server under test is actually PoF (the LayoutLab
 *     `harness-lab-ready` marker renders). reuseExistingServer can otherwise latch onto a
 *     stray dev server on the port, turning the run into N identical silent harness-lab-ready
 *     timeouts against the wrong app. Here it's ONE clear, actionable failure instead.
 *  2. WARM-UP — the first hit to the heavy /layout lab compiles it on-demand under
 *     `npm run dev`; warming it here keeps each spec's gotoLab inside its 30s budget.
 *  3. PROJECT SEED — the homepage (`/`) now gates on project setup (NewHome → SetupWizard
 *     when none is loaded). The specs target the project-agnostic lab, not the first-run
 *     setup flow, so seed a completed project into localStorage and persist it as a
 *     storageState every context inherits. We use the ungated `/layout` for the guard +
 *     warm-up, then verify the gate at `/` renders the lab with the seed applied.
 */
export default async function globalSetup(): Promise<void> {
  const port = process.env.PLAYWRIGHT_PORT ?? '3000';
  const baseURL = `http://localhost:${port}`;
  const labURL = `${baseURL}/layout`;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1 + 2: identity guard and warm-up against the ungated lab route.
    await page.goto(labURL, { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId(POF_READY_TESTID).waitFor({ state: 'visible', timeout: READY_TIMEOUT });
    } catch {
      throw new Error(pofNotDetectedMessage(labURL, READY_TIMEOUT));
    }

    // 3: seed a completed project. projectName/path stay empty (the lab ignores them);
    // only the gate flag + default version matter, so the seeded lab renders identically
    // to a no-project run — just past the gate.
    await page.evaluate(() => {
      localStorage.setItem(
        'pof-project',
        JSON.stringify({
          state: {
            projectName: '', projectPath: '', ueVersion: '5.8.0',
            isSetupComplete: true, isNewProject: false, setupStep: 0, dynamicContext: null,
          },
          version: 0,
        }),
      );
    });

    // Verify the gate at `/` now renders the lab (and warm the homepage route).
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId(POF_READY_TESTID).waitFor({ state: 'visible', timeout: READY_TIMEOUT });
    } catch {
      throw new Error(pofNotDetectedMessage(baseURL, READY_TIMEOUT));
    }

    mkdirSync(dirname(SEEDED_STORAGE_STATE), { recursive: true });
    await context.storageState({ path: SEEDED_STORAGE_STATE });
  } finally {
    await browser.close();
  }
}
