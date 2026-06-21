import { describe, it, expect, afterEach } from 'vitest';
import { makeSpawnExecutor, drainAll } from '@/lib/test-gate-runner';
import { upsertArtifact, getArtifact, deleteArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * End-to-end live L3 drain against a real headless UnrealEditor-Cmd — the full production
 * path: a deferred pipeline_artifacts row → drainAll → the spawn executor launches UE,
 * runs the automation test, parses the abslog marker → the verdict flips the artifact in
 * SQLite. This is the one piece the 40 mocked drain unit tests can't cover (the live
 * engine integration); it proved out on UE 5.8 (the AnimBP path having confirmed the
 * mechanism; GenFireball is the no-map config gate that passes headless).
 *
 * SKIPPED by default — it launches the editor (~minutes), so it never runs in normal/CI
 * vitest. Enable with the same env the spawn executor reads, plus an explicit opt-in:
 *   POF_UE_EDITOR_CMD=".../UnrealEditor-Cmd.exe" POF_UE_UPROJECT=".../PoF.uproject" \
 *   POF_RUN_UE_GATES=1 npx vitest run src/__tests__/lib/test-gate-runner/live-drain.integration.test.ts
 */
const ENABLED = !!(process.env.POF_UE_EDITOR_CMD && process.env.POF_UE_UPROJECT && process.env.POF_RUN_UE_GATES);

const CAT = '_l3livedrain';
const ENT = '_probe';
const STEP = 'GenFireball gate';

describe.skipIf(!ENABLED)('L3 live drain (spawn → real UE)', () => {
  afterEach(() => deleteArtifact(CAT, ENT, STEP));

  it('runs a deferred L3 gate in UE and flips it to pass', async () => {
    // Seed a deferred L3 gate exactly as runtimeDeferred would — parseTestName recovers the
    // automation filter ("GenFireball" matches the registered Project.…GenFireball.EffectConfig).
    upsertArtifact({
      catalogId: CAT, entityId: ENT, step: STEP, data: {}, ueAssets: [],
      status: 'deferred', tier: 'L3', reason: 'live-UE runner not yet run: GenFireball',
    });

    const spawn = makeSpawnExecutor({ allowSpawn: true });
    const summary = await drainAll([spawn], { catalogId: CAT });

    // A job actually ran (not skipped for a missing executor / test name) ...
    expect(summary.ran, JSON.stringify(summary.results)).toBe(1);
    // ... and the artifact flipped off `deferred` to the real UE verdict.
    const after = getArtifact(CAT, ENT, STEP);
    expect(after?.status, `verdict reason: ${after?.reason}`).toBe('pass');
  }, 300_000);
});
