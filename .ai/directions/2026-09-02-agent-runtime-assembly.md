---
subject: software-engineering/agent-runtime-assembly
project: pof
raised_by: intake intake-hermes-0902
source: librarian/sources/2026-09-02-hermes-agent.md (design record entries C1, C3, F1)
stage: the MCP server the app ships (tools/pof-mcp) and the harness-mode gate the e2e lane keys on (e2e/helpers/ci-harness.ts resolveHarnessMode)
size: 3 files / ~120 lines / M
status: accepted
---

## Why the scope implies it

The manifest scope says the project *does* "headless engine tooling, MCP wiring, UI
workflows". Those are three topologies for one tool surface: a live editor session, a
headless command-line engine run, and the web app. Today the surface that decides which
topology it is in reads the process environment (`HARNESS_MODE` / `CI` in
`e2e/helpers/ci-harness.ts:24`), which is the exact shape the source's design record calls
a silent no-op: a capability that exists only because of *who is on the other end* (an
editor that can render, a headless engine that cannot) resolved from an env var that only
the topologies the app spawned itself will carry. The registry map lists this project as a
candidate absence for the subject, and the scope admits the force directly.

## What the first context contains

A `capability-surface` context around `tools/pof-mcp/src` (the MCP tools the app exposes:
harness, design tools, growth, quality) that answers two questions the current code
answers by environment:

- **Which tools are offered to this session** - resolved from the session's own source
  (the connecting client's declared topology) at connection time, never from the server
  process's env. The source's rule: a reachability or opt-in check may be cached
  process-wide; a *surface* answer may not.
- **Which surface a contributed hook registered on** - observer (return ignored) versus
  behaviour-changing (declares which point it wraps), so a tool's power is legible from
  its registration rather than from what it happens to return. The project's
  `project-scope-guard` is already a behaviour-changing check; naming the surface is what
  makes the next one safe to add.

It must NOT absorb the engine-side toolset (`ue/PoFToolset`), the e2e harness itself, or
the MCP transport (the registry's `mcp-tools` subject owns that).

## The measurable

The regression test the source names: *the editor-topology session gets the tool with the
env var absent.* Today that assertion cannot pass. After: count of tools offered per
topology from the session source, with the env var unset, versus today's env-derived set.
Instrument: `tools/pof-mcp` contract tests (`dist/contract.itest.js` is the shape to extend).

## What would make this wrong

If every topology the app supports is spawned by the app itself and always carries the
env var, the session-sourced resolver adds a layer for no case. Check by enumerating the
topologies in `e2e/helpers/ci-harness.ts` and the editor launch path: if a client can
connect to `pof-mcp` without the app having set its environment, the direction stands.
