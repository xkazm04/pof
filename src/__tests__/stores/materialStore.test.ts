import { describe, it, expect, beforeEach } from 'vitest';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

describe('useMaterialStore', () => {
  beforeEach(() => {
    useMaterialStore.setState({
      params: {
        baseColor: '#808080',
        metallic: 0,
        roughness: 0.5,
        normalStrength: 1,
        aoStrength: 1,
      },
      previewMesh: 'sphere',
      presets: [],
      activePresetId: null,
      albedoTexture: null,
      normalTexture: null,
      metallicTexture: null,
      roughnessTexture: null,
      aoTexture: null,
    });
  });

  it('starts with default PBR params', () => {
    const { params } = useMaterialStore.getState();
    expect(params.baseColor).toBe('#808080');
    expect(params.metallic).toBe(0);
    expect(params.roughness).toBe(0.5);
    expect(params.normalStrength).toBe(1);
    expect(params.aoStrength).toBe(1);
  });

  it('sets individual PBR param', () => {
    useMaterialStore.getState().setParam('metallic', 0.8);
    expect(useMaterialStore.getState().params.metallic).toBe(0.8);
  });

  it('sets multiple PBR params', () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.1 });
    const { params } = useMaterialStore.getState();
    expect(params.metallic).toBe(1.0);
    expect(params.roughness).toBe(0.1);
    expect(params.baseColor).toBe('#808080'); // unchanged
  });

  it('clears activePresetId when params change', () => {
    // First add and load a preset
    const id = useMaterialStore.getState().addPreset('Test');
    expect(useMaterialStore.getState().activePresetId).toBe(id);

    // Changing a param clears the active preset
    useMaterialStore.getState().setParam('roughness', 0.9);
    expect(useMaterialStore.getState().activePresetId).toBeNull();
  });

  it('sets preview mesh', () => {
    useMaterialStore.getState().setPreviewMesh('cube');
    expect(useMaterialStore.getState().previewMesh).toBe('cube');
  });

  it('sets and clears texture', () => {
    useMaterialStore.getState().setTexture('albedo', 'blob:test-texture');
    expect(useMaterialStore.getState().albedoTexture).toBe('blob:test-texture');

    useMaterialStore.getState().setTexture('albedo', null);
    expect(useMaterialStore.getState().albedoTexture).toBeNull();
  });

  it('adds a preset from current params', () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.2 });
    const id = useMaterialStore.getState().addPreset('Gold');

    expect(id).toBeTruthy();
    const { presets, activePresetId } = useMaterialStore.getState();
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('Gold');
    expect(presets[0].params.metallic).toBe(1.0);
    expect(presets[0].params.roughness).toBe(0.2);
    expect(activePresetId).toBe(id);
  });

  it('loads a preset', () => {
    useMaterialStore.getState().setParams({ metallic: 1.0, roughness: 0.1 });
    const id = useMaterialStore.getState().addPreset('Shiny Metal');

    // Change params
    useMaterialStore.getState().setParams({ metallic: 0, roughness: 0.9 });

    // Load preset
    useMaterialStore.getState().loadPreset(id);
    const { params, activePresetId } = useMaterialStore.getState();
    expect(params.metallic).toBe(1.0);
    expect(params.roughness).toBe(0.1);
    expect(activePresetId).toBe(id);
  });

  it('removes a preset', () => {
    const id = useMaterialStore.getState().addPreset('Temp');
    useMaterialStore.getState().removePreset(id);
    expect(useMaterialStore.getState().presets).toHaveLength(0);
    expect(useMaterialStore.getState().activePresetId).toBeNull();
  });

  it('resets all state', () => {
    useMaterialStore.getState().setParams({ metallic: 1, roughness: 0 });
    useMaterialStore.getState().setTexture('albedo', 'blob:tex');
    useMaterialStore.getState().addPreset('Test');

    useMaterialStore.getState().reset();
    const state = useMaterialStore.getState();
    expect(state.params.metallic).toBe(0);
    expect(state.params.roughness).toBe(0.5);
    expect(state.albedoTexture).toBeNull();
    expect(state.activePresetId).toBeNull();
    // Presets survive reset (they're saved data)
  });
});
