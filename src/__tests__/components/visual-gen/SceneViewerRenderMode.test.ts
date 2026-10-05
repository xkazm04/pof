/**
 * `applyRenderMode` must never leak a solid/wireframe material it created when the
 * render mode is switched again or back to textured — see SceneViewer.tsx's doc
 * comment on `applyRenderMode` for the bug this pins (a fresh Material allocated on
 * every switch, never disposed).
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// SceneViewer.tsx imports ViewportStatus, which imports src/lib/chart-colors.ts — a
// file another session has left mid-merge with literal conflict markers (unrelated
// to this fix). Stub the module so this test's import of `applyRenderMode` (pure
// THREE.js, no chart-colors dependency) doesn't pull the broken file through the
// transform pipeline.
vi.mock('@/components/modules/visual-gen/asset-viewer/ViewportStatus', () => ({
  ViewportStatus: () => null,
}));

const { applyRenderMode } = await import('@/components/modules/visual-gen/asset-viewer/SceneViewer');

function makeMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  return new THREE.Mesh(geometry, material);
}

describe('applyRenderMode disposes materials it created', () => {
  it('disposes the previous solid material when switching solid -> wireframe', () => {
    const mesh = makeMesh();
    const original = mesh.material;
    const created = new Set<THREE.Material>();

    applyRenderMode(mesh, 'solid', original, created);
    const solidMat = mesh.material as THREE.Material;
    const disposeSpy = vi.spyOn(solidMat, 'dispose');

    applyRenderMode(mesh, 'wireframe', original, created);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(created.has(solidMat)).toBe(false);
    expect(created.size).toBe(1); // the new wireframe material
  });

  it('disposes the last created material when switching back to textured, and never disposes the original', () => {
    const mesh = makeMesh();
    // makeMesh() builds the mesh around ONE MeshStandardMaterial, never an array.
    const original = mesh.material as THREE.Material;
    const originalDisposeSpy = vi.spyOn(original, 'dispose');
    const created = new Set<THREE.Material>();

    applyRenderMode(mesh, 'wireframe', original, created);
    const wireframeMat = mesh.material as THREE.Material;
    const wireframeDisposeSpy = vi.spyOn(wireframeMat, 'dispose');

    applyRenderMode(mesh, 'textured', original, created);

    expect(wireframeDisposeSpy).toHaveBeenCalledTimes(1);
    expect(mesh.material).toBe(original);
    expect(created.size).toBe(0);
    expect(originalDisposeSpy).not.toHaveBeenCalled();
  });

  it('repeated toggling never accumulates undisposed materials', () => {
    const mesh = makeMesh();
    const original = mesh.material;
    const created = new Set<THREE.Material>();

    for (let i = 0; i < 10; i++) {
      applyRenderMode(mesh, 'solid', original, created);
      applyRenderMode(mesh, 'wireframe', original, created);
    }
    applyRenderMode(mesh, 'textured', original, created);

    expect(created.size).toBe(0);
  });
});
