'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type {
  EditorAttribute, EditorEffect, AttrRelationship, QueuedEffect, SimSnapshot,
} from './types';
import { runSimulation } from './simulation';

export function useSimulationSandbox({ attributes, effects, relationships }: {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  relationships: AttrRelationship[];
}) {
  // Effect queue
  const [queue, setQueue] = useState<QueuedEffect[]>(() => {
    // Pre-populate with a sample scenario
    const dmg = effects.find(e => e.name.includes('Damage'));
    const heal = effects.find(e => e.name.includes('Heal'));
    const regen = effects.find(e => e.name.includes('Regen'));
    const init: QueuedEffect[] = [];
    if (regen) init.push({ id: 'q-0', effectId: regen.id, triggerTime: 0 });
    if (dmg) init.push({ id: 'q-1', effectId: dmg.id, triggerTime: 2 });
    if (dmg) init.push({ id: 'q-2', effectId: dmg.id, triggerTime: 5 });
    if (heal) init.push({ id: 'q-3', effectId: heal.id, triggerTime: 7 });
    return init;
  });

  // Attribute overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  // Simulation state
  const [simDuration, setSimDuration] = useState(15);
  const [snapshots, setSnapshots] = useState<SimSnapshot[]>([]);
  const [playbackIdx, setPlaybackIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedAttrs, setExpandedAttrs] = useState(true);

  // Tracked attributes for sparklines (user can toggle)
  const trackableAttrs = useMemo(() =>
    attributes.filter(a => a.category === 'vital' || a.category === 'combat' || a.category === 'primary'),
    [attributes],
  );
  const [trackedAttrNames, setTrackedAttrNames] = useState<Set<string>>(() =>
    new Set(attributes.filter(a => a.category === 'vital').map(a => a.name)),
  );

  // Run simulation
  const runSim = useCallback(() => {
    const result = runSimulation(attributes, effects, relationships, queue, overrides, simDuration);
    setSnapshots(result);
    setPlaybackIdx(null);
    setIsPlaying(false);
    if (playRef.current) clearInterval(playRef.current);
  }, [attributes, effects, relationships, queue, overrides, simDuration]);

  // Auto-run on first mount
  useEffect(() => { runSim(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback — suspendable: a hidden sandbox must not run the timeline out from
  // under the user at 12.5 fps. On resume it continues from `playbackIdx`.
  useSuspendableEffect(() => {
    if (isPlaying && snapshots.length > 0) {
      const startIdx = playbackIdx ?? 0;
      let idx = startIdx;
      playRef.current = setInterval(() => {
        idx++;
        if (idx >= snapshots.length) {
          setIsPlaying(false);
          setPlaybackIdx(snapshots.length - 1);
          if (playRef.current) clearInterval(playRef.current);
          return;
        }
        setPlaybackIdx(idx);
      }, 80);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [isPlaying, snapshots.length]);

  // Add effect to queue
  const addQueueItem = useCallback(() => {
    if (effects.length === 0) return;
    setQueue(q => [...q, {
      id: `q-${Date.now()}`,
      effectId: effects[0].id,
      triggerTime: 0,
    }]);
  }, [effects]);

  const removeQueueItem = useCallback((id: string) => {
    setQueue(q => q.filter(item => item.id !== id));
  }, []);

  const updateQueueItem = useCallback((id: string, updates: Partial<QueuedEffect>) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  // Current snapshot
  const currentSnap = playbackIdx != null ? snapshots[playbackIdx] : snapshots[snapshots.length - 1];
  const currentTime = currentSnap?.time ?? 0;

  // Event log (last N events up to playback position)
  const eventLog = useMemo(() => {
    const maxIdx = playbackIdx ?? snapshots.length - 1;
    const entries: { time: number; event: string }[] = [];
    for (let i = 0; i <= maxIdx && i < snapshots.length; i++) {
      for (const ev of snapshots[i].events) {
        entries.push({ time: snapshots[i].time, event: ev });
      }
    }
    return entries.slice(-20);
  }, [snapshots, playbackIdx]);

  // Sparkline data extraction
  const sparklineData = useMemo(() => {
    const maxIdx = playbackIdx ?? snapshots.length - 1;
    const sliced = snapshots.slice(0, maxIdx + 1);
    const result: Record<string, number[]> = {};
    for (const name of trackedAttrNames) {
      result[name] = sliced.map(s => s.values[name] ?? 0);
    }
    return result;
  }, [snapshots, playbackIdx, trackedAttrNames]);

  const toggleTrack = useCallback((name: string) => {
    setTrackedAttrNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  return {
    queue,
    overrides, setOverrides,
    simDuration, setSimDuration,
    snapshots,
    playbackIdx, setPlaybackIdx,
    isPlaying, setIsPlaying,
    expandedAttrs, setExpandedAttrs,
    trackableAttrs,
    trackedAttrNames,
    runSim,
    addQueueItem,
    removeQueueItem,
    updateQueueItem,
    currentSnap,
    currentTime,
    eventLog,
    sparklineData,
    toggleTrack,
  };
}
