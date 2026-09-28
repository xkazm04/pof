'use client';

/**
 * LiveStateSyncPanel — Real-time UE5 editor state display.
 *
 * Shows viewport camera, selected actors, PIE state, property watches,
 * and connection metrics streamed over WebSocket from the UE5 plugin.
 */

import { useState, useCallback, useMemo } from 'react';
import { WifiOff, Zap, Loader2, AlertTriangle, RotateCw, Radio } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_ORANGE, ACCENT_CYAN,
  OPACITY_15,
} from '@/lib/chart-colors';
import type { PropertyWatchRequest, SelectedActor, UE5ConnectionStatus } from '@/types/ue5-bridge';
import { Header } from './Header';
import { ViewportSection } from './ViewportSection';
import { SelectionSection } from './SelectionSection';
import { WatchesSection } from './WatchesSection';
import { watchCountsByObjectPath, watchDraftFromActor, type WatchDraft } from './selectionWatch';

// ── Pre-snapshot state copy ───────────────────────────────────────────────
// Honest per-status copy: the panel must never claim "not connected" while the
// socket is mid-handshake, retrying, or connected-but-awaiting its first frame.

interface StatusCopy {
  icon: typeof WifiOff;
  title: string;
  detail: string;
  color?: string;
  spin?: boolean;
}

function statusCopy(status: UE5ConnectionStatus, wsPort: number): StatusCopy {
  switch (status) {
    case 'connecting':
      return {
        icon: Loader2,
        title: 'Connecting…',
        detail: `Opening the WebSocket channel on port ${wsPort}`,
        color: ACCENT_CYAN,
        spin: true,
      };
    case 'reconnecting':
      return {
        icon: RotateCw,
        title: 'Connection lost — reconnecting',
        detail: 'The channel closed unexpectedly. Retrying with backoff.',
        color: ACCENT_ORANGE,
        spin: true,
      };
    case 'error':
      return {
        icon: AlertTriangle,
        title: 'WebSocket connection failed',
        detail: `Could not reach the UE5 plugin on port ${wsPort}. Check the editor is running and the plugin's WS port matches.`,
        color: STATUS_ERROR,
      };
    case 'connected':
      return {
        icon: Radio,
        title: 'Connected — waiting for the first snapshot',
        detail: 'The channel is open; no editor state has arrived yet.',
        color: STATUS_SUCCESS,
      };
    default:
      return {
        icon: WifiOff,
        title: 'WebSocket not connected',
        detail: 'Connect to stream real-time editor state from UE5',
      };
  }
}

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
  // Prefill for the watch form from a selected actor; `key` remounts the form per pick.
  const [watchDraft, setWatchDraft] = useState<(WatchDraft & { key: number }) | null>(null);

  const watchEntries = useMemo(() => Object.entries(propertyWatches), [propertyWatches]);
  const watchCounts = useMemo(() => watchCountsByObjectPath(watchEntries), [watchEntries]);
  const preSnapshot = useMemo(() => statusCopy(wsStatus, wsPort), [wsStatus, wsPort]);
  const PreSnapshotIcon = preSnapshot.icon;

  const handleAddWatch = useCallback((req: PropertyWatchRequest) => {
    watchProperty(req);
    setShowWatches(true);
  }, [watchProperty]);

  const handleWatchActor = useCallback((actor: SelectedActor) => {
    const draft = watchDraftFromActor(actor);
    if (!draft) return;
    setWatchDraft((prev) => ({ ...draft, key: (prev?.key ?? 0) + 1 }));
    setShowWatches(true);
  }, []);

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

      {/* ── Pre-snapshot state (disconnected / connecting / retrying / error) ── */}
      {!snapshot && (
        <div
          role="status"
          aria-live="polite"
          data-ws-status={wsStatus}
          data-testid="live-state-sync-status"
          className="flex flex-col items-center justify-center py-8 px-6 text-text-muted text-center"
        >
          <PreSnapshotIcon
            className={`w-8 h-8 mb-3 ${preSnapshot.spin ? 'animate-spin motion-reduce:animate-none' : ''}`}
            style={preSnapshot.color ? { color: preSnapshot.color } : { opacity: 0.3 }}
          />
          <p className="text-xs font-medium mb-1 text-text">{preSnapshot.title}</p>
          <p className="text-2xs opacity-60 max-w-sm">{preSnapshot.detail}</p>
        </div>
      )}

      {/* ── Live state sections ───────────────────────────────────── */}
      {snapshot && (
        <div className="divide-y divide-border/20">
          {/* ── Stale frame: the client keeps the last snapshot through an
                 unexpected close, so it must not read as live ─────────── */}
          {!isLive && (
            <div
              role="status"
              aria-live="polite"
              data-testid="live-state-stale"
              data-ws-status={wsStatus}
              className="flex items-center gap-2 px-4 py-2 text-2xs font-medium"
              style={{ color: ACCENT_ORANGE, backgroundColor: `${ACCENT_ORANGE}${OPACITY_15}` }}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{preSnapshot.title} · values below are from the last frame, not live</span>
            </div>
          )}

          {/* ── Viewport camera ──────────────────────────────────── */}
          <ViewportSection snapshot={snapshot} showViewport={showViewport} setShowViewport={setShowViewport} />

          {/* ── Selected actors ──────────────────────────────────── */}
          <SelectionSection
            snapshot={snapshot}
            showSelection={showSelection}
            setShowSelection={setShowSelection}
            watchCounts={watchCounts}
            onWatchActor={handleWatchActor}
          />

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
            watchDraft={watchDraft}
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
