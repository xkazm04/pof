/**
 * Shared Claude Code CLI session spawner for the harness.
 *
 * Both the executor (`executeArea`) and the orchestrator's self-heal pass spawn
 * `claude -p` with the same platform switch, arg assembly, stdin write, SIGTERM
 * timeout, and stream-json parsing. This module is the single, testable surface
 * for that — so a change to a flag, timeout, or parse rule lands in one place
 * instead of drifting between two hand-rolled copies.
 *
 * It also single-sources the `@@HARNESS_RESULT` marker contract that sessions
 * use to report structured results, so the prompt builders and the parser can't
 * disagree about the format.
 */

import { spawn, exec, type ChildProcess } from 'child_process';
import { resolveAutonomousMcpArgs } from '@/lib/claude-terminal/mcp-config';

// ── Process-tree kill (shared by every harness spawn) ────────────────────────

/**
 * How long to wait for the OS kill command to report back before we stop waiting
 * for a CONFIRMED outcome. Bounded so a hung `taskkill` can never stall the loop;
 * the kill has still been issued, we just report it as unconfirmed.
 */
const KILL_CONFIRM_TIMEOUT_MS = 5_000;

/** Which mechanism was used to kill the process (see {@link killProcessTree}). */
export type TreeKillMethod = 'taskkill' | 'process-group' | 'direct' | 'none';

export interface TreeKillOutcome {
  method: TreeKillMethod;
  /** True only when the kill was issued AND the OS reported no failure. */
  killed: boolean;
  /** What actually happened, for the caller's error log — stated, never assumed. */
  detail: string;
}

/**
 * Kill a spawned process AND its descendants.
 *
 * Every harness spawn that goes through a shell (`shell: isWindows` for
 * `claude.cmd`, `shell: true` for the dev server) makes `proc.pid` the wrapping
 * `cmd.exe`, not the real work process. `proc.kill()` then reaps the shell and
 * ORPHANS the child — a `claude -p` session that keeps running and keeps
 * spending after the harness believes it stopped it, or a `next dev` still
 * holding the port. `taskkill /T` on win32 (the tree), the process group on
 * POSIX with a direct-kill fallback.
 *
 * Scoped strictly to `proc`'s own tree — it can never signal the harness process
 * itself. This is the ONE kill implementation for the subsystem: the session
 * timeout and the dev-server teardown both call it, so they cannot drift apart.
 *
 * @param posixSignal signal used on non-Windows, where the spawned process IS the
 *   real one and no shell wrapper exists. Defaults to `SIGTERM` (graceful); the
 *   dev server passes `SIGKILL` because it must release the port immediately.
 */
