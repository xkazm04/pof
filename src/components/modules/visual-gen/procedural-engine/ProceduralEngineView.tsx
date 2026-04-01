'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Cpu, Upload } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { useProceduralStore, type GeneratorType } from './useProceduralStore';
import { generateDiamondSquare } from '@/lib/visual-gen/generators/terrain';
import { generateDungeon } from '@/lib/visual-gen/generators/dungeon';
import { generateVegetation } from '@/lib/visual-gen/generators/vegetation';
import type { CellType } from '@/lib/visual-gen/generators/dungeon';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

const GENERATOR_OPTIONS: { id: GeneratorType; label: string; description: string }[] = [
  { id: 'terrain', label: 'Terrain Heightmap', description: 'Diamond-Square algorithm for realistic terrain elevation' },
  { id: 'dungeon', label: 'Dungeon Layout', description: 'BSP tree dungeon with rooms, corridors, and walls' },
  { id: 'vegetation', label: 'Vegetation Scatter', description: 'Poisson disk sampling for natural vegetation placement' },
];

const CELL_COLORS: Record<CellType, string> = {
  empty: '#111827',
  floor: '#6b7280',
  wall: '#374151',
  door: '#f59e0b',
  corridor: '#4b5563',
};

function TerrainPreview({ heightmap }: { heightmap: number[][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = heightmap.length;
    canvas.width = size;
    canvas.height = size;

    const imageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = Math.floor(heightmap[y][x] * 255);
        const idx = (y * size + x) * 4;
        // Green-brown terrain coloring
        imageData.data[idx] = Math.floor(v * 0.4);
        imageData.data[idx + 1] = Math.floor(v * 0.7 + 50);
        imageData.data[idx + 2] = Math.floor(v * 0.2);
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [heightmap]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function DungeonPreview({ grid, width, height }: { grid: CellType[][]; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = CELL_COLORS[grid[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function VegetationPreview({ points, width, height, species }: {
  points: Array<{ x: number; y: number; speciesId: string; scale: number }>;
  width: number;
  height: number;
  species: Array<{ id: string; color: string; radius: number }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 4;
    canvas.width = width * scale;
    canvas.height = height * scale;

    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const speciesMap = new Map(species.map((s) => [s.id, s]));

    for (const point of points) {
      const sp = speciesMap.get(point.speciesId);
      if (!sp) continue;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(point.x * scale, point.y * scale, sp.radius * scale * 0.3 * point.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [points, width, height, species]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[512px] aspect-square rounded-lg border border-border"
    />
  );
}

function ExportFeedback({ isExporting, result, error }: {
  isExporting: boolean;
  result: string | null;
  error: string | null;
}) {
  if (isExporting) {
    return (
      <div className="text-xs text-amber-400 bg-amber-500/5 rounded px-2 py-1.5 animate-pulse">
        Exporting to Blender...
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1.5">
        Export failed: {error}
      </div>
    );
  }
  if (result) {
    return (
      <div className="text-xs text-emerald-400 bg-emerald-500/5 rounded px-2 py-1.5">
        {result}
      </div>
    );
  }
  return null;
}

function GeneratorTab() {
  const {
    activeGenerator,
    terrainConfig,
    dungeonConfig,
    vegetationConfig,
    terrainHeightmap,
    dungeonResult,
    vegetationPoints,
    isGenerating,
    exportState,
    setActiveGenerator,
    setTerrainConfig,
    setDungeonConfig,
    setVegetationConfig,
    setTerrainHeightmap,
    setDungeonResult,
    setVegetationPoints,
    setGenerating,
    exportTerrainToBlender,
    exportDungeonToBlender,
    exportVegetationToBlender,
  } = useProceduralStore();

  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      try {
        if (activeGenerator === 'terrain') {
          const result = generateDiamondSquare(terrainConfig);
          setTerrainHeightmap(result);
        } else if (activeGenerator === 'dungeon') {
          const result = generateDungeon(dungeonConfig);
          setDungeonResult(result);
        } else if (activeGenerator === 'vegetation') {
          const result = generateVegetation(vegetationConfig);
          setVegetationPoints(result);
        }
      } finally {
        setGenerating(false);
      }
    });
  }, [activeGenerator, terrainConfig, dungeonConfig, vegetationConfig, setTerrainHeightmap, setDungeonResult, setVegetationPoints, setGenerating]);

  const handleExport = useCallback(() => {
    if (activeGenerator === 'terrain') {
      exportTerrainToBlender();
    } else if (activeGenerator === 'dungeon') {
      exportDungeonToBlender();
    } else if (activeGenerator === 'vegetation') {
      exportVegetationToBlender();
    }
  }, [activeGenerator, exportTerrainToBlender, exportDungeonToBlender, exportVegetationToBlender]);

  const hasData =
    (activeGenerator === 'terrain' && terrainHeightmap !== null) ||
    (activeGenerator === 'dungeon' && dungeonResult !== null) ||
    (activeGenerator === 'vegetation' && vegetationPoints !== null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-base font-semibold text-text">Procedural Content Engine</h2>
        <p className="text-xs text-text-muted mt-1">
          Generate terrains, dungeons, and vegetation scatter using configurable algorithms
        </p>
      </div>

      {/* Blender connection */}
      <BlenderConnectionBar />

      {/* Generator selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {GENERATOR_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setActiveGenerator(opt.id)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              activeGenerator === opt.id
                ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
                : 'border-border hover:border-text-muted'
            }`}
          >
            <div className="text-sm font-medium text-text">{opt.label}</div>
            <div className="text-xs text-text-muted mt-1">{opt.description}</div>
          </button>
        ))}
      </div>

      {/* Parameter editors */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="text-sm font-medium text-text">Parameters</h3>

        {activeGenerator === 'terrain' && (
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
        )}

        {activeGenerator === 'dungeon' && (
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
        )}

        {activeGenerator === 'vegetation' && (
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
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>

          <button
            onClick={handleExport}
            disabled={!connected || !hasData || exportState.isExporting}
            title={!connected ? 'Connect to Blender first' : !hasData ? 'Generate content first' : 'Export to Blender'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            {exportState.isExporting ? 'Exporting...' : 'Export to Blender'}
          </button>
        </div>
      </div>

      {/* Export feedback */}
      <ExportFeedback
        isExporting={exportState.isExporting}
        result={exportState.exportResult}
        error={exportState.exportError}
      />

      {/* Preview */}
      <div className="rounded-lg border border-border p-4 flex flex-col items-center gap-3">
        <h3 className="text-sm font-medium text-text self-start">Preview</h3>

        {activeGenerator === 'terrain' && terrainHeightmap && (
          <TerrainPreview heightmap={terrainHeightmap} />
        )}

        {activeGenerator === 'dungeon' && dungeonResult && (
          <>
            <DungeonPreview grid={dungeonResult.grid} width={dungeonResult.width} height={dungeonResult.height} />
            <div className="text-xs text-text-muted">
              {dungeonResult.rooms.length} rooms generated
            </div>
          </>
        )}

        {activeGenerator === 'vegetation' && vegetationPoints && (
          <>
            <VegetationPreview
              points={vegetationPoints}
              width={vegetationConfig.width}
              height={vegetationConfig.height}
              species={vegetationConfig.species}
            />
            <div className="text-xs text-text-muted">
              {vegetationPoints.length} scatter points generated
            </div>
          </>
        )}

        {!terrainHeightmap && activeGenerator === 'terrain' && (
          <p className="text-xs text-text-muted py-8">Click Generate to create a terrain heightmap</p>
        )}
        {!dungeonResult && activeGenerator === 'dungeon' && (
          <p className="text-xs text-text-muted py-8">Click Generate to create a dungeon layout</p>
        )}
        {!vegetationPoints && activeGenerator === 'vegetation' && (
          <p className="text-xs text-text-muted py-8">Click Generate to scatter vegetation points</p>
        )}
      </div>
    </div>
  );
}

export function ProceduralEngineView() {
  const mod = SUB_MODULE_MAP['procedural-engine'];
  const cat = getCategoryForSubModule('procedural-engine');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'generator',
      label: 'Generator',
      icon: Cpu,
      render: () => <GeneratorTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="procedural-engine"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('procedural-engine')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
