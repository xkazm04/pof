---
date: 2026-05-20
status: draft
sub_project: D (scenario execution)
sub_phase: D9 (proper dispatch-race fix — Strategy B + wall-clock guard, stub-tested)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario
predecessor_specs:
  - docs/superpowers/specs/2026-05-19-arpg-vertical-slice-scenario-d8-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-d8.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-d8-rerun.md
---

# Sub-project D9: ARPG vertical-slice — proper dispatch-race fix (Strategy B), stub-tested before any live run

## Context

D7/D7.5 surfaced an intermittent flake: after a dispatch-button click, the
`pof-cli-panel-running-indicator` sometimes never appears, so
`waitForCliComplete` times out. Root cause is a timing race in
`useModuleCLI.sendPrompt` (`src/hooks/useModuleCLI.ts:122-128`): it waits
`UI_TIMEOUTS.mountDelay` (100ms, `src/lib/constants.ts:69`) before dispatching
the `pof-cli-prompt` CustomEvent. When CompactTerminal's mount + bubble-phase
listener registration takes longer than that window, the event fires to a
window with no terminal-side listener. The harness's capture-phase listener
records the dispatch, but nothing starts the CLI session — `isRunning` never
flips, the indicator never renders.

D8 attempted a **spec-level double-click** (Strategy C): after the click, sleep
1s and re-click if the button was still enabled. This was a **regression**. Two
live runs were consumed:

- **D8 first run**: 5.4h overnight — almost certainly machine sleep (event loop
  suspended), inconclusive.
