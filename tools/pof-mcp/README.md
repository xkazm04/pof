# pof-mcp

A headless **MCP server** that exposes PoF's catalog **pipelines** and the autonomous
**harness** as tools, so you can drive UE5 game-dev tasks directly from the Claude Code
CLI — the same product pipelines the `/layout` lab UI runs, without the UI.

It is a **thin adapter** over the running PoF Next.js backend: every tool proxies to an
existing PoF route and unwraps the `{ success, data }` envelope. The backend (its SQLite
and its single shared harness orchestrator) stays the source of truth — a run you start
from the CLI is the same run the web UI sees.

## Division of labor

| Server | Owns |
|--------|------|
| **pof-mcp** (this) | PoF's *structured* layer: pipelines, derived acceptance, persistence, the harness, the gate-drain |
| **mcp-unreal** | *Raw* Unreal ops: run a script, capture a viewport, build the project, GAS/material/asset ops |

The orchestrating Claude composes both. pof-mcp deliberately does **not** duplicate raw
UE control.

## The model: Claude does the work, PoF provides structure + truth

`pof_get_step` returns a **recipe** (canon-prefixed prompt + acceptance contract + UE
asset targets), Claude does the actual generation/UE edits itself (using mcp-unreal), then
`pof_submit_artifact` records the work and the **server** derives the pass/pending/fail/
deferred verdict — Claude never self-grades.

## Tools

**Pipeline loop**
- `pof_list_catalogs` — catalogs + ordered steps + entity counts
- `pof_list_entities {catalogId}` — seeded entities + lifecycle
- `pof_get_pipeline {catalogId}` — steps + entities for one catalog
- `pof_get_step {catalogId, entityId, step, direction?}` — the **recipe** (structure + truth)
- `pof_submit_artifact {catalogId, entityId, step, data, ueAssets?}` — submit work → derived verdict
- `pof_get_acceptance {catalogId, entityId?}` — per-step status + rollup
- `pof_drain_gates {catalogId, entityId, tier?, allowSpawn?}` — run deferred L3/L4 gates on the live editor

**Harness loop**
- `pof_harness_start {projectPath, projectName, ueVersion, …}` — start plan→execute→verify→checkpoint. Steering levers: `statePath` (a start over an existing state path RESUMES that run), `fork`, `targetPassRate`, `passRateBasis` (`verified` default | `self-reported`), `sessionTimeoutMs`, `areaPassThreshold`, `themeDirective` (creative direction, ≤2000 chars), `budgetUsd`/`unlimited`, `maxConcurrent`, `scenario`, `checkpoint`, `ueTests`/`ueTestFilter`, `ueVisual` (the game-runs gate)
- `pof_harness_status {feed?, statePath?}` — run state, progress (incl. `verifiedPassRate` + `selfReportedPassRate`), cost, checkpoints, events; `feed: events|progress` swaps in the raw feeds; `statePath` reads the run bound to that dir from disk (`source:'disk'`, `resumable`) so a post-restart status is never a false `idle`
- `pof_harness_plan` — full game plan
- `pof_harness_control {action: pause|resume, statePath?}` — pass `statePath` so a resume AFTER A SERVER RESTART rehydrates the same run from disk instead of 409ing
- `pof_harness_guide` — generated build guide / learnings
- `pof_harness_runs {limit?, project?}` — run history (newest first)
- `pof_harness_run {runId}` — full plan/progress/guide/cost snapshot of one run
- `pof_harness_run_diff {a, b}` — compare two runs (pass-rate/cost/duration deltas + per-area changes)

### Annotations (blast radius)

