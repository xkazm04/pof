# The LLM ↔ Unreal Engine Harness

This folder documents the machinery that lets an LLM/agent **drive and verify Unreal Engine 5** — the bridge between "an AI authored some content" and "the engine actually does the thing." It has two layers, each with its own doc:

| Doc | What it covers |
|-----|----------------|
| [`llm-ue-interface.md`](llm-ue-interface.md) | The **verification & control interface**: the Observation Spine (Tiers of Truth), the PoF Bridge plugin (`:30040`), the test-gate-runner (L3/L4 drain), the `pof-mcp` UE tools, and the CLI callback system. |
| [`autonomous-builder.md`](autonomous-builder.md) | The **autonomous game-builder loop** (`src/lib/harness/`): plan → execute → verify → self-heal → checkpoint, run by a streaming pool of Claude Code sessions with budget governance and git rollback. |

---

## Why this exists

PoF's whole premise is that an AI can author game content *and prove it works*. The hard part is the proof. A symbolic gate ("the Blueprint compiles", "the property is set") can be green while the rendered result is wrong — the canonical example is the player-movement **T-pose**: every structural check passed, yet the character stood frozen in a reference pose. The harness exists to make "done" mean **observed**, not **assumed**.

Two complementary ideas:

1. **Never claim done without a ground-truth observation.** Verification is tiered (T0 existence → T4 a seeing agent reads a rendered frame). Higher tiers cost more but catch what lower tiers can't. This is the *interface* layer.

2. **Close the loop autonomously.** A long-running orchestrator plans coherent chunks of work, spawns CLI sessions to implement them, runs quality gates, self-heals common failures, and snapshots green states so it can roll back. This is the *builder* layer.

---

## How the two layers relate

```
            ┌─────────────────────────── autonomous-builder.md ──────────────────────────┐
            │  HarnessOrchestrator: plan → [streaming pool of executor sessions] → verify  │
            │     ↑ checkpoint/rollback (git)     ↑ self-heal      ↑ budget governor       │
            └───────────────┬──────────────────────────────────────┬───────────────────────┘
                            │ spawns                                 │ verifies via gates
                            ▼                                        ▼
                   Claude Code CLI sessions            ┌──── llm-ue-interface.md ───────────┐
                   (callback-marker results)           │  Observation Spine (T0–T4)         │
                            │                           │  PoF Bridge plugin  :30040         │
                            │ author content / drive    │  test-gate-runner (L3/L4 drain)    │
                            ▼                           │  pof-mcp UE tools                  │
              SQLite pipeline_artifacts  ◀──────────────┤  CLI callback system               │
              (catalog pipeline truth)                  └──────────────┬─────────────────────┘
                                                                       │ HTTP :30040
                                                                       ▼
                                                          UE 5.x editor + PoF Bridge plugin
                                                          (realized C++, assets, PIE, frames)
```

- The **catalog pipelines** (see [`../pipeline-architecture.md`](../pipeline-architecture.md)) produce `deferred` L3/L4 acceptance markers. The **interface layer's** test-gate-runner drains those against the live editor and flips them to `pass`/`fail`.
- The **builder layer** is a separate, higher-level loop: it builds whole *features/modules* (not single catalog entities) and uses its own quality gates (typecheck, lint, test, visual). Both layers spawn Claude Code CLI sessions and both ultimately ground out in the same PoF Bridge to Unreal.

---

## At a glance

| Capability | Layer | Entry point |
|-----------|-------|-------------|
| Run a UE automation test, read its verdict | interface | `:30040/pof/test/run-automation`, `pof_ue_run_tests` |
| Capture a rendered frame for an agent to read | interface | `:30040/pof/snapshot/capture`, Observation `CaptureFrame` |
| Dispatch Python on the editor thread | interface | `:30040/pof/python/run`, `runPython()` |
| Drain deferred L3/L4 catalog gates | interface | `/api/pipeline-artifacts/drain`, `pof_drain_gates` |
| Start/steer an autonomous build run | builder | `/api/harness`, `pof_harness_start` / `pof_harness_control` |
| Inspect plan / guide / cost / checkpoints | builder | `/api/harness?action=…`, `pof_harness_plan` / `pof_harness_guide` |

Everything here is **Blueprint / going-forward**. The retired `mcp-unreal` Go server (`:8090`) is noted in the interface doc only for historical context.
