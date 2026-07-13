/**
 * UE5 verification-gate derivation — the harness's OWN command layer.
 *
 * Deliberately self-contained: it derives real build/test commands from the
 * configured UE environment (`POF_UE_EDITOR_CMD` / `POF_UE_UPROJECT` — the same
 * envs the drain system uses) WITHOUT importing anything from `test-gate-runner`
 * (a sibling context under concurrent refactor).
 *
 * Compile signal — WHY UnrealBuildTool over the editor's CompileAllBlueprints:
 * the harness writes C++ game code, so the truth we need is "does the C++ still
 * compile". UBT is a deterministic, headless, from-source compile whose EXIT
 * CODE is a reliable pass/fail signal — unlike the editor (`-run=...`), which
 * can crash on headless shutdown even after a clean run (per project
 * convention we never trust the editor's exit code). CompileAllBlueprints also
 * only covers Blueprints, not the C++ the harness edits. So the compile gate is
 * UBT (exit-code judged); the automation-test gate runs the editor and is judged
 * by ABSLOG CONTENT, never exit code.
 */

import * as path from 'path';
import type { VerificationGate } from './types';

export interface UeEnv {
  /** Absolute path to UnrealEditor-Cmd(.exe) — POF_UE_EDITOR_CMD. */
  editorCmd: string;
  /** Absolute path to the .uproject — POF_UE_UPROJECT. */
  uproject: string;
}

/** Read the UE env. Returns null unless BOTH vars are set (no half-config). */
export function resolveUeEnv(env: Record<string, string | undefined> = process.env): UeEnv | null {
  const editorCmd = env.POF_UE_EDITOR_CMD?.trim();
  const uproject = env.POF_UE_UPROJECT?.trim();
  if (!editorCmd || !uproject) return null;
  return { editorCmd, uproject };
}

type Platform = NodeJS.Platform;

/**
 * Engine root from an editor-cmd path:
 * `.../Engine/Binaries/Win64/UnrealEditor-Cmd.exe` → `.../Engine`.
 * Returns null if the path isn't under `Engine/Binaries/`.
 */
export function deriveEngineRoot(editorCmd: string): string | null {
  const norm = editorCmd.replace(/\\/g, '/');
  const idx = norm.toLowerCase().indexOf('/engine/binaries/');
  if (idx < 0) return null;
  return norm.slice(0, idx) + '/Engine';
}

/** Project name from a .uproject path (basename without extension). */
export function projectNameFromUproject(uproject: string): string {
  return path.basename(uproject).replace(/\.uproject$/i, '');
}

/** UBT build script under the engine root (Build.bat on Windows, Build.sh else). */
export function buildScriptPath(engineRoot: string, platform: Platform = process.platform): string {
  const script = platform === 'win32' ? 'Build.bat' : 'Build.sh';
  return `${engineRoot}/Build/BatchFiles/${script}`;
}

/** UBT platform token for a Node platform. */
function ubtPlatform(platform: Platform): string {
  if (platform === 'win32') return 'Win64';
  if (platform === 'darwin') return 'Mac';
  return 'Linux';
}

/**
 * Derive the headless C++ compile command (UBT, Editor target, Development).
 * Judged by EXIT CODE by the caller. Returns null if the engine root can't be
 * derived from the editor-cmd path (→ the caller reports the gate unverifiable).
 */
export function deriveUeCompileCommand(env: UeEnv, platform: Platform = process.platform): string | null {
  const engineRoot = deriveEngineRoot(env.editorCmd);
  if (!engineRoot) return null;
  const script = buildScriptPath(engineRoot, platform);
  const target = `${projectNameFromUproject(env.uproject)}Editor`;
  // Quote every path (UE projects live under "…/Unreal Projects/…" with spaces).
  // -WaitMutex: don't clash with a running editor. -NoHotReloadFromIDE: clean
  // from-source compile, not a live hot-reload patch.
  return `"${script}" ${target} Development ${ubtPlatform(platform)} -Project="${env.uproject}" -WaitMutex -NoHotReloadFromIDE`;
}