Every tool advertises MCP `ToolAnnotations` on `tools/list` — `readOnlyHint`,
`destructiveHint`, `idempotentHint`, `openWorldHint` — so a host can tier consent instead
of confirming every call: the reads (`pof_get_*`, `pof_list_*`, status/history/evidence)
are read-only; `pof_submit_artifact`, `pof_ue_compile`/`_run_tests`/`_build`,
`pof_package_preflight`, `pof_economy_simulate` and `pof_gdd_compliance` write; `pof_drain_gates`
and `pof_harness_start` are destructive (verdict flips, editor boots, an autonomous session
that spends budget). The hints are claims, pinned to behaviour by `annotations.test.ts`: a
read-only tool may POST only to a route allow-listed in `src/coverage.ts` → `READ_ONLY_POST`,
whose source is checked for write primitives. A tool that reaches no route at all must say so
in `LOCAL_ONLY` with a reason, or the probe refuses its hint as unverified.

### Tool groups (advertised surface)

The surface is partitioned into five families — `pipeline`, `harness`, `sims`, `ue`, `design`
(`src/tools/groups.ts`) — and an operator may trim what a given client sees by setting
`POF_MCP_TOOL_GROUPS` in that client's `.mcp.json` (`"env": { "POF_MCP_TOOL_GROUPS": "pipeline,ue" }`).

Gating is **opt-in and static**: unset, blank or `all` advertises everything, so an
autonomous harness run cannot silently lose a capability it had yesterday. There is no
in-session `activate` — that needs `tools/listChanged`, which clients honour unevenly.
A gated-out tool is REFUSED at `CallTool` with a message naming its group, never silently
run, so "listed" and "callable" stay the same set. `pof_tool_groups` is never gated: it
reports every group, which are hidden, and the tool names inside them, so a trimmed session
can say what it is missing instead of concluding the capability does not exist.

## Build & test

```bash
cd tools/pof-mcp
npm install
npm run build            # tsc → dist/
npm test                 # Layer 0: schema + registry + tools/list parity (no backend)
npm run test:integration # Layers 1–2: contract + quality (needs the backend; skips cleanly if down)
npm run gen:docs         # regenerate TOOLS-REFERENCE.md from live example responses
```

- **`npm test`** is backend-free (schema validation, example-coverage guard, `tools/list` parity).
- **`npm run test:integration`** drives every tool through the real server against a running
  PoF backend: it documents each tool (contract examples) and asserts outcome quality (the
  pipeline recipe walk across all catalogs, simulator sanity, design-truth invariants). Set
  `POF_APP_ORIGIN` to the backend; for isolation start the backend with `POF_DB_PATH` pointing
  at a throwaway DB. See `TEST-PLAN.md` for the full layered strategy and `TOOLS-REFERENCE.md`
  for the generated per-tool reference.

### Live UE growth (`growth.live.itest.ts`)

Tier 1 scans the connected UE project on disk through the MCP (`POF_UE_ROOT` / `POF_UE_MODULE`,
default the PoF project), ratchets non-regression of its class/asset counts, and appends a row
to `GROWTH-LOG.md`. It runs as part of `test:integration` and needs only the project on disk.
Tier 2 drains the growth garden's gates against a **live** editor and is gated on `POF_LIVE_UE=1`
+ the PoF bridge plugin (port 30040) running — it skips with a reason otherwise.

## Register with Claude Code

Add to the orchestration project's `.mcp.json` (alongside `mcp-unreal`). The PoF backend
must be running (`npm run dev` in the app) and `POF_APP_ORIGIN` must match its port:

```json
{
  "mcpServers": {
    "pof-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\Users\\kazda\\kiro\\pof\\tools\\pof-mcp\\dist\\index.js"],
      "env": { "POF_APP_ORIGIN": "http://127.0.0.1:3001" }
    }
  }
}
```

`POF_APP_ORIGIN` resolution: explicit env → `PORT` → `http://127.0.0.1:3000` default. Set
it to wherever `next dev` is serving the PoF app (the PoF Next app port, **not** 3000 if
that's another service).

## Requirements

- Node ≥ 18 (uses global `fetch`).
- The PoF Next.js app running as a backend daemon (no web UI needed).
- For `pof_drain_gates`: the PoF UE bridge plugin reachable (the app handles this).
