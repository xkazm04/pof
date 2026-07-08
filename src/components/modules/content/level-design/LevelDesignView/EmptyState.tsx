'use client';
import { Plus } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { LevelDesignSpatialDiagram } from '../LevelDesignSpatialDiagram';
import { ProceduralLevelWizard } from '../ProceduralLevelWizard';
import type { LevelDesignVM } from './useLevelDesignView';

export function EmptyState({ vm }: { vm: LevelDesignVM }) {
  const {
    spatialCli,
    handleGenerateProcgen,
    procgenCli,
    newDocName,
    setNewDocName,
    handleCreateDoc,
    isCreating,
  } = vm;

  return (
    /* Empty state — Spatial diagram + doc creation */
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-lg space-y-8">
        {/* Spatial Diagram */}
        <LevelDesignSpatialDiagram
          onRunPrompt={spatialCli.sendPrompt}
          isRunning={spatialCli.isRunning}
          activeItemId={spatialCli.activeItemId}
        />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-2xs text-text-muted uppercase tracking-widest">or generate procedurally</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Procedural Level Wizard */}
        <ProceduralLevelWizard
          onGenerate={handleGenerateProcgen}
          isGenerating={procgenCli.isRunning}
        />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-2xs text-text-muted uppercase tracking-widest">or start a design doc</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Doc creation */}
        <div className="text-center space-y-2.5">
          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
            Create level designs in natural language with a visual flow editor and bidirectional C++ code sync.
          </p>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="text"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDoc(); }}
              placeholder="My first level..."
              className="px-3 py-2 bg-surface border border-border rounded-md text-xs text-text placeholder-text-muted outline-none focus:border-border-bright transition-colors"
            />
            <button
              onClick={handleCreateDoc}
              disabled={!newDocName.trim() || isCreating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${MODULE_COLORS.content}15`,
                color: MODULE_COLORS.content,
                border: `1px solid ${MODULE_COLORS.content}30`,
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Doc
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
