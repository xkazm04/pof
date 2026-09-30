'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { appendLog, deriveConflicts, sameLedger, type Ledger } from '@/lib/ue5-bridge/sync-ledger';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { MAX_LOG_ENTRIES } from './constants';
import { nextLogId, truncate } from './helpers';
import type { WriteReceipt } from '@/types/ue5-bridge';
import type { SyncDirection, LogLevel, SyncLogEntry, PropertyEdit, ViewportTarget } from './types';

export function useBidirectionalStateSyncPanel() {
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

  const addLog = useCallback((direction: SyncDirection, level: LogLevel, category: string, message: string, detail?: string, dropped?: boolean) => {
    const entry: SyncLogEntry = { id: nextLogId(), ts: Date.now(), direction, level, category, message, detail };
    if (dropped) entry.dropped = true;
    setSyncLog((prev) => appendLog(prev, entry, MAX_LOG_ENTRIES));
  }, []);

  /** Log an outbound action as it actually went: a dropped frame is a warning, not a send. */
  const logWrite = useCallback((receipts: WriteReceipt[], category: string, message: string, detail: string) => {
    const dropped = receipts.some((r) => !r.sent);
    if (dropped) addLog('outbound', 'warn', category, message, `${detail} - dropped (socket not open)`, true);
    else addLog('outbound', 'info', category, message, detail);
  }, [addLog]);

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
    const receipt = setProperty(propEdit.objectPath.trim(), propEdit.propertyName.trim(), parsed);
    logWrite([receipt], 'SET', `${propEdit.propertyName} = ${truncate(propEdit.value, 40)}`, propEdit.objectPath);
    setPropEdit({ objectPath: '', propertyName: '', value: '' });
  }, [propEdit, setProperty, logWrite]);

  // ── Watched property push-back ──
  const watchEntries = useMemo(() => Object.entries(propertyWatches), [propertyWatches]);

  const handleWatchedPush = useCallback((objectPath: string, propertyName: string, value: unknown) => {
    const receipt = setProperty(objectPath, propertyName, value);
    logWrite([receipt], 'SET', `${propertyName} = ${truncate(JSON.stringify(value), 40)}`, objectPath);
  }, [setProperty, logWrite]);

  // ── PIE control ──
  const handlePIE = useCallback((action: 'play' | 'pause' | 'stop') => {
    // PIE control uses set.property on the editor subsystem
    const receipt = setProperty('/Script/UnrealEd.Default__UnrealEditorSubsystem', 'PIECommand', action);
    logWrite([receipt], 'PIE', `PIE ${action}`, 'EditorSubsystem');
  }, [setProperty, logWrite]);

  // ── Viewport teleport ──
  const [viewTarget, setViewTarget] = useState<ViewportTarget>({
    x: '0', y: '0', z: '200', pitch: '-20', yaw: '0', roll: '0', fov: '90',
  });

  const handleViewportPush = useCallback(() => {
    const loc = { x: parseFloat(viewTarget.x) || 0, y: parseFloat(viewTarget.y) || 0, z: parseFloat(viewTarget.z) || 0 };
    const rot = { pitch: parseFloat(viewTarget.pitch) || 0, yaw: parseFloat(viewTarget.yaw) || 0, roll: parseFloat(viewTarget.roll) || 0 };
    const fov = parseFloat(viewTarget.fov) || 90;

    const receipts = [
      setProperty('/Editor/ViewportClient', 'CameraLocation', loc),
      setProperty('/Editor/ViewportClient', 'CameraRotation', rot),
      setProperty('/Editor/ViewportClient', 'FOV', fov),
    ];
    logWrite(receipts, 'CAM', `Teleport → (${loc.x}, ${loc.y}, ${loc.z})`, `P:${rot.pitch} Y:${rot.yaw} R:${rot.roll} FOV:${fov}`);
  }, [viewTarget, setProperty, logWrite]);

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

  // ── Conflict detection: the WS client's write ledger, three-way compare on the exact key ──
  const [writes, setWrites] = useState<Ledger>(() => ue5LiveState.getState().writes);
  const conflicts = useMemo(() => deriveConflicts(writes), [writes]);

  // ── Stats (a dropped write never went out, so it is not counted as sent) ──
  const outboundCount = useMemo(() => syncLog.filter((e) => e.direction === 'outbound' && !e.dropped).length, [syncLog]);
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
      // Mirror the write ledger (skip the re-render when only the clone changed)
      setWrites((prev) => (sameLedger(prev, state.writes) ? prev : state.writes));

      // Track snapshot changes
      if (state.snapshot && prevTs !== null && state.snapshot.timestamp !== prevTs) {
        const entry: SyncLogEntry = {
          id: nextLogId(), ts: Date.now(), direction: 'inbound', level: 'info',
          category: 'SNAP', message: `Editor: ${state.snapshot.editorState}`,
          detail: `Level: ${state.snapshot.openLevel}`,
        };
        setSyncLog((prev) => appendLog(prev, entry, MAX_LOG_ENTRIES));
      }
      if (state.snapshot) prevTs = state.snapshot.timestamp;

      // Track new property watches
      const watchCount = state.propertyWatches.size;
      if (watchCount > prevWatchCount) {
        const entries = [...state.propertyWatches.entries()];
        const latest = entries.at(-1);
        if (latest) {
          const entry: SyncLogEntry = {
            id: nextLogId(), ts: Date.now(), direction: 'inbound', level: 'info',
            category: 'PROP',
            message: `${latest[1].propertyName} = ${truncate(JSON.stringify(latest[1].value), 30)}`,
            detail: latest[1].objectPath,
          };
          setSyncLog((prev) => appendLog(prev, entry, MAX_LOG_ENTRIES));
        }
      }
      prevWatchCount = watchCount;
    });

    return unsub;
  }, []);

  return {
    snapshot,
    frameRate,
    isLive,
    connectWs,
    disconnectWs,
    requestSnapshot,
    autoSync,
    syncLog,
    setSyncLog,
    showLog,
    setShowLog,
    logFilter,
    setLogFilter,
    logEndRef,
    showPropertyWrite,
    setShowPropertyWrite,
    showPieControl,
    setShowPieControl,
    showViewportTeleport,
    setShowViewportTeleport,
    showConflicts,
    setShowConflicts,
    propEdit,
    setPropEdit,
    handleDirectPropertyPush,
    watchEntries,
    handleWatchedPush,
    handlePIE,
    viewTarget,
    setViewTarget,
    handleViewportPush,
    handleCopyFromSnapshot,
    conflicts,
    outboundCount,
    inboundCount,
    filteredLog,
  };
}
