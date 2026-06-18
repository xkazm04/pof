/**
 * Resolves the UnrealEditor binary to launch — the engine-version seam that lets
 * PoF's autonomous UE ops target UE 5.8 (the official-MCP engine) instead of the
 * project's current 5.7, without hardcoding paths. Pure + env-injectable.
 *
 * Resolution order (first match wins):
 *   1. an explicit `cmd` path
 *   2. env override — `POF_UE_EDITOR` (windowed) / `POF_UE_CMD` (headless)
 *   3. `UE_<engine>` default path, where engine = opts.engine ?? POF_UE_ENGINE ?? '5.8'
 */
export type EnvLike = Record<string, string | undefined>;

export interface ResolveEditorOptions {
  /** Engine version for the default path, e.g. '5.7' | '5.8'. */
  engine?: string;
  /** true → windowed `UnrealEditor.exe` (can render); false → headless `UnrealEditor-Cmd.exe`. */
  windowed?: boolean;
  /** Explicit full binary path — wins over everything. */
  cmd?: string;
}

export function resolveEditorBinary(opts: ResolveEditorOptions = {}, env: EnvLike = process.env): string {
  if (opts.cmd) return opts.cmd;
  const envOverride = opts.windowed ? env.POF_UE_EDITOR : env.POF_UE_CMD;
  if (envOverride) return envOverride;
  const engine = opts.engine ?? env.POF_UE_ENGINE ?? '5.8';
  const exe = opts.windowed ? 'UnrealEditor.exe' : 'UnrealEditor-Cmd.exe';
  return `C:\\Program Files\\Epic Games\\UE_${engine}\\Engine\\Binaries\\Win64\\${exe}`;
}
