import { Film, RefreshCw, Scan, Play, RotateCcw, Plug, Monitor, LayoutTemplate } from 'lucide-react';
import { ACCENT_ORANGE, STATUS_SUCCESS } from '@/lib/chart-colors';
import { ExplainToggle } from '@/components/animations/explain';
import { ANIM_ACCENT, GRAPH_PROVENANCE } from './constants';
import { resolveGraphProvenance } from './helpers';
import type { StateNode } from './types';

interface StateMachineHeaderProps {
  useBridgeData: boolean;
  simMode: boolean;
  simPath: string[];
  completedCount: number;
  displayStates: StateNode[];
  hasScannedData: boolean | null;
  toggleSimMode: () => void;
  projectPath: string | null;
  projectName: string | null;
  handleScan: () => void;
  isScanning: boolean;
  handleExportToBlenderNLA: () => void;
  blenderConnected: boolean;
  blenderExporting: boolean;
}

export function StateMachineHeader({
  useBridgeData,
  simMode,
  simPath,
  completedCount,
  displayStates,
  hasScannedData,
  toggleSimMode,
  projectPath,
  projectName,
  handleScan,
  isScanning,
  handleExportToBlenderNLA,
  blenderConnected,
  blenderExporting,
}: StateMachineHeaderProps) {
  // One badge, one source of truth: the graph never claims RUNTIME while it is
  // showing the hardcoded template.
  const provenance = resolveGraphProvenance(useBridgeData, !!hasScannedData);
  const { badge, label } = GRAPH_PROVENANCE[provenance];
  const isBridge = provenance === 'bridge';

  return (
    <div className="flex items-center justify-between relative z-10 border-b border-violet-900/40 pb-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] relative overflow-hidden">
          <Film className="w-5 h-5 text-violet-400 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-violet-500/20 to-transparent" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase flex items-center gap-3" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
            STATE_MACHINE.graph
            <span
              data-testid="graph-provenance"
              data-provenance={provenance}
              title={label}
              className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                isBridge
                  ? 'bg-green-500/20 text-green-300 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                  : 'bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
              }`}
            >
              {provenance === 'bridge' ? <Plug className="w-2.5 h-2.5" />
                : provenance === 'scanned' ? <Scan className="w-2.5 h-2.5" />
                : <LayoutTemplate className="w-2.5 h-2.5" />}
              {badge}
            </span>
          </h3>
          <p className="text-xs text-violet-400/80 font-mono uppercase tracking-widest mt-0.5">
            {simMode
              ? simPath.length === 0
                ? 'Click a state to begin tracing'
                : `${simPath.length} states in path — click valid transitions to continue`
              : `${completedCount}/${displayStates.length} states // ${label}`
            }
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ExplainToggle compact />
        {/* Simulate button */}
        <button
          onClick={toggleSimMode}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg"
          style={{
            backgroundColor: simMode ? `${ACCENT_ORANGE}20` : `${ANIM_ACCENT}20`,
            color: simMode ? ACCENT_ORANGE : ANIM_ACCENT,
            border: `1px solid ${simMode ? ACCENT_ORANGE : ANIM_ACCENT}`,
            boxShadow: simMode ? `0 0 15px ${ACCENT_ORANGE}40, inset 0 0 10px ${ACCENT_ORANGE}20` : `0 0 10px ${ANIM_ACCENT}30, inset 0 0 10px ${ANIM_ACCENT}15`,
          }}
        >
          {simMode ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {simMode ? 'Exit Sim' : 'Simulate'}
        </button>

        {/* Scan button */}
        {projectPath && projectName && !simMode && (
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg"
            style={{
              backgroundColor: hasScannedData ? `${STATUS_SUCCESS}20` : `${ANIM_ACCENT}20`,
              color: hasScannedData ? STATUS_SUCCESS : ANIM_ACCENT,
              border: `1px solid ${hasScannedData ? STATUS_SUCCESS : ANIM_ACCENT}`,
              boxShadow: hasScannedData ? `0 0 15px ${STATUS_SUCCESS}40, inset 0 0 10px ${STATUS_SUCCESS}20` : `0 0 10px ${ANIM_ACCENT}30, inset 0 0 10px ${ANIM_ACCENT}15`,
            }}
          >
            {isScanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Scan className="w-3.5 h-3.5" />
            )}
            {isScanning ? 'Scanning...' : hasScannedData ? 'Rescan' : 'Scan Project'}
          </button>
        )}

        {/* Export to Blender NLA */}
        {!simMode && (
          <button
            onClick={handleExportToBlenderNLA}
            disabled={!blenderConnected || blenderExporting || displayStates.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 shadow-lg"
            style={{
              backgroundColor: 'rgba(16,185,129,0.12)',
              color: 'rgb(52,211,153)',
              border: '1px solid rgba(16,185,129,0.4)',
              boxShadow: '0 0 10px rgba(16,185,129,0.2), inset 0 0 10px rgba(16,185,129,0.1)',
            }}
            title={!blenderConnected ? 'Connect to Blender first' : 'Export state machine as NLA tracks in Blender'}
          >
            {blenderExporting ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Monitor className="w-3.5 h-3.5" />
            )}
            {blenderExporting ? 'Exporting...' : 'Export to Blender NLA'}
          </button>
        )}
      </div>
    </div>
  );
}
