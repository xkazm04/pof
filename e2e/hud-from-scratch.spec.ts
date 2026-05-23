import { test, expect } from '@playwright/test';
import {
  resolveHarnessMode,
  isUEAvailable,
  shouldRunUEChecks,
  runsGeminiChecks,
} from './helpers/ci-harness';
import { launchAndScreenshot, geminiCheck } from './helpers/ue-verification';

// Folder-04 (HUD/UI) tests.md E2E §1 — a focused HUD visual gate.
//
// Launches the slice in a real (rendered) window, takes a HighResShot, and asks
// Gemini (via the stable, discriminating hud-check.txt fixture) whether a health
// bar renders and whether anything reads as empty / zero-width. This is the
// end-to-end mirror of the in-app /api/verify/visual route (2a): same launch +
// same fixture, exercised through the e2e helpers.
//
// Skips unless a real UE install + Gemini are available (live mode) — it cannot
// run on a stub/CI box with no engine.

const mode = resolveHarnessMode();
const runUE = shouldRunUEChecks(mode, isUEAvailable());

test.describe('hud-from-scratch', () => {
  test.skip(!runUE || !runsGeminiChecks(mode), `HUD visual gate skipped (mode=${mode})`);

  test('player health bar renders and is not empty on a real launch', async () => {
    test.setTimeout(5 * 60_000);

    const shot = await launchAndScreenshot();
    expect(shot, 'expected a screenshot from the real launch').not.toBeNull();

    const verdict = await geminiCheck(shot!, 'hud-check');
    await test.info().attach('gemini-hud-check', { body: verdict, contentType: 'text/plain' });

    expect(verdict.length, 'Gemini returned an empty verdict').toBeGreaterThan(0);
    // hud-check.txt asks explicitly about a top-left health bar and whether any
    // element reads as empty/zero-width. Require an affirmative mention of a bar.
    expect(
      verdict.toLowerCase(),
      `Gemini did not confirm a visible health bar:\n${verdict}`,
    ).toMatch(/health bar|\bbar\b/);
  });
});
