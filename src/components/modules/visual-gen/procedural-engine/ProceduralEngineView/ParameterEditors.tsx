'use client';

import type { TerrainConfig } from '@/lib/visual-gen/generators/terrain';
import type { DungeonConfig } from '@/lib/visual-gen/generators/dungeon';
import type { VegetationConfig } from '@/lib/visual-gen/generators/vegetation';

export function TerrainParams({ terrainConfig, setTerrainConfig }: {
  terrainConfig: TerrainConfig;
  setTerrainConfig: (config: Partial<TerrainConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Size ({terrainConfig.size})</span>
        <select
          value={terrainConfig.size}
          onChange={(e) => setTerrainConfig({ size: Number(e.target.value) })}
          className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text"
        >
          <option value={65}>65x65</option>
          <option value={129}>129x129</option>
          <option value={257}>257x257</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Roughness ({terrainConfig.roughness.toFixed(2)})</span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={terrainConfig.roughness}
          onChange={(e) => setTerrainConfig({ roughness: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Seed</span>
        <input
          type="number"
          value={terrainConfig.seed}
          onChange={(e) => setTerrainConfig({ seed: Number(e.target.value) })}
          className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text"
        />
      </label>
    </div>
  );
}

export function DungeonParams({ dungeonConfig, setDungeonConfig }: {
  dungeonConfig: DungeonConfig;
  setDungeonConfig: (config: Partial<DungeonConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Width ({dungeonConfig.width})</span>
        <input
          type="range"
          min="32"
          max="128"
          step="8"
          value={dungeonConfig.width}
          onChange={(e) => setDungeonConfig({ width: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Height ({dungeonConfig.height})</span>
        <input
          type="range"
          min="32"
          max="128"
          step="8"
          value={dungeonConfig.height}
          onChange={(e) => setDungeonConfig({ height: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Iterations ({dungeonConfig.iterations})</span>
        <input
          type="range"
          min="2"
          max="8"
          step="1"
          value={dungeonConfig.iterations}
          onChange={(e) => setDungeonConfig({ iterations: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Min Room Size ({dungeonConfig.minRoomSize})</span>
        <input
          type="range"
          min="3"
          max="8"
          step="1"
          value={dungeonConfig.minRoomSize}
          onChange={(e) => setDungeonConfig({ minRoomSize: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Max Room Size ({dungeonConfig.maxRoomSize})</span>
        <input
          type="range"
          min="6"
          max="20"
          step="1"
          value={dungeonConfig.maxRoomSize}
          onChange={(e) => setDungeonConfig({ maxRoomSize: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Corridor Width ({dungeonConfig.corridorWidth})</span>
        <input
          type="range"
          min="1"
          max="3"
          step="1"
          value={dungeonConfig.corridorWidth}
          onChange={(e) => setDungeonConfig({ corridorWidth: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Seed</span>
        <input
          type="number"
          value={dungeonConfig.seed}
          onChange={(e) => setDungeonConfig({ seed: Number(e.target.value) })}
          className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text"
        />
      </label>
    </div>
  );
}

export function VegetationParams({ vegetationConfig, setVegetationConfig }: {
  vegetationConfig: VegetationConfig;
  setVegetationConfig: (config: Partial<VegetationConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Area Width ({vegetationConfig.width})</span>
        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={vegetationConfig.width}
          onChange={(e) => setVegetationConfig({ width: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Area Height ({vegetationConfig.height})</span>
        <input
          type="range"
          min="50"
          max="200"
          step="10"
          value={vegetationConfig.height}
          onChange={(e) => setVegetationConfig({ height: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Max Attempts ({vegetationConfig.maxAttempts})</span>
        <input
          type="range"
          min="10"
          max="60"
          step="5"
          value={vegetationConfig.maxAttempts}
          onChange={(e) => setVegetationConfig({ maxAttempts: Number(e.target.value) })}
          className="w-full"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-text-muted">Seed</span>
        <input
          type="number"
          value={vegetationConfig.seed}
          onChange={(e) => setVegetationConfig({ seed: Number(e.target.value) })}
          className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text"
        />
      </label>
      <div className="col-span-2">
        <span className="text-xs text-text-muted">
          Species: {vegetationConfig.species.map((s) => s.name).join(', ')}
        </span>
      </div>
    </div>
  );
}
