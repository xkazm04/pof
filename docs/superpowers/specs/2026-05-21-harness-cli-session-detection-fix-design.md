---
date: 2026-05-21
status: draft
sub_project: SP-B remediation — harness CLI-session detection fix
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md
  - docs/superpowers/specs/2026-05-20-arpg-vertical-slice-scenario-d9-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-20-live-sp-b-chunk1.md
---

# Harness CLI-Session Detection Fix

## Context

SP-B's chunk-1 live run (combat + enemy) failed. Root-cause investigation —
from the dispatch artifact, the per-step findings doc, and the Playwright
failure DOM snapshot — produced a complete, evidence-backed diagnosis.

### What actually happened

Step 11a dispatched `acb-1`. The session **worked** — the failure DOM snapshot
shows the inline terminal with real output (`Glob`, `Read: GA_MeleeAttack.h`,
`Read: GA_MeleeAttack.cpp`, confirming `UGA_MeleeAttack` already exists) and a
terminal status of **"Done"**. But the harness mis-detected it and cascaded into
a 40-minute hang.

The chain, all from one root trigger:

1. **Too-short start window.** `waitForCliComplete` decides "a session started"
   by waiting for the `pof-cli-panel-running-indicator` DOM element to attach.
   That window is `appearGraceMs` = 4 s, applied twice (×2 with the re-dispatch)
   = **8 s total**. A live `claude.exe` cold start — process spawn + auth + MCP
   init + first streamed token — empirically takes longer than 8 s. The session
   was still cold-starting when the harness gave up.

2. **Spurious step fail.** `waitForCliComplete` returned
   `success: false` ("running indicator never appeared") after 8 s, so Step 11a
   recorded a fail — even though the session then ran fine and finished "Done".

3. **Harmful re-dispatch → double-submission.** D9's Strategy-B backstop
   re-fires the `pof-cli-prompt` event if the indicator does not appear within
   `appearGraceMs`. It is meant for a *lost* dispatch — but a slow cold start is
   indistinguishable from a lost dispatch by this signal. The dispatch artifact
   confirms **two identical `acb-1` prompts**. `CompactTerminal`'s auto-submit
   fired the prompt a second time → a second queued task.

4. **Stuck `isRunning`.** `session.isRunning` is set `true` on stream-start and
   `false` on `onTaskComplete` (`InlineTerminal.tsx:153-154`). With two tasks,
   task 1 finished ("Done") but task 2 kept `session.isRunning` true. The
   snapshot shows the contradiction directly: terminal "Done", yet the sidebar
   badge reads "Task running" and every combat "Claude" button is `disabled`.

5. **37-minute hang.** Step 11b (`acb-4`, same module) tried to click `acb-4`'s
   "Claude" button — `disabled={isRunning}`, and `isRunning` was stuck true.
   Playwright retried the disabled-button click 4,457 times until the 40-minute
   test cap.

### Why the stub run did not catch it

Stub mode short-circuits `waitForCliComplete` (returns success after 200 ms) and
never dispatches a real session. The defect is purely a *live-mode* timing
interaction — structurally invisible to a stub run.

## Goals

1. Make `waitForCliComplete` tolerate a real `claude.exe` cold start so a slow
   session start is no longer mis-read as a failed dispatch.
2. Remove the re-dispatch so a slow start can never cause a double-submission
   (which is what stuck `session.isRunning`).
3. Prove the fix deterministically with a fixture test before any live run.
4. Unblock SP-B: enable a gated live re-run of chunk 1.

## Non-goals

- **No app source change.** SP-A's `dispatchPromptWhenReady` handshake already
  guarantees a dispatch reaches a mounted terminal; this fix is harness-only.
- **No app-side `isRunning` hardening.** The stuck `isRunning` is a *symptom* of
  the double-dispatch; removing the re-dispatch removes the double-dispatch and
  therefore the stuck state. (Confirmed scope decision from brainstorming.)
- **No change to the SP-B spec or `dispatch-helpers.ts`** — they call
  `waitForCliComplete` and inherit the fix.
- **No new detection signal / new app testId** — the existing
  `pof-cli-panel-running-indicator` is a valid signal; D9 proved the
  attach→detach detection logic. It was only being checked too early.

## Decision record (from brainstorming)

1. **Scope:** harness-only robust rewrite (vs. also hardening app `isRunning`,
   vs. a broader harness-reliability pass).
2. **Approach A:** widen the cold-start window **and remove the re-dispatch**
   (vs. keeping a guarded re-dispatch; vs. a new app-side CLI-state testId).
   The re-dispatch was a pre-SP-A backstop that SP-A made redundant and that
   directly caused the double-submission — removing it is correct.
3. **Cold-start ceiling:** ~90 s. It is a ceiling, not a fixed wait — `waitFor`
   returns as soon as the indicator attaches.

## Design

### Change 1 — `waitForCliComplete` (`e2e/helpers/harness-mode.ts`)

The current function (lines ~235-334) has: `opts: { appearGraceMs?: number; redispatch?: boolean }`; a Phase-1 attach wait with `appearGraceMs` default 4000; a Strategy-B re-dispatch block on attach-miss; a Phase-2 detach wait + wall-clock backstop.

Changes:

