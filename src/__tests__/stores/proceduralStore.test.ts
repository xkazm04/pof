import { describe, it, expect, beforeEach } from 'vitest';
import { useProceduralStore } from '@/components/modules/visual-gen/procedural-engine/useProceduralStore';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { DEFAULT_VEGETATION_CONFIG } from '@/lib/visual-gen/generators/vegetation';

describe('useProceduralStore', () => {
  beforeEach(() => {
    useProceduralStore.setState({
      activeGenerator: 'terrain',
      terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
      dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
      vegetationConfig: { ...DEFAULT_VEGETATION_CONFIG },
      terrainHeightmap: null,
      dungeonResult: null,
      vegetationPoints: null,
      isGenerating: false,
    });
  });

  it('starts with terrain as active generator', () => {
    const state = useProceduralStore.getState();
    expect(state.activeGenerator).toBe('terrain');
    expect(state.isGenerating).toBe(false);
    expect(state.terrainHeightmap).toBeNull();
    expect(state.dungeonResult).toBeNull();
    expect(state.vegetationPoints).toBeNull();
  });

  it('sets active generator', () => {
    useProceduralStore.getState().setActiveGenerator('dungeon');
    expect(useProceduralStore.getState().activeGenerator).toBe('dungeon');

    useProceduralStore.getState().setActiveGenerator('vegetation');
    expect(useProceduralStore.getState().activeGenerator).toBe('vegetation');
  });

  it('updates terrain config with partial merge', () => {
    useProceduralStore.getState().setTerrainConfig({ roughness: 0.8, seed: 99 });
    const { terrainConfig } = useProceduralStore.getState();
    expect(terrainConfig.roughness).toBe(0.8);
    expect(terrainConfig.seed).toBe(99);
    expect(terrainConfig.size).toBe(DEFAULT_TERRAIN_CONFIG.size); // unchanged
  });

  it('updates dungeon config with partial merge', () => {
    useProceduralStore.getState().setDungeonConfig({ width: 128, iterations: 8 });
    const { dungeonConfig } = useProceduralStore.getState();
    expect(dungeonConfig.width).toBe(128);
    expect(dungeonConfig.iterations).toBe(8);
    expect(dungeonConfig.height).toBe(DEFAULT_DUNGEON_CONFIG.height); // unchanged
  });

  it('updates vegetation config with partial merge', () => {
    useProceduralStore.getState().setVegetationConfig({ width: 200, maxAttempts: 50 });
    const { vegetationConfig } = useProceduralStore.getState();
    expect(vegetationConfig.width).toBe(200);
    expect(vegetationConfig.maxAttempts).toBe(50);
    expect(vegetationConfig.height).toBe(DEFAULT_VEGETATION_CONFIG.height); // unchanged
  });

  it('sets terrain heightmap', () => {
    const heightmap = [[0.1, 0.2], [0.3, 0.4]];
    useProceduralStore.getState().setTerrainHeightmap(heightmap);
    expect(useProceduralStore.getState().terrainHeightmap).toEqual(heightmap);
  });

  it('sets dungeon result', () => {
    const result = { grid: [['floor' as const]], rooms: [], width: 1, height: 1 };
    useProceduralStore.getState().setDungeonResult(result);
    expect(useProceduralStore.getState().dungeonResult).toEqual(result);
  });

  it('sets vegetation points', () => {
    const points = [{ x: 10, y: 20, speciesId: 'tree', rotation: 45, scale: 1.0 }];
    useProceduralStore.getState().setVegetationPoints(points);
    expect(useProceduralStore.getState().vegetationPoints).toEqual(points);
  });

  it('sets generating flag', () => {
    useProceduralStore.getState().setGenerating(true);
    expect(useProceduralStore.getState().isGenerating).toBe(true);
    useProceduralStore.getState().setGenerating(false);
    expect(useProceduralStore.getState().isGenerating).toBe(false);
  });

  it('clears all results', () => {
    useProceduralStore.getState().setTerrainHeightmap([[1]]);
    useProceduralStore.getState().setDungeonResult({ grid: [['floor']], rooms: [], width: 1, height: 1 });
    useProceduralStore.getState().setVegetationPoints([{ x: 0, y: 0, speciesId: 'a', rotation: 0, scale: 1 }]);

    useProceduralStore.getState().clearResults();

    const state = useProceduralStore.getState();
    expect(state.terrainHeightmap).toBeNull();
    expect(state.dungeonResult).toBeNull();
    expect(state.vegetationPoints).toBeNull();
  });
});
