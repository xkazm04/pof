'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { useCharacterCliStore } from '@/stores/cliOptimizationStore';
import type { DodgeParams, HitMarker, DodgeChainEntry } from '../_shared/dodge-types';
import { DEFAULT_PARAMS } from '../_shared/dodge-types';
import { computePhases } from '../_shared/dodge-math';
import { BlueprintPanel } from '../../unique-tabs/_design';
import type { HapticEffect } from './types';
import { TimelineBar } from './TimelineBar';
import { VelocityCurve } from './VelocityCurve';
import { LiveStats } from './LiveStats';
import { PlaybackControls } from './PlaybackControls';
import { ParameterEditor } from './ParameterEditor';
import { HitMarkerEditor } from './HitMarkerEditor';
import { ChainControls } from './ChainControls';
import { HeaderToolbar, type CliStore } from './HeaderToolbar';
import { PhaseLegend, FrameDataPanel } from './PhaseLegend';
import { useHapticDetection, usePlayheadStats } from './useDodgeTimelineState';

export type { DodgeParams } from '../_shared/dodge-types';

/* ── Main Component ──────────────────────────────────────────────────────── */

export function DodgeTimelineEditor({ initialParams }: { initialParams?: Partial<DodgeParams> }) {
  const [params, setParams] = useState<DodgeParams>({ ...DEFAULT_PARAMS, ...initialParams });
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([
    { id: '1', time: 0.1, label: 'Sword Swing', damage: 40 },
    { id: '2', time: 0.35, label: 'Follow-up', damage: 25 },
  ]);
  const [showHitEditor, setShowHitEditor] = useState(false);
  const [showFrameData, setShowFrameData] = useState(true);
  const [chainMode, setChainMode] = useState(false);
  const [chain, setChain] = useState<DodgeChainEntry[]>([]);
  const [chainPlayhead, setChainPlayhead] = useState(0);
  const animRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  /* Haptic state */
  const [hapticEffect, setHapticEffect] = useState<HapticEffect>(null);
  const prevPlayheadRef = useRef<number>(0);
  const triggeredHitsRef = useRef<Set<string>>(new Set());
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cliStore = useCharacterCliStore() as CliStore;

  useEffect(() => {
    const pending = cliStore.pendingResult;
    if (pending) { /* Applied via the sidebar "Apply" button */ }
  }, [cliStore.pendingResult]);

  /* Haptic detection */
  useHapticDetection(playhead, hitMarkers, params, prevPlayheadRef, triggeredHitsRef, hapticTimerRef, setHapticEffect);

  useEffect(() => {
    if (playhead !== 0) return;
    const raf = requestAnimationFrame(() => {
      triggeredHitsRef.current.clear();
      setHapticEffect(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [playhead]);
  useEffect(() => { triggeredHitsRef.current.clear(); }, [hitMarkers]);
  useEffect(() => () => clearTimeout(hapticTimerRef.current), []);

  const phases = useMemo(() => computePhases(params), [params]);
  const updateParam = useCallback((key: keyof DodgeParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const stats = usePlayheadStats(playhead, params, phases, hitMarkers);

  /* Playback */
  const play = useCallback(() => {
    setIsPlaying(true);
    lastFrameRef.current = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      if (chainMode) {
        setChainPlayhead((prev) => {
          const total = chain.length > 0
            ? chain[chain.length - 1].startTime + computePhases(chain[chain.length - 1].params).totalTimeline : 0;
          const next = prev + dt;
          if (next >= total) { setIsPlaying(false); return total; }
          return next;
        });
      } else {
        setPlayhead((prev) => {
          const next = prev + dt;
          if (next >= phases.totalTimeline) { setIsPlaying(false); return phases.totalTimeline; }
          return next;
        });
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
  }, [phases, chainMode, chain]);

  const pause = useCallback(() => { setIsPlaying(false); cancelAnimationFrame(animRef.current); }, []);
  const reset = useCallback(() => { pause(); setPlayhead(0); setChainPlayhead(0); }, [pause]);
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  /* Chain management */
  const addDodgeToChain = useCallback(() => {
    setChain((prev) => {
      const lastEnd = prev.length > 0
        ? prev[prev.length - 1].startTime + computePhases(prev[prev.length - 1].params).totalTimeline : 0;
      return [...prev, { id: crypto.randomUUID(), startTime: lastEnd, params: { ...params } }];
    });
  }, [params]);

  const removeLastFromChain = useCallback(() => { setChain((prev) => prev.slice(0, -1)); }, []);

  const buildChainFromCount = useCallback((count: number) => {
    const newChain: DodgeChainEntry[] = [];
    for (let i = 0; i < count; i++) {
      const lastEnd = newChain.length > 0
        ? newChain[newChain.length - 1].startTime + computePhases(newChain[newChain.length - 1].params).totalTimeline : 0;
      newChain.push({ id: crypto.randomUUID(), startTime: lastEnd, params: { ...params } });
    }
    setChain(newChain);
  }, [params]);

  /* Hit marker management */
  const addHitMarker = useCallback(() => {
    setHitMarkers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: params.dodgeDuration * 0.5, label: `Hit ${prev.length + 1}`, damage: 30 },
    ]);
  }, [params.dodgeDuration]);
  const removeHitMarker = useCallback((id: string) => { setHitMarkers((prev) => prev.filter((h) => h.id !== id)); }, []);
  const updateHitMarker = useCallback((id: string, field: keyof HitMarker, value: string | number) => {
    setHitMarkers((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  }, []);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header + Controls */}
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <HeaderToolbar
          cliStore={cliStore} params={params}
          showFrameData={showFrameData} setShowFrameData={setShowFrameData}
          showParams={showParams} setShowParams={setShowParams}
          showHitEditor={showHitEditor} setShowHitEditor={setShowHitEditor}
        />
        <PhaseLegend phases={phases} hitMarkers={hitMarkers} stats={stats} />
        <TimelineBar phases={phases} playhead={playhead} hitMarkers={hitMarkers} totalTime={phases.totalTimeline} onScrub={setPlayhead} hapticEffect={hapticEffect} />
        <div className="mt-2"><VelocityCurve params={params} phases={phases} playhead={playhead} /></div>
        <LiveStats stats={stats} params={params} phases={phases} playhead={playhead} />
        <PlaybackControls isPlaying={isPlaying} playhead={playhead} staminaCost={params.staminaCost} onPlay={play} onPause={pause} onReset={reset} />
      </BlueprintPanel>

      {/* Collapsible panels */}
      <AnimatePresence>{showFrameData && <FrameDataPanel params={params} />}</AnimatePresence>
      <AnimatePresence>{showParams && <ParameterEditor params={params} onUpdate={updateParam} onReset={() => setParams({ ...DEFAULT_PARAMS })} />}</AnimatePresence>
      <AnimatePresence>{showHitEditor && <HitMarkerEditor hitMarkers={hitMarkers} phases={phases} stats={stats} onAdd={addHitMarker} onRemove={removeHitMarker} onUpdate={updateHitMarker} />}</AnimatePresence>

      {/* Dodge Chain */}
      <ChainControls
        chainMode={chainMode} chain={chain} chainPlayhead={chainPlayhead}
        onSetChainMode={setChainMode} onBuildChain={buildChainFromCount}
        onAddDodge={addDodgeToChain} onRemoveLast={removeLastFromChain}
        onScrub={setChainPlayhead}
      />
    </motion.div>
  );
}
