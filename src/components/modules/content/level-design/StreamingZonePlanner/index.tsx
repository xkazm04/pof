'use client';

import { useMemo } from 'react';
import { Loader2, Send } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_ERROR } from '@/lib/chart-colors';
import { preflightStreamingPlan, residency } from '@/lib/level-design/streaming-preflight';
import { useStreamingZonePlanner } from './useStreamingZonePlanner';
import { PaintPalette } from './PaintPalette';
import { ZoneGrid } from './ZoneGrid';
import { ZoneEditor } from './ZoneEditor';
import { TransitionList } from './TransitionList';
import { PreflightPanel } from './PreflightPanel';
import type { StreamingZonePlannerConfig, StreamingPlanStore } from './types';

export type {
  ZoneType,
  LoadPriority,
  TransitionStyle,
  StreamingZone,
  ZoneTransition,
  StreamingZonePlannerConfig,
  StreamingMode,
  StreamingOp,
  StreamingPlanState,
  StreamingPlanStore,
} from './types';

// ── Props ──

interface StreamingZonePlannerProps {
  onGenerate: (config: StreamingZonePlannerConfig) => void;
  isGenerating: boolean;
  /**
   * The plan's reducer, owned by the level-design view so a tab switch cannot
   * reset it. Omitted (tests, standalone), the planner holds a private one.
   */
  store?: StreamingPlanStore;
}

// ── Component ──

export function StreamingZonePlanner({ onGenerate, isGenerating, store }: StreamingZonePlannerProps) {
  const {
    zones,
    transitions,
    gridSize,
    mode,
    paintType,
    linkingFrom,
    selectedZoneId,
    dispatch,
    zoneAt,
    handleCellClick,
    updateZone,
    deleteTransition,
    updateTransition,
    selectedZone,
    transitionLines,
    config,
    stats,
  } = useStreamingZonePlanner(store);

  // Preflight runs on the document only (config is stable across selection/mode changes).
  const preflight = useMemo(() => preflightStreamingPlan(config), [config]);
  const resident = useMemo(() => residency(config), [config]);
  const residentIds = useMemo(
    () => (selectedZoneId ? new Set(resident.byZone[selectedZoneId] ?? []) : null),
    [resident, selectedZoneId],
  );
  const blocking = preflight.findings.filter((f) => f.blocksGenerate).length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto w-full max-w-6xl mx-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Paint palette */}
      <PaintPalette
        mode={mode}
        selectedZoneId={selectedZoneId}
        dispatch={dispatch}
      />

      {/* Dynamic Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-6 relative z-10">

        {/* Main Grid Canvas */}
        <ZoneGrid
          gridSize={gridSize}
          paintType={paintType}
          linkingFrom={linkingFrom}
          transitionLines={transitionLines}
          zones={zones}
          zoneAt={zoneAt}
          handleCellClick={handleCellClick}
          deleteTransition={deleteTransition}
          selectedZoneId={selectedZoneId}
          residentIds={residentIds}
        />

        {/* Right Column (Editor & Transitions) */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-6 relative z-10">
          {selectedZone && !linkingFrom && (
            <ZoneEditor
              zone={selectedZone!}
              onUpdate={(patch) => updateZone(selectedZone!.id, patch)}
              onClose={() => dispatch({ type: 'select', zoneId: null })}
            />
          )}

          {/* Transition list */}
          {transitions.length > 0 && (
            <TransitionList
              transitions={transitions}
              zones={zones}
              deleteTransition={deleteTransition}
              updateTransition={updateTransition}
            />
          )}

          <PreflightPanel
            preflight={preflight}
            residency={resident}
            zones={zones}
            selectedZoneId={selectedZoneId}
            dispatch={dispatch}
          />

          {/* Summary & Generate */}
          <div className="bg-[#03030a] rounded-xl border border-violet-900/30 shadow-[inset_0_0_20px_rgba(167,139,250,0.05)] p-4">
            <div className="flex items-center justify-between mb-3 text-[11px] font-mono tracking-widest uppercase text-violet-300">
              <span>{stats.total} ZONES</span>
              <span className="text-violet-800">|</span>
              <span>{stats.alwaysLoaded} PERSISTENT</span>
              <span className="text-violet-800">|</span>
              <span>{stats.transitions} PIPELINES</span>
            </div>
            <button
              onClick={() => onGenerate(config)}
              disabled={isGenerating || zones.length === 0 || preflight.blocksGenerate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg"
              style={{
                backgroundColor: `${MODULE_COLORS.content}20`,
                color: MODULE_COLORS.content,
                border: `1px solid ${MODULE_COLORS.content}50`,
                boxShadow: `0 0 20px ${MODULE_COLORS.content}30, inset 0 0 10px ${MODULE_COLORS.content}20`,
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Config...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generate Map Matrix
                </>
              )}
            </button>
            {preflight.blocksGenerate && (
              <p className="mt-2 text-xs font-mono" style={{ color: STATUS_ERROR }}>
                Generate blocked: {blocking} EWorldZone error{blocking === 1 ? '' : 's'} would not compile. Fix them in Preflight.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
