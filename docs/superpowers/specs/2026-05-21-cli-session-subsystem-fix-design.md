---
date: 2026-05-21
status: draft
sub_project: CLI-session subsystem fix (SP-B remediation, app-side)
parent_initiative: PoF end-to-end ARPG vertical-slice scenario — post-D9 roadmap (P0–P3)
predecessor_docs:
  - docs/superpowers/specs/2026-05-21-harness-cli-session-detection-fix-design.md
  - docs/superpowers/specs/2026-05-20-arpg-vertical-slice-sp-b-design.md
inputs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-21-live-sp-b-chunk1.md
---

# CLI-Session Subsystem Fix

## Context

SP-B's gameplay-chain live run failed three times across 2026-05-20/21, each on
a different defect. A diagnostic probe and source investigation pinned the two
root causes precisely; both are **app bugs** in PoF's CLI-session subsystem,
exposed by the autonomous harness driving back-to-back same-module dispatches.

This is the app-side remediation the user chose over reducing SP-B's ambition
or wrapping the initiative. It is a prerequisite for SP-B's gameplay-chain live
runs.

### Bug #1 — `CompactTerminal` auto-submit is unreliable

`CompactTerminal.tsx:101-108` — when a `pof-cli-prompt` event fills the terminal
input, an effect is meant to auto-submit it:

```ts
useEffect(() => {
  if (pendingPromptRef.current && input === pendingPromptRef.current && !tq.isStreaming) {
    pendingPromptRef.current = null;
    const timer = setTimeout(() => handleSubmit(tq.sessionId !== null), UI_TIMEOUTS.autoSubmitDelay);
    return () => clearTimeout(timer);
  }
}, [input, tq.isStreaming, tq.sessionId, handleSubmit]);
```

The effect returns `clearTimeout(timer)` as cleanup. The effect's deps include
`handleSubmit`, a `useCallback` keyed on `[input, tq, history]`. `input` changes
when the prompt is set, and `tq` (the `useTaskQueue` return) is a fresh object
each render — so `handleSubmit` is recreated on essentially every render, the
effect re-runs, and its **cleanup cancels the 50 ms submit timer before it
fires**. The prompt only submits in the rare event of a >50 ms render-quiet
window. The diagnostic probe caught the failure state directly: the full
9 226-char prompt sitting in the input, terminal "Ready", no session.

### Bug #2 — `session.isRunning` is never cleared on an abnormal process exit

`useTaskQueue.ts` — `connectToStream`'s `eventSource.onerror` (line ~372) closes
the SSE stream but **does not call `onTaskComplete`**:

```ts
eventSource.onerror = () => { eventSource.close(); eventSourceRef.current = null; };
```

`onTaskComplete` is what clears `session.isRunning` (`InlineTerminal.tsx:154`).
It is fired only from the `result` and `error` SSE event handlers. When a Claude
process exits abnormally (code 1) and the server emits no clean `result`/`error`
SSE event — the stream just errors and closes — `onTaskComplete` never fires and
`session.isRunning` stays `true` forever. Every same-module "Claude" button is
`disabled={isRunning}`, so the next same-module dispatch can never click → the
SP-B chunk-1 run #3 hung for 37 minutes on exactly this.

### Bug #3 — acb-1's Claude process exited code 1 under chained dispatch

In run #3, acb-1's Claude process exited with code 1. The same item ran cleanly
to a 64 s success when dispatched in isolation (the verification probe). Why it
fails under chained dispatch is unexplained — possibly transient, possibly a
concurrent-session or spawn issue. **Crucially, fixing #2 makes #3 non-fatal**:
a failed process would release `isRunning`, record a failed step, and let the
chain continue. #3 is scoped here as an *investigation*, not a guaranteed fix.

## Goals

1. Fix #1 so a dispatched `pof-cli-prompt` reliably submits and starts a session.
2. Fix #2 so any abnormal stream termination releases `session.isRunning`.
3. Investigate #3 — find the cause of the code-1 exit, or conclude it is
   transient and rely on #2 to keep it non-fatal.
4. Verify deterministically / observably before any chained live run.

## Non-goals

- **No new CLI features.** Bug fixes only.
- **No rewrite of `useTaskQueue` / the CLI service.** Targeted fixes following
  existing patterns.
- **No SP-B spec change.** SP-B resumes unchanged once this lands.
- **#3 is not guaranteed a root-cause fix** — the investigation may legitimately
  conclude "transient; non-fatal via #2".

## Decision record (from brainstorming)

1. **Scope:** fix the app's CLI-session subsystem (chosen over single-dispatch
   SP-B mode, or wrapping the initiative on findings).
