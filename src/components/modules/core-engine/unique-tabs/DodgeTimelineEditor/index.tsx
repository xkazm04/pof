'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Crosshair, Settings2, Table2, AlertTriangle,
} from 'lucide-react';
import {
  ACCENT_ORANGE, ACCENT_CYAN,
  ACCENT_EMERALD, STATUS_ERROR,
  STATUS_WARNING, STATUS_NEUTRAL,
  OVERLAY_WHITE,
  withOpacity, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';
import { useCharacterCliStore, type CLILogEntry } from '@/stores/cliOptimizationStore';
import type { DodgeParams, DodgePhases, HitMarker, DodgeChainEntry } from '../dodge-types';
import { DEFAULT_PARAMS } from '../dodge-types';
import { computePhases, speedCurve, distanceCurve } from '../dodge-math';
import { BlueprintPanel, SectionHeader } from '../_design';
import type { HapticEffect, PlayheadStats } from './types';
import { TimelineBar } from './TimelineBar';
import { VelocityCurve } from './VelocityCurve';
import { LiveStats } from './LiveStats';
import { PlaybackControls } from './PlaybackControls';
import { FrameDataTable } from './FrameDataTable';
import { ParameterEditor } from './ParameterEditor';
import { HitMarkerEditor } from './HitMarkerEditor';
import { ChainControls } from './ChainControls';

export type { DodgeParams } from '../dodge-types';

type CliStore = {
  log: CLILogEntry[]; isOptimizing: boolean; sidebarOpen: boolean;
  pendingResult: DodgeParams | null;
  addLogEntry: (entry: Omit<CLILogEntry, 'id' | 'timestamp'>) => void;
  startOptimization: () => void; finishOptimization: (result?: DodgeParams) => void;
  toggleSidebar: () => void; applyPendingResult: () => DodgeParams | null;
};

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

/* ── Header Toolbar (inline) ─────────────────────────────────────────────── */

function HeaderToolbar({ cliStore, params, showFrameData, setShowFrameData, showParams, setShowParams, showHitEditor, setShowHitEditor }: {
  cliStore: CliStore;
  params: DodgeParams;
  showFrameData: boolean; setShowFrameData: (v: boolean) => void;
  showParams: boolean; setShowParams: (v: boolean) => void;
  showHitEditor: boolean; setShowHitEditor: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <SectionHeader icon={Crosshair} label="Interactive Dodge Timeline" color={ACCENT_CYAN} />
      <div className="ml-auto flex items-center gap-1">
        <OptimizeButton cliStore={cliStore} params={params} />
        <ToggleBtn active={showFrameData} onToggle={() => setShowFrameData(!showFrameData)} color={STATUS_WARNING} icon={Table2} title="Toggle frame data table" />
        <ToggleBtn active={showParams} onToggle={() => setShowParams(!showParams)} color={ACCENT_CYAN} icon={Settings2} title="Toggle parameter editor" />
        <ToggleBtn active={showHitEditor} onToggle={() => setShowHitEditor(!showHitEditor)} color={STATUS_ERROR} icon={AlertTriangle} title="Toggle hit marker editor" />
      </div>
    </div>
  );
}

function ToggleBtn({ active, onToggle, color, icon: Icon, title }: {
  active: boolean; onToggle: () => void; color: string;
  icon: React.ComponentType<{ className?: string }>; title: string;
}) {
  return (
    <button onClick={onToggle} className="p-1.5 rounded-lg border transition-colors" title={title}
      style={{ borderColor: active ? `${withOpacity(color, OPACITY_25)}` : withOpacity(OVERLAY_WHITE, OPACITY_8), backgroundColor: active ? `${withOpacity(color, OPACITY_8)}` : 'transparent', color: active ? color : 'var(--text-muted)' }}>
      <Icon className="w-3 h-3" />
    </button>
  );
}

function OptimizeButton({ cliStore, params }: { cliStore: CliStore; params: DodgeParams }) {
  return (
    <button
      onClick={() => {
        cliStore.startOptimization();
        cliStore.addLogEntry({ type: 'info', message: 'Starting dodge parameter optimization...', detail: `Current params: distance=${params.dodgeDistance}, duration=${params.dodgeDuration}, iFrameStart=${params.iFrameStart}` });
        setTimeout(() => { cliStore.addLogEntry({ type: 'change', message: 'Analyzing i-frame window coverage...' }); }, 800);
        setTimeout(() => {
          cliStore.addLogEntry({ type: 'result', message: 'Optimization complete -- suggested adjustments ready', detail: 'Increased i-frame window by 15%, reduced cooldown by 10%' });
          cliStore.finishOptimization({ ...params, iFrameDuration: Math.min(params.iFrameDuration * 1.15, params.dodgeDuration * 0.8), cooldown: params.cooldown * 0.9 });
        }, 2000);
      }}
      disabled={cliStore.isOptimizing}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ borderColor: `${withOpacity(ACCENT_EMERALD, OPACITY_25)}`, backgroundColor: `${withOpacity(ACCENT_EMERALD, OPACITY_8)}`, color: ACCENT_EMERALD }}
    >
      {cliStore.isOptimizing ? 'Optimizing...' : 'Simulate & Optimize'}
    </button>
  );
}

