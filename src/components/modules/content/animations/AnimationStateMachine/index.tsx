'use client';

import {
  AlertCircle, Sparkles, FileCode2,
  RotateCcw, MousePointerClick,
} from 'lucide-react';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_WARNING, MODULE_COLORS,
  ACCENT_ORANGE, OPACITY_30,
} from '@/lib/chart-colors';
import { SchematicPanel } from '@/components/ui/SchematicPanel';
import { JargonText } from '@/components/animations/explain';
import { ANIM_ACCENT } from './constants';
import type { AnimationStateMachineProps } from './types';
import { useAnimationStateMachine } from './useAnimationStateMachine';
import { StateMachineHeader } from './StateMachineHeader';
import { StateMachineDiagram } from './StateMachineDiagram';
import { StateMachineDetails } from './StateMachineDetails';

export type { AnimationStateMachineProps } from './types';

export function AnimationStateMachine({ onSelectState, isRunning, activeStateId }: AnimationStateMachineProps) {
  const {
    prefersReducedMotion,
    projectPath,
    projectName,
    scanResult,
    isScanning,
    scanError,
    blenderExporting,
    blenderResult,
    blenderConnected,
    simMode,
    simPath,
    simUnreachable,
    simDeadEnds,
    modifiedTransitions,
    hoveredTransition,
    setHoveredTransition,
    handleScan,
    hasScannedData,
    useBridgeData,
    displayStates,
    displayTransitions,
    transitionRuleMap,
    edgeKeySet,
    stateNodes,
    stateMap,
    simEdges,
    validNextStates,
    handleClick,
    toggleSimMode,
    resetSimPath,
    handleExportToBlenderNLA,
    completedCount,
  } = useAnimationStateMachine({ onSelectState, isRunning, activeStateId });

  return (
    <SchematicPanel
      accent={ANIM_ACCENT}
      accentSecondary={ACCENT_CYAN}
      className="w-full max-w-4xl mx-auto select-none p-6 flex flex-col gap-6"
    >
      {/* Header */}
      <StateMachineHeader
        useBridgeData={useBridgeData}
        simMode={simMode}
        simPath={simPath}
        completedCount={completedCount}
        displayStates={displayStates}
        hasScannedData={hasScannedData}
        toggleSimMode={toggleSimMode}
        projectPath={projectPath}
        projectName={projectName}
        handleScan={handleScan}
        isScanning={isScanning}
        handleExportToBlenderNLA={handleExportToBlenderNLA}
        blenderConnected={blenderConnected}
        blenderExporting={blenderExporting}
      />

      {/* Blender NLA result */}
      {blenderResult && (
        <div className={`relative z-10 text-xs font-mono px-3 py-2 rounded-lg border ${blenderResult.isError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
          {blenderResult.message}
        </div>
      )}

      {/* Simulation reset bar */}
      {simMode && simPath.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ borderColor: `${ACCENT_ORANGE}${OPACITY_30}`, backgroundColor: `${ACCENT_ORANGE}06` }}>
          <div className="flex items-center gap-2 min-w-0">
            <MousePointerClick className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_ORANGE }} />
            <span className="text-2xs text-text-muted truncate">
              Path: {simPath.map((id) => stateMap[id]?.label ?? id).join(' → ')}
            </span>
          </div>
          <button
            onClick={resetSimPath}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium transition-colors"
            style={{ color: ACCENT_ORANGE }}
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-red-subtle border border-status-red-medium text-2xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {/* Scan metadata */}
      {scanResult && !simMode && (
        <div className="flex flex-wrap items-center gap-3 text-2xs text-text-muted">
          {scanResult.animInstanceClass && (
            <span className="flex items-center gap-1">
              <FileCode2 className="w-2.5 h-2.5" />
              {scanResult.animInstanceClass}
            </span>
          )}
          {scanResult.headerPath && (
            <span className="flex items-center gap-1 font-mono text-text-muted">
              {scanResult.headerPath}
            </span>
          )}
          {scanResult.montageRefs.length > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {scanResult.montageRefs.length} montage ref{scanResult.montageRefs.length !== 1 ? 's' : ''}
            </span>
          )}
          {scanResult.animVariables.length > 0 && (
            <span>
              {scanResult.animVariables.length} anim var{scanResult.animVariables.length !== 1 ? 's' : ''}
            </span>
          )}
          {scanResult.states.length === 0 && !scanError && (
            <span style={{ color: STATUS_WARNING }}>
              <JargonText>No states found — AnimBP states may be defined in Blueprint only</JargonText>
            </span>
          )}
        </div>
      )}

      {/* State machine diagram */}
      <StateMachineDiagram
        displayStates={displayStates}
        displayTransitions={displayTransitions}
        stateMap={stateMap}
        simEdges={simEdges}
        modifiedTransitions={modifiedTransitions}
        hoveredTransition={hoveredTransition}
        setHoveredTransition={setHoveredTransition}
        edgeKeySet={edgeKeySet}
        transitionRuleMap={transitionRuleMap}
        prefersReducedMotion={prefersReducedMotion}
        stateNodes={stateNodes}
        simMode={simMode}
        simPath={simPath}
        validNextStates={validNextStates}
        simUnreachable={simUnreachable}
        simDeadEnds={simDeadEnds}
        isRunning={isRunning}
        handleClick={handleClick}
      />

      {/* Simulation summary */}
      {simMode && simPath.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold text-text">{simPath.length}</div>
            <div className="text-2xs text-text-muted">states visited</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: simUnreachable.size > 0 ? MODULE_COLORS.evaluator : STATUS_SUCCESS }}>
              {simUnreachable.size}
            </div>
            <div className="text-2xs text-text-muted">unreachable</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-deep px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: simDeadEnds.size > 0 ? ACCENT_ORANGE : STATUS_SUCCESS }}>
              {simDeadEnds.size}
            </div>
            <div className="text-2xs text-text-muted">dead ends</div>
          </div>
        </div>
      )}

      <StateMachineDetails scanResult={scanResult} simMode={simMode} />
    </SchematicPanel>
  );
}
