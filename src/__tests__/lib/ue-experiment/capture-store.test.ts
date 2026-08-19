/**
 * Direction 3 — "experiment captures outlive %TEMP%".
 *
 * Forced failures against the pre-fix code:
 *  - captures were written to `tmpdir()` and that path persisted, so every historical run rotted;
 *  - `hasScreenshot` came from "path is non-null", so a row pointing at a swept file still said
 *    it had a screenshot and the history rendered a broken `<img>` with the verdict intact.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EXPERIMENT_CAPTURE_DIR,
  captureDirFor,
  captureFileFor,
  captureStateOf,
  deleteCaptureFor,
  ensureCaptureDir,
  isServableCapture,
  safeRunId,
} from '@/lib/ue-experiment/capture-store';
import { saveExperimentRun, getExperimentRun, listExperimentRuns, deleteExperimentRun } from '@/lib/ue-experiment/experiment-db';
import type { ExperimentResult, ExperimentSpec } from '@/lib/ue-experiment/runner';

const madeIds: string[] = [];
afterEach(() => {
  for (const id of madeIds.splice(0)) deleteExperimentRun(id);
});

function save(id: string, spec: ExperimentSpec, result: Partial<ExperimentResult>): void {
  madeIds.push(id);
  saveExperimentRun({
    id,
    createdAt: '2026-08-19T00:00:00.000Z',
    spec,
    result: { ok: true, logs: [], markers: {}, durationMs: 1, binary: 'b', args: [], ...result },
  });
}

describe('durable capture root', () => {
  it('captures live under ~/.pof/experiments, not the OS temp dir', () => {
    expect(EXPERIMENT_CAPTURE_DIR).toMatch(/[\\/]\.pof[\\/]experiments$/);
    expect(captureFileFor('exp-1')).toContain('/.pof/experiments/'.replace(/\//g, '/'));
    expect(captureFileFor('exp-1').startsWith(tmpdir().replace(/\\/g, '/'))).toBe(false);
    expect(captureFileFor('exp-1')).toMatch(/exp-1\.png$/);
    expect(captureDirFor('exp-1')).toMatch(/exp-1$/);
  });

  it('a run id can never escape the root', () => {
    expect(safeRunId('../../etc/passwd')).not.toContain('..');
    expect(safeRunId('a/b')).toBe('a_b');
    expect(safeRunId('..')).toBe('_');
    expect(safeRunId('')).toBe('run');
    expect(safeRunId('.')).toBe('run');
    expect(captureFileFor('../../evil')).toMatch(/experiments[\\/][A-Za-z0-9._-]+\.png$/);
  });
});

describe('isServableCapture (realpath containment)', () => {
  it('serves a real file inside the durable root and refuses one outside every root', () => {
    ensureCaptureDir();
    const inside = join(EXPERIMENT_CAPTURE_DIR, `test-servable-${process.pid}.png`);
    writeFileSync(inside, 'PNG');
    try {
      expect(isServableCapture(inside)).toBe(true);
    } finally {
      rmSync(inside, { force: true });
    }
    // A path that does not exist is not servable — this is the whole point.
    expect(isServableCapture(join(EXPERIMENT_CAPTURE_DIR, 'never-written.png'))).toBe(false);
  });

  it('keeps LEGACY temp captures servable while their file still exists (no run is orphaned)', () => {
    const legacy = join(tmpdir(), `pof_exp_legacy_${process.pid}.png`);
    writeFileSync(legacy, 'PNG');
    try {
      expect(isServableCapture(legacy)).toBe(true);
    } finally {
      rmSync(legacy, { force: true });
    }
  });

  it('refuses a real file outside every allowed root', () => {
    // process.cwd() is the repo — a real, existing path that is not a capture root.
    expect(isServableCapture(join(process.cwd(), 'package.json'))).toBe(false);
  });
});

describe('captureStateOf', () => {
  it('distinguishes never-captured from recorded-but-gone', () => {
    expect(captureStateOf(null)).toBe('none');
    expect(captureStateOf(undefined)).toBe('none');
    expect(captureStateOf(join(tmpdir(), 'swept-by-windows.png'))).toBe('missing');
  });
});

describe('a run row whose capture is gone', () => {
  it('reports the capture as MISSING instead of claiming it has a screenshot', () => {
    const id = `test-cap-missing-${Date.now()}`;
    // Exactly the shape every pre-fix row degrades into: a temp path Windows has since swept.
    save(id, { python: "unreal.log('x')", capture: true }, {
      screenshotPath: join(tmpdir(), `pof_exp_${Date.now()}_gone.png`),
      verdict: { status: 'pass', detail: 'visual character: pass' },
    });

    const run = getExperimentRun(id);
    expect(run?.captureState).toBe('missing');
    // The old derivation said `true` here, which is what rendered the broken image.
    expect(run?.hasScreenshot).toBe(false);
    // The verdict is NOT deleted — it is labelled unauditable by the UI, not erased.
    expect(run?.verdict?.status).toBe('pass');

    const listed = listExperimentRuns(500).find((r) => r.id === id);
    expect(listed?.captureState).toBe('missing');
    expect(listed?.hasScreenshot).toBe(false);
  });

  it('reports PRESENT for a capture that is actually on disk', () => {
    const id = `test-cap-present-${Date.now()}`;
    ensureCaptureDir();
    const path = captureFileFor(id);
    writeFileSync(path, 'PNG');
    save(id, { python: 'x', capture: true }, { screenshotPath: path });
    expect(getExperimentRun(id)?.captureState).toBe('present');
    expect(getExperimentRun(id)?.hasScreenshot).toBe(true);
  });

  it('reports NONE when the run never captured', () => {
    const id = `test-cap-none-${Date.now()}`;
    save(id, { python: 'x' }, {});
    expect(getExperimentRun(id)?.captureState).toBe('none');
  });
});

describe('retention is explicit', () => {
  it('deleting a run removes its capture too, and only inside the durable root', () => {
    const id = `test-cap-del-${Date.now()}`;
    ensureCaptureDir();
    const path = captureFileFor(id);
    writeFileSync(path, 'PNG');
    save(id, { python: 'x', capture: true }, { screenshotPath: path });

    expect(deleteExperimentRun(id)).toBe(true);
    madeIds.length = 0;
    expect(getExperimentRun(id)).toBeNull();
    expect(existsSync(path)).toBe(false);
  });

  it('deleting a scenario run removes its whole shot directory', () => {
    const id = `test-cap-scn-${Date.now()}`;
    const dir = captureDirFor(id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'shot_00.png'), 'PNG');
    expect(deleteCaptureFor(id)).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it('never reaches outside the durable root to delete a legacy temp capture', () => {
    const legacy = join(tmpdir(), `pof_exp_legacy_keep_${process.pid}.png`);
    writeFileSync(legacy, 'PNG');
    try {
      // The run id names nothing inside our root, so nothing is removed — and the operator's
      // temp file is left exactly where PoF found it.
      expect(deleteCaptureFor(`unrelated-${process.pid}`)).toBe(false);
      expect(existsSync(legacy)).toBe(true);
    } finally {
      rmSync(legacy, { force: true });
    }
  });
});
