/**
 * Builds the UnrealEditor argv for an autonomous launch. Pure + tested.
 * Mirrors the proven invocation from `editor-open-5_8.log` and `spawnExecutor`:
 * `<uproject> [map] [-game] [-ExecCmds=…] -unattended -nopause -nosplash [-nullrhi]
 *  -NoLiveCoding -log [-abslog=…]`. `-NoLiveCoding` avoids the headless Live-Coding
 * hang; `-nullrhi` (headless, default) skips rendering — drop it for a real render.
 */
export interface LaunchArgsOptions {
  uproject: string;
  /** Map to open (e.g. '/Game/Maps/VerticalSlice'). */
  map?: string;
  /** `-game` (real game loop) vs editor. */
  game?: boolean;
  /** Value for `-ExecCmds=` (e.g. 'py import unreal; …' or 'Automation RunTests …;Quit'). */
  execCmds?: string;
  /** Headless (no RHI). Default true. Set false for a windowed/rendered launch. */
  headless?: boolean;
  /** Absolute log path for `-abslog=` (deterministic, readable result sink). */
  abslog?: string;
  /** Anything else appended verbatim (e.g. -EnablePlugins=…, -PoFScenario=…). */
  extraArgs?: string[];
}

export function buildLaunchArgs(o: LaunchArgsOptions): string[] {
  const args: string[] = [o.uproject];
  if (o.map) args.push(o.map);
  if (o.game) args.push('-game');
  if (o.execCmds) args.push(`-ExecCmds=${o.execCmds}`);
  args.push('-unattended', '-nopause', '-nosplash');
  if (o.headless ?? true) args.push('-nullrhi');
  args.push('-NoLiveCoding', '-log');
  if (o.abslog) args.push(`-abslog=${o.abslog}`);
  if (o.extraArgs?.length) args.push(...o.extraArgs);
  return args;
}
