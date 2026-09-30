/**
 * argv for `codex exec` — every trap found while probing codex-cli 0.155.1 on 2026-09-22 is
 * encoded here, so no caller can rediscover one:
 *
 *  1. **stdin**: when stdin is a pipe, `exec` appends it to the prompt and WAITS for EOF. A child
 *     process spawned by a harness keeps its stdin open, so the run hangs until the timeout
 *     (5 min, nothing produced). The spawner must pass `stdio: ['ignore', …]`; this module
 *     cannot do that, so `CODEX_SPAWN_STDIO` is exported for it.
 *  2. **`-i <FILE>...` is variadic**: a prompt placed after it is parsed as another image path
 *     and the run exits in 0 s. The prompt is therefore always preceded by `--`.
 *  3. **`--approve-for-me` excludes `-s`**: passing both is a usage error. On Windows the
 *     `workspace-write` sandbox refuses child processes (`spawn EPERM` from vitest's workers),
 *     so a task that must run tests uses `--approve-for-me` — the sandbox stays the default and
 *     each escalation is auto-reviewed — rather than turning the sandbox off.
 *
 * `--dangerously-bypass-approvals-and-sandbox` is never produced.
 *
 * Long briefs go through STDIN (`PROMPT_FROM_STDIN`): Windows caps a command line at ~32K chars,
 * and `exec -- -` reads the prompt from stdin — which also closes it, so trap 1 cannot occur.
 * Probed live: a multi-line brief with a nonce came back verbatim.
 */

import type { CodexRoute } from './routing';

/** Pass as the prompt to make `exec` read it from stdin; the spawner then writes and closes stdin. */
export const PROMPT_FROM_STDIN = '-';

/** Pass as `spawn(..., { stdio: CODEX_SPAWN_STDIO })` — see trap 1. */
export const CODEX_SPAWN_STDIO = ['ignore', 'pipe', 'pipe'] as const;

export type CodexAccess =
  /** Reads only (analysis, review, image critique). */
  | 'read-only'
  /** Edits files AND may run the project's commands (tests, typecheck) under reviewed escalation. */
  | 'write-verified';

export interface CodexExecOptions {
  route: CodexRoute;
  access: CodexAccess;
  prompt: string;
  /** Working root (a worktree for write tasks). */
  cwd: string;
  /** Where the final message is written (`-o`). */
  lastMessagePath: string;
  /** JSON Schema file the final message must satisfy. */
  outputSchemaPath?: string;
  images?: string[];
  /** Do not persist the session (read-only one-shots). A write task keeps it so it can be resumed. */
  ephemeral?: boolean;
}

function effortArg(route: CodexRoute): string[] {
  return ['-m', route.model, '-c', `model_reasoning_effort="${route.effort}"`];
}

export function buildCodexExecArgs(o: CodexExecOptions): string[] {
  const args = ['exec', ...effortArg(o.route)];
  if (o.access === 'read-only') args.push('-s', 'read-only');
  else args.push('--approve-for-me');
  args.push('--json', '-o', o.lastMessagePath, '-C', o.cwd);
  if (o.outputSchemaPath) args.push('--output-schema', o.outputSchemaPath);
  if (o.ephemeral) args.push('--ephemeral');
  for (const img of o.images ?? []) args.push('-i', img);
  args.push('--', o.prompt);
  return args;
}

/**
 * A follow-up instruction into an existing session. `resume` accepts no `-s`: the session keeps
 * the access it was started with.
 */
export function buildCodexResumeArgs(o: { threadId: string; prompt: string; lastMessagePath: string; outputSchemaPath?: string; images?: string[] }): string[] {
  const args = ['exec', 'resume', o.threadId, '--json', '-o', o.lastMessagePath];
  // resume accepts --output-schema (verified in 0.155.1 help), so every round's report stays structured.
  if (o.outputSchemaPath) args.push('--output-schema', o.outputSchemaPath);
  for (const img of o.images ?? []) args.push('-i', img);
  args.push('--', o.prompt);
  return args;
}
