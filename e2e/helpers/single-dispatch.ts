import { test, type Page } from '@playwright/test';

export interface DispatchStep {
  /** Test title — becomes the isolated Playwright test name. */
  name: string;
  run: (page: Page) => Promise<void>;
}

/**
 * Generate one isolated Playwright `test()` per step — each gets a fresh page.
 *
 * Codifies the SP-B lesson: chained dispatches in a single page collided on
 * the CLI session's `isRunning` flag and hung four 40-minute runs; running
 * each dispatch as its own isolated test (fresh page) structurally eliminates
 * that class. `testFn` is injectable so the generation can be unit-tested
 * without a Playwright runner.
 */
export function singleDispatch(
  steps: DispatchStep[],
  testFn: typeof test = test,
): void {
  for (const step of steps) {
    testFn(step.name, async ({ page }) => {
      await step.run(page);
    });
  }
}