- **`appearGraceMs` default `4_000` → `90_000`.** A live `claude.exe` cold start
  comfortably fits; `waitFor({state:'attached'})` still returns the instant the
  indicator appears, so a fast start is not slowed.
- **Remove the `redispatch` option and the entire re-dispatch block.** On a
  Phase-1 attach-miss within `appearGraceMs`, return `success: false` directly.
  The failure `outputExcerpt` is reworded — it no longer mentions a re-dispatch:
  `running indicator never appeared within ${appearGraceMs}ms — the CLI session did not start`.
- **Phase 2 unchanged** — the detach wait + `Promise.race` wall-clock backstop +
  the Stop-button abort + output-excerpt capture all stay exactly as-is. D9
  proved this logic; it is not implicated in the failure.

New signature: `waitForCliComplete(page, sessionLabel, timeoutMs = 600_000, opts: { appearGraceMs?: number } = {})`. All existing 3-arg callers (the D-spec, `dispatch-helpers.ts`) are unaffected and pick up the 90 s default.

### Change 2 — rework the fixture spec

`e2e/harness-redispatch.spec.ts` currently tests the re-dispatch behavior (D9).
With the re-dispatch removed those tests are obsolete. **Rename** the file to
`e2e/harness-cli-detection.spec.ts` and replace its contents with two
deterministic cold-start fixtures (same D9 pattern: a `data:` URL page, no app,
no live Claude, `HARNESS_MODE=live` set per-test so `waitForCliComplete` does
not short-circuit). Both cases also assert **no `pof-cli-prompt` event is ever
dispatched by `waitForCliComplete`** (a window listener counts them; expect 0).

- **Case 1 — late indicator is caught.** The fixture creates the
  `pof-cli-panel-running-indicator` element after a delay longer than the old
  4 s window, then removes it (session "done"). Call
  `waitForCliComplete(page, 'late', 30_000, { appearGraceMs: <delay + margin> })`.
  Assert `result.success === true` and the re-dispatch counter is 0. This proves
  the helper waits past a slow start instead of bailing.
- **Case 2 — indicator never appears → bounded fail.** The fixture never creates
  the indicator. Call `waitForCliComplete(page, 'never', 30_000, { appearGraceMs: 3_000 })`.
  Assert `result.success === false`, `result.timedOut === false`, the call
  returns at ~`appearGraceMs` (not later — proving no extra re-dispatch round),
  and the re-dispatch counter is 0.

The fixtures use small explicit `appearGraceMs` values for fast tests; they
verify the *mechanism* (waits the full window; catches a late indicator; never
re-dispatches). The 90 s production default is a value choice, not separately
unit-tested — exactly as D9's fixture used `appearGraceMs: 1_000`.

## Cross-cutting

- **Branch:** `master`.
- **Validation gate:** `npx tsc --noEmit` + the fixture spec green. No live run
  is part of *this* spec's definition of done — the live re-run is the resumed
  SP-B Task 3.
- **No worktree. No app source change.**
- **Commit locally only** — the user pushes manually.

## Definition of done

1. `waitForCliComplete`: `appearGraceMs` default is 90 s; the `redispatch`
   option and re-dispatch block are removed; Phase 2 unchanged; signature is
   backward-compatible for 3-arg callers.
2. `e2e/harness-redispatch.spec.ts` renamed to `e2e/harness-cli-detection.spec.ts`
   and reworked into the two cold-start fixtures above.
3. `npx tsc --noEmit` clean; the fixture spec passes both cases.
4. Committed to `master` (~2 commits).

**Success criterion:** the fixture proves `waitForCliComplete` tolerates a
late-appearing running indicator and never re-dispatches — so a live cold start
will no longer be mis-read as a failed dispatch, and no double-submission can
occur.

## After this fix — resuming SP-B

This fix unblocks SP-B. Once it lands, SP-B resumes at **Task 3 (chunk 1 live
run)**: a gated live re-run of `arpg-vertical-slice-sp-b.spec.ts --grep "chunk 1"`
(keep-awake pre-flight, ~40 min cap), then the artifact-inspection checkpoint,
then Task 4 (chunk 2). No SP-B spec/plan change is needed — only the live runs
were not yet done.

## Risks & mitigations

- **A dispatch is genuinely lost (no session starts).** Without the re-dispatch
  there is no harness-level recovery — `waitForCliComplete` waits 90 s then
  fails. Mitigation: SP-A's `dispatchPromptWhenReady` app handshake already
  guarantees delivery to a mounted terminal; a genuine loss would be an SP-A
  handshake bug to fix at the source, not paper over with a re-dispatch that
  double-submits. A bounded 90 s failure is the correct, honest outcome.
- **A live session legitimately takes >90 s to *start* streaming.** 90 s is a
  generous ceiling for a cold start (D9 sessions began streaming within
  seconds). If a future environment is slower, `appearGraceMs` is still a
  parameter and can be raised without code change.
- **`isRunning` could still get stuck from some other cause.** The evidence ties
  the stuck state specifically to the double-dispatch (two tasks). If a future
  live run shows `isRunning` stuck without a double-dispatch, that is a distinct
  app bug — out of scope here, to be diagnosed then.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves the written spec.
3. `writing-plans` skill → implementation plan.
4. Execute (subagent-driven): helper change + fixture rework.
5. Resume SP-B at Task 3 (gated live re-run of chunk 1).
