# Harness CLI-Session Detection Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `waitForCliComplete` tolerate a live `claude.exe` cold start and stop it from re-dispatching, so a slow-but-healthy CLI session is no longer mis-read as a failed dispatch (the SP-B chunk-1 failure).

**Architecture:** Two coupled changes in the e2e harness, landed as one atomic commit: (1) `waitForCliComplete`'s session-start window `appearGraceMs` 4s → 90s and the D9 re-dispatch removed entirely; (2) the D9 fixture spec reworked into cold-start fixtures that lock in the new behavior. No app source change.

**Tech Stack:** TypeScript, Playwright, the existing PoF e2e harness.

**Spec:** `docs/superpowers/specs/2026-05-21-harness-cli-session-detection-fix-design.md`

---

## Planning-time facts (verified)

1. **Current `waitForCliComplete`** (`e2e/helpers/harness-mode.ts`, lines ~235-334): signature `(page, sessionLabel, timeoutMs = 600_000, opts: { appearGraceMs?: number; redispatch?: boolean } = {})`. `appearGraceMs` default `4_000`; `redispatch` default `true`. Phase 1 waits for `pof-cli-panel-running-indicator` to attach within `appearGraceMs`; on miss it runs a Strategy-B re-dispatch (`page.evaluate` re-fires the last recorded `pof-cli-prompt`) then waits again. Phase 2 waits for detach + a `Promise.race` wall-clock backstop.

2. **The re-dispatch is the double-submission cause.** It re-fires `pof-cli-prompt` whenever the indicator doesn't appear in `appearGraceMs` — indistinguishable from a slow cold start. SP-A's app-level `dispatchPromptWhenReady` handshake already guarantees a dispatch reaches a mounted terminal, so the re-dispatch is redundant; removing it is correct.

3. **The fixture to rework:** `e2e/harness-redispatch.spec.ts` (created by D9, commit `76ffd93`) — its two tests assert the re-dispatch fires/doesn't-fire. Both become obsolete when the re-dispatch is removed. Rename the file to `e2e/harness-cli-detection.spec.ts` and replace its contents.

4. **`setupHarnessMode`** installs a capture-phase listener that records every `pof-cli-prompt` event into `window.__pofHarnessDispatches` (and, in live mode, lets it propagate). The fixtures use `window.__pofHarnessDispatches.length` to assert how many `pof-cli-prompt` events occurred — exactly as D9's fixture did.

5. **Empty `catch` blocks** with only a comment are accepted by the project's ESLint (`waitForCliComplete`'s Phase 2 already uses `catch { /* noop */ }`).

6. **`playwright.config.ts`**: `webServer.reuseExistingServer` against `localhost:${PLAYWRIGHT_PORT ?? 3000}`; run with `PLAYWRIGHT_PORT=3010`. The fixture spec uses `data:` URLs (no app), but `webServer` still starts/reuses a server — harmless.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `e2e/helpers/harness-mode.ts` | Modify `waitForCliComplete` | 90s cold-start window; remove the re-dispatch |
| `e2e/harness-redispatch.spec.ts` | Delete | Obsolete — tested the removed re-dispatch |
| `e2e/harness-cli-detection.spec.ts` | Create | Cold-start fixtures locking in the new behavior |

Total: **1 modified, 1 deleted, 1 created, 1 commit.**

---

## Task 1: Widen the cold-start window + remove the re-dispatch

**Files:**
- Modify: `e2e/helpers/harness-mode.ts`
- Delete: `e2e/harness-redispatch.spec.ts`
- Create: `e2e/harness-cli-detection.spec.ts`

