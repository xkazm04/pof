import { describe, it, expect, beforeEach } from 'vitest';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';

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
});
