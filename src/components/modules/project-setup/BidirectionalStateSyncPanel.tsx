'use client';

/**
 * BidirectionalStateSyncPanel — Full bidirectional UE5 editor control surface.
 *
 * Beyond the read-only LiveStateSyncPanel, this panel provides:
 *   - Property write-back: edit watched property values and push to UE5
 *   - PIE control: play/pause/stop from the web app
 *   - Viewport teleport: set camera position/rotation/FOV
 *   - Actor selection push: select actors in UE5 from the web app
 *   - Sync log: live message log of all inbound/outbound WS traffic
 *   - Conflict detection: highlights when both sides edit the same property
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeftRight, Send, Play, Pause, Square,
  Camera, MapPin, RotateCcw, Trash2, Copy, ChevronDown,
  ChevronRight, Zap, ArrowDown, ArrowUp, Filter, AlertTriangle,
  CheckCircle, Clock, Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_8, OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

const ACCENT = ACCENT_VIOLET;
const MAX_LOG_ENTRIES = 200;

// ── Types ──────────────────────────────────────────────────────────────────

type SyncDirection = 'outbound' | 'inbound';
type LogLevel = 'info' | 'warn' | 'conflict';

interface SyncLogEntry {
  id: number;
  ts: number;
  direction: SyncDirection;
  level: LogLevel;
  category: string;
  message: string;
  detail?: string;
}

interface PropertyEdit {
  objectPath: string;
  propertyName: string;
  value: string;
}

interface ViewportTarget {
  x: string;
  y: string;
  z: string;
  pitch: string;
  yaw: string;
  roll: string;
  fov: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let _logIdCounter = 0;
function nextLogId(): number {
  return ++_logIdCounter;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ── Direction badge ────────────────────────────────────────────────────────

function DirectionBadge({ direction }: { direction: SyncDirection }) {
  const isOut = direction === 'outbound';
  return (
    <span
      className="flex items-center gap-0.5 px-1 py-0.5 rounded text-2xs font-bold"
      style={{
        color: isOut ? ACCENT_ORANGE : ACCENT_CYAN,
        backgroundColor: `${isOut ? ACCENT_ORANGE : ACCENT_CYAN}${OPACITY_15}`,
      }}
    >
      {isOut ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {isOut ? 'OUT' : 'IN'}
    </span>
  );
}

// ── Level indicator ─────────────────────────────────────────────────────

function LevelIndicator({ level }: { level: LogLevel }) {
  const conf: Record<LogLevel, { color: string; Icon: React.ComponentType<{ className?: string }> }> = {
    info: { color: ACCENT_CYAN, Icon: CheckCircle },
    warn: { color: STATUS_WARNING, Icon: AlertTriangle },
    conflict: { color: STATUS_ERROR, Icon: AlertTriangle },
  };
  const c = conf[level];
  return (
    <span className="flex-shrink-0" style={{ color: c.color }}>
      <c.Icon className="w-3 h-3" />
    </span>
  );
}

// ── Property editor row ─────────────────────────────────────────────────

function PropertyEditorRow({
  objectPath,
  propertyName,
  currentValue,
  onPush,
}: {
  objectPath: string;
  propertyName: string;
  currentValue: unknown;
  onPush: (objectPath: string, propertyName: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = useCallback(() => {
    setDraft(typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? ''));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [currentValue]);

  const handlePush = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      parsed = draft; // send as string
    }
    onPush(objectPath, propertyName, parsed);
    setEditing(false);
  }, [draft, objectPath, propertyName, onPush]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePush();
    if (e.key === 'Escape') setEditing(false);
  }, [handlePush]);

  const displayValue = typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '—');

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/20 group hover:bg-surface/30 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT_EMERALD }} />
      <div className="flex-1 min-w-0">
        <div className="text-2xs font-mono text-text-muted/60 truncate">{objectPath}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-text">{propertyName}</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-32 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                style={{ borderColor: `${ACCENT_EMERALD}60` }}
              />
              <button
                onClick={handlePush}
                className="p-0.5 rounded"
                title="Push to UE5"
                style={{ color: ACCENT_EMERALD }}
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono truncate" style={{ color: ACCENT_EMERALD }}>
              {truncate(displayValue, 40)}
            </span>
          )}
        </div>
      </div>
      {!editing && (
        <button
          onClick={handleStartEdit}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit & push to UE5"
          style={{ color: ACCENT_ORANGE }}
        >
          <Send className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function BidirectionalStateSyncPanel() {
  const {
    snapshot,
    propertyWatches,
    frameRate,
    isLive,
    connectWs,
    disconnectWs,
    setProperty,
    requestSnapshot,
  } = useLiveStateSync();

  const autoSync = useUE5BridgeStore((s) => s.autoSyncLiveState);

  // ── Sync log ──
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [showLog, setShowLog] = useState(true);
  const [logFilter, setLogFilter] = useState<SyncDirection | 'all'>('all');
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((direction: SyncDirection, level: LogLevel, category: string, message: string, detail?: string) => {
    setSyncLog((prev) => {
      const next = [...prev, { id: nextLogId(), ts: Date.now(), direction, level, category, message, detail }];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [syncLog]);

  // ── Sections ──
  const [showPropertyWrite, setShowPropertyWrite] = useState(true);
  const [showPieControl, setShowPieControl] = useState(true);
  const [showViewportTeleport, setShowViewportTeleport] = useState(false);
  const [showConflicts, setShowConflicts] = useState(true);

  // ── Property write ──
  const [propEdit, setPropEdit] = useState<PropertyEdit>({ objectPath: '', propertyName: '', value: '' });

  const handleDirectPropertyPush = useCallback(() => {
    if (!propEdit.objectPath.trim() || !propEdit.propertyName.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(propEdit.value);
    } catch {
      parsed = propEdit.value;
    }
    setProperty(propEdit.objectPath.trim(), propEdit.propertyName.trim(), parsed);
    addLog('outbound', 'info', 'SET', `${propEdit.propertyName} = ${truncate(propEdit.value, 40)}`, propEdit.objectPath);
    setPropEdit({ objectPath: '', propertyName: '', value: '' });
  }, [propEdit, setProperty, addLog]);

  // ── Watched property push-back ──
  const watchEntries = useMemo(() => Object.entries(propertyWatches), [propertyWatches]);

  const handleWatchedPush = useCallback((objectPath: string, propertyName: string, value: unknown) => {
    setProperty(objectPath, propertyName, value);
    addLog('outbound', 'info', 'SET', `${propertyName} = ${truncate(JSON.stringify(value), 40)}`, objectPath);
  }, [setProperty, addLog]);

  // ── PIE control ──
  const handlePIE = useCallback((action: 'play' | 'pause' | 'stop') => {
    // PIE control uses set.property on the editor subsystem
    setProperty('/Script/UnrealEd.Default__UnrealEditorSubsystem', 'PIECommand', action);
    addLog('outbound', 'info', 'PIE', `PIE ${action}`, 'EditorSubsystem');
  }, [setProperty, addLog]);

  // ── Viewport teleport ──
  const [viewTarget, setViewTarget] = useState<ViewportTarget>({
    x: '0', y: '0', z: '200', pitch: '-20', yaw: '0', roll: '0', fov: '90',
  });

  const handleViewportPush = useCallback(() => {
    const loc = { x: parseFloat(viewTarget.x) || 0, y: parseFloat(viewTarget.y) || 0, z: parseFloat(viewTarget.z) || 0 };
    const rot = { pitch: parseFloat(viewTarget.pitch) || 0, yaw: parseFloat(viewTarget.yaw) || 0, roll: parseFloat(viewTarget.roll) || 0 };
    const fov = parseFloat(viewTarget.fov) || 90;

    setProperty('/Editor/ViewportClient', 'CameraLocation', loc);
    setProperty('/Editor/ViewportClient', 'CameraRotation', rot);
    setProperty('/Editor/ViewportClient', 'FOV', fov);

    addLog('outbound', 'info', 'CAM', `Teleport → (${loc.x}, ${loc.y}, ${loc.z})`, `P:${rot.pitch} Y:${rot.yaw} R:${rot.roll} FOV:${fov}`);
  }, [viewTarget, setProperty, addLog]);

  const handleCopyFromSnapshot = useCallback(() => {
    if (!snapshot?.viewport) return;
    const v = snapshot.viewport;
    setViewTarget({
      x: String(Math.round(v.cameraLocation.x)),
      y: String(Math.round(v.cameraLocation.y)),
      z: String(Math.round(v.cameraLocation.z)),
      pitch: String(Math.round(v.cameraRotation.pitch * 10) / 10),
      yaw: String(Math.round(v.cameraRotation.yaw * 10) / 10),
      roll: String(Math.round(v.cameraRotation.roll * 10) / 10),
      fov: String(Math.round(v.fov * 10) / 10),
    });
    addLog('inbound', 'info', 'CAM', 'Copied viewport from snapshot');
  }, [snapshot, addLog]);

  // ── Conflict detection ──
  const conflicts = useMemo(() => {
    const found: Array<{ watchId: string; propertyName: string; inbound: unknown; outbound: string }> = [];
    for (const [watchId, update] of watchEntries) {
      // Track if we recently wrote to this same property
      const recentWrite = syncLog
        .filter((e) => e.direction === 'outbound' && e.category === 'SET' && e.message.startsWith(update.propertyName))
        .at(-1);
      if (recentWrite && update.previousValue !== undefined && update.previousValue !== update.value) {
        found.push({
          watchId,
          propertyName: update.propertyName,
          inbound: update.value,
          outbound: recentWrite.message,
        });
      }
    }
    return found;
  }, [watchEntries, syncLog]);

  // ── Stats ──
  const outboundCount = useMemo(() => syncLog.filter((e) => e.direction === 'outbound').length, [syncLog]);
  const inboundCount = useMemo(() => syncLog.filter((e) => e.direction === 'inbound').length, [syncLog]);

  const filteredLog = useMemo(() => {
    if (logFilter === 'all') return syncLog;
    return syncLog.filter((e) => e.direction === logFilter);
  }, [syncLog, logFilter]);

  // Track inbound WS events via singleton subscription (callback-based, avoids setState-in-effect)
  useEffect(() => {
    let prevTs: number | null = null;
    let prevWatchCount = 0;

    const unsub = ue5LiveState.onStateChange((state) => {
      // Track snapshot changes
      if (state.snapshot && prevTs !== null && state.snapshot.timestamp !== prevTs) {
        setSyncLog((prev) => {
          const entry: SyncLogEntry = {
            id: nextLogId(), ts: Date.now(), direction: 'inbound', level: 'info',
            category: 'SNAP', message: `Editor: ${state.snapshot!.editorState}`,
            detail: `Level: ${state.snapshot!.openLevel}`,
          };
          const next = [...prev, entry];
          return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
        });
      }
      if (state.snapshot) prevTs = state.snapshot.timestamp;

      // Track new property watches
      const watchCount = state.propertyWatches.size;
      if (watchCount > prevWatchCount) {
        const entries = [...state.propertyWatches.entries()];
        const latest = entries.at(-1);
        if (latest) {
          setSyncLog((prev) => {
            const entry: SyncLogEntry = {
              id: nextLogId(), ts: Date.now(), direction: 'inbound', level: 'info',
              category: 'PROP',
              message: `${latest[1].propertyName} = ${truncate(JSON.stringify(latest[1].value), 30)}`,
              detail: latest[1].objectPath,
            };
            const next = [...prev, entry];
            return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
          });
        }
      }
      prevWatchCount = watchCount;
    });

    return unsub;
  }, []);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="bidirectional-state-sync-panel">
      {/* ── Header ───────────────────────────────────────────────── */}
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

      {/* ── Offline state ─────────────────────────────────────────── */}
      {!isLive && (
        <div className="flex flex-col items-center justify-center py-8 text-text-muted">
          <ArrowLeftRight className="w-8 h-8 opacity-30 mb-3" />
          <p className="text-xs font-medium mb-1">Not connected to UE5</p>
          <p className="text-2xs opacity-60">
            Connect the WebSocket to push state changes bidirectionally
          </p>
          {autoSync && (
            <p className="text-2xs mt-2" style={{ color: ACCENT_EMERALD }}>
              Auto-sync is enabled — will connect when HTTP bridge connects
            </p>
          )}
        </div>
      )}

      {/* ── Live sections ─────────────────────────────────────────── */}
      {isLive && (
        <div className="divide-y divide-border/20">

          {/* ── PIE Control ───────────────────────────────────────── */}
          <div>
            <button
              onClick={() => setShowPieControl(!showPieControl)}
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
                        <span>Session: <span className="text-text">{snapshot.pieState.sessionId.slice(0, 8)}</span></span>
                        <span>Players: <span className="text-text">{snapshot.pieState.playerCount}</span></span>
                        <span>Editor: <span className="text-text">{snapshot.editorState}</span></span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Property Write-Back ───────────────────────────────── */}
          <div>
            <button
              onClick={() => setShowPropertyWrite(!showPropertyWrite)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showPropertyWrite ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <Send className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_ORANGE }}>
                Property Write-Back
              </span>
              <span className="text-2xs text-text-muted ml-1">{watchEntries.length} watched</span>
            </button>
            <AnimatePresence>
              {showPropertyWrite && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 space-y-2">
                    {/* Watched properties with edit buttons */}
                    {watchEntries.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {watchEntries.map(([watchId, update]) => (
                          <PropertyEditorRow
                            key={watchId}
                            objectPath={update.objectPath}
                            propertyName={update.propertyName}
                            currentValue={update.value}
                            onPush={handleWatchedPush}
                          />
                        ))}
                      </div>
                    )}

                    {/* Direct property write form */}
                    <div className="pt-2 border-t border-border/20">
                      <div className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Direct Property Write</div>
                      <div className="flex items-end gap-1.5">
                        <div className="flex-1">
                          <label className="text-2xs text-text-muted">Object Path</label>
                          <input
                            type="text"
                            value={propEdit.objectPath}
                            onChange={(e) => setPropEdit((p) => ({ ...p, objectPath: e.target.value }))}
                            placeholder="/Game/BP_Player.BP_Player_C"
                            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div className="w-28">
                          <label className="text-2xs text-text-muted">Property</label>
                          <input
                            type="text"
                            value={propEdit.propertyName}
                            onChange={(e) => setPropEdit((p) => ({ ...p, propertyName: e.target.value }))}
                            placeholder="MaxHealth"
                            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div className="w-28">
                          <label className="text-2xs text-text-muted">Value</label>
                          <input
                            type="text"
                            value={propEdit.value}
                            onChange={(e) => setPropEdit((p) => ({ ...p, value: e.target.value }))}
                            placeholder="100"
                            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <button
                          onClick={handleDirectPropertyPush}
                          disabled={!propEdit.objectPath.trim() || !propEdit.propertyName.trim()}
                          className="px-2.5 py-1 rounded text-xs font-bold border transition-colors disabled:opacity-40"
                          style={{ borderColor: `${ACCENT_ORANGE}40`, color: ACCENT_ORANGE }}
                          title="Push to UE5"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Viewport Teleport ─────────────────────────────────── */}
          <div>
            <button
              onClick={() => setShowViewportTeleport(!showViewportTeleport)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showViewportTeleport ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <Camera className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
                Viewport Teleport
              </span>
            </button>
            <AnimatePresence>
              {showViewportTeleport && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <div key={axis}>
                          <label className="text-2xs font-bold text-text-muted uppercase">{axis}</label>
                          <input
                            type="number"
                            value={viewTarget[axis]}
                            onChange={(e) => setViewTarget((v) => ({ ...v, [axis]: e.target.value }))}
                            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['pitch', 'yaw', 'roll'] as const).map((r) => (
                        <div key={r}>
                          <label className="text-2xs font-bold text-text-muted uppercase">{r}</label>
                          <input
                            type="number"
                            value={viewTarget[r]}
                            onChange={(e) => setViewTarget((v) => ({ ...v, [r]: e.target.value }))}
                            className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-2xs font-bold text-text-muted uppercase">FOV</label>
                        <input
                          type="number"
                          value={viewTarget.fov}
                          onChange={(e) => setViewTarget((v) => ({ ...v, fov: e.target.value }))}
                          className="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleViewportPush}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors"
                        style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}${OPACITY_8}`, color: ACCENT_CYAN }}
                      >
                        <MapPin className="w-3 h-3" /> Teleport Camera
                      </button>
                      <button
                        onClick={handleCopyFromSnapshot}
                        disabled={!snapshot?.viewport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-border/30 text-text-muted hover:text-text transition-colors disabled:opacity-40"
                      >
                        <Copy className="w-3 h-3" /> Copy Current
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Conflict Detection ────────────────────────────────── */}
          {conflicts.length > 0 && (
            <div>
              <button
                onClick={() => setShowConflicts(!showConflicts)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
              >
                {showConflicts ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
                  Sync Conflicts
                </span>
                <span
                  className="text-2xs font-mono px-1.5 py-0.5 rounded"
                  style={{ color: STATUS_ERROR, backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
                >
                  {conflicts.length}
                </span>
              </button>
              <AnimatePresence>
                {showConflicts && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1">
                      {conflicts.map((c) => (
                        <div
                          key={c.watchId}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs"
                          style={{ borderColor: `${STATUS_ERROR}30`, backgroundColor: `${STATUS_ERROR}${OPACITY_8}` }}
                        >
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                          <span className="font-mono font-bold text-text">{c.propertyName}</span>
                          <span className="text-text-muted">—</span>
                          <span className="font-mono text-2xs">
                            UE5: <span style={{ color: ACCENT_CYAN }}>{truncate(JSON.stringify(c.inbound), 20)}</span>
                          </span>
                          <span className="text-text-muted">vs</span>
                          <span className="font-mono text-2xs">
                            Sent: <span style={{ color: ACCENT_ORANGE }}>{truncate(c.outbound, 20)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Sync Log ──────────────────────────────────────────── */}
          <div>
            <button
              onClick={() => setShowLog(!showLog)}
              className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors"
            >
              {showLog ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
              <Clock className="w-3.5 h-3.5" style={{ color: ACCENT }} />
              <span className="text-2xs font-bold text-text-muted uppercase tracking-wider" style={{ color: ACCENT }}>
                Sync Log
              </span>
              <span className="text-2xs text-text-muted">{syncLog.length} entries</span>
              {syncLog.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSyncLog([]);
                  }}
                  className="ml-auto p-0.5 rounded text-text-muted hover:text-text transition-colors"
                  title="Clear log"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </button>
            <AnimatePresence>
              {showLog && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 mb-2">
                      <Filter className="w-3 h-3 text-text-muted" />
                      {(['all', 'outbound', 'inbound'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setLogFilter(f)}
                          className="px-2 py-0.5 rounded text-2xs font-bold transition-colors"
                          style={{
                            color: logFilter === f ? (f === 'outbound' ? ACCENT_ORANGE : f === 'inbound' ? ACCENT_CYAN : ACCENT) : STATUS_NEUTRAL,
                            backgroundColor: logFilter === f ? `${f === 'outbound' ? ACCENT_ORANGE : f === 'inbound' ? ACCENT_CYAN : ACCENT}${OPACITY_15}` : 'transparent',
                          }}
                        >
                          {f === 'all' ? 'All' : f === 'outbound' ? 'Sent' : 'Received'}
                        </button>
                      ))}
                    </div>

                    {/* Log entries */}
                    <div
                      className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5 rounded-lg p-1.5"
                      style={{ backgroundColor: `var(--surface-deep, ${ACCENT}${OPACITY_8})` }}
                    >
                      {filteredLog.length === 0 && (
                        <p className="text-2xs text-text-muted text-center py-4">No sync events yet</p>
                      )}
                      {filteredLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-1.5 px-1.5 py-1 rounded text-2xs font-mono hover:bg-white/3 transition-colors"
                        >
                          <span className="text-text-muted/60 w-20 flex-shrink-0">{fmtTime(entry.ts)}</span>
                          <DirectionBadge direction={entry.direction} />
                          <LevelIndicator level={entry.level} />
                          <span
                            className="font-bold w-10 flex-shrink-0"
                            style={{ color: entry.direction === 'outbound' ? ACCENT_ORANGE : ACCENT_CYAN }}
                          >
                            {entry.category}
                          </span>
                          <span className="text-text truncate">{entry.message}</span>
                          {entry.detail && (
                            <span className="text-text-muted/60 truncate ml-auto">{truncate(entry.detail, 30)}</span>
                          )}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
