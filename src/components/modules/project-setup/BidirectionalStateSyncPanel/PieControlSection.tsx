import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Square, RotateCcw, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, ACCENT_ORANGE,
  OPACITY_8, OPACITY_15,
} from '@/lib/chart-colors';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';

export function PieControlSection({
  showPieControl,
  setShowPieControl,
  snapshot,
  handlePIE,
  requestSnapshot,
}: {
  showPieControl: boolean;
  setShowPieControl: Dispatch<SetStateAction<boolean>>;
  snapshot: UE5EditorSnapshot | null;
  handlePIE: (action: 'play' | 'pause' | 'stop') => void;
  requestSnapshot: () => void;
}) {
  return (
    <div>
      <button
        onClick={() => setShowPieControl(!showPieControl)}
        aria-expanded={showPieControl}
        aria-controls="bss-pie-panel"
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
      >
        {showPieControl ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
        <Zap className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
        <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: STATUS_SUCCESS }}>
          PIE Control
        </span>
        {snapshot?.pieState && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded"
            style={{
              color: snapshot.pieState.isPaused ? ACCENT_ORANGE : STATUS_SUCCESS,
              backgroundColor: `${snapshot.pieState.isPaused ? ACCENT_ORANGE : STATUS_SUCCESS}${OPACITY_15}`,
            }}
          >
            {snapshot.pieState.isPaused ? 'Paused' : 'Running'} — {snapshot.pieState.elapsedSeconds.toFixed(1)}s
          </span>
        )}
      </button>
      <AnimatePresence>
        {showPieControl && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePIE('play')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors"
                  style={{ borderColor: `${STATUS_SUCCESS}40`, backgroundColor: `${STATUS_SUCCESS}${OPACITY_8}`, color: STATUS_SUCCESS }}
                >
                  <Play className="w-3.5 h-3.5" /> Play
                </button>
                <button
                  onClick={() => handlePIE('pause')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors"
                  style={{ borderColor: `${ACCENT_ORANGE}40`, backgroundColor: `${ACCENT_ORANGE}${OPACITY_8}`, color: ACCENT_ORANGE }}
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
                <button
                  onClick={() => handlePIE('stop')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors"
                  style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}${OPACITY_8}`, color: STATUS_ERROR }}
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
                <button
                  onClick={requestSnapshot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-border/30 text-text-muted hover:text-text transition-colors ml-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {/* Current PIE info */}
              {snapshot?.pieState && (
                <div className="mt-2 flex items-center gap-4 text-2xs font-mono text-text-muted">
                  <span>Session: <span className="text-text">{snapshot.pieState.sessionId?.slice(0, 8) ?? 'N/A'}</span></span>
                  <span>Players: <span className="text-text">{snapshot.pieState.playerCount}</span></span>
                  <span>Editor: <span className="text-text">{snapshot.editorState}</span></span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
