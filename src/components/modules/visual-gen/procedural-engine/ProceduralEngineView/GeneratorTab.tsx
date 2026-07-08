'use client';

import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useProceduralStore } from '../useProceduralStore';
import { generateDiamondSquare } from '@/lib/visual-gen/generators/terrain';
import { generateDungeon } from '@/lib/visual-gen/generators/dungeon';
import { generateVegetation } from '@/lib/visual-gen/generators/vegetation';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import { GENERATOR_OPTIONS } from './constants';
import { TerrainPreview, DungeonPreview, VegetationPreview } from './Previews';
import { ExportFeedback } from './ExportFeedback';
import { TerrainParams, DungeonParams, VegetationParams } from './ParameterEditors';

export function GeneratorTab() {
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
            aria-pressed={activeGenerator === opt.id}
            className={`text-left p-3 rounded-lg border transition-colors ${VISUAL_GEN_FOCUS_RING} ${
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
          <TerrainParams terrainConfig={terrainConfig} setTerrainConfig={setTerrainConfig} />
        )}

        {activeGenerator === 'dungeon' && (
          <DungeonParams dungeonConfig={dungeonConfig} setDungeonConfig={setDungeonConfig} />
        )}

        {activeGenerator === 'vegetation' && (
          <VegetationParams vegetationConfig={vegetationConfig} setVegetationConfig={setVegetationConfig} />
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