/**
 * Derive the headless automation-test command. Judged by ABSLOG CONTENT (see
 * `parseAutomationLog`), never exit code. `filter` is an automation test filter
 * such as "Project" or "PoF.Combat"; `abslogPath` is where UE writes the log.
 */
export function deriveUeTestCommand(env: UeEnv, filter: string, abslogPath: string): string {
  const safeFilter = (filter && filter.trim()) || 'Project';
  const execCmds = `Automation RunTests ${safeFilter};Quit`;
  return `"${env.editorCmd}" "${env.uproject}" -ExecCmds="${execCmds}" -unattended -nop4 -nosplash -nullrhi -abslog="${abslogPath}"`;
}

export interface AutomationVerdict {
  verdict: 'pass' | 'fail' | 'unverifiable';
  total: number;
  passed: number;
  failed: number;
  reason: string;
}

/**
 * Parse a UE automation abslog into a verdict, judging by CONTENT not exit code.
 * Counts `Result={Passed|Success}` vs `Result={Failed|Fail}`. Zero matched tests
 * is `unverifiable` (the filter hit nothing — not a failure), per the project's
 * "zero-match → deferred, not fail" convention.
 */
export function parseAutomationLog(log: string): AutomationVerdict {
  if (!log || !log.trim()) {
    return { verdict: 'unverifiable', total: 0, passed: 0, failed: 0, reason: 'Empty automation log — nothing to verify' };
  }
  const passed = (log.match(/Result=\{(?:Passed|Success)\}/gi) ?? []).length;
  const failed = (log.match(/Result=\{(?:Failed|Fail)\}/gi) ?? []).length;
  const total = passed + failed;
  if (total === 0) {
    return { verdict: 'unverifiable', total, passed, failed, reason: 'Automation filter matched 0 tests — cannot verify (not a failure)' };
  }
  if (failed > 0) {
    return { verdict: 'fail', total, passed, failed, reason: `${failed} of ${total} automation test(s) failed` };
  }
  return { verdict: 'pass', total, passed, failed, reason: `${passed} automation test(s) passed` };
}

export interface UeGateOptions {
  /** Opt-in the automation-test gate (advisory; gated behind the compile gate). */
  ueTests?: boolean;
  /** Automation test filter for the ue-test gate (default "Project"). */
  ueTestFilter?: string;
  /**
   * Override env resolution (tests). `undefined` → read `resolveUeEnv()`;
   * `null` → force the "no env configured" path.
   */
  env?: UeEnv | null;
}

/**
 * Build the UE5 gate set. With a configured env, a REAL compile gate (and an
 * opt-in test gate). Without env, a commandless compile gate that the verifier
 * reports as `unverifiable` — NEVER a silent pass.
 */
export function detectUeGates(opts: UeGateOptions = {}): VerificationGate[] {
  const env = opts.env !== undefined ? opts.env : resolveUeEnv();
  const gates: VerificationGate[] = [];

  if (env) {
    const compileCmd = deriveUeCompileCommand(env);
    gates.push({
      name: 'ue-compile',
      type: 'ue-compile',
      required: true,
      // If the engine root couldn't be derived, no command → unverifiable.
      ...(compileCmd ? { command: compileCmd } : {}),
    });
    if (opts.ueTests) {
      gates.push({
        name: 'ue-tests',
        type: 'ue-test',
        required: false, // advisory; gated behind the required compile gate
        filter: (opts.ueTestFilter && opts.ueTestFilter.trim()) || 'Project',
      });
    }
  } else {
    // No UE env — a required compile gate with NO command. verify() reports this
    // as unverifiable so the area is honestly gapped rather than self-certified.
    gates.push({ name: 'ue-compile', type: 'ue-compile', required: true });
  }

  return gates;
}