- **D8 re-run (controlled, watched)**: hit exactly 30 min ("Test timeout of
  1800000ms exceeded") — a conclusive, genuine hang in Step 8 ih-1.

The double-click likely either spawned a second concurrent Claude session for
the same module (indicator stays perpetually attached → `waitFor({detached})`
never resolves) or stalled on `isEnabled()` against a re-rendering button.
Single-click (D5/D6/D7) completed Step 8 in 38-137s; the double-click traded an
occasional retry-able flake for a consistent 30-min hang — strictly worse. It
was reverted (`git revert f9f54e6` → commit `370edbd`); the spec is back to the
known-good D7 single-click state (`filenameSuffix: 'd7'`, `tsc --noEmit` clean).

D9 implements the **proper** fix the D8 findings recommended, and — critically,
after two wasted live runs — **proves it deterministically with a stub test
before spending any live run.**

## Goals

1. Replace the lost-dispatch flake with a **helper-level Strategy B re-dispatch**
   inside `waitForCliComplete`: if the running indicator does not attach within a
   grace window, re-fire the *same recorded* `pof-cli-prompt` event exactly
   **once** via `page.evaluate` — never via a second UI click (eliminates the
   duplicate-session risk that broke D8).
2. Add a **wall-clock backstop** to the detach wait so a genuinely-stuck session
   fails bounded instead of consuming the full Playwright test timeout.
3. **Stub-test the retry deterministically** with a new Playwright fixture spec
   (`page.setContent`, no app, no live Claude) covering both the race case and
   the happy case — this is the **gate** before any live run.
4. Only after the fixture tests are green and a keep-awake pre-flight is
   confirmed, run **one** gated live re-run of the existing scenario spec to
   close the initiative with real end-to-end proof.

## Non-goals

- **No second UI click anywhere.** Strategy B re-dispatches the recorded event
  programmatically; it never clicks the button twice. (This is the D8 lesson.)
- **No fix for Finding A** (Step 6 build-verify button not visible). Out of scope.
- **No new live scenario steps** (Step 11+ combat etc. remain future work).
- **No change to `useModuleCLI` / the app's 100ms mountDelay.** D9 is a
  test-harness robustness fix, not an app change. (Lowering mountDelay would be
  an app-side alternative but risks real terminal-mount regressions; out of scope.)
- **No in-process defense against OS sleep.** A `setTimeout` guard is itself
  suspended during sleep; sleep is handled operationally (keep-awake pre-flight),
  not by a timer.

## Decision record (from brainstorming)

1. **Strategy:** Strategy B (helper-level single re-dispatch via `page.evaluate`)
   — chosen over Strategy A (longer pre-wait, too weak) and Strategy C
   (spec-level double-click, proven regression in D8).
2. **Re-dispatch source:** the last entry of `window.__pofHarnessDispatches`.
   The harness records every `pof-cli-prompt` (`harness-mode.ts:45-51`), and
   `drainCliDispatches` clears the array per step, so at retry time
   `list[list.length-1].detail` is exactly this step's `{tabId, prompt}`.
3. **`appearGraceMs` default = 4000ms** (replaces the current flat 10s single
   wait). Comfortable margin over the 100ms mountDelay while keeping the retry
   responsive. The two-phase flow waits up to `appearGraceMs`, re-dispatches,
   then waits up to `appearGraceMs` again (worst case ~8s before declaring
   "never appeared").
4. **Wall-clock backstop = `Promise.race` vs `setTimeout(timeoutMs + 30_000)`**.
   A thin backstop for a non-sleep Playwright hang; explicitly NOT a sleep defense.
5. **Stub-test method:** Playwright fixture page (`page.setContent`) exercising
   the real `waitForCliComplete` against a deterministic race reproduction.
   Chosen over a vitest mock-Page unit test because the bug lives in the real
   Playwright locator/timing interaction — a mock could pass while reality fails.
6. **Live run scope:** gated live run after the fixture gate is green + keep-awake
   confirmed. Closes the initiative with end-to-end proof, spent only on a fix
   already proven deterministically.

## How `setupHarnessMode` supports this (verified)

- `mode` is read from `process.env.HARNESS_MODE` **at call time**
  (`harness-mode.ts:34`). The fixture test sets `process.env.HARNESS_MODE='live'`
  *before* calling `setupHarnessMode(page)` so the live retry branch runs.
- `page.route` mocks are installed **only in stub mode** (`harness-mode.ts:61`).
  In live mode there is no route interception, so `page.setContent` with a
  synthetic fixture works with no app and no interference.
- The init script (`addInitScript`, `harness-mode.ts:42-57`) runs on document
  creation **before** the page's inline scripts, so the fixture's button-click
  dispatch is recorded into `__pofHarnessDispatches` and (in live mode)
  propagation continues to the fixture's own listener.

## Deliverable 1: `waitForCliComplete` (Strategy B + guard)

**File:** `e2e/helpers/harness-mode.ts` (modify the existing function, ~lines 235-295).

New signature (additive, backward-compatible — existing 3-arg calls keep working):

```ts
export async function waitForCliComplete(
  page: Page,
  sessionLabel: string,
  timeoutMs: number = 600_000,
  opts: { appearGraceMs?: number; redispatch?: boolean } = {},
): Promise<WaitResult> {
```

**Phase 1 — attach, with one re-dispatch retry** (replaces the current single
`waitFor({state:'attached', timeout: 10_000})` + catch-return):

```ts
const appearGraceMs = opts.appearGraceMs ?? 4_000;
const redispatch = opts.redispatch ?? true;

const indicator = page.getByTestId('pof-cli-panel-running-indicator');
let attached = false;
try {
  await indicator.first().waitFor({ state: 'attached', timeout: appearGraceMs });
  attached = true;
} catch {
  // Grace elapsed without the indicator. The pof-cli-prompt event was likely
  // dispatched into the mountDelay window before CompactTerminal's listener
  // registered, so nothing started the session. Strategy B: re-fire the SAME
  // recorded event ONCE via page.evaluate — never a second UI click (a second
  // click can spawn a duplicate Claude session; see D8 regression, commit
  // 370edbd). The re-dispatch reaches the now-mounted terminal listener.
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

**Phase 2 — detach, with a wall-clock backstop** (wraps the current
`waitFor({state:'detached', timeout: timeoutMs})`):

```ts
// Wall-clock backstop: bounds a genuinely-stuck session (indicator attached
// forever) so it fails at ~timeoutMs instead of consuming the full Playwright
// test timeout. NOTE: a setTimeout is suspended during OS sleep, so this does
// NOT defend against machine sleep (see D8 5.4h run) — sleep is handled by the
// keep-awake pre-flight, not here.
const detachOutcome = await Promise.race([
  indicator.first().waitFor({ state: 'detached', timeout: timeoutMs })
    .then(() => 'detached' as const)
    .catch(() => 'detach-timeout' as const),
  new Promise<'guard'>((resolve) => setTimeout(() => resolve('guard'), timeoutMs + 30_000)),
]);

if (detachOutcome !== 'detached') {
  // existing timeout handling: capture pof-cli-panel-output excerpt, try to
  // click a Stop/abort button, return { success:false, timedOut:true, outputExcerpt }.
}
// existing success path unchanged: capture output excerpt, return success:true.
```

The existing output-capture and Stop-button-abort logic (current lines 262-281)
is preserved inside the `detachOutcome !== 'detached'` branch.

## Deliverable 2: Fixture test (the stub gate)

**File:** `e2e/harness-redispatch.spec.ts` (create).

A self-contained spec that runs the real `waitForCliComplete` against a
synthetic `page.setContent` fixture. Sets `process.env.HARNESS_MODE='live'`
before `setupHarnessMode` so the live retry branch executes; restores the prior
value in `finally` so it cannot leak to other workers/files.

**Fixture HTML** — a button that dispatches `pof-cli-prompt` on click (recorded
by the harness), plus a "terminal" listener that materializes the running
indicator when it receives an event and removes it shortly after (session
"completes"). The *timing* of when the listener mounts is what distinguishes the
two cases.

**Case A — race → re-dispatch fixes it.** The terminal listener mounts *late*
(via `setTimeout(..., delayMs)` chosen larger than the click but smaller than the
re-dispatch), so the click's first dispatch is missed; the helper's re-dispatch
is caught → indicator attaches then detaches.

```ts
test('re-dispatches once when the indicator misses the first event', async ({ page }) => {
  const prev = process.env.HARNESS_MODE;
  process.env.HARNESS_MODE = 'live';
  try {
    await setupHarnessMode(page);
    await page.setContent(FIXTURE_HTML_LATE_LISTENER);
    await page.getByTestId('dispatch-btn').click();
    const result = await waitForCliComplete(page, 'fixture-race', 30_000, { appearGraceMs: 1_000 });
    expect(result.success).toBe(true);
    const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
    expect(count).toBe(2); // original click + exactly one re-dispatch
  } finally {
    process.env.HARNESS_MODE = prev;
  }
});
```

**Case B — happy path → no re-dispatch.** The terminal listener is mounted
*synchronously* (before the click), so the indicator appears within the first
grace and the retry branch never fires. Proves D9 does NOT double-dispatch when
the first dispatch worked — the exact failure mode D8 introduced.

```ts
test('does NOT re-dispatch when the indicator appears on the first try', async ({ page }) => {
  const prev = process.env.HARNESS_MODE;
  process.env.HARNESS_MODE = 'live';
  try {
    await setupHarnessMode(page);
    await page.setContent(FIXTURE_HTML_EAGER_LISTENER);
    await page.getByTestId('dispatch-btn').click();
    const result = await waitForCliComplete(page, 'fixture-happy', 30_000, { appearGraceMs: 1_000 });
    expect(result.success).toBe(true);
    const count = await page.evaluate(() => window.__pofHarnessDispatches?.length ?? 0);
    expect(count).toBe(1); // no replay
  } finally {
    process.env.HARNESS_MODE = prev;
  }
});
```

Fixture timing relationships (with `appearGraceMs: 1_000`):
- **Late listener (Case A):** listener mounts at ~300ms after load (after the
  click's first dispatch at t≈0 is gone, before the re-dispatch at t≈1000ms).
  Indicator removed ~300ms after it is added → detaches well within the test.
- **Eager listener (Case B):** listener attached synchronously in the inline
  script, so the click's dispatch is caught immediately → indicator appears
  inside the first grace → no retry.

Run: `HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/harness-redispatch.spec.ts`
(The per-test `process.env` set makes it robust regardless of the outer env, but
passing `HARNESS_MODE=live` keeps intent explicit.) Completes in seconds; no
live Claude, no UE5.

## Deliverable 3: Gated live run

**Precondition gate (must ALL hold before firing):**
1. `e2e/harness-redispatch.spec.ts` Case A + Case B both green.
2. `npx tsc --noEmit` clean.
3. Keep-awake pre-flight applied so the machine cannot sleep mid-run:
   `powercfg /change standby-timeout-ac 0` and `powercfg /change monitor-timeout-ac 0`
   (record the prior values to restore afterward if desired).
4. PoF dev server alive on port 3010.

**Spec change:** `e2e/arpg-vertical-slice-live-d2.spec.ts` — bump
`filenameSuffix: 'd7'` → `'d9'`. **Dispatch sites stay single-click** — the new
helper handles any race transparently; no per-step changes.

**Run:** `HARNESS_MODE=live PLAYWRIGHT_PORT=3010 npx playwright test e2e/arpg-vertical-slice-live-d2.spec.ts --reporter=list`
(background, 30-min cap). Generates `docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-d9.md`.

**Expected:** Steps 8/9/10 pass and artifact-verified. Dispatch count = 3 if no
race occurred live (one per step), or 3 + N where N = number of steps that hit
the race and triggered a single replay each. A replay count > 0 with all steps
still passing is the *positive* signal that Strategy B did its job.

## Cross-cutting

- **Branch:** `master`. ~3 commits (helper+fixture; suffix bump; live findings).
- **Validation gate:** `npx tsc --noEmit` after the helper + fixture edits; the
  fixture spec itself is the behavioral gate.
- **No worktree.**
- **PoF app source untouched** (`useModuleCLI` / mountDelay unchanged).
- **UE5 project may be modified again** by the live run if any dispatch produces
  fresh code/assets (Claude's verify-and-skip handles existing artifacts).
- **Port 3010** for the live run.

## Definition of done

1. `waitForCliComplete` updated (two-phase attach + re-dispatch + wall-clock
   backstop); existing 3-arg callers unaffected.
2. `e2e/harness-redispatch.spec.ts` created; **Case A asserts success + dispatch
   count 2**, **Case B asserts success + dispatch count 1**; both green.
3. `npx tsc --noEmit` clean.
4. Helper + fixture committed (commit 1); `filenameSuffix` bumped to `'d9'`
   (commit 2).
5. Keep-awake pre-flight applied; gated live run executed; findings doc
   `2026-05-20-live-d9.md` produced and enriched (commit 3).
6. Findings explicitly state: Step 8/9/10 outcomes, total dispatch count, and how
   many steps required a replay (0 = no race occurred; >0 = Strategy B engaged
   and worked).
7. Chat summary with commit SHAs + per-step results.

**Success criterion:** the fixture gate proves the re-dispatch works (Case A) and
does no harm on the happy path (Case B), and the gated live run completes with
Steps 8/9/10 passing artifact-verified — closing the dispatch-race flake that
D7/D7.5 surfaced and D8 failed to fix.

## Risks & mitigations

- **Re-dispatch replays a stale `__pofHarnessDispatches[last]`** (e.g., a prior
  step's dispatch). Mitigation: `drainCliDispatches` clears the array per step
  (`runLiveStep` calls it after each body), so at retry time the array holds only
  this step's dispatch. The fixture test's count assertions (2 / 1) directly
  guard this.
- **`appearGraceMs` (4s) too short on a loaded machine** → false "never
  appeared". Mitigation: the *retry* gives a second 4s window (~8s total) before
  failing; can be raised via the new opts param without code change. The current
  flat 10s is replaced by ~8s worst-case + a real retry, which is strictly more
  robust than a longer single wait.
- **Replay reaches a terminal that DID register late, causing a second real
  session** (live). Mitigation: distinct from D8 — Strategy B only re-fires when
  the indicator is *absent* after the grace, i.e. when the first dispatch
  produced no session. If a session had started, the indicator would be attached
  and the retry branch is skipped. Worst case (a race where the session starts
  exactly at the grace boundary) is one extra event to an already-running session;
  the app's session de-dup / Claude's verify-and-skip absorbs it. Far safer than
  an unconditional second click.
- **Wall-clock guard gives false sense of sleep safety.** Mitigation: explicitly
  documented (code comment + this spec) that the guard does not survive sleep;
  the keep-awake pre-flight is the actual sleep mitigation and is a hard
  precondition of the live run.

## Hand-off after D9

If the gated live run passes: the harness is **production-stable and
flake-fixed**, with the fix proven deterministically (fixture) and end-to-end
(live). The ARPG vertical-slice initiative can wrap; remaining 11 dispatch steps
are mechanical pattern-extensions.

If the gated live run still stalls *despite* keep-awake + green fixtures: the
problem is neither the dispatch race nor sleep — escalate (capture the
`pof-cli-panel-output` excerpt and the dispatch artifact JSON) rather than
attempting another trial-and-error live run.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves the written spec.
3. `writing-plans` skill → plan (Task 1: helper + fixture + tsc + fixture-run +
   commit; Task 2: suffix bump + commit; Task 3: keep-awake pre-flight + gated
   live run + findings + commit).
4. Execute.