2. **#1 fix — Approach A:** submit directly from the `pof-cli-prompt` handler,
   eliminating the `setInput → effect → clearTimeout'd timer` mechanism (vs.
   Approach B, stabilising the effect's deps — rejected as fragile).
3. **#3 is scoped as an investigation**, with #2 guaranteeing non-fatality.

## Design

### Fix #1 — reliable auto-submit (`src/components/cli/CompactTerminal.tsx`)

Remove the auto-submit `useEffect` (lines 101-108) entirely. The `pof-cli-prompt`
handler submits the prompt **directly**:

- The handler still calls `setInput(prompt)` so the prompt is visible in the
  terminal, but it no longer relies on a downstream effect to submit.
- It submits by calling the task-queue's `submitPrompt` directly with the prompt
  value in hand. Because the handler lives in a `useEffect` keyed on
  `[instanceId]`, it must reach the *current* `submitPrompt` (and `sessionId`)
  through a ref updated every render (`tqRef`), not a stale closure.
- `pendingPromptRef` and the separate auto-submit effect are deleted — the
  prompt value is passed straight through, never round-tripped through `input`
  state and a timer.

This removes the entire race: there is no timer for a re-render to cancel.
`handleSubmit`'s own guard (`if (!input.trim() || tq.isStreaming) return`) and
the task queue's idempotency guard (`dispatchedTaskIds`) remain, so a manual
click or the harness Send-click cannot double-submit alongside the direct path.

Exact ref mechanics and the `submitPrompt` signature are settled during
planning by reading the current `useTaskQueue` return shape.

### Fix #2 — abnormal exit releases the session (`src/components/cli/useTaskQueue.ts`)

`connectToStream`'s `eventSource.onerror` must complete the in-flight task as
failed before closing:

```ts
eventSource.onerror = () => {
  eventSource.close();
  eventSourceRef.current = null;
  const tid = currentTaskIdRef.current;
  if (tid) {
    registerTaskComplete(tid, instanceId, false);
    onTaskComplete?.(tid, false);
  }
};
```

This mirrors the existing `result`/`error` SSE handlers. Guard against a
double-complete: if the `result`/`error` handler already completed the task,
`onerror` must not fire `onTaskComplete` a second time (the `result`/`error`
handlers also close the EventSource, which can itself trigger `onerror`). The
plan adds a per-task "already completed" guard (a ref) so `onTaskComplete` fires
exactly once per task regardless of which path observes the end. Exact guard
placement is settled during planning by reading the full `connectToStream` /
`handleSSEEvent` flow.

### Investigate #3 — the code-1 exit

A scoped investigation, not a predetermined fix:

- Read `src/lib/claude-terminal/cli-service.ts`: how the Claude CLI is spawned,
  how stdout/stderr/exit are handled, what surfaces as "Process exited with
  code 1", and whether a code-1 exit emits a `result`/`error` SSE event or only
  closes the stream.
- Examine concurrent / back-to-back same-module session handling — acb-1 and
  acb-4 reuse one combat session (`findSessionByKey`); look for state that an
  isolated dispatch would not hit.
- Deliverable: either a found cause with a fix, or a written conclusion in the
  findings that it is transient/environmental — with #2 keeping it non-fatal.

If the investigation finds a concrete, low-risk fix, it is included; if it finds
nothing deterministic, that is an acceptable, documented outcome.

## Verification

App code, event-driven — verified by a mix of unit tests and short live/observable probes; **no chained 40-min live run until these pass**.

- **#2 unit test (where isolatable):** if the `onerror`→complete logic can be
  exercised against a faked EventSource / task-queue surface in vitest+jsdom,
  add a test asserting an abnormal close fires `onTaskComplete(tid, false)`
  exactly once and not twice when a `result` already completed the task. If the
  code is too React-entangled to isolate cleanly, this is covered by the live
  probe below instead — the plan decides based on the actual `useTaskQueue`
  structure.
- **#1 live probe:** a short single-dispatch live spec (the diagnostic-probe
  pattern, no `--trace`) — dispatch acb-1, assert a session starts and completes
  *without* the harness Send-click workaround, proving auto-submit now works.
- **#2 live probe:** dispatch an item, abort/kill its session mid-run, assert
  `session.isRunning` clears and a follow-on same-module dispatch can proceed.
- **`npm run validate`** (typecheck + lint + full vitest) green — this is app
  source; no regression in the existing suite.

## Cross-cutting

- **Branch:** `master`.
- **App source IS modified:** `CompactTerminal.tsx`, `useTaskQueue.ts`, possibly
  `cli-service.ts` (only if #3 finds a fix). All targeted, pattern-following.
- **The SP-B harness Send-click workaround** (`dispatchRoadmapChecklistItem`,
  commit `dbd2c92`) stays for now as defense-in-depth; whether to remove it once
  #1 is fixed is a planning decision (it is idempotent-safe either way).
- **No worktree.** Commit locally only — the user pushes manually.

## Definition of done

1. #1: the auto-submit effect is removed; the `pof-cli-prompt` handler submits
   directly; a dispatched prompt reliably starts a session.
2. #2: an abnormal SSE stream close fires `onTaskComplete(tid, false)` exactly
   once; `session.isRunning` is released on a process error-exit.
3. #3: a written conclusion — a cause + fix, or a documented "transient,
   non-fatal via #2" — in the findings.
4. `npm run validate` green.
5. The #1 and #2 live probes pass.
6. Committed to `master`; chat summary.

**Success criterion:** a dispatched prompt reliably starts a session (no
Send-click crutch needed), and a failed/aborted session always releases
`isRunning` so the next same-module dispatch is never blocked — removing the two
defects that hung SP-B's chunk-1 runs.

## After this fix — resume SP-B

Once this lands and its probes pass, SP-B resumes at **Task 3 (chunk 1 live
run)**. The harness Send-click workaround is harmless if kept; the real fix is
now in the app. The next chained live run is gated on these probes being green.

## Risks & mitigations

- **#1's direct-submit reintroduces a stale closure** (handler in an
  `[instanceId]` effect capturing an old `submitPrompt`). Mitigation: a
  per-render-updated `tqRef`; the plan verifies the ref is read at call time.
- **#2 double-completes a task** (both the `result` handler and `onerror` fire).
  Mitigation: a per-task completed-guard ref; `onTaskComplete` fires once.
- **#3 has no deterministic repro.** Mitigation: the investigation is
  time-boxed; #2 guarantees a code-1 exit is non-fatal regardless, so SP-B is
  unblocked even if #3's cause is never pinned.
- **App-source regression.** Mitigation: `npm run validate` (full vitest) is the
  gate; changes are targeted and follow existing handler patterns.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves the written spec.
3. `writing-plans` skill → implementation plan.
4. Execute (subagent-driven).
5. Resume SP-B at Task 3 (gated chunk-1 live run).
