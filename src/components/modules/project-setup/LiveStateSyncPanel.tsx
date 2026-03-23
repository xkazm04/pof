'use client';

/**
 * LiveStateSyncPanel — Real-time UE5 editor state display.
 *
 * Shows viewport camera, selected actors, PIE state, property watches,
 * and connection metrics streamed over WebSocket from the UE5 plugin.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Radio, Wifi, WifiOff, Eye, MapPin, Play, Pause, Square,
  ChevronDown, ChevronRight, RefreshCw, Plus, X, Activity,
  Camera, Layers, Crosshair, Gauge, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_PINK,
  OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import type { SelectedActor, PropertyWatchRequest, PropertyWatchUpdate } from '@/types/ue5-bridge';

const ACCENT = MODULE_COLORS.setup;

// ── Helpers ────────────────────────────────────────────────────────────────

function formatVec3(v: { x: number; y: number; z: number } | undefined): string {
  if (!v) return '—';
  return `${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}`;
}

function formatRot(r: { pitch: number; yaw: number; roll: number } | undefined): string {
  if (!r) return '—';
  return `P:${r.pitch.toFixed(1)} Y:${r.yaw.toFixed(1)} R:${r.roll.toFixed(1)}`;
}

// ── Status badge ──────────────────────────────────────────────────────────

function WsStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; pulse: boolean }> = {
    connected: { color: STATUS_SUCCESS, label: 'Live', pulse: true },
    connecting: { color: ACCENT_ORANGE, label: 'Connecting...', pulse: true },
    reconnecting: { color: ACCENT_ORANGE, label: 'Reconnecting...', pulse: true },
    disconnected: { color: STATUS_NEUTRAL, label: 'Offline', pulse: false },
  };
  const c = config[status] ?? config.disconnected;
  return (
    <span className="flex items-center gap-1.5 text-xs font-mono font-bold" style={{ color: c.color }}>
      <motion.span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}60` }}
        animate={c.pulse ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {c.label}
    </span>
  );
}

// ── Editor state badge ────────────────────────────────────────────────────

function EditorStateBadge({ state }: { state: string }) {
  const config: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
    Editing: { color: ACCENT_CYAN, icon: Layers },
    PIE: { color: STATUS_SUCCESS, icon: Play },
    SIE: { color: ACCENT_VIOLET, icon: Eye },
    Paused: { color: ACCENT_ORANGE, icon: Pause },
  };
  const c = config[state] ?? { color: STATUS_NEUTRAL, icon: Square };
  const Icon = c.icon;
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
      style={{ color: c.color, backgroundColor: `${c.color}${OPACITY_15}` }}
    >
      <Icon className="w-3 h-3" />
      {state}
    </span>
  );
}

// ── Actor row ─────────────────────────────────────────────────────────────

function ActorRow({ actor }: { actor: SelectedActor }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 hover:bg-surface/30 transition-colors">
      <Crosshair className="w-3 h-3 flex-shrink-0" style={{ color: ACCENT_PINK }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono font-bold text-text truncate">{actor.label}</div>
        <div className="text-2xs font-mono text-text-muted/60 truncate">{actor.className}</div>
      </div>
      {actor.location && (
        <span className="text-2xs font-mono text-text-muted flex-shrink-0">{formatVec3(actor.location)}</span>
      )}
    </div>
  );
}

// ── Property watch form ───────────────────────────────────────────────────

function PropertyWatchForm({ onAdd }: { onAdd: (req: PropertyWatchRequest) => void }) {
  const [objectPath, setObjectPath] = useState('');
  const [propertyName, setPropertyName] = useState('');

  const handleAdd = useCallback(() => {
    if (!objectPath.trim() || !propertyName.trim()) return;
    onAdd({
      watchId: `watch-${Date.now()}`,
      objectPath: objectPath.trim(),
      propertyName: propertyName.trim(),
      intervalMs: 500,
    });
    setObjectPath('');
    setPropertyName('');
  }, [objectPath, propertyName, onAdd]);

  return (
    <div className="flex items-end gap-1.5">
      <div className="flex-1">
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">Object Path</label>
        <input
          type="text"
          value={objectPath}
          onChange={(e) => setObjectPath(e.target.value)}
          placeholder="/Game/BP_Player.BP_Player_C"
          className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      <div className="w-32">
        <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">Property</label>
        <input
          type="text"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
          placeholder="MaxHealth"
          className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      <button
        onClick={handleAdd}
        disabled={!objectPath.trim() || !propertyName.trim()}
        className="px-2 py-1 rounded text-xs font-bold border transition-colors disabled:opacity-40"
        style={{ borderColor: `${ACCENT_EMERALD}40`, color: ACCENT_EMERALD }}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
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

  const watchEntries = useMemo(() => Object.entries(propertyWatches), [propertyWatches]);

  const handleAddWatch = useCallback((req: PropertyWatchRequest) => {
    watchProperty(req);
    setShowWatches(true);
  }, [watchProperty]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="live-state-sync-panel">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT_VIOLET }} />
            <Radio className="w-4 h-4 relative z-10" style={{ color: ACCENT_VIOLET }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text">Live State Sync</h3>
              <WsStatusBadge status={wsStatus} />
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
              <button
                onClick={requestSnapshot}
                className="p-1.5 rounded-md border border-border/30 text-text-muted hover:text-text transition-colors"
                title="Request fresh snapshot"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-md border border-border/30 text-text-muted hover:text-text transition-colors"
              title="Connection settings"
            >
              <Gauge className="w-3 h-3" />
            </button>
            {!isLive ? (
              <button
                onClick={connectWs}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors"
                style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}${OPACITY_10}`, color: ACCENT_EMERALD }}
              >
                <Wifi className="w-3 h-3" />
                Connect
              </button>
            ) : (
              <button
                onClick={disconnectWs}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors"
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
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                <label className="text-2xs font-bold text-text-muted uppercase tracking-wider">WS Port</label>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={wsPort}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 65535) setWsPort(v);
                  }}
                  className="w-24 px-2 py-1 rounded text-xs font-mono bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                />
                <span className="text-2xs text-text-muted">
                  Default: HTTP port + 1 (30041). Must match UE5 plugin WS port.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
          <div>
            <button
              onClick={() => setShowViewport(!showViewport)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showViewport ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <Camera className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
                Viewport
              </span>
              <span className="text-2xs text-text-muted ml-auto font-mono">
                {snapshot.viewport.viewMode}
              </span>
            </button>
            {showViewport && (
              <div className="px-4 pb-3 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Camera Location</div>
                    <div className="text-xs font-mono text-text">{formatVec3(snapshot.viewport.cameraLocation)}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Camera Rotation</div>
                    <div className="text-xs font-mono text-text">{formatRot(snapshot.viewport.cameraRotation)}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">FOV</div>
                    <div className="text-xs font-mono text-text">{snapshot.viewport.fov.toFixed(1)}&deg;</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xs font-bold text-text-muted uppercase tracking-wider">Level</div>
                    <div className="text-xs font-mono text-text truncate">{snapshot.openLevel || '—'}</div>
                  </div>
                </div>

                {/* Mini viewport position dot */}
                <div
                  className="relative w-full h-16 rounded-lg overflow-hidden"
                  style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_8}`, border: `1px solid ${ACCENT_CYAN}${OPACITY_15}` }}
                >
                  <svg viewBox="0 0 200 60" className="w-full h-full">
                    {/* Grid */}
                    {[0, 50, 100, 150, 200].map((x) => (
                      <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={60} stroke={`${ACCENT_CYAN}15`} strokeWidth={0.5} />
                    ))}
                    {[0, 20, 40, 60].map((y) => (
                      <line key={`gy-${y}`} x1={0} y1={y} x2={200} y2={y} stroke={`${ACCENT_CYAN}15`} strokeWidth={0.5} />
                    ))}
                    {/* Camera position dot */}
                    {(() => {
                      // Normalize to a reasonable range (±50000 UU)
                      const nx = ((snapshot.viewport.cameraLocation.x + 50000) / 100000) * 200;
                      const ny = ((snapshot.viewport.cameraLocation.y + 50000) / 100000) * 60;
                      const clampX = Math.max(4, Math.min(196, nx));
                      const clampY = Math.max(4, Math.min(56, ny));
                      return (
                        <>
                          <circle cx={clampX} cy={clampY} r={6} fill={`${ACCENT_CYAN}20`} />
                          <circle cx={clampX} cy={clampY} r={3} fill={ACCENT_CYAN} />
                          {/* Yaw direction indicator */}
                          <line
                            x1={clampX}
                            y1={clampY}
                            x2={clampX + Math.cos((snapshot.viewport.cameraRotation.yaw * Math.PI) / 180) * 10}
                            y2={clampY + Math.sin((snapshot.viewport.cameraRotation.yaw * Math.PI) / 180) * 10}
                            stroke={ACCENT_CYAN}
                            strokeWidth={1.5}
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* ── Selected actors ──────────────────────────────────── */}
          <div>
            <button
              onClick={() => setShowSelection(!showSelection)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showSelection ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <MapPin className="w-3.5 h-3.5" style={{ color: ACCENT_PINK }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_PINK }}>
                Selected Actors
              </span>
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: snapshot.selectedActors.length > 0 ? ACCENT_PINK : STATUS_NEUTRAL,
                  backgroundColor: snapshot.selectedActors.length > 0 ? `${ACCENT_PINK}${OPACITY_15}` : 'transparent',
                }}
              >
                {snapshot.selectedActors.length}
              </span>
            </button>
            {showSelection && (
              <div className="px-4 pb-3">
                {snapshot.selectedActors.length === 0 ? (
                  <p className="text-2xs text-text-muted py-1">No actors selected in the editor</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {snapshot.selectedActors.map((actor, i) => (
                      <ActorRow key={actor.path || i} actor={actor} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
          <div>
            <button
              onClick={() => setShowWatches(!showWatches)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showWatches ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <Eye className="w-3.5 h-3.5" style={{ color: ACCENT_EMERALD }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_EMERALD }}>
                Property Watches
              </span>
              <span className="text-2xs text-text-muted">{watchEntries.length}</span>
            </button>
            {showWatches && (
              <div className="px-4 pb-3 space-y-2">
                {/* Active watches */}
                {watchEntries.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {watchEntries.map(([watchId, update]) => (
                      <div key={watchId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 group">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-2xs font-mono text-text-muted truncate">{update.objectPath}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-text">{update.propertyName}</span>
                            <span className="text-xs font-mono" style={{ color: ACCENT_EMERALD }}>
                              {typeof update.value === 'object' ? JSON.stringify(update.value) : String(update.value)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => unwatchProperty(watchId)}
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: STATUS_ERROR }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add watch form */}
                <PropertyWatchForm onAdd={handleAddWatch} />
              </div>
            )}
          </div>

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
