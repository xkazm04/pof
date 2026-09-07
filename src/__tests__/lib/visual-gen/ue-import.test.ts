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

// ── The glTF importer returns MANY assets (live run, 2026-09-07) ─────────────
// A real import of props__crate.glb returned `imported_object_paths` whose FIRST entry
// was a Texture2D, so `load_asset(paths[0])` handed a texture to add_simple_collisions:
//   TypeError: NativizeObject: Cannot nativize 'Texture2D' as 'Object'
//            (allowed Class type: 'StaticMesh')
// and the reported assetPath was a texture too. The mesh must be SELECTED by type.
describe('buildGlbImportPython — selecting the static mesh among the imported assets', () => {
  it('scans imported_object_paths for a StaticMesh instead of taking paths[0]', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb');
    expect(py).toContain('unreal.StaticMesh');
    expect(py).toMatch(/isinstance\(/);
    // The old bug in one line: collision (or the marker) reading index 0 blindly.
    expect(py).not.toMatch(/load_asset\(paths\[0\]\)/);
  });

  it('reports the STATIC MESH path in the import marker, not the first asset', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb');
    const marker = py.indexOf("POF_UE_IMPORT=");
    expect(marker).toBeGreaterThan(-1);
    // Selection must happen before the marker is logged, or it reports the wrong asset.
    expect(py.indexOf('unreal.StaticMesh')).toBeLessThan(marker);
  });

  it('emits a distinct marker for "imported, but nothing was a StaticMesh"', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb');
    expect(py).toContain('POF_UE_MESH=');
  });

  it('runs the collision call against the SELECTED mesh', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/Generated', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
    });
    expect(py.indexOf('unreal.StaticMesh')).toBeLessThan(py.indexOf('add_simple_collisions'));
  });
});

describe('importGlbToUE — no StaticMesh among the imported assets', () => {
  it('fails a requested collision when the import produced no static mesh', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/T.T', POF_UE_MESH: 'NO' }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/static ?mesh/i);
  });

  it('does not invent that failure when no collision was asked for', async () => {
    const res = await importGlbToUE('C:/gen/chair.glb', {
      runExperimentFn: async () => RES({ POF_UE_IMPORT: '/Game/T.T', POF_UE_MESH: 'NO' }),
    });
    expect(res.ok).toBe(true);
  });
});

// ── Saving (live run, 2026-09-07) ────────────────────────────────────────────
// A collision plan sets `task.save = False` so the mesh is not persisted before collision
// is applied. The first live run then saved ONLY the mesh: the glTF import's textures and
// materials existed in memory and never reached disk, leaving the saved mesh referencing
// assets that would not survive an editor restart. Everything imported must be saved.
describe('buildGlbImportPython — persisting the whole import', () => {
  it('saves EVERY imported asset after collision, not only the mesh', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/G', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
    });
    // NOT `/for .* in paths:[\s\S]*save_loaded_asset/` — the mesh-SELECTION loop already
    // iterates paths, so that regex passes on the very script it was meant to catch.
    // Assert the save takes the loop variable, and never the single mesh.
    expect(py).toContain('save_loaded_asset(a)');
    expect(py).not.toContain('save_loaded_asset(mesh)');
    // Two separate passes over paths: select the mesh, then save everything.
    expect(py.split('for p in paths:').length - 1).toBe(2);
  });

  it('saves only AFTER the collision call, so the mesh persists with its collision', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb', '/Game/G', 'Chair', {
      collision: collisionPlan({ use: 'blocking', components: 1 }),
    });
    expect(py.indexOf('add_simple_collisions')).toBeLessThan(py.lastIndexOf('save_loaded_asset'));
  });

  it('leaves the plain import saving through the task, with no explicit save loop', () => {
    const py = buildGlbImportPython('C:/gen/chair.glb');
    expect(py).toContain('task.save = True');
    expect(py).not.toContain('save_loaded_asset');
  });
});