/* ── Phase Legend ─────────────────────────────────────────────────────────── */

function PhaseLegend({ phases, hitMarkers, stats }: { phases: DodgePhases; hitMarkers: HitMarker[]; stats: PlayheadStats }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {[phases.movement, phases.invuln, phases.cancel, phases.recovery].map((phase) => (
        <span key={phase.label} className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: phase.color }}>
          <span className="w-3 h-1 rounded-full" style={{ backgroundColor: phase.color }} />
          {phase.label}
        </span>
      ))}
      {hitMarkers.length > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: STATUS_ERROR }}>
          <span className="w-2 h-2 rounded-full border" style={{ borderColor: STATUS_ERROR }} />
          Hits ({stats.dodgedHits}/{stats.totalHits} dodged)
        </span>
      )}
    </div>
  );
}

/* ── Frame Data Panel Wrapper ────────────────────────────────────────────── */

function FrameDataPanel({ params }: { params: DodgeParams }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <BlueprintPanel color={STATUS_WARNING} className="p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <SectionHeader icon={Table2} label="Frame Data" color={STATUS_WARNING} />
          <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] text-text-muted/50">@60 FPS &middot; Dustloop-style</span>
        </div>
        <FrameDataTable params={params} />
      </BlueprintPanel>
    </motion.div>
  );
}

/* ── Custom hooks (inlined to keep under limit) ──────────────────────────── */

function useHapticDetection(
  playhead: number, hitMarkers: HitMarker[], params: DodgeParams,
  prevRef: React.MutableRefObject<number>,
  triggeredRef: React.MutableRefObject<Set<string>>,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
  setEffect: (e: HapticEffect) => void,
) {
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = playhead;
    if (playhead <= prev) return;
    for (const hit of hitMarkers) {
      if (hit.time > prev && hit.time <= playhead && !triggeredRef.current.has(hit.id)) {
        triggeredRef.current.add(hit.id);
        const dodged = hit.time >= params.iFrameStart && hit.time < params.iFrameStart + params.iFrameDuration;
        clearTimeout(timerRef.current);
        setEffect({ type: dodged ? 'dodge' : 'hit', id: hit.id });
        timerRef.current = setTimeout(() => setEffect(null), dodged ? 500 : 400);
      }
    }
  }, [playhead, hitMarkers, params.iFrameStart, params.iFrameDuration, prevRef, triggeredRef, timerRef, setEffect]);
}

function usePlayheadStats(playhead: number, params: DodgeParams, phases: DodgePhases, hitMarkers: HitMarker[]): PlayheadStats {
  return useMemo(() => {
    const t = playhead;
    const alpha = params.dodgeDuration > 0 ? Math.min(t / params.dodgeDuration, 1) : 0;
    const maxSpeed = params.dodgeDistance / params.dodgeDuration;
    const speed = t <= params.dodgeDuration ? speedCurve(alpha) * maxSpeed : 0;
    const dist = t <= params.dodgeDuration ? distanceCurve(alpha) * params.dodgeDistance : params.dodgeDistance;
    return {
      speed, dist,
      inMovement: t >= phases.movement.start && t < phases.movement.end,
      inInvuln: t >= phases.invuln.start && t < phases.invuln.end,
      inCancel: t >= phases.cancel.start && t < phases.cancel.end,
      inCooldown: t >= phases.recovery.start,
      dodgedHits: hitMarkers.filter((h) => h.time >= phases.invuln.start && h.time < phases.invuln.end).length,
      totalHits: hitMarkers.length,
    };
  }, [playhead, params, phases, hitMarkers]);
}
