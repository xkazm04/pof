/**
 * Deleting the selected object left its name in `selectedObject`, so the next object
 * Blender gave that name came up already selected. `transformMode` had no reader at all.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';

const store = () => useSceneComposerStore.getState();

beforeEach(() => {
  useSceneComposerStore.setState({ selectedObject: 'Cube', actionError: null, actionResult: null });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { output: 'done', objects: [] } }),
  })));
});

afterEach(() => vi.unstubAllGlobals());

describe('scene composer selection', () => {
  it('clears the selection when the selected object is deleted', async () => {
    await store().deleteObject('Cube');
    expect(store().selectedObject).toBeNull();
  });

  it('keeps the selection when another object is deleted', async () => {
    await store().deleteObject('Sphere');
    expect(store().selectedObject).toBe('Cube');
  });
});
