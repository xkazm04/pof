import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useViewerStore, revokeIfBlobUrl } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';

describe('useViewerStore', () => {
  beforeEach(() => {
    useViewerStore.setState({
      modelUrl: null,
      modelName: null,
      renderMode: 'textured',
      showGrid: true,
      showAxes: true,
      autoRotate: false,
    });
  });

  it('starts with default state', () => {
    const state = useViewerStore.getState();
    expect(state.modelUrl).toBeNull();
    expect(state.modelName).toBeNull();
    expect(state.renderMode).toBe('textured');
    expect(state.showGrid).toBe(true);
    expect(state.showAxes).toBe(true);
    expect(state.autoRotate).toBe(false);
  });

  it('sets model URL and name', () => {
    useViewerStore.getState().setModel('blob:test-url', 'character.glb');
    const state = useViewerStore.getState();
    expect(state.modelUrl).toBe('blob:test-url');
    expect(state.modelName).toBe('character.glb');
  });

  it('sets model URL without name', () => {
    useViewerStore.getState().setModel('blob:test-url');
    const state = useViewerStore.getState();
    expect(state.modelUrl).toBe('blob:test-url');
    expect(state.modelName).toBeNull();
  });

  it('clears model', () => {
    useViewerStore.getState().setModel('blob:test', 'test.glb');
    useViewerStore.getState().setModel(null);
    const state = useViewerStore.getState();
    expect(state.modelUrl).toBeNull();
    expect(state.modelName).toBeNull();
  });

  it('sets render mode', () => {
    useViewerStore.getState().setRenderMode('wireframe');
    expect(useViewerStore.getState().renderMode).toBe('wireframe');

    useViewerStore.getState().setRenderMode('solid');
    expect(useViewerStore.getState().renderMode).toBe('solid');

    useViewerStore.getState().setRenderMode('textured');
    expect(useViewerStore.getState().renderMode).toBe('textured');
  });

  it('toggles grid', () => {
    expect(useViewerStore.getState().showGrid).toBe(true);
    useViewerStore.getState().toggleGrid();
    expect(useViewerStore.getState().showGrid).toBe(false);
    useViewerStore.getState().toggleGrid();
    expect(useViewerStore.getState().showGrid).toBe(true);
  });

  it('toggles axes', () => {
    expect(useViewerStore.getState().showAxes).toBe(true);
    useViewerStore.getState().toggleAxes();
    expect(useViewerStore.getState().showAxes).toBe(false);
    useViewerStore.getState().toggleAxes();
    expect(useViewerStore.getState().showAxes).toBe(true);
  });

  it('toggles auto-rotate', () => {
    expect(useViewerStore.getState().autoRotate).toBe(false);
    useViewerStore.getState().toggleAutoRotate();
    expect(useViewerStore.getState().autoRotate).toBe(true);
    useViewerStore.getState().toggleAutoRotate();
    expect(useViewerStore.getState().autoRotate).toBe(false);
  });

  it('resets to initial state', () => {
    useViewerStore.getState().setModel('blob:test', 'test.glb');
    useViewerStore.getState().setRenderMode('wireframe');
    useViewerStore.getState().toggleGrid();
    useViewerStore.getState().toggleAutoRotate();

    useViewerStore.getState().reset();
    const state = useViewerStore.getState();
    expect(state.modelUrl).toBeNull();
    expect(state.modelName).toBeNull();
    expect(state.renderMode).toBe('textured');
    expect(state.showGrid).toBe(true);
    expect(state.showAxes).toBe(true);
    expect(state.autoRotate).toBe(false);
  });

  describe('revokeIfBlobUrl', () => {
    it('revokes a blob: URL', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      revokeIfBlobUrl('blob:abc');
      expect(spy).toHaveBeenCalledWith('blob:abc');
      spy.mockRestore();
    });

    it('never revokes a served URL, null, or undefined', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      revokeIfBlobUrl('/api/visual-gen/asset/foo.glb');
      revokeIfBlobUrl('https://example.com/foo.glb');
      revokeIfBlobUrl(null);
      revokeIfBlobUrl(undefined);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // setModel used to overwrite modelUrl with no cleanup: loading several local files in
  // one session leaked one Object URL (and the File bytes it pins) per load.
  describe('setModel revokes the outgoing blob URL', () => {
    it('revokes the previous blob: URL when pointed at a new model', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      useViewerStore.getState().setModel('blob:first', 'a.glb');
      useViewerStore.getState().setModel('blob:second', 'b.glb');
      expect(spy).toHaveBeenCalledWith('blob:first');
      expect(spy).not.toHaveBeenCalledWith('blob:second');
      spy.mockRestore();
    });

    it('never revokes a served (non-blob) URL', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      useViewerStore.getState().setModel('/api/visual-gen/asset/foo.glb', 'foo.glb');
      useViewerStore.getState().setModel('blob:local', 'local.glb');
      expect(spy).not.toHaveBeenCalledWith('/api/visual-gen/asset/foo.glb');
      spy.mockRestore();
    });

    it('revokes the current blob URL on reset', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      useViewerStore.getState().setModel('blob:held', 'held.glb');
      useViewerStore.getState().reset();
      expect(spy).toHaveBeenCalledWith('blob:held');
      spy.mockRestore();
    });
  });
});
