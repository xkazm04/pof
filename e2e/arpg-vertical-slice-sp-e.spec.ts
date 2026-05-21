import { test, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';

const STAGE_DIR = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\Saved\\StagedBuilds\\Windows';
const BOOTSTRAP_EXE = `${STAGE_DIR}\\PoF.exe`;
/** The real game process the bootstrap launches — the honest "is it alive" signal. */
const GAME_IMAGE = 'PoF-Win64-Shipping.exe';
// A packaged build writes its log under %LOCALAPPDATA%\<Project>\Saved\Logs,
// not the editor project. The Shipping target sets bUseLoggingInShipping=false,
// so this log is expected to be absent — that is recorded, not a failure.
const LOG_PATH = `${process.env.LOCALAPPDATA ?? ''}\\PoF\\Saved\\Logs\\PoF.log`;
const OBSERVE_MS = 25_000;

function imageRunning(image: string): boolean {
  try {
    const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/NH'], { encoding: 'utf-8' });
    return out.toLowerCase().includes(image.toLowerCase());
  } catch {
    return false;
  }
}

function killImage(image: string): void {
  try {
    execFileSync('taskkill', ['/IM', image, '/T', '/F'], { stdio: 'ignore' });
  } catch { /* not running — fine */ }
}

test.describe('ARPG vertical slice — SP-E packaged-build smoke-test', () => {
  test('packaged PoF.exe launches and the game process survives', async () => {
    test.setTimeout(90_000);

    // 1. The staged build must exist (SP-C must have cooked it).
    try {
      await stat(BOOTSTRAP_EXE);
    } catch {
      throw new Error(`SP-E: staged exe not found at ${BOOTSTRAP_EXE} — run the SP-C cook first.`);
    }

    // 2. Launch the build the way a player would — the staged PoF.exe bootstrap.
    const child = spawn(BOOTSTRAP_EXE, ['-windowed', '-ResX=1280', '-ResY=720', '-log'], {
      cwd: STAGE_DIR,
      stdio: 'ignore',
    });
    let bootstrapExit: number | null = null;
    let spawnError = '';
    child.on('exit', (code) => { bootstrapExit = code; });
    child.on('error', (err) => { spawnError = err.message; });

    // 3. Observe for a fixed window.
    await new Promise((r) => setTimeout(r, OBSERVE_MS));

    // 4. Honest signal: is the real game process alive?
    const gameAlive = imageRunning(GAME_IMAGE);

    // 5. Clean up — kill the game process and the bootstrap.
    killImage(GAME_IMAGE);
    if (child.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch { /* already gone */ }
    }
    await new Promise((r) => setTimeout(r, 1500));

    // 6. Capture the engine log tail.
    let logTail = '(PoF.log not found)';
    try {
      const log = await readFile(LOG_PATH, 'utf-8');
      logTail = log.split(/\r?\n/).filter(Boolean).slice(-60).join('\n');
    } catch { /* keep default */ }

    console.log(
      `\n===== SP-E SMOKE-TEST RESULT =====\n` +
      `gameProcessAlive=${gameAlive}\n` +
      `bootstrapExitCode=${bootstrapExit}\n` +
      `spawnError=${spawnError || '(none)'}\n` +
      `----- PoF.log tail (last 60 non-empty lines) -----\n${logTail}\n` +
      `===== END SP-E RESULT =====\n`,
    );

    expect(gameAlive, `the packaged game process (${GAME_IMAGE}) must be alive after ${OBSERVE_MS}ms`).toBe(true);
  });
});
