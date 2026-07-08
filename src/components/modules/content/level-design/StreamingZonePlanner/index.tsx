'use client';

import { Loader2, Send } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { useStreamingZonePlanner } from './useStreamingZonePlanner';
import { PaintPalette } from './PaintPalette';
import { ZoneGrid } from './ZoneGrid';
import { ZoneEditor } from './ZoneEditor';
import { TransitionList } from './TransitionList';
import type { StreamingZonePlannerConfig } from './types';

export type {
  ZoneType,
  LoadPriority,
  TransitionStyle,
  StreamingZone,
  ZoneTransition,
  StreamingZonePlannerConfig,
} from './types';

// ── Props ──

interface StreamingZonePlannerProps {
  onGenerate: (config: StreamingZonePlannerConfig) => void;
  isGenerating: boolean;
}

// ── Component ──

export function StreamingZonePlanner({ onGenerate, isGenerating }: StreamingZonePlannerProps) {
  const {
    zones,
    transitions,
    gridSize,
    paintType,
    setPaintType,
    selectedZoneId,
    setSelectedZoneId,
    linkingFrom,
    setLinkingFrom,
    zoneAt,
    handleCellClick,
    updateZone,
    deleteTransition,
    updateTransition,
    selectedZone,
    transitionLines,
    config,
    stats,
  } = useStreamingZonePlanner();

  return (
    <div className="p-6 space-y-6 overflow-y-auto w-full max-w-6xl mx-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Paint palette */}
      <PaintPalette
        paintType={paintType}
        setPaintType={setPaintType}
        selectedZoneId={selectedZoneId}
        linkingFrom={linkingFrom}
        setLinkingFrom={setLinkingFrom}
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
        />

        {/* Right Column (Editor & Transitions) */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-6 relative z-10">
          {selectedZone && !linkingFrom && (
            <ZoneEditor
              zone={selectedZone!}
              onUpdate={(patch) => updateZone(selectedZone!.id, patch)}
              onClose={() => setSelectedZoneId(null)}
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
              disabled={isGenerating || zones.length === 0}
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
          </div>
        </div>
      </div>
    </div>
  );
}
