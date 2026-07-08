'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { MAX_LOG_ENTRIES } from './constants';
import { nextLogId, truncate } from './helpers';
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
