# CLI-Session Subsystem Fix — Findings

> Companion to `docs/superpowers/specs/2026-05-21-cli-session-subsystem-fix-design.md`.
> Records the bug #3 investigation outcome.

## Bug #3 investigation — the code-1 exit under chained dispatch

### What the Claude spawn/exit path does (`src/lib/claude-terminal/cli-service.ts`)

`startExecution` spawns the Claude Code CLI: on Windows, `spawn('claude.cmd', ['-p', '-', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', ...], { cwd: projectPath, shell: true, ... })`, then writes the prompt to stdin. stdout is parsed line-by-line as stream-json; each `system/init`, `assistant`, `user`, `result` message becomes a `CLIExecutionEvent`.

The process `close` handler (`cli-service.ts:268-284`):
- sets `status = code === 0 ? 'completed' : 'error'`;
- **if `code !== 0`, emits an `error` event** — `{ type: 'error', data: { exitCode, message: 'Process exited with code N' } }`;
- if `code === 0` and no `result` was seen, emits a synthetic `result`.

So a non-zero exit **does** produce a terminal `error` event. The catch is timing: that event is emitted *inside* the `close` handler, racing the SSE HTTP stream closing. If it is not flushed to the browser before the `EventSource` connection drops, the browser observes only `EventSource.onerror`. Before Fix #2, `onerror` released nothing → `session.isRunning` stuck. **Fix #2 (`useTaskQueue.connectToStream.onerror` completes the in-flight task) closes this race definitively** — a lost `error` event no longer hangs the session.

### Why acb-1's process exited code 1 — root cause found

The cli-service log for SP-B chunk-1 run #3's acb-1 execution
(`<UE project>/.claude/logs/terminal_exec-1779354425759-t2drrw_2026-05-21T09-07-05-759Z.log`):

```
[STDERR] '"C:\nvm4w\nodejs\node_modules\@anthropic-ai\claude-code\bin\claude.exe"'
         is not recognized as an internal or external command, operable program or batch file.
Process exited with code: 1, duration: 97ms
```

acb-1's `claude.cmd` (the Windows shim) **failed to resolve/execute `claude.exe`** and exited code 1 in 97 ms — before any session work. The same item ran to a clean 64 s success in the isolated verification probe minutes earlier.

**This is an environment/toolchain inconsistency, not a PoF code bug.** The path in the error (`C:\nvm4w\nodejs\...\@anthropic-ai\claude-code\bin\claude.exe`) points through **nvm-for-windows** (`nvm4w`). The Claude Code CLI is a global npm package installed under one nvm-managed Node version; if the active Node version changes, or the nvm `nodejs` symlink is mid-rebuild, or PATH is inconsistent between process spawns, `claude.cmd` resolves `claude.exe` to a path that is not currently valid → "not recognized". That the same dispatch succeeded in one run and failed 40 minutes later confirms the environment is *inconsistent*, not PoF's spawn logic.

PoF's spawn (`cli-service.ts:195-210`) is reasonable and unchanged. No `cli-service.ts` code fix is warranted — the failure is external to PoF.

### Verdict

- **Cause:** environmental — `claude.cmd` intermittently cannot resolve `claude.exe` (nvm-for-windows / global-install / PATH inconsistency on the dev machine). Not a PoF defect.
- **Non-fatal via Fix #2:** a code-1 exit now reliably completes the task as failed and releases `session.isRunning`; the step records a fail and the chained run continues instead of hanging 37 minutes.
- **No code fix applied** for #3 (spec-sanctioned outcome — investigation found no PoF code bug).

### Operational recommendation

Because the environment is *inconsistent*, future SP-B live runs are exposed to spurious step failures whenever `claude.cmd` is in a bad state — Fix #2 makes them non-fatal, but a failed `claude.cmd` still fails that step. **Before the next SP-B live run, stabilise the Claude Code CLI install:** confirm `claude --version` works in a fresh shell in the dev server's environment, and that it stays consistent across spawns (a stable Node version / a non-nvm global install of the CLI removes the moving part). This is a machine-setup action, outside PoF's code.
