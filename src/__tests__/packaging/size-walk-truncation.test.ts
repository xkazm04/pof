/**
 * A truncated size walk is NOT a measurement.
 *
 * `measureBuildSize` stops after MAX_SIZE_WALK_FILES (50 000) files and used to return
 * the PARTIAL SUM — which `runScheduledBuild` step 4 then used to OVERRIDE
 * `cookExecutor`'s uncapped measurement and fed to `evaluateBuildSize`. A shipping stage
 * that crosses the cap therefore reported a size that shrinks as the project grows: it
 * reads as an improvement and can only ever mask a real regression.
 *
 * The cap stays (it bounds an unattended nightly run); a truncated walk now reports
 * "not measured".
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { measureBuildSize, MAX_SIZE_WALK_FILES, runScheduledBuild } from '@/lib/packaging/scheduled-build-runner';

let stageDir: string;
let exePath: string;
const FILE_COUNT = 12;
const FILE_BYTES = 100;

beforeAll(async () => {
  stageDir = await mkdtemp(path.join(tmpdir(), 'pof-sizewalk-'));
  const sub = path.join(stageDir, 'Content');
  await mkdir(sub, { recursive: true });
  const body = 'x'.repeat(FILE_BYTES);
  for (let i = 0; i < FILE_COUNT; i++) {
    await writeFile(path.join(i % 2 === 0 ? stageDir : sub, `f${i}.pak`), body);
  }
  exePath = path.join(stageDir, 'PoF.exe');
});

afterAll(async () => {
  await rm(stageDir, { recursive: true, force: true });
});

describe('measureBuildSize', () => {
  it('sums the whole tree when the walk completes', async () => {
    // exePath itself is one of the counted files only if it exists; it does not,
    // so the total is exactly the files written above.
    const measured = await measureBuildSize(exePath);
    expect(measured).toBe(FILE_COUNT * FILE_BYTES);
  });

  it('returns null — not a partial sum — when the file cap truncates the walk', async () => {
    const truncated = await measureBuildSize(exePath, 4);
    expect(truncated).toBeNull();
  });

  it('does not truncate at a cap the tree fits inside', async () => {
    expect(await measureBuildSize(exePath, FILE_COUNT)).toBe(FILE_COUNT * FILE_BYTES);
    expect(await measureBuildSize(exePath, FILE_COUNT + 1)).toBe(FILE_COUNT * FILE_BYTES);
  });

  it('ships the cap it documents', () => {
    expect(MAX_SIZE_WALK_FILES).toBe(50_000);
  });

  it('returns null for an unreadable root rather than a fake 0', async () => {
    expect(await measureBuildSize(path.join(stageDir, 'nope', 'PoF.exe'))).toBeNull();
  });
});

describe('a truncated measurement never reaches the budget gate', () => {
  it("keeps the cook's own uncapped size and grades THAT", async () => {
    const graded: (number | null)[] = [];
    const recorded: { sizeBytes?: number | null }[] = [];
    await runScheduledBuild(
      {
        profile: { platform: 'Linux', config: 'Shipping' } as never,
        projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.8.0',
        lastBuiltCommit: null, skipIfUnchanged: false,
      },
      {
        getHead: async () => 'abc',
        runPreflight: async () => ({ overall: 'pass', results: [] }),
        runCook: async () => ({ status: 'success', exePath: 'C:/p/PoF.exe', durationMs: 10, sizeBytes: 9_000_000 }),
        // What a truncated walk now returns.
        measureSize: async () => null,
        runSmoke: async () => ({ status: 'pass' }) as never,
        lastGreenSize: () => 8_000_000,
        evaluateSize: (_p, sizeBytes) => { graded.push(sizeBytes); return null; },
        recordBuild: (input) => { recorded.push(input); return { id: 1 }; },
        now: () => 0,
      },
    );
    // The cook's uncapped 9 MB survives — a partial sum would have replaced it with
    // something smaller and been graded as shrinkage.
    expect(graded).toEqual([9_000_000]);
    expect(recorded[0].sizeBytes).toBe(9_000_000);
  });
});
