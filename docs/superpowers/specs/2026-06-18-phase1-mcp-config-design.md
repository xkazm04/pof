# Phase 1 — Wire `--mcp-config` into autonomous Claude Code spawns

**Date:** 2026-06-18 · **Status:** approved · **Plan:** [`docs/ue58-mcp-convergence-plan.md`](../../ue58-mcp-convergence-plan.md) Phase 1

## Goal

Let PoF's **autonomous** Claude Code spawns call UE tools (and PoF app tools) over MCP, by optionally passing `--mcp-config`. De-risks the UE-MCP loop today against the existing `mcp-unreal` (`:8090`) server — no UE 5.8 / no engine upgrade required. **Default off; off-state is byte-for-byte identical to today.**

## Scope decisions (approved)

- **Servers when on:** `mcp-unreal` **+** `pof-mcp` (both UE control and PoF app tools). Recursion risk accepted (see Risks).
- **Which spawns:** **autonomous only** — the one-shot orchestrator, `feature-matrix/batch-review`, and the **harness**. The **interactive terminal** (`claude-terminal/stream`, `query`) is excluded.
- **Activation:** per-call opt-in (`enableMcp`) **combined with** a default-off global gate (one env var). MCP args are added only when *both* hold.

## Two spawn sites (both must be wired)

1. `src/lib/claude-terminal/cli-service.ts` → `startExecution` — used by `one-shot/{propose,refine,step}` and `feature-matrix/batch-review` (autonomous) **and** `claude-terminal/{stream,query}` (interactive — excluded).
2. `src/lib/harness/claude-session.ts` → `spawnClaudeSession` (args via `buildClaudeArgs(opts)`, already has an `opts.skipPermissions` pattern) — used by `harness/executor.ts`.

## Design

### Shared helper — `src/lib/claude-terminal/mcp-config.ts` (new)
```
resolveAutonomousMcpArgs(): string[]
  // gate + source = one env var, POF_CLI_MCP_CONFIG (absolute path to an MCP config JSON)
  // unset            -> [] (feature off; default)
  // set but missing  -> [] (+ log a one-time warning)
  // set and exists    -> ['--mcp-config', <path>, '--strict-mcp-config']
```
`POF_CLI_MCP_CONFIG` is both the **gate** (unset ⇒ off) and the **source** (the file to load). Point it at the repo `.mcp.json` (already contains `mcp-unreal` + `pof-mcp`) or a curated file. `--strict-mcp-config` ⇒ the spawned session loads **only** those servers (deterministic; ignores ambient configs). No machine-specific paths committed to the repo.

### Spawn site 1 — `cli-service.ts`
- Extract arg construction into a pure, exported `buildCliArgs(opts: { resumeSessionId?: string; enableMcp?: boolean }): string[]` (testable without spawning).
  - Base (unchanged): `['-p','-','--output-format','stream-json','--verbose','--dangerously-skip-permissions']`, then `--resume <id>` if present.
  - If `enableMcp` → append `...resolveAutonomousMcpArgs()`.
- `startExecution(projectPath, prompt, resumeSessionId?, onEvent?, options?: { enableMcp?: boolean })` — new trailing optional `options`. Calls `buildCliArgs`.
- Autonomous callers pass `{ enableMcp: true }`: `one-shot/{propose,refine,step}/route.ts`, `feature-matrix/batch-review/route.ts`.
- `claude-terminal/{stream,query}/route.ts` unchanged ⇒ no MCP.

### Spawn site 2 — `harness/claude-session.ts`
- Add `enableMcp?: boolean` to the session opts; `buildClaudeArgs` appends `...resolveAutonomousMcpArgs()` when set.
- `harness/executor.ts` passes `enableMcp: true`.

### Off-state guarantee
Env unset (default) **or** `enableMcp` falsy ⇒ both arg builders return exactly today's arrays ⇒ the `@@CALLBACK` path is untouched.

## Testing (TDD)

Unit (vitest):
- `resolveAutonomousMcpArgs`: unset ⇒ `[]`; set+exists ⇒ the 3 args in order; set+missing ⇒ `[]`.
- `buildCliArgs`: base only when `enableMcp` falsy; includes resume; appends MCP args when `enableMcp` + env set; **off-state array deep-equals the pre-change literal.**
- `buildClaudeArgs` (harness): same with/without `enableMcp`.

Live acceptance (manual, documented): set `POF_CLI_MCP_CONFIG` to the repo `.mcp.json`, run an autonomous spawn (e.g. one-shot propose), confirm the `init` event's `tools` lists `mcp__mcp-unreal__*` + `mcp__pof-mcp__*` and one UE tool call succeeds. With the env unset, `tools` is unchanged.

## Risks

1. **Recursion / blast radius** — `pof-mcp` lets the spawned session call the PoF app API; could trigger nested work. Accepted; mitigated by default-off + autonomous-only + `--strict-mcp-config`.
2. **Per-spawn child processes** — each autonomous spawn launches `mcp-unreal.exe` + `node` (pof-mcp) as MCP children ⇒ extra startup latency/processes. Acceptable for long-running autonomous runs.
3. **Config drift** — pointing at `.mcp.json` couples to its contents; `--strict-mcp-config` bounds it to whatever that file declares. A curated file avoids drift if needed.

## Non-goals

No UE 5.8 / engine upgrade. No change to the interactive terminal. No options-object refactor of `startExecution` (only the trailing `options` param). No verification-spine changes.

## Verified pre-conditions

- Claude Code **2.1.181** supports `--mcp-config <configs...>` and `--strict-mcp-config` (`claude --help`).
- Repo `.mcp.json` declares `mcp-unreal` (stdio exe) + `pof-mcp` (stdio node).
