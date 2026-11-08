/**
 * The two I/O seams of pof_tripo_smartlowpoly_arena.ts, split out so a test can drive them
 * (the arena file runs main() on import). Importing this module has no side effect.
 *
 *  - runCritiqueScript waits for `close` through runLocalProcess, so the last output line is
 *    not lost to the exit-before-drain race, and a spawn error or our own kill is reported
 *    as such.
 *  - downloadToBase64 refuses a non-OK response: an error body must never reach the Qwen
 *    judge as if it were the render.
 */
import { runLocalProcess, processFailureReason } from '../../src/lib/visual-gen/local-process';

/** Same guard as critiqueMesh()'s own runner: a pathological mesh must not run unbounded. */
export const CRITIQUE_TIMEOUT_MS = 60_000;

export interface CritiqueRunOptions {
  python: string;
  /** Script path; defaults to the repo's pof_mesh_critique.py. */
  script?: string;
  timeoutMs?: number;
}

export async function runCritiqueScript(
  glbPath: string,
  opts: CritiqueRunOptions,
): Promise<{ stdout: string; code: number | null }> {
  const timeoutMs = opts.timeoutMs ?? CRITIQUE_TIMEOUT_MS;
  const outcome = await runLocalProcess(
    opts.python,
    [opts.script ?? 'scripts/visual-gen/pof_mesh_critique.py', '--mesh', glbPath],
    { timeoutMs },
  );
  if (outcome.spawnError || outcome.timedOut) {
    return { stdout: processFailureReason(outcome, { tool: 'pof_mesh_critique.py', timeoutMs }), code: null };
  }
  return { stdout: outcome.stdout, code: outcome.code };
}

export interface DownloadedImage { mime: string; base64: string }

export async function downloadToBase64(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadedImage> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`render download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return { mime, base64: buf.toString('base64') };
}
