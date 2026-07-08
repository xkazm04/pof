'use client';

/**
 * LiveStateSyncPanel — Real-time UE5 editor state display.
 *
 * Shows viewport camera, selected actors, PIE state, property watches,
 * and connection metrics streamed over WebSocket from the UE5 plugin.
 */

import { useState, useCallback, useMemo } from 'react';
import { WifiOff, Zap } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import {
  STATUS_SUCCESS, STATUS_WARNING,
  ACCENT_ORANGE,
  OPACITY_15,
} from '@/lib/chart-colors';
import type { PropertyWatchRequest } from '@/types/ue5-bridge';
import { Header } from './Header';
import { ViewportSection } from './ViewportSection';
import { SelectionSection } from './SelectionSection';
import { WatchesSection } from './WatchesSection';

// ── Main component ────────────────────────────────────────────────────────

export function LiveStateSyncPanel() {
  const {
    wsStatus,
    snapshot,
    propertyWatches,
    frameRate,
    isLive,
    connectWs,
    disconnectWs,
    watchProperty,
    unwatchProperty,
    requestSnapshot,
  } = useLiveStateSync();

  const wsPort = useUE5BridgeStore((s) => s.wsPort);
  const setWsPort = useUE5BridgeStore((s) => s.setWsPort);

  const [showViewport, setShowViewport] = useState(true);
  const [showSelection, setShowSelection] = useState(true);
  const [showWatches, setShowWatches] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const watchEntries = useMemo(() => Object.entries(propertyWatches), [propertyWatches]);

  const handleAddWatch = useCallback((req: PropertyWatchRequest) => {
    watchProperty(req);
    setShowWatches(true);
  }, [watchProperty]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="live-state-sync-panel" role="region" aria-label="Live State Sync">
      {/* ── Header ───────────────────────────────────────────────── */}
      <Header
        wsStatus={wsStatus}
        snapshot={snapshot}
        isLive={isLive}
        frameRate={frameRate}
        watchEntries={watchEntries}
        requestSnapshot={requestSnapshot}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        connectWs={connectWs}
        disconnectWs={disconnectWs}
        wsPort={wsPort}
        setWsPort={setWsPort}
      />

      {/* ── Disconnected state ────────────────────────────────────── */}
      {!isLive && !snapshot && (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted">
          <WifiOff className="w-8 h-8 opacity-30 mb-3" />
          <p className="text-xs font-medium mb-1">WebSocket not connected</p>
          <p className="text-2xs opacity-60">Connect to stream real-time editor state from UE5</p>
        </div>
      )}

      {/* ── Live state sections ───────────────────────────────────── */}
      {snapshot && (
        <div className="divide-y divide-border/20">
          {/* ── Viewport camera ──────────────────────────────────── */}
          <ViewportSection snapshot={snapshot} showViewport={showViewport} setShowViewport={setShowViewport} />

          {/* ── Selected actors ──────────────────────────────────── */}
          <SelectionSection snapshot={snapshot} showSelection={showSelection} setShowSelection={setShowSelection} />

          {/* ── PIE state ────────────────────────────────────────── */}
          {snapshot.pieState && (
            <div className="px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Zap className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
                <span className="font-bold text-text">Play-In-Editor</span>
                <span
                  className="px-1.5 py-0.5 rounded text-2xs font-bold"
                  style={{
                    color: snapshot.pieState.isPaused ? ACCENT_ORANGE : STATUS_SUCCESS,
                    backgroundColor: `${snapshot.pieState.isPaused ? ACCENT_ORANGE : STATUS_SUCCESS}${OPACITY_15}`,
                  }}
                >
                  {snapshot.pieState.isPaused ? 'Paused' : 'Running'}
                </span>
                <span className="text-text-muted font-mono ml-auto">
                  {snapshot.pieState.elapsedSeconds.toFixed(1)}s
                </span>
                <span className="text-text-muted">
                  {snapshot.pieState.playerCount} player{snapshot.pieState.playerCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* ── Property watches ─────────────────────────────────── */}
          <WatchesSection
            watchEntries={watchEntries}
            showWatches={showWatches}
            setShowWatches={setShowWatches}
            unwatchProperty={unwatchProperty}
            handleAddWatch={handleAddWatch}
          />

          {/* ── Dirty packages indicator ─────────────────────────── */}
          {snapshot.dirtyPackages.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 text-2xs">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_WARNING }}
                />
                <span className="font-bold text-text-muted uppercase tracking-wider">
                  Unsaved Packages
                </span>
                <span
                  className="font-mono px-1 rounded"
                  style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_15}` }}
                >
                  {snapshot.dirtyPackages.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