export function killProcessTree(
  proc: ChildProcess,
  opts: { posixSignal?: NodeJS.Signals } = {},
): Promise<TreeKillOutcome> {
  const pid = proc.pid;
  if (pid == null) {
    // Never spawned (or already reaped) — there is no tree to kill. Still try the
    // direct kill so a half-started process cannot linger.
    let killed = false;
    try { killed = proc.kill(); } catch { /* ignore */ }
    return Promise.resolve({
      method: 'none',
      killed,
      detail: 'process had no pid (never spawned or already reaped); issued a direct kill',
    });
  }

  if (process.platform === 'win32') {
    return new Promise<TreeKillOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: TreeKillOutcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(outcome);
      };
      const guard = setTimeout(() => finish({
        method: 'taskkill',
        killed: false,
        detail: `taskkill /pid ${pid} /T /F did not report back within ${KILL_CONFIRM_TIMEOUT_MS}ms — kill issued but UNCONFIRMED`,
      }), KILL_CONFIRM_TIMEOUT_MS);

      try {
        exec(`taskkill /pid ${pid} /T /F`, (err, _stdout, stderr) => {
          finish(err
            ? {
                method: 'taskkill',
                killed: false,
                // "not found" here usually means it had already exited — say so
                // rather than implying we killed something.
                detail: `taskkill /pid ${pid} /T /F failed: ${(stderr || err.message).trim()}`,
              }
            : { method: 'taskkill', killed: true, detail: `taskkill /pid ${pid} /T /F killed the process tree` });
        });
      } catch (err) {
        finish({
          method: 'taskkill',
          killed: false,
          detail: `could not run taskkill for pid ${pid}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }

  // POSIX: try the process group first (covers any children the session spawned),
  // then fall back to signalling the process directly.
  const signal = opts.posixSignal ?? 'SIGTERM';
  try {
    process.kill(-pid, signal);
    return Promise.resolve({
      method: 'process-group',
      killed: true,
      detail: `sent ${signal} to process group ${pid}`,
    });
  } catch {
    let killed = false;
    let detail = `process group ${pid} not signalable; sent ${signal} directly to pid ${pid}`;
    try {
      killed = proc.kill(signal);
    } catch (err) {
      detail = `process group ${pid} not signalable and direct ${signal} failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    return Promise.resolve({ method: 'direct', killed, detail });
  }
}

/** Resolve after `ms` — used only to bound how long we wait for a kill report. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Kill a session that blew its timeout and RECORD what the kill actually did.
 * A timed-out session used to report only "timed out" while a `SIGTERM` to the
 * wrapping shell left the real `claude -p` alive and spending; the outcome is now
 * appended to the same `errors` the caller returns, so it is never assumed.
 */
export async function killTimedOutSession(
  proc: ChildProcess,
  timeoutMs: number,
  errors: string[],
): Promise<TreeKillOutcome> {
  errors.push(`Session timed out after ${timeoutMs}ms`);
  const outcome = await killProcessTree(proc);
  errors.push(`Timeout kill (${outcome.method}): ${outcome.detail}`);
  return outcome;
}

// ── @@HARNESS_RESULT marker contract ─────────────────────────────────────────

/** Opening sentinel for the JSON a session emits on completion. */
export const HARNESS_RESULT_START = '@@HARNESS_RESULT';
/** Closing sentinel for the result JSON. */
export const HARNESS_RESULT_END = '@@END_HARNESS_RESULT';

/**
 * Regex extracting the JSON body between the markers (capture group 1).
 * Built from the marker constants so the parser can never diverge from them.
 */
export const HARNESS_RESULT_REGEX = new RegExp(
  `${HARNESS_RESULT_START}\\s*\\n([\\s\\S]*?)\\n\\s*${HARNESS_RESULT_END}`,
);

/**
 * Wrap a JSON body — a schema template the model fills in, or a literal payload
 * it should echo — in the result markers. Use this in every prompt builder so
 * the emitted contract matches what {@link HARNESS_RESULT_REGEX} parses.
 */
export function wrapHarnessResult(body: string): string {
  return `${HARNESS_RESULT_START}\n${body}\n${HARNESS_RESULT_END}`;
}

// ── CLI spawn ────────────────────────────────────────────────────────────────

export interface ClaudeSessionOptions {
  /** Working directory for the spawned process (the project path). */
  cwd: string;
  /** Tools passed via `--allowedTools`. Empty/omitted → flag not added. */
  allowedTools?: string[];
  /** Pass `--dangerously-skip-permissions`. */
  skipPermissions?: boolean;
  /** Pass `--bare` (faster startup, no hooks/skills). */
  bareMode?: boolean;
  /** Pass `--verbose`. */
  verbose?: boolean;
  /**
   * Autonomous opt-in to load MCP servers via `--mcp-config` (gated by the
   * POF_CLI_MCP_CONFIG env var — default off). See `resolveAutonomousMcpArgs`.
   */
  enableMcp?: boolean;
  /** Kill the session with SIGTERM after this many ms. */
  timeoutMs: number;
  /** Called with each assistant text block as it streams in. */
  onOutput?: (chunk: string) => void;
}

export interface ClaudeSessionResult {
  /** Assistant text extracted from the stream, falling back to raw stdout. */
  output: string;
  /** Cost in USD if the CLI reported a `result` message carrying `cost_usd`. */
  costUsd?: number;
  /** Process exit code, or null if it errored before exit / was killed. */
  exitCode: number | null;
  /** stderr lines, spawn errors, and timeout notices. */
  errors: string[];
  /** Session id from the stream-json `init` message, if seen. */
  sessionId?: string;
  /** True when the session blew `timeoutMs` and was killed. See `errors` for the kill outcome. */
  timedOut?: boolean;
}

/**
 * Assemble the `claude -p` argv from session options. Pure + testable so the
 * flag matrix (verbose / skip-permissions / bare / allowed-tools) is verifiable
 * without spawning a process.
 */
export function buildClaudeArgs(
  opts: Pick<ClaudeSessionOptions, 'allowedTools' | 'skipPermissions' | 'bareMode' | 'verbose' | 'enableMcp'>,
): string[] {
  const args = ['-p', '-', '--output-format', 'stream-json'];
  if (opts.verbose) args.push('--verbose');
  if (opts.skipPermissions) args.push('--dangerously-skip-permissions');
  if (opts.bareMode) args.push('--bare');
  if (opts.allowedTools && opts.allowedTools.length > 0) {
    args.push('--allowedTools', opts.allowedTools.join(','));
  }
  if (opts.enableMcp) args.push(...resolveAutonomousMcpArgs());
  return args;
}

/**
 * Spawn a `claude -p` session, write `prompt` to stdin, and parse the
 * stream-json output. Resolves (never rejects) with the accumulated assistant
 * text, reported cost, exit code, errors, and session id. A SIGTERM is sent
 * after `opts.timeoutMs`; the close/error handlers still resolve afterward.
 */
export function spawnClaudeSession(
  prompt: string,
  opts: ClaudeSessionOptions,
): Promise<ClaudeSessionResult> {
  return new Promise<ClaudeSessionResult>((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'claude.cmd' : 'claude';
    const args = buildClaudeArgs(opts);

    const proc = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let fullOutput = '';
    /** Accumulated assistant text extracted from stream-json messages. */
    let assistantText = '';
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    const errors: string[] = [];

    // Send prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;

      // Parse stream-json lines to extract assistant text and metadata
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'system' && parsed.subtype === 'init' && parsed.session_id) {
            sessionId = parsed.session_id;
          }
          if (parsed.type === 'result') {
            // Current Claude CLIs report `total_cost_usd`; older ones used `cost_usd`.
            // Accept either, or the harness budget governor never sees any spend.
            const reported = parsed.total_cost_usd ?? parsed.cost_usd;
            if (typeof reported === 'number') costUsd = reported;
            // The result message may also contain the final text
            if (parsed.result?.text) assistantText += parsed.result.text;
          }
          // Extract text from assistant messages
          if (parsed.type === 'assistant') {
            const content = parsed.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'text' && block.text) {
                  assistantText += block.text;
                  opts.onOutput?.(block.text);
                }
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) errors.push(text);
    });

    // Timeout. The process is spawned with `shell: isWindows`, so on Windows a
    // plain `proc.kill('SIGTERM')` reaps the wrapping cmd.exe and ORPHANS the
    // real `claude -p` — still running, still spending, after the harness has
    // stopped counting it. Tree-kill through the shared helper (the same one the
    // dev-server teardown uses) and wait for its outcome before resolving, so the
    // returned `errors` state what the kill did instead of assuming it worked.
    let timedOut = false;
    let killReport: Promise<unknown> | null = null;
    const timeout = setTimeout(() => {
      timedOut = true;
      killReport = killTimedOutSession(proc, opts.timeoutMs, errors);
    }, opts.timeoutMs);

    const settle = async (exitCode: number | null) => {
      clearTimeout(timeout);
      // Never let a stuck kill-report stall the loop — the process is already gone.
      if (killReport) await Promise.race([killReport, delay(KILL_CONFIRM_TIMEOUT_MS)]);
      resolve({
        output: assistantText || fullOutput,
        costUsd,
        exitCode,
        errors,
        sessionId,
        ...(timedOut ? { timedOut: true } : {}),
      });
    };

    proc.on('close', (code) => { void settle(code); });

    proc.on('error', (err) => {
      errors.push(err.message);
      void settle(null);
    });
  });
}
