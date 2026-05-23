import { test, expect } from '@playwright/test';
import {
  resolveHarnessMode, isUEAvailable, shouldRunUEChecks, runsGeminiChecks,
  ciVerificationPlan, fullVerificationPlan,
} from './helpers/ci-harness';
import { runFunctionalTest, launchAndScreenshot, geminiCheck } from './helpers/ue-verification';

// Composite "is the slice still healthy?" pass. Replaces the per-sub-project
// ad-hoc verify steps with one cohesive run:
//   - CI mode (HARNESS_MODE=ci or CI=1): headless functional tests only — no
//     dev server, no Gemini. Runs on every PoF-app PR. Skips cleanly when no
//     UE install is present.
//   - live mode: the full daily run — functional tests + a Gemini visual gate
//     per visible system.
//   - stub mode (default): everything is skipped (these need a real UE).
//
// Single-dispatch isolation (SP-B): each functional test / visual check is its
// own isolated test() with a fresh context — no chained-isRunning collisions.

const mode = resolveHarnessMode();
const ueAvailable = isUEAvailable();
const runUE = shouldRunUEChecks(mode, ueAvailable);
const plan = mode === 'live' ? fullVerificationPlan() : ciVerificationPlan();

test.describe('all-verifications', () => {
  test.skip(!runUE, `UE checks skipped (mode=${mode}, ueAvailable=${ueAvailable})`);

  for (const testPath of plan.functionalTests) {
    test(`functional: ${testPath}`, async () => {
      test.setTimeout(40 * 60_000);
      const result = await runFunctionalTest(testPath);
      const detail = result.criteria
        .map((c) => `${c.passed ? '✓' : '✗'} ${c.message}`)
        .join('\n');
      expect(result.success, `functional test failed:\n${detail}\n--- log tail ---\n${result.rawTail}`).toBe(true);
    });
  }

  if (runsGeminiChecks(mode)) {
    for (const { system, fixture } of plan.geminiChecks) {
      test(`visual: ${system}`, async () => {
        test.setTimeout(5 * 60_000);
        const shot = await launchAndScreenshot();
        expect(shot, 'expected a screenshot from the real launch').not.toBeNull();
        const verdict = await geminiCheck(shot!, fixture);
        expect(verdict.length, 'Gemini returned an empty verdict').toBeGreaterThan(0);
        // The discriminating prompt is the gate; the verdict is attached for
        // operator/agent review rather than auto-asserted on substring.
        await test.info().attach(`gemini-${system}`, { body: verdict, contentType: 'text/plain' });
      });
    }
  }
});
