// Shell-wrapping verification helpers — promote the ad-hoc UE-launch /
// functional-test / Gemini-vision patterns the vertical slice used
// (PS-1/PS-2/PS-3/HUD/Characters) into reusable primitives. Pure logic lives
// in verification-core.ts (unit-tested); these are the thin Node wrappers.
import { spawn, execFileSync, type SpawnOptions } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAutomationLog,
  pickNewestScreenshot,
  resolveGeminiPrompt,
  buildGeminiArgs,
  type FunctionalResult,
} from './verification-core';

// All paths are env-overridable so the harness runs on CI / other machines.
const UE_ROOT = process.env.POF_UE_ENGINE ?? 'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64';
const UE_CMD = process.env.POF_UE_CMD ?? `${UE_ROOT}\\UnrealEditor-Cmd.exe`;
const UE_EDITOR = process.env.POF_UE_EDITOR ?? `${UE_ROOT}\\UnrealEditor.exe`;
const UPROJECT = process.env.POF_UPROJECT ?? 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject';
const UE_PROJECT_DIR = process.env.POF_UE_PROJECT_DIR ?? 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const SCREENSHOT_DIR = `${UE_PROJECT_DIR}\\Saved\\Screenshots\\WindowsEditor`;
const PERSONAS_DIR = process.env.POF_PERSONAS_DIR ?? 'C:\\Users\\kazda\\kiro\\personas';
const GEMINI_SCRIPT = `${PERSONAS_DIR}\\.claude\\skills\\leonardo\\tools\\gemini-recognize.mjs`;

/** Absolute path of this helpers dir's sibling fixtures/gemini-prompts dir. */
const GEMINI_PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'gemini-prompts');

function run(cmd: string, args: string[], opts: SpawnOptions = {}): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts });
    let out = '';
    child.stdout?.on('data', (d) => { out += d.toString('utf-8'); });
    child.stderr?.on('data', (d) => { out += d.toString('utf-8'); });
    child.on('close', (code) => resolve({ code: code ?? -1, out }));
    child.on('error', (e) => resolve({ code: -1, out: out + `\n[spawn error] ${e.message}` }));
  });
}

export interface RunFunctionalTestOptions {
  /** Map to load before running automation (default the vertical slice). */
  map?: string;
  timeoutMs?: number;
}

/**
 * Run a UE automation/functional test headless and parse the result.
 * `testPath` is the automation filter, e.g.
 * `Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`.
 *
 * Note: headless UE often exits non-zero on shutdown (a benign teardown
 * crash) AFTER the work — success is judged from the log, not the exit code.
 */
export async function runFunctionalTest(
  testPath: string,
  opts: RunFunctionalTestOptions = {},
): Promise<FunctionalResult> {
  const map = opts.map ?? '/Game/Maps/VerticalSlice';
  const { out } = await run(UE_CMD, [
    UPROJECT, map,
    `-ExecCmds=Automation RunTests ${testPath};Quit`,
    '-unattended', '-nopause', '-nullrhi', '-log',
  ], { timeout: opts.timeoutMs ?? 1_800_000 });
  return parseAutomationLog(out);
}

export interface LaunchScreenshotOptions {
  map?: string;
  resX?: number;
  resY?: number;
  /** Seconds to let the game run before grabbing the newest screenshot. */
  settleSec?: number;
}

/**
 * Launch the slice in a real (rendered) window, take a HighResShot, terminate,
 * and return the newest screenshot path (or null). Used for every Gemini
 * visual gate — the functional test runs `-nullrhi` and cannot render the HUD
 * or character meshes, so visual checks need a real launch.
 */
export async function launchAndScreenshot(opts: LaunchScreenshotOptions = {}): Promise<string | null> {
  const map = opts.map ?? '/Game/Maps/VerticalSlice';
  const resX = opts.resX ?? 1280;
  const resY = opts.resY ?? 720;
  const settleSec = opts.settleSec ?? 25;
  const child = spawn(UE_EDITOR, [
    UPROJECT, map, '-game', '-windowed', `-ResX=${resX}`, `-ResY=${resY}`,
    `-ExecCmds=HighResShot ${resX}x${resY}`,
  ], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, settleSec * 1000));
  try {
    if (child.pid) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch { /* already gone */ }
  try { execFileSync('taskkill', ['/IM', 'UnrealEditor.exe', '/F'], { stdio: 'ignore' }); } catch { /* noop */ }
  await new Promise((r) => setTimeout(r, 1500));
  return pickNewestScreenshot(SCREENSHOT_DIR);
}

/**
 * Describe a screenshot with Gemini vision. `promptOrFixture` is either a
 * literal prompt or a fixture name resolved from e2e/fixtures/gemini-prompts/.
 * Returns Gemini's text. The personas .env (with GEMINI_API_KEY) is loaded by
 * gemini-recognize.mjs's own dotenv; we pass the key through if present.
 */
export async function geminiCheck(screenshotPath: string, promptOrFixture: string): Promise<string> {
  const prompt = resolveGeminiPrompt(promptOrFixture, GEMINI_PROMPTS_DIR);
  const args = buildGeminiArgs(GEMINI_SCRIPT, screenshotPath, prompt);
  const { out } = await run('node', args, { cwd: PERSONAS_DIR, timeout: 120_000 });
  return out.trim();
}
