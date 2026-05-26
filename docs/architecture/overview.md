# Architecture overview

PoF (Pillars of Fortune) is a **Next.js 16 / React 19 web app that drives UE5 ARPG game development**. It holds the *authoring* truth (designs, checklists, generated specs, acceptance verdicts) in SQLite, dispatches **Claude Code CLI** sessions to produce real engine artifacts, and validates the result against the live **Unreal Engine 5.7** project through a companion bridge plugin.

## The system at a glance

```
┌──────────────────────── PoF app — Next.js 16 / React 19 / Tailwind 4 ────────────────────────┐
│  UI shell (/layout)   │  Module system   │  Prompt + CLI/Task system   │  Zustand stores       │
│            └──────────────── event bus · Lifecycle · suspend/LRU ────────────────┘             │
└──────────────┬──────────────────────────────────────────────────────────┬─────────────────────┘
               │ better-sqlite3 (server)                                    │ Claude Code CLI (stream-json)
       ┌───────▼────────┐                                          ┌────────▼─────────┐
       │ SQLite ~/.pof  │ ◄────── schema-down / content-up ──────► │  UE 5.7 project   │
       │ pof.db (WAL)   │   app validates UE schema; content       │ (realized truth)  │
       │ authoring SoR  │   flows app → UE via seeds / codegen     └────────┬─────────┘
       └────────────────┘                                   PoF Bridge plugin :30040
                                                          + headless UnrealEditor-Cmd
```

**Two halves, one contract.** The app is the **system-of-record for intent** (what should exist, in what shape, and whether it passes). The UE project is the **realized truth** (compiled C++, DataTable rows, assets, maps). They meet at a locked **schema-down / content-up** contract: the app *validates against* the UE schema and never re-authors it; content flows app → UE via seed scripts and generated C++. See [`../catalog/WIRING-AND-ACCEPTANCE.md`](../catalog/WIRING-AND-ACCEPTANCE.md).

## Subsystems

| Subsystem | Doc | What it owns |
|-----------|-----|--------------|
| **UI shell** | [ui-shell.md](ui-shell.md) | The `/layout` homepage (Category→Catalog→Entity tree + the Baseline composition screen + step rendering + the server-backed produce→persist→rollup loop + the UE bridge strip). |
| **Module system** | [module-system.md](module-system.md) | The game-dev domains: sub-module registry (checklists/quick-actions/knowledge-tips), the feature dependency graph + NBA engine, and the per-module evaluator passes. |
| **Prompts + CLI/tasks** | [prompts-and-cli.md](prompts-and-cli.md) | The composable 6-section prompt builder, the unified `CLITask`/`TaskFactory` abstraction, the `@@CALLBACK` result-capture flow, `useModuleCLI`, and skills packs. |
| **State + persistence** | [state-and-persistence.md](state-and-persistence.md) | Zustand v5 stores (+ persist gotchas), the SQLite layer (`*-db.ts`), and the `{success,data}` API envelope (`apiFetch`/`tryApiFetch`/`useCRUD`). |
| **Runtime patterns** | [runtime-patterns.md](runtime-patterns.md) | The typed event bus, the `Lifecycle` protocol, the suspend/LRU pattern, and the enforced coding conventions. |
| **Catalog pipeline** | [../catalog/index.md](../catalog/index.md) | The StepSpec chassis that turns a catalog "row" into a tested, UE-wired pipeline — the bulk of recent work. |
| **UE integration** | [../ue5-companion-plugin-design.md](../ue5-companion-plugin-design.md) · [../catalog/L3-L4-RUNNER.md](../catalog/L3-L4-RUNNER.md) | The PoF Bridge plugin (HTTP on :30040) and the L3/L4 test-gate runner that drives headless verification. |

## A catalog row's lifecycle (the spine)

1. **Author** — a row is a `StepSpec[]` in `src/lib/catalog/pipelines/<catalogId>.ts`; it renders in `/layout` through the generic `ArchetypeStep` ([catalog](../catalog/index.md)).
2. **Produce** — each step's Produce panel dispatches a CLI task (canon-injected prompt) or generator; the output is persisted to the `pipeline_artifacts` SQLite table via the `@@CALLBACK`/API path.
3. **Accept** — each step derives a verdict on the 4-tier ladder (L0 data · L1 selection · L2 static · L3 runtime · L4 visual). **Config-complete = L0–L2 pass or honest L3/L4 deferral.**
4. **Verify (L3/L4)** — deferred runtime/visual gates drain through the test-gate runner against the live editor ([runner](../catalog/L3-L4-RUNNER.md)).
5. **Gate** — content fidelity + wiring pass a blocking review ([quality gate](../catalog/QUALITY-GATE.md)) before the row is "done".

## Tech stack

Next.js 16 (App Router) · React 19.2 · Zustand 5 (persist) · better-sqlite3 (WAL, `serverExternalPackages`) · Tailwind CSS 4 · Vitest · TypeScript (strict) · `@/` → `src/` path alias. The UE side is UE 5.7 with the PoF Bridge editor plugin.

## Where things live

```
src/
  app/            Next routes + API handlers ({success,data} envelope)
  components/
    layout-lab/   the /layout shell (Baseline, CatalogTree, ArchetypeStep, …)
    modules/      per-domain module UIs (core-engine / content / game-systems / …)
  lib/
    catalog/      the pipeline chassis: pipelines/, acceptance/, canon/, stepSpec.ts
    test-gate-runner/  the L3/L4 drain runner (bridge / spawn / visual executors)
    prompts/      per-module prompt builders + prompt-builder.ts
    claude-terminal/   cli-service.ts (spawns Claude Code), skills.ts
    *-db.ts       SQLite access per domain; db.ts is the singleton
    event-bus.ts · lifecycle.ts · logger.ts · chart-colors.ts · constants.ts
  stores/         Zustand stores + services/ProjectModuleBridge.ts
  hooks/          useModuleCLI, useSuspend, useLifecycle, useCRUD
  types/          api.ts, result.ts, modules.ts, event-bus.ts, pof-bridge.ts
```

See [the top-level README](../README.md) for the full document map.
