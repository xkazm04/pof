'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { appendLog, deriveConflicts, sameLedger, type Ledger } from '@/lib/ue5-bridge/sync-ledger';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { MAX_LOG_ENTRIES } from './constants';
import { nextLogId, truncate } from './helpers';
import { diffSyncState, tallyEvents, EMPTY_TOTALS, type SyncView, type SyncTotals } from './syncEvents';
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
  const [totals, setTotals] = useState<SyncTotals>(EMPTY_TOTALS);
  const logEndRef = useRef<HTMLDivElement>(null);

  /** Append to the bounded display log and fold into the unbounded totals. */
  const pushEvents = useCallback((entries: SyncLogEntry[]) => {
    if (entries.length === 0) return;
    setSyncLog((prev) => entries.reduce((log, e) => appendLog(log, e, MAX_LOG_ENTRIES), prev));
    setTotals((prev) => tallyEvents(prev, entries));
  }, []);

  const addLog = useCallback((direction: SyncDirection, level: LogLevel, category: string, message: string, detail?: string, dropped?: boolean) => {
    const entry: SyncLogEntry = { id: nextLogId(), ts: Date.now(), direction, level, category, message, detail };
    if (dropped) entry.dropped = true;
    pushEvents([entry]);
  }, [pushEvents]);

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

  // ── Stats: running totals, independent of the capped, clearable log ──
  const outboundCount = totals.outboundTotal;
  const inboundCount = totals.inboundTotal;

  const filteredLog = useMemo(() => {
    if (logFilter === 'all') return syncLog;
    return syncLog.filter((e) => e.direction === logFilter);
  }, [syncLog, logFilter]);

  // Derive inbound/outcome events from each client-state change (callback-based, avoids setState-in-effect)
  useEffect(() => {
    const toView = (st: ReturnType<typeof ue5LiveState.getState>): SyncView => ({
      snapshot: st.snapshot, propertyWatches: st.propertyWatches, writes: st.writes,
    });
    let prev = toView(ue5LiveState.getState());

    const unsub = ue5LiveState.onStateChange((state) => {
      // Mirror the write ledger (skip the re-render when only the clone changed)
      setWrites((p) => (sameLedger(p, state.writes) ? p : state.writes));

      const next = toView(state);
      pushEvents(diffSyncState(prev, next));
      prev = next;
    });

    return unsub;
  }, [pushEvents]);

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
