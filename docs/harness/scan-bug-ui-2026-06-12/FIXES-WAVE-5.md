# Bug+UI Scan Fix Wave 5 — Queues, races & orphaned async

> 5 commits, 6 High findings closed.
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0; tests (see Verification).

One mental model: **async work must be keyed to its owner (session/epoch/id), coupled to its transport's lifecycle, and tolerant of transient observation failures — never keyed to "whatever I'm currently looking at."**

## Commits

| # | Commit | Finding(s) closed | The race |
|---|---|---|---|
| 1 | `58ad766` | blender-mcp #1 + #2 | dead commands starve the queue across reconnects; a timed-out command's late response answers the NEXT command (permanent off-by-one) |
| 2 | `8870d72` | harness #2 | pause launches replacement sessions, then abandons all in-flight sessions un-awaited |
| 3 | `014bce3` | visual-asset #1 | one transient poll miss permanently fails a paid multi-minute remote generation |
| 4 | `c17cce7` | inventory #1 | switching cards mid-generation fabricates a failed completion for a run still in progress |

## What was fixed

1. **Blender queue lifecycle.** In-flight commands settle immediately on socket close/error; a timeout *poisons* the connection (teardown — stale bytes die with the socket) instead of letting the late response cross-wire the next command; an epoch counter discards entries queued before any teardown; disconnect starts a fresh chain so reconnect health checks don't wait behind dead commands.
2. **Harness pause is honest.** `fillPool` checks `paused` (no new launches after a pause, ever); pool exit drains `active` via `Promise.allSettled` and persists the plan those sessions actually produced; plan load heals stranded `in-progress` areas back to `pending`.
3. **Forge poll tolerance.** Up to 3 consecutive transport misses are tolerated (counter resets on success); only repeated misses or an explicit remote `failed` terminate; every terminal transition stamps `completedAt` (no more forever-ticking "Failed" cards).
4. **Per-session completion detection.** `useModuleCLI`'s running→stopped transition now tracks which sessionKey its previous value was observed under — a key switch resyncs (and clears the old session's analytics refs) instead of firing a false completion. *Residual (Medium, in INDEX):* after a switch the real run's completion has no subscriber, so that item's cell stays stale until refetch — staleness, no longer corruption.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` |
| `eslint` (all 4 changed files) | 0 problems |
| `vitest run` (full suite) | **3940 pass / 15 fail / 1 skip** — identical to wave 4; all failures pre-existing (blender 82, harness 64, forge 12, cli 19 targeted suites all green) |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| 3 | Destructive writes & data loss | 6 | 0 |
| 4 | UE5 codegen correctness | 4 | 0 |
| 5 | Queues, races & orphaned async | 6 | 0 |
| **Total** | | **29 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 43–46)

43. **Un-correlated wire protocols need lifecycle poisoning.** When request/response carry no id, serialization alone only prevents *concurrent* cross-wiring — a timeout desyncs the stream deterministically. Tear the connection down on timeout; stale bytes must die with their socket.
44. **Queues must be epoch-stamped.** Entries enqueued against connection N must not execute against connection N+1. Capture an epoch at enqueue; discard on mismatch at dequeue.
45. **"Pause" means: stop launching AND drain what's running.** A pause flag checked only at the loop top races every launch site in the loop body; an exit that abandons in-flight async leaves orphans mutating state after the snapshot.
46. **Completion detection belongs to the work, not the observer.** A hook that infers completion from its *current* subscription fabricates events whenever the subscription target changes. Track the key the observation was made under; resync on change.

## What remains

323 → 294 open findings. Suggested next waves (fresh session): **F+G — trust boundaries + stale state** (~8), **H + U3 — shell hazards + silent-failure UX** (~7), **U2 + a11y foundations** (ConfirmDialog, controls.tsx focus ring, shared dialog semantics), then the U1 keyboard-access sweep (2–3 waves).
