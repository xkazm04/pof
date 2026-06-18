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

import { spawn } from 'child_process';
import { resolveAutonomousMcpArgs } from '@/lib/claude-terminal/mcp-config';

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

    // Timeout
    const timeout = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* */ }
      errors.push(`Session timed out after ${opts.timeoutMs}ms`);
    }, opts.timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        output: assistantText || fullOutput,
        costUsd,
        exitCode: code,
        errors,
        sessionId,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      errors.push(err.message);
      resolve({
        output: assistantText || fullOutput,
        costUsd,
        exitCode: null,
        errors,
        sessionId,
      });
    });
  });
}
