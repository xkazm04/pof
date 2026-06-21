import { chromium } from '@playwright/test';
import { POF_READY_TESTID, pofNotDetectedMessage } from './helpers/pof-identity';

const READY_TIMEOUT = 90_000;

/**
 * Runs once before the whole Playwright suite. Two jobs, both learned from a real misfire
 * where the run silently tested a non-PoF portfolio app squatting on :3000:
 *
 *  1. IDENTITY GUARD — confirm the server under test is actually PoF (the LayoutLab
 *     `harness-lab-ready` marker renders). reuseExistingServer can otherwise latch onto a
 *     stray dev server on the port, turning the run into N identical silent harness-lab-ready
 *     timeouts against the wrong app. Here it's ONE clear, actionable failure instead.
 *  2. WARM-UP — the first hit to the heavy /layout lab compiles it on-demand under
 *     `npm run dev`; warming it here keeps each spec's gotoLab inside its 30s budget.
 */
export default async function globalSetup(): Promise<void> {
  const port = process.env.PLAYWRIGHT_PORT ?? '3000';
  const baseURL = `http://localhost:${port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId(POF_READY_TESTID).waitFor({ state: 'visible', timeout: READY_TIMEOUT });
    } catch {
      throw new Error(pofNotDetectedMessage(baseURL, READY_TIMEOUT));
    }
  } finally {
    await browser.close();
  }
}
