/**
 * Read a `codex exec --json` event stream (JSONL) into what an overseer needs: the session id
 * (to resume it), every command it ran with its exit code, its messages, and token usage.
 *
 * A failed command is not a failed task — Codex retries (the live probe's first vitest run hit
 * `spawn EPERM`, the escalated retry passed) — so failures are listed, never summarized away,
 * and the overseer decides. Lines that are not JSON are counted rather than thrown on: a
 * truncated stream must still yield what it did carry.
 */

export interface CodexCommand {
  command: string;
  exitCode: number | null;
  status: string;
}

export interface CodexUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface CodexRunSummary {
  threadId: string | null;
  commands: CodexCommand[];
  failedCommands: CodexCommand[];
  messages: string[];
  usage: CodexUsage | null;
  /** `turn.completed` seen — absent means the run was cut off (timeout, crash). */
  completed: boolean;
  errors: string[];
  unparsedLines: number;
}

export function parseCodexEvents(jsonl: string): CodexRunSummary {
  const out: CodexRunSummary = {
    threadId: null, commands: [], failedCommands: [], messages: [], usage: null,
    completed: false, errors: [], unparsedLines: 0,
  };
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try { e = JSON.parse(line) as Record<string, unknown>; } catch { out.unparsedLines++; continue; }
    const type = e.type as string | undefined;
    const item = (e.item ?? {}) as Record<string, unknown>;
    if (type === 'thread.started') out.threadId = (e.thread_id as string) ?? null;
    else if (type === 'turn.completed') {
      out.completed = true;
      const u = (e.usage ?? {}) as Record<string, number>;
      out.usage = {
        inputTokens: u.input_tokens ?? 0, cachedInputTokens: u.cached_input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0, reasoningOutputTokens: u.reasoning_output_tokens ?? 0,
      };
    } else if (type === 'turn.failed' || type === 'error') {
      const err = (e.error as { message?: string } | undefined)?.message ?? (e.message as string | undefined);
      out.errors.push(err ?? JSON.stringify(e).slice(0, 300));
    } else if (type === 'item.completed' && item.type === 'command_execution') {
      const cmd: CodexCommand = {
        command: String(item.command ?? ''),
        exitCode: typeof item.exit_code === 'number' ? item.exit_code : null,
        status: String(item.status ?? ''),
      };
      out.commands.push(cmd);
      if (cmd.exitCode !== 0) out.failedCommands.push(cmd);
    } else if (type === 'item.completed' && item.type === 'agent_message') {
      out.messages.push(String(item.text ?? ''));
    }
  }
  return out;
}
