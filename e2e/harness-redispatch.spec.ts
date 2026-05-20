import { test, expect } from '@playwright/test';
import { setupHarnessMode, waitForCliComplete } from './helpers/harness-mode';

// Synthetic stand-in for the PoF app. Clicking the button dispatches a
// pof-cli-prompt CustomEvent (recorded by setupHarnessMode's capture-phase init
// script). A "terminal" listener materializes the pof-cli-panel-running-indicator
// when it receives an event and removes it ~400ms later (the session
// "completes"). WHEN the listener mounts is what distinguishes the two cases.

// LATE listener: mounts ~300ms after load — AFTER the click's first dispatch
// (t~0, missed because no listener yet), BEFORE the helper's re-dispatch
// (t~appearGraceMs=1000ms). Reproduces the mountDelay race.
const FIXTURE_HTML_LATE_LISTENER = `<!doctype html><html><body>
<button data-testid="dispatch-btn">go</button>
<div id="root"></div>
<script>
  document.querySelector('[data-testid=dispatch-btn]').addEventListener('click', function () {
    window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: 't1', prompt: 'p' } }));
  });
  setTimeout(function () {
    window.addEventListener('pof-cli-prompt', function () {
      var ind = document.createElement('div');
      ind.setAttribute('data-testid', 'pof-cli-panel-running-indicator');
      document.getElementById('root').appendChild(ind);
      setTimeout(function () { ind.remove(); }, 400);
    });
  }, 300);
</script>
</body></html>`;

// EAGER listener: attached synchronously, BEFORE the click — so the click's
// first dispatch is caught immediately and the indicator appears within the
// first grace. The helper's retry branch never fires.
const FIXTURE_HTML_EAGER_LISTENER = `<!doctype html><html><body>
<button data-testid="dispatch-btn">go</button>
<div id="root"></div>
<script>
  window.addEventListener('pof-cli-prompt', function () {
    var ind = document.createElement('div');
    ind.setAttribute('data-testid', 'pof-cli-panel-running-indicator');
    document.getElementById('root').appendChild(ind);
    setTimeout(function () { ind.remove(); }, 400);
  });
  document.querySelector('[data-testid=dispatch-btn]').addEventListener('click', function () {
    window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: { tabId: 't1', prompt: 'p' } }));
  });
</script>
</body></html>`;

test.describe('waitForCliComplete — Strategy B re-dispatch', () => {
  test('re-dispatches once when the indicator misses the first event', async ({ page }) => {
    const prev = process.env.HARNESS_MODE;
    process.env.HARNESS_MODE = 'live';
    try {
      await setupHarnessMode(page);
      await page.goto('data:text/html,' + encodeURIComponent(FIXTURE_HTML_LATE_LISTENER));
      await page.getByTestId('dispatch-btn').click();
      const result = await waitForCliComplete(page, 'fixture-race', 30_000, { appearGraceMs: 1_000 });
      expect(result.success).toBe(true);
      const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
      expect(count).toBe(2); // original click + exactly one re-dispatch
    } finally {
      process.env.HARNESS_MODE = prev;
    }
  });

  test('does NOT re-dispatch when the indicator appears on the first try', async ({ page }) => {
    const prev = process.env.HARNESS_MODE;
    process.env.HARNESS_MODE = 'live';
    try {
      await setupHarnessMode(page);
      await page.goto('data:text/html,' + encodeURIComponent(FIXTURE_HTML_EAGER_LISTENER));
      await page.getByTestId('dispatch-btn').click();
      const result = await waitForCliComplete(page, 'fixture-happy', 30_000, { appearGraceMs: 1_000 });
      expect(result.success).toBe(true);
      const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
      expect(count).toBe(1); // no replay
    } finally {
      process.env.HARNESS_MODE = prev;
    }
  });
});
