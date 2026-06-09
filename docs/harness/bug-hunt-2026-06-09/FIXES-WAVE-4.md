# Bug Hunter Fix Wave 4 — Shared-singleton concurrency & process lifecycle

> 3 commits, 3 critical findings closed. 1 high (UE5 connection-manager leak) deliberately deferred — see "Deferred".
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related Blender + harness test files 16/16 pass.

## Theme

Process-wide singletons and spawned processes living in the long-lived Next.js server, shared across concurrent requests/clients, with no serialization or lifecycle teardown — so concurrent callers cross-wire a socket, a rollback wipes siblings' work, and an "abort" leaves the real process running.

## Commits

| # | Commit | Finding closed | Severity | File |
|---|--------|----------------|----------|------|
| 1 | `73a447a` | harness-autonomous-builder #1 | critical | `lib/harness/orchestrator.ts` |
| 2 | `cbb5840` | blender-mcp-integration #1 | critical | `lib/blender-mcp/service.ts` |
| 3 | `a5a5795` | cli-terminal-task-system #1 | critical | `components/cli/useTaskQueue.ts` |

## What was fixed

1. **Harness checkpoint vs concurrency** (`73a447a`). With `--checkpoint` and the default concurrency of 4, a failed area's `rollbackToLastGreen()` ran `git reset --hard` on the *shared* working tree while sibling areas were still inside live `claude -p` sessions editing files — destroying their uncommitted work and leaving them writing onto a reset tree. Checkpointing assumes sequential execution (the code comments say so, nothing enforced it). `createHarnessOrchestrator` now clamps `maxConcurrent = 1` whenever `config.checkpoint === true`, making the dangerous combination impossible.
2. **Blender socket cross-wire** (`cbb5840`). `BlenderMCPService` is a module singleton shared across concurrent route handlers; its wire protocol has no request/response correlation, so two overlapping commands each attached a `data` listener to the same socket and whichever parsed first could resolve with the *other* command's bytes (a screenshot returned as scene info, etc.). `sendCommand` now chains every command through a per-instance promise chain (`commandChain`) so exactly one request is outstanding at a time; the raw I/O moved to `sendCommandRaw`.
3. **CLI abort doesn't kill the process** (`a5a5795`). `handleAbort` closed the client `EventSource` but the `executionId` from `/api/claude-terminal/query` was discarded, so the spawned `claude.cmd` kept editing files and billing tokens until the 100-minute timeout; repeated abort-and-retry stacked concurrent orphaned editors on the same project. `executionId` is now captured into a ref at both start paths, and `handleAbort` `DELETE`s `…/query?executionId=…` (→ `abortExecution` → `process.kill`) before completing the task. Killing the process — not closing the stream — is now the definition of abort.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors |
| Related tests (blender-mcp/service, harness cost-and-heal) | 16/16 pass — Blender FIFO change preserves existing behavior |

## Deferred (not done this wave)

- **ue5-bridge-live-sync #2 — connection-manager timer/state leak (high).** The fix (reference-count SSE subscribers, `disconnect()` on zero, cap reconnect attempts) is a multi-file lifecycle change to `connection-manager.ts` + the status SSE route, touching the *working* auto-reconnect machinery the report itself notes is functional. With no way to exercise the live UE5 bridge here, a rushed lifecycle rewrite risks regressing reconnect behavior. Deferred to a focused session that can validate the bridge end-to-end. The 3 criticals — the wave's core value — are all closed.

## Cumulative status (across waves so far)

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| **Total** | | **12 / 140** | **8 / 18** | **4 / 70** |

## Patterns established (catalogue items 7–9)

7. **A process-wide singleton serving concurrent requests needs serialization.** A shared socket/connection/resource with no per-request correlation must funnel calls through a FIFO (one outstanding at a time) or add request-id framing. Never attach a fresh per-call listener to a shared stream.
8. **Mutually-unsafe config knobs must be made mutually-exclusive in code.** If feature A (checkpoint rollback) is only safe under condition B (sequential), don't document the assumption — enforce it at construction (clamp/assert), because the defaults will violate it.
9. **"Abort" must target the work, not the view.** Killing the server-side process (by a captured id) is the definition of abort; closing the client stream is cosmetic. Capture the execution handle at start so the two can never diverge.

## What remains

12 of 140 findings closed; 8 of 18 criticals. Open per the INDEX: Wave 2 (atomicity & write races — closes the last 3 unaddressed criticals: regression-tracker transaction, A/B trial counter, checklist last-writer-wins... plus economy/audio variants), Wave 3 (silent-failure safety gates), Wave 5 (UE5 codegen correctness), Wave 7 (determinism / timestamps / stale closures), and the deferred UE5 connection-manager high. Remaining criticals after this wave: 10 of 18 open.
