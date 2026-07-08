import { motion } from 'framer-motion';
import {
  ArrowLeftRight, Square, Zap, ArrowDown, ArrowUp,
  AlertTriangle, Radio,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import { ACCENT } from './constants';
import type { SyncConflict } from './types';

export function PanelHeader({
  isLive,
  conflicts,
  outboundCount,
  inboundCount,
  frameRate,
  connectWs,
  disconnectWs,
}: {
  isLive: boolean;
  conflicts: SyncConflict[];
  outboundCount: number;
  inboundCount: number;
  frameRate: number;
  connectWs: () => void;
  disconnectWs: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
          <ArrowLeftRight className="w-4 h-4 relative z-10" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text">Bidirectional State Sync</h3>
            {isLive && (
              <motion.span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold"
                role="status"
                aria-live="polite"
                style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}${OPACITY_15}` }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Radio className="w-2.5 h-2.5" /> LIVE
              </motion.span>
            )}
            {conflicts.length > 0 && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold"
                role="alert"
                style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
              >
                <AlertTriangle className="w-2.5 h-2.5" /> {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Push property edits, PIE commands &amp; viewport changes to UE5
          </p>
        </div>

        {/* Traffic stats */}
        {isLive && (
          <div className="flex items-center gap-3 mr-2">
            <span className="flex items-center gap-1 text-2xs font-mono text-text-muted">
              <ArrowUp className="w-3 h-3" style={{ color: ACCENT_ORANGE }} />
              <span style={{ color: ACCENT_ORANGE }}>{outboundCount}</span>
            </span>
            <span className="flex items-center gap-1 text-2xs font-mono text-text-muted">
              <ArrowDown className="w-3 h-3" style={{ color: ACCENT_CYAN }} />
              <span style={{ color: ACCENT_CYAN }}>{inboundCount}</span>
            </span>
            <span className="flex items-center gap-1 text-2xs font-mono text-text-muted">
              <Zap className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
              <span style={{ color: ACCENT_EMERALD }}>{frameRate}</span> /s
            </span>
          </div>
        )}

        {/* Connect/disconnect */}
        {!isLive ? (
          <button
            onClick={connectWs}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors"
            style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD }}
          >
            <ArrowLeftRight className="w-3 h-3" /> Connect
          </button>
        ) : (
          <button
            onClick={disconnectWs}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors"
            style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}${OPACITY_10}`, color: STATUS_ERROR }}
          >
            <Square className="w-3 h-3" /> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
