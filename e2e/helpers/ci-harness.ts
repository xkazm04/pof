import { existsSync } from 'node:fs';

/**
 * CI-runnable harness mode.
 *
 * The vertical-slice harness runs locally against a live PoF dev server + the
 * user's UE install + Blender/Leonardo. None of that exists on CI. This module
 * resolves a third mode — `ci` — that:
 *   - needs no dev server (the CI verification path is a direct
 *     `UnrealEditor-Cmd` invocation, not a Playwright page session);
 *   - needs no Blender/Leonardo (no generation, no Gemini network calls);
 *   - runs only the deterministic in-engine functional tests, and gracefully
 *     skips even those when no UE install is present (so a UE-less CI runner
 *     still passes the harness-self-check subset).
 *
 * Pure + injectable so it is fully unit-tested without a UE install.
 */
export type HarnessRunMode = 'stub' | 'live' | 'ci';

/** Loose env shape — accepts process.env or a partial test fixture. */
export type EnvLike = Record<string, string | undefined>;

export function resolveHarnessMode(env: EnvLike = process.env): HarnessRunMode {
  if (env.HARNESS_MODE === 'live') return 'live';
  if (env.HARNESS_MODE === 'ci' || env.CI === 'true' || env.CI === '1') return 'ci';
  return 'stub';
}

const DEFAULT_UE_CMD =
  'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';

/** Resolve the UnrealEditor-Cmd path the harness would use (env-overridable). */
export function resolveUECmd(env: EnvLike = process.env): string {
  return env.POF_UE_CMD ?? DEFAULT_UE_CMD;
}

/** True when a UE install is present — used to skip UE steps on a UE-less runner. */
export function isUEAvailable(
  env: EnvLike = process.env,
  exists: (p: string) => boolean = existsSync,
): boolean {
  return exists(resolveUECmd(env));
}

/** Whether in-engine UE checks should run for this mode + environment. */
export function shouldRunUEChecks(mode: HarnessRunMode, ueAvailable: boolean): boolean {
  return (mode === 'ci' || mode === 'live') && ueAvailable;
}

/** Whether a running PoF dev server (Playwright page session) is required. */
export function requiresDevServer(mode: HarnessRunMode): boolean {
  // CI mode is a headless UnrealEditor-Cmd path — no app navigation.
  return mode !== 'ci';
}

/** Whether Gemini-vision checks (network + real launch) run for this mode. */
export function runsGeminiChecks(mode: HarnessRunMode): boolean {
  // CI uses fixtures, not live Gemini calls; only `live` does the visual gate.
  return mode === 'live';
}

export interface CIVerificationPlan {
  /** Automation filters run headless via runFunctionalTest, in order. */
  functionalTests: string[];
  /** Gemini fixture checks (system → fixture name); empty in CI. */
  geminiChecks: Array<{ system: string; fixture: string }>;
}

/**
 * The subset of `all-verifications` that runs in CI on every PoF-app PR:
 * HealthCheck first (fail fast on structural breakage), then the slice
 * functional test. No Gemini (no network / no real launch on CI).
 */
export function ciVerificationPlan(): CIVerificationPlan {
  return {
    functionalTests: [
      'Project.Functional Tests.PoF.HealthCheck',
      'Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest',
    ],
    geminiChecks: [],
  };
}

/** The full daily plan (live mode): functional tests + a Gemini check per system. */
export function fullVerificationPlan(): CIVerificationPlan {
  return {
    functionalTests: ciVerificationPlan().functionalTests,
    geminiChecks: [
      { system: 'arena', fixture: 'arena-check' },
      { system: 'characters', fixture: 'character-check' },
      { system: 'enemy', fixture: 'enemy-distinction' },
      { system: 'hud', fixture: 'hud-check' },
      { system: 'textures', fixture: 'texture-check' },
    ],
  };
}
