import { describe, it, expect } from 'vitest';
import { buildGlbImportPython, collisionPlan, importGlbToUE } from '@/lib/visual-gen/ue-import';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

const RES = (markers: Record<string, string>, ok = true): ExperimentResult => ({
  ok, logs: [], markers, durationMs: 1, binary: 'b', args: [],
});

describe('buildGlbImportPython', () => {
  it('imports the glb via an AssetImportTask and logs the marker', () => {
    const py = buildGlbImportPython('C:\\gen\\chair.glb', '/Game/Generated', 'Chair');
    expect(py).toContain('unreal.AssetImportTask()');
    expect(py).toContain("task.filename = 'C:/gen/chair.glb'"); // backslashes normalized
    expect(py).toContain("task.destination_path = '/Game/Generated'");
    expect(py).toContain("task.destination_name = 'Chair'");
    expect(py).toContain('POF_UE_IMPORT=');
  });
});

describe('importGlbToUE', () => {
  it('returns the imported asset path on success', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Chair.Chair' }) });
    expect(res.ok).toBe(true);
    expect(res.assetPath).toBe('/Game/Generated/Chair.Chair');
  });

  it('fails when nothing was imported (NONE marker)', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_UE_IMPORT: 'NONE' }) });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no objects imported/i);
  });

  it('propagates an experiment-level failure', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', { runExperimentFn: async () => RES({ POF_EXPERIMENT_ERROR: 'boom' }, false) });
    expect(res.ok).toBe(false);
  });
});

// ── Collision (research 2026-09-07) ──────────────────────────────────────────
// A generated .glb is render geometry only, and glTF has no UCX_ convention, so a mesh
// imported by the block above arrives with NO collision and falls through the world. The
// headless fix is post-import — and the collision is only CLAIMED once body_setup has been
// read back, never because the call was emitted.
describe('collisionPlan', () => {
  it('gives a blocking prop convex hulls when the mesh is multi-part', () => {
    const p = collisionPlan({ use: 'blocking', components: 6 });
    expect(p.kind).toBe('convex');
    expect(p.hullCount).toBeGreaterThanOrEqual(4);
    expect(p.maxHullVerts).toBeGreaterThan(0);
    expect(p.reason).toMatch(/./);
  });

  it('gives a blocking single-shell prop ONE simple primitive, not hulls', () => {
    const p = collisionPlan({ use: 'blocking', components: 1 });
    expect(p.kind).toBe('simple');
    expect(p.shape).toBe('BOX');
  });

  it('gives a decorative asset NO collision — a bad hull is worse than none', () => {
    const p = collisionPlan({ use: 'decorative', components: 12 });
    expect(p.kind).toBe('none');
    expect(p.reason).toMatch(/decorative|no collision/i);
  });

  it('never returns complex-as-simple for a moving object', () => {
    for (const use of ['blocking', 'decorative', 'character'] as const) {
      expect(collisionPlan({ use }).kind).not.toBe('complex');
    }
  });

  it('is pure — the same request yields the same plan', () => {
    const a = collisionPlan({ use: 'blocking', components: 6 });
    const b = collisionPlan({ use: 'blocking', components: 6 });
    expect(a).toEqual(b);
  });
});

describe('buildGlbImportPython — collision', () => {
  it('emits no collision call by default (unchanged behaviour)', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb');
    expect(py).not.toContain('add_simple_collisions');
    expect(py).not.toContain('set_convex_decomposition_collisions');
  });

  it('emits a convex decomposition with the planned budget', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/Generated', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 6 }),
    });
    expect(py).toContain('set_convex_decomposition_collisions');
    expect(py).not.toContain('add_simple_collisions');
  });

  it('emits a simple primitive for a single-shell blocking prop', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/Generated', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
    });
    expect(py).toContain('add_simple_collisions');
    expect(py).toContain('ScriptingCollisionShapeType.BOX');
  });

  it('READS BACK body_setup and reports the element count — never assumes the call worked', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/Generated', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 6 }),
    });
    expect(py).toContain('body_setup');
    expect(py).toContain('POF_UE_COLLISION=');
    // The read-back must come after the collision call, or it measures the wrong thing.
    expect(py.indexOf('POF_UE_COLLISION=')).toBeGreaterThan(py.indexOf('set_convex_decomposition_collisions'));
  });

  it('saves the asset AFTER collision is applied, not at import time', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/Generated', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
    });
    // task.save = True would persist the mesh before the collision call ran.
    expect(py).toContain('task.save = False');
    expect(py.indexOf('save_loaded_asset')).toBeGreaterThan(py.indexOf('add_simple_collisions'));
  });
});

describe('importGlbToUE — collision is observed, not assumed', () => {
  it('reports the observed element count when the read-back is positive', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      collision: collisionPlan({ use: 'blocking', components: 6 }),
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Chair.Chair', POF_UE_COLLISION: '7' }),
    });
    expect(res.ok).toBe(true);
    expect(res.collisionElements).toBe(7);
  });

  it('FAILS the import when collision was requested and the read-back is zero', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      collision: collisionPlan({ use: 'blocking', components: 6 }),
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Chair.Chair', POF_UE_COLLISION: '0' }),
    });
    expect(res.ok).toBe(false);
    expect(res.collisionElements).toBe(0);
    expect(res.error).toMatch(/collision/i);
  });

  it('FAILS when collision was requested and no read-back marker came back at all', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      collision: collisionPlan({ use: 'blocking', components: 6 }),
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Chair.Chair' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/collision/i);
    expect(res.collisionElements).toBeUndefined();
  });

  it('a plan of kind none asks for nothing and is not failed by a missing marker', async () => {
    const res = await importGlbToUE('C:/gen/sign.glb', {
      collision: collisionPlan({ use: 'decorative' }),
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/Generated/Sign.Sign' }),
    });
    expect(res.ok).toBe(true);
    expect(res.collisionElements).toBeUndefined();
  });
});
