'use client';

import type { ReactNode } from 'react';
import { Upload } from 'lucide-react';
import {
  useProceduralStore,
  selectRun,
  selectExportFeedback,
  type GeneratorRun,
  type GeneratorType,
} from '../useProceduralStore';
import { specOf } from '../generatorSpecs';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { VISUAL_GEN_FOCUS_RING } from '@/lib/visual-gen/ui';
import { GENERATOR_OPTIONS } from './constants';
import { TerrainPreview, DungeonPreview, VegetationPreview } from './Previews';
import { ExportFeedback } from './ExportFeedback';
import { TerrainParams, DungeonParams, VegetationParams } from './ParameterEditors';

/** Preview per generator, drawn from the RUN (its data and its config), never the live config. */
const PREVIEWS: { [K in GeneratorType]: (run: GeneratorRun<K>) => ReactNode } = {
  terrain: (run) => <TerrainPreview heightmap={run.data} />,
  dungeon: (run) => (
    <DungeonPreview grid={run.data.grid} width={run.data.width} height={run.data.height} />
  ),
  vegetation: (run) => (
    <VegetationPreview
      points={run.data}
      width={run.config.width}
      height={run.config.height}
      species={run.config.species}
    />
  ),
};

function renderPreview<K extends GeneratorType>(type: K, run: GeneratorRun<K>): ReactNode {
  return (PREVIEWS[type] as (r: GeneratorRun<K>) => ReactNode)(run);
}

function runSummary<K extends GeneratorType>(type: K, run: GeneratorRun<K>): string {
  const spec = specOf(type);
  const cfg = run.config as { seed: number };
  return `${spec.summarize(run.data)} - seed ${cfg.seed}, size ${spec.describeSize(run.config)}`;
}

export function GeneratorTab() {
  const state = useProceduralStore();
  const {
    activeGenerator,
    terrainConfig,
    dungeonConfig,
    vegetationConfig,
    isGenerating,
    setActiveGenerator,
    setTerrainConfig,
    setDungeonConfig,
    setVegetationConfig,
    generate,
    exportToBlender,
  } = state;

  const connected = useBlenderMCPStore((s) => s.connection.connected);

  const spec = specOf(activeGenerator);
  const view = selectRun(state, activeGenerator);
  const feedback = selectExportFeedback(state, activeGenerator);
  const isExporting = feedback?.isExporting ?? false;

  const params: Record<GeneratorType, () => ReactNode> = {
    terrain: () => <TerrainParams terrainConfig={terrainConfig} setTerrainConfig={setTerrainConfig} />,
    dungeon: () => <DungeonParams dungeonConfig={dungeonConfig} setDungeonConfig={setDungeonConfig} />,
    vegetation: () => (
      <VegetationParams vegetationConfig={vegetationConfig} setVegetationConfig={setVegetationConfig} />
    ),
  };

  const exportTitle = !connected
    ? 'Connect to Blender first'
    : !view.run
      ? 'Generate content first'
      : 'Export the previewed run to Blender (its data and the config that produced it)';

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
        {GENERATOR_OPTIONS.map((opt) => {
          const selected = opt.id === activeGenerator;
          return (
            <button
              key={opt.id}
              onClick={() => setActiveGenerator(opt.id)}
              aria-pressed={selected}
              className={`text-left p-3 rounded-lg border transition-colors ${VISUAL_GEN_FOCUS_RING} ${
                selected
                  ? 'border-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
                  : 'border-border hover:border-text-muted'
              }`}
            >
              <div className="text-sm font-medium text-text">{opt.label}</div>
              <div className="text-xs text-text-muted mt-1">{opt.description}</div>
            </button>
          );
        })}
      </div>

      {/* Parameter editors */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="text-sm font-medium text-text">Parameters</h3>

        {params[activeGenerator]()}

        <div className="flex items-center gap-2">
          <button
            onClick={() => void generate(activeGenerator)}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : view.status === 'stale' ? 'Regenerate' : 'Generate'}
          </button>

          <button
            onClick={() => void exportToBlender(activeGenerator)}
            disabled={!connected || !view.run || isExporting}
            title={exportTitle}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export to Blender'}
          </button>
        </div>

        {view.status === 'stale' && (
          <p role="status" className="text-xs text-amber-400">
            Config changed since this preview ({view.staleBecause.join(', ')}) - Regenerate to
            apply it. Export ships the previewed run, not the edited config.
          </p>
        )}
      </div>

      {/* Export feedback (this generator's only) */}
      <ExportFeedback feedback={feedback} />

      {/* Preview */}
      <div className="rounded-lg border border-border p-4 flex flex-col items-center gap-3">
        <h3 className="text-sm font-medium text-text self-start">Preview</h3>

        {view.run ? (
          <>
            {renderPreview(activeGenerator, view.run)}
            <div className="text-xs text-text-muted">{runSummary(activeGenerator, view.run)}</div>
          </>
        ) : (
          <p className="text-xs text-text-muted py-8">{spec.emptyHint}</p>
        )}
      </div>
    </div>
  );
}