The helper change and the fixture must land together (the reworked fixture's red case fails against the old helper; the helper change must not land without its test). One atomic commit. TDD order: rework the fixture first, watch the re-dispatch-removal case go red, then change the helper.

- [ ] **Step 1: Create the reworked fixture spec**

Create `e2e/harness-cli-detection.spec.ts` with exactly this content:

```typescript
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
```

- [ ] **Step 2: Delete the obsolete D9 fixture**

```bash
git rm e2e/harness-redispatch.spec.ts
```

- [ ] **Step 3: Run the new fixture against the UNCHANGED helper — verify the re-dispatch case FAILS (red)**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/harness-cli-detection.spec.ts --reporter=list
```
Expected: **1 failed, 1 passed.** The first test ("does NOT re-dispatch…") FAILS — against the current helper the re-dispatch fires, so `__pofHarnessDispatches.length` is `2` (not `1`) and `durationMs` is ~6s (not `< 5000`). The second test ("catches a running indicator…") passes (the attach succeeds within the explicit 10s grace regardless). This red proves the first test genuinely exercises the re-dispatch removal.

- [ ] **Step 4: Change `waitForCliComplete` — 90s window + remove the re-dispatch**

Use the Edit tool on `e2e/helpers/harness-mode.ts`. Replace:
```typescript
export async function waitForCliComplete(
  page: Page,
  sessionLabel: string,
  timeoutMs: number = 600_000,
  opts: { appearGraceMs?: number; redispatch?: boolean } = {},
): Promise<WaitResult> {
  const start = Date.now();
  const appearGraceMs = opts.appearGraceMs ?? 4_000;
  const redispatch = opts.redispatch ?? true;

  if (process.env.HARNESS_MODE !== 'live') {
    await page.waitForTimeout(200);
    return { success: true, durationMs: Date.now() - start, timedOut: false };
  }

  const indicator = page.getByTestId('pof-cli-panel-running-indicator');
  let attached = false;
  try {
    await indicator.first().waitFor({ state: 'attached', timeout: appearGraceMs });
    attached = true;
  } catch {
    // Grace elapsed without the indicator. The pof-cli-prompt event was likely
    // dispatched into the 100ms mountDelay window before CompactTerminal's
    // listener registered, so nothing started the session. Strategy B: re-fire
    // the SAME recorded event ONCE via page.evaluate — never a second UI click
    // (a second click can spawn a duplicate Claude session; see D8 regression,
    // commit 370edbd). The re-dispatch reaches the now-mounted terminal listener.
    if (redispatch) {
      const reDispatched = await page.evaluate(() => {
        const list = window.__pofHarnessDispatches ?? [];
        const last = list[list.length - 1];
        if (last?.detail) {
          window.dispatchEvent(new CustomEvent('pof-cli-prompt', { detail: last.detail }));
          return true;
        }
        return false;
      });
      if (reDispatched) {
        try {
          await indicator.first().waitFor({ state: 'attached', timeout: appearGraceMs });
          attached = true;
        } catch { /* still nothing after replay */ }
      }
    }
  }
  if (!attached) {
    return {
      success: false,
      durationMs: Date.now() - start,
      timedOut: false,
      outputExcerpt: `waitForCliComplete(${sessionLabel}): running indicator never appeared within ${appearGraceMs}ms even after one re-dispatch — dispatch likely never fired, or no recorded dispatch to replay`,
    };
  }
```
with:
```typescript
export async function waitForCliComplete(
  page: Page,
  sessionLabel: string,
  timeoutMs: number = 600_000,
  opts: { appearGraceMs?: number } = {},
): Promise<WaitResult> {
  const start = Date.now();
  // Cold-start ceiling. A live `claude.exe` start (process spawn + auth + MCP
  // init + first streamed token) can take tens of seconds before the running
  // indicator appears. waitFor returns the instant the indicator attaches, so
  // a fast start is not slowed — this is only an upper bound.
  const appearGraceMs = opts.appearGraceMs ?? 90_000;

  if (process.env.HARNESS_MODE !== 'live') {
    await page.waitForTimeout(200);
    return { success: true, durationMs: Date.now() - start, timedOut: false };
  }

  const indicator = page.getByTestId('pof-cli-panel-running-indicator');
  let attached = false;
  try {
    await indicator.first().waitFor({ state: 'attached', timeout: appearGraceMs });
    attached = true;
  } catch {
    // Indicator never appeared within the cold-start ceiling — the CLI session
    // genuinely did not start. No re-dispatch: SP-A's dispatchPromptWhenReady
    // app handshake guarantees a dispatch reaches a mounted terminal, so a
    // harness-level re-dispatch could only double-submit (the SP-B chunk-1
    // failure: a slow start was mis-read as a lost dispatch, re-dispatched,
    // and the duplicate task stuck session.isRunning true).
  }
  if (!attached) {
    return {
      success: false,
      durationMs: Date.now() - start,
      timedOut: false,
      outputExcerpt: `waitForCliComplete(${sessionLabel}): running indicator never appeared within ${appearGraceMs}ms — the CLI session did not start`,
    };
  }
```

Leave everything below this point (Phase 2 — the detach `Promise.race`, the wall-clock backstop, the Stop-button abort, the output-excerpt capture, the success return) **unchanged**.

- [ ] **Step 5: Run the fixture against the changed helper — verify BOTH pass (green)**

```bash
PLAYWRIGHT_PORT=3010 npx playwright test e2e/harness-cli-detection.spec.ts --reporter=list
```
Expected: **2 passed.** The first test now passes (`__pofHarnessDispatches.length === 1`, `durationMs < 5000` — no re-dispatch); the second still passes (late indicator caught).

- [ ] **Step 6: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: `tsc` clean — note any other 3-arg or 4-arg `waitForCliComplete` caller still compiles (the `opts` shape only lost `redispatch`, which no caller passed — `dispatch-helpers.ts` and the D-spec call it 3-arg; the SP-B spec calls it 3-arg). `lint` 0 errors, no new warnings in the two changed files.

- [ ] **Step 7: Commit**

The deletion of `harness-redispatch.spec.ts` was already staged by `git rm` in Step 2; this step only adds the modified + new files, then commits all three changes together.

```bash
git add e2e/helpers/harness-mode.ts e2e/harness-cli-detection.spec.ts
git commit -m "$(cat <<'EOF'
fix(e2e): tolerate claude.exe cold start in waitForCliComplete; drop re-dispatch

SP-B chunk-1 failed because waitForCliComplete's session-start window (4s, x2
with the re-dispatch = 8s) is shorter than a live claude.exe cold start. A
slow-but-healthy session was mis-read as a failed dispatch; D9's Strategy-B
re-dispatch then re-fired pof-cli-prompt, double-submitting the prompt — the
duplicate task stuck session.isRunning true and hung the next same-module step
for 37 minutes.

Fix: appearGraceMs default 4s -> 90s (a ceiling — waitFor returns the instant
the indicator attaches), and the re-dispatch is removed entirely. SP-A's
dispatchPromptWhenReady app handshake already guarantees a dispatch reaches a
mounted terminal, so the re-dispatch was redundant and could only double-submit.

harness-redispatch.spec.ts (which tested the removed re-dispatch) is replaced
by harness-cli-detection.spec.ts: a cold-start fixture proving waitForCliComplete
catches a late-appearing indicator and never re-dispatches.

Spec: docs/superpowers/specs/2026-05-21-harness-cli-session-detection-fix-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
git status --short
```
The commit should show 3 changes: `harness-mode.ts` modified, `harness-cli-detection.spec.ts` added, `harness-redispatch.spec.ts` deleted. Do NOT stage `test-results/`, `playwright-report/`, etc.

---

## Self-review (writer's checklist)

- [x] **Spec coverage:** spec Change 1 (`waitForCliComplete`: 90s default, remove `redispatch` + re-dispatch block, reworded fail message, Phase 2 unchanged) → Task 1 Step 4. Spec Change 2 (rename `harness-redispatch.spec.ts` → `harness-cli-detection.spec.ts`, two cold-start fixtures, assert no re-dispatch) → Task 1 Steps 1-2. Spec "prove deterministically before any live run" → Steps 3 (red) + 5 (green). Spec DoD items 1-4 all map. The spec's "resume SP-B at Task 3" is a handoff, not a task here — see below.
- [x] **Placeholder scan:** no "TBD"/"handle edge cases"/"similar to". Every code step shows complete code. Commands have exact expected output.
- [x] **Type consistency:** new signature `opts: { appearGraceMs?: number }` drops `redispatch`; verified no caller passes `redispatch` (D9's fixture did via `harness-redispatch.spec.ts`, which is deleted in this same task; `dispatch-helpers.ts`, the D-spec, and the SP-B spec all call `waitForCliComplete` 3-arg). `appearGraceMs` is still accepted, so the fixture's explicit `appearGraceMs: 3_000` / `10_000` calls compile. `WaitResult` shape unchanged.
- [x] **TDD:** Step 1 writes the fixture, Step 3 runs it red (the re-dispatch-removal test fails against the unchanged helper), Step 4 implements, Step 5 green. The second fixture is a characterization/regression guard (passes both sides) — acceptable; the first provides the genuine red→green.
- [x] **Atomic:** one task, one commit — the helper change and fixture rework are interdependent and land together.
- [x] **Bite-sized:** 7 single-action steps.

---

## After this plan — resume SP-B

This fix unblocks SP-B. Once committed, SP-B resumes at its **Task 3 (chunk 1 live run)** from `docs/superpowers/plans/2026-05-20-arpg-vertical-slice-sp-b.md`: a gated live re-run of `arpg-vertical-slice-sp-b.spec.ts --grep "chunk 1"` (keep-awake pre-flight, ~40 min cap), the artifact-inspection checkpoint, then Task 4 (chunk 2). The SP-B spec, plan, helper, and spec file need no change — they call `waitForCliComplete` and inherit this fix.
