'use client';

import { Grid3X3 } from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { useProceduralLevelWizard } from './useProceduralLevelWizard';
import { AlgorithmSelector } from './AlgorithmSelector';
import { LevelTypeSelector } from './LevelTypeSelector';
import { SizeParameters } from './SizeParameters';
import { ConstraintsPanel } from './ConstraintsPanel';
import { LivePreview } from './LivePreview';
import { GenerateActions } from './GenerateActions';
import type { ProcgenSpec } from '@/lib/level-design/procgen-spec';
import type { ProceduralLevelConfig } from './types';

export type {
  GenAlgorithm, LevelType, SizeParams, GameplayConstraints, ProceduralLevelConfig,
} from './types';

// ── Component ──

interface ProceduralLevelWizardProps {
  onGenerate: (config: ProceduralLevelConfig) => void;
  isGenerating: boolean;
  /**
   * Publish the configured {@link ProcgenSpec} so the UE dungeon tab can adopt
   * it. The wizard state is the spec's producer; adopting surfaces are expected
   * to disclose which of its fields their engine ignores.
   */
  onSpecChange?: (spec: ProcgenSpec) => void;
}

export function ProceduralLevelWizard({ onGenerate, isGenerating, onSpecChange }: ProceduralLevelWizardProps) {
  const {
    algorithm, setAlgorithm,
    levelType,
    size,
    constraints,
    seed, setSeed,
    blenderExporting,
    blenderResult,
    blenderConnected,
    pendingExport,
    exportPlanSummary,
    spawnPlacementSummary,
    preview,
    selectLevelType,
    toggleConstraint,
    updateSize,
    handleGenerate,
    prepareBlenderExport,
    cancelBlenderExport,
    confirmBlenderExport,
    algNav,
    ltNav,
    algDef,
    ltDef,
  } = useProceduralLevelWizard({ onGenerate, onSpecChange });

  return (
    <div
      className="w-full h-full space-y-6 p-6 overflow-y-auto bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] text-violet-100 font-mono relative"
      style={{ ['--focus-accent' as string]: ACCENT_VIOLET }}
    >
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 blur-[100px] rounded-full pointer-events-none" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 relative z-10 border-b border-violet-900/30 pb-4">
        <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
          <Grid3X3 className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Procedural Matrix Configurator</h3>
          <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">Initialize algorithmic spatial generation parameters</p>
        </div>
      </div>

      {/* ─── Algorithm ─── */}
      <AlgorithmSelector algorithm={algorithm} setAlgorithm={setAlgorithm} algNav={algNav} algDef={algDef} />

      {/* ─── Level Type ─── */}
      <LevelTypeSelector levelType={levelType} selectLevelType={selectLevelType} ltNav={ltNav} />

      {/* ─── Size Parameters ─── */}
      <SizeParameters size={size} updateSize={updateSize} seed={seed} setSeed={setSeed} ltDef={ltDef} algorithm={algorithm} />

      {/* ─── Gameplay Constraints ─── */}
      <ConstraintsPanel constraints={constraints} toggleConstraint={toggleConstraint} />

      {/* ─── Live Preview ─── */}
      <LivePreview preview={preview} seed={seed} algDef={algDef} />

      {/* ─── Generate ─── */}
      <GenerateActions
        isGenerating={isGenerating}
        handleGenerate={handleGenerate}
        prepareBlenderExport={prepareBlenderExport}
        cancelBlenderExport={cancelBlenderExport}
        confirmBlenderExport={confirmBlenderExport}
        pendingExport={pendingExport}
        exportPlanSummary={exportPlanSummary}
        spawnPlacementSummary={spawnPlacementSummary}
        blenderConnected={blenderConnected}
        blenderExporting={blenderExporting}
        blenderResult={blenderResult}
        algDef={algDef}
      />
    </div>
  );
}
