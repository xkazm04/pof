import { test, expect } from '@playwright/test';
import { setupHarnessMode, waitForCliComplete } from './helpers/harness-mode';

// Fixtures are synthetic data: URL pages — no app, no live Claude. They drive
// waitForCliComplete directly to verify its session-detection behavior:
//  - it waits the full appearGraceMs for a late-appearing running indicator;
//  - it NEVER re-dispatches a pof-cli-prompt event.
// HARNESS_MODE=live is set per-test so waitForCliComplete does not short-circuit.

// Case A fixture: a button that dispatches one pof-cli-prompt on click. The
// running indicator is NEVER created — the "session" never starts.
const FIXTURE_NO_INDICATOR = `<!doctype html><html><body>
<button data-testid="dispatch-btn">go</button>
<script>
  document.querySelector('[data-testid=dispatch-btn]').addEventListener('click', function () {
    window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: 't1', prompt: 'p' } }));
  });
</script>
</body></html>`;

// Case B fixture: the running indicator appears LATE (~3s after load), then is
// removed ~600ms later (session "done"). No pof-cli-prompt is ever dispatched.
const FIXTURE_LATE_INDICATOR = `<!doctype html><html><body>
<div id="root"></div>
<script>
  setTimeout(function () {
    var ind = document.createElement('div');
    ind.setAttribute('data-testid', 'pof-cli-panel-running-indicator');
    document.getElementById('root').appendChild(ind);
    setTimeout(function () { ind.remove(); }, 600);
  }, 3000);
</script>
</body></html>`;

test.describe('waitForCliComplete — CLI session detection', () => {
  test('does NOT re-dispatch when the running indicator never appears', async ({ page }) => {
    const prev = process.env.HARNESS_MODE;
    process.env.HARNESS_MODE = 'live';
    try {
      await setupHarnessMode(page);
      await page.goto('data:text/html,' + encodeURIComponent(FIXTURE_NO_INDICATOR));
      await page.getByTestId('dispatch-btn').click(); // 1 pof-cli-prompt recorded

      const result = await waitForCliComplete(page, 'never-starts', 30_000, { appearGraceMs: 3_000 });

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(false);
      // The harness must NOT re-fire pof-cli-prompt — only the click's 1 dispatch.
      const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
      expect(count).toBe(1);
      // A single grace round (~3s). The removed re-dispatch added a second
      // round (~6s total) — this bound proves it is gone.
      expect(result.durationMs).toBeLessThan(5_000);
    } finally {
      process.env.HARNESS_MODE = prev;
    }
  });

  test('catches a running indicator that appears well after dispatch', async ({ page }) => {
    const prev = process.env.HARNESS_MODE;
    process.env.HARNESS_MODE = 'live';
    try {
      await setupHarnessMode(page);
      await page.goto('data:text/html,' + encodeURIComponent(FIXTURE_LATE_INDICATOR));

      // Indicator appears ~3s in; appearGraceMs=10s comfortably covers it.
      const result = await waitForCliComplete(page, 'late-start', 30_000, { appearGraceMs: 10_000 });

      expect(result.success).toBe(true);
      // waitForCliComplete itself dispatches nothing.
      const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
      expect(count).toBe(0);
    } finally {
      process.env.HARNESS_MODE = prev;
    }
  });
});
