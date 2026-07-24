import {
  Radio, Wifi, WifiOff, Eye, RefreshCw, Activity, Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectionStatusBadge } from '@/components/ui/ConnectionStatusBadge';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET,
  OPACITY_10,
} from '@/lib/chart-colors';
import type { UE5ConnectionStatus, UE5EditorSnapshot, PropertyWatchUpdate } from '@/types/ue5-bridge';
import { EditorStateBadge } from './EditorStateBadge';

interface HeaderProps {
  wsStatus: UE5ConnectionStatus;
  snapshot: UE5EditorSnapshot | null;
  isLive: boolean;
  frameRate: number;
  watchEntries: [string, PropertyWatchUpdate][];
  requestSnapshot: () => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  connectWs: () => void;
  disconnectWs: () => void;
  wsPort: number;
  setWsPort: (v: number) => void;
}

export function Header({
  wsStatus,
  snapshot,
  isLive,
  frameRate,
  watchEntries,
  requestSnapshot,
  showSettings,
  setShowSettings,
  connectWs,
  disconnectWs,
  wsPort,
  setWsPort,
}: HeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT_VIOLET }} />
          <Radio className="w-4 h-4 relative z-10" style={{ color: ACCENT_VIOLET }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text">Live State Sync</h3>
            <ConnectionStatusBadge status={wsStatus} label={wsStatus === 'connected' ? 'Live' : undefined} />
            {isLive && snapshot && <EditorStateBadge state={snapshot.editorState} />}
          </div>
          <p className="text-xs text-text-muted">
            Bidirectional WebSocket — real-time editor state from UE5
          </p>
        </div>

        {/* Metrics */}
        {isLive && (
          <div className="flex items-center gap-3 mr-2">
            <span className="flex items-center gap-1 text-2xs font-mono text-text-muted">
              <Activity className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
              <span style={{ color: ACCENT_EMERALD }}>{frameRate}</span> msg/s
            </span>
            {watchEntries.length > 0 && (
              <span className="flex items-center gap-1 text-2xs font-mono text-text-muted">
                <Eye className="w-3 h-3" style={{ color: ACCENT_CYAN }} />
                {watchEntries.length} watches
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {isLive && (
            <Tooltip content="Request fresh snapshot">
              <button
                type="button"
                onClick={requestSnapshot}
                aria-label="Request fresh snapshot"
                className="p-1.5 rounded-md border border-border/30 text-text-muted hover:text-text transition-colors focus-ring"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Connection settings">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              aria-label="Connection settings"
              aria-expanded={showSettings}
              aria-controls="lss-connection-settings"
              className="p-1.5 rounded-md border border-border/30 text-text-muted hover:text-text transition-colors focus-ring"
            >
              <Gauge className="w-3 h-3" />
            </button>
          </Tooltip>
          {!isLive ? (
            <button
              type="button"
              onClick={connectWs}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors focus-ring"
              style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD }}
            >
              <Wifi className="w-3 h-3" />
              Connect
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnectWs}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors focus-ring"
              style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}${OPACITY_10}`, color: STATUS_ERROR }}
            >
              <WifiOff className="w-3 h-3" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div id="lss-connection-settings" className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
              <label htmlFor="lss-ws-port" className="text-2xs font-bold text-text-muted uppercase tracking-wider">WS Port</label>
              <input
                id="lss-ws-port"
                type="number"
                min={1024}
                max={65535}
                value={wsPort}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 65535) setWsPort(v);
                }}
                className="w-24 px-2 py-1 rounded text-xs font-mono bg-surface-deep border border-border/40 text-text focus-ring-inset"
              />
              <span className="text-2xs text-text-muted">
                Default: HTTP port + 1 (30041). Must match UE5 plugin WS port.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
