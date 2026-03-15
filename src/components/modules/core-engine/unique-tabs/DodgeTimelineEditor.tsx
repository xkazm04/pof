'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCharacterCliStore } from '@/stores/cliOptimizationStore';
import {
  Play, Pause, RotateCcw, Plus, Trash2, Crosshair,
  Zap, AlertTriangle, Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_ERROR, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from './_shared';

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface DodgeParams {
  dodgeDuration: number;
  dodgeDistance: number;
  iFrameStart: number;
  iFrameDuration: number;
  cancelWindowStart: number;
  cancelWindowEnd: number;
  cooldown: number;
  staminaCost: number;
}

interface DodgePhases {
  movement: Phase;
  invuln: Phase;
  cancel: Phase;
  recovery: Phase;
  totalTimeline: number;
}

interface Phase {
  start: number;
  end: number;
  color: string;
  label: string;
}

interface HitMarker {
  id: string;
  time: number;
  label: string;
  damage: number;
}

interface DodgeChainEntry {
  id: string;
  startTime: number;
  params: DodgeParams;
}

/* ── Defaults ─────────────────────────────────────────────────────────────── */

const DEFAULT_PARAMS: DodgeParams = {
  dodgeDuration: 0.5,
  dodgeDistance: 500,
  iFrameStart: 0.05,
  iFrameDuration: 0.3,
  cancelWindowStart: 0.35,
  cancelWindowEnd: 0.5,
  cooldown: 0.8,
  staminaCost: 25,
};

/* ── Derived phase computation ────────────────────────────────────────────── */

function computePhases(p: DodgeParams): DodgePhases {
  const totalTimeline = p.dodgeDuration + p.cooldown;
  return {
    movement: { start: 0, end: p.dodgeDuration, color: ACCENT_CYAN, label: 'Movement' },
    invuln: { start: p.iFrameStart, end: p.iFrameStart + p.iFrameDuration, color: ACCENT_ORANGE, label: 'I-Frames' },
    cancel: { start: p.cancelWindowStart, end: Math.min(p.cancelWindowEnd, p.dodgeDuration), color: ACCENT_VIOLET, label: 'Cancel' },
    recovery: { start: p.dodgeDuration, end: totalTimeline, color: STATUS_NEUTRAL, label: 'Cooldown' },
    totalTimeline,
  };
}

/** Quadratic ease-out: peak speed at start, decelerating to 0 */
function speedCurve(alpha: number): number {
  return Math.max(0, 1 - alpha * alpha);
}

/** Distance integral of ease-out: alpha - alpha^3/3, normalized */
function distanceCurve(alpha: number): number {
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return (clamped - (clamped * clamped * clamped) / 3) / (1 - 1 / 3);
}

/* ── Field definitions for editable params ────────────────────────────────── */

interface FieldDef {
  key: keyof DodgeParams;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  color: string;
}

const PARAM_FIELDS: FieldDef[] = [
  { key: 'dodgeDuration', label: 'Duration', unit: 's', min: 0.1, max: 2.0, step: 0.05, color: ACCENT_CYAN },
  { key: 'dodgeDistance', label: 'Distance', unit: 'cm', min: 100, max: 2000, step: 25, color: ACCENT_CYAN },
  { key: 'iFrameStart', label: 'I-Frame Start', unit: 's', min: 0, max: 0.5, step: 0.01, color: ACCENT_ORANGE },
  { key: 'iFrameDuration', label: 'I-Frame Dur.', unit: 's', min: 0, max: 1.0, step: 0.01, color: ACCENT_ORANGE },
  { key: 'cancelWindowStart', label: 'Cancel Start', unit: 's', min: 0, max: 1.5, step: 0.01, color: ACCENT_VIOLET },
  { key: 'cancelWindowEnd', label: 'Cancel End', unit: 's', min: 0, max: 2.0, step: 0.01, color: ACCENT_VIOLET },
  { key: 'cooldown', label: 'Cooldown', unit: 's', min: 0, max: 3.0, step: 0.05, color: STATUS_NEUTRAL },
  { key: 'staminaCost', label: 'Stamina Cost', unit: '', min: 0, max: 100, step: 1, color: ACCENT_EMERALD },
];

/* ── Timeline Bar Sub-component ───────────────────────────────────────────── */

function TimelineBar({
  phases,
  playhead,
  hitMarkers,
  totalTime,
  onScrub,
  hapticEffect,
}: {
  phases: DodgePhases;
  playhead: number;
  hitMarkers: HitMarker[];
  totalTime: number;
  onScrub: (t: number) => void;
  hapticEffect?: HapticEffect;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleInteraction = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(pct * totalTime);
  }, [totalTime, onScrub]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleInteraction(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleInteraction]);

  const phaseBars: Phase[] = [phases.movement, phases.invuln, phases.cancel, phases.recovery];

  const isDodgeHaptic = hapticEffect?.type === 'dodge';
  const isHitHaptic = hapticEffect?.type === 'hit';

  return (
    <div className="space-y-1">
      <div
        ref={barRef}
        className="relative h-8 rounded-md overflow-hidden cursor-pointer select-none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: `1px solid ${isDodgeHaptic ? ACCENT_EMERALD : isHitHaptic ? STATUS_ERROR : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isDodgeHaptic
            ? `0 0 12px ${ACCENT_EMERALD}50, inset 0 0 8px ${ACCENT_EMERALD}15`
            : isHitHaptic
              ? `0 0 16px ${STATUS_ERROR}60, inset 0 0 10px ${STATUS_ERROR}20`
              : 'none',
          transform: isHitHaptic ? 'translateX(2px)' : 'none',
          transition: isDodgeHaptic
            ? 'border-color 0.1s ease-out, box-shadow 0.1s ease-out'
            : isHitHaptic
              ? 'border-color 0.05s, box-shadow 0.05s'
              : 'border-color 0.3s ease-out, box-shadow 0.3s ease-out, transform 0.05s',
          animation: isHitHaptic ? 'dodge-hit-shake 0.15s ease-in-out 0s 2' : 'none',
        }}
        onMouseDown={(e) => { dragging.current = true; handleInteraction(e.clientX); }}
      >
        {/* Haptic flash overlay */}
        <AnimatePresence>
          {hapticEffect && (
            <motion.div
              key={hapticEffect.id}
              className="absolute inset-0 z-30 pointer-events-none rounded-md"
              initial={{ opacity: isDodgeHaptic ? 0.35 : 0.5 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: isDodgeHaptic ? 0.45 : 0.3 }}
              style={{
                background: isDodgeHaptic
                  ? `linear-gradient(90deg, transparent, ${ACCENT_EMERALD}30, transparent)`
                  : `linear-gradient(90deg, ${STATUS_ERROR}40, transparent 30%, transparent 70%, ${STATUS_ERROR}40)`,
              }}
            />
          )}
        </AnimatePresence>
        {/* Phase segments */}
        {phaseBars.map((phase) => {
          const left = (phase.start / totalTime) * 100;
          const width = ((phase.end - phase.start) / totalTime) * 100;
          const isInvuln = phase.label === 'I-Frames';
          const isCancel = phase.label === 'Cancel';
          return (
            <div
              key={phase.label}
              className={`absolute top-0 h-full ${isInvuln ? 'phase-iframe-pulse' : isCancel ? 'phase-cancel-spark' : ''}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: isInvuln || isCancel ? 'transparent' : `${phase.color}25`,
                borderBottom: `2px solid ${phase.color}`,
                ...(isCancel ? { borderTop: `2px solid ${phase.color}`, borderBottom: 'none' } : {}),
                ...(isInvuln || isCancel ? {
                  '--phase-color-10': `${phase.color}1a`,
                  '--phase-color-18': `${phase.color}2e`,
                  '--phase-color-20': `${phase.color}33`,
                  '--phase-color-25': `${phase.color}40`,
                  '--phase-color-30': `${phase.color}4d`,
                } as React.CSSProperties : {}),
              }}
            />
          );
        })}

        {/* Phase boundary markers */}
        {[phases.invuln.end, phases.cancel.start, phases.movement.end].map((t, i) => (
          <div
            key={`boundary-${i}`}
            className="absolute top-0 h-full w-px"
            style={{ left: `${(t / totalTime) * 100}%`, backgroundColor: 'rgba(255,255,255,0.15)' }}
          />
        ))}

        {/* Hit markers */}
        {hitMarkers.map((hit) => {
          const left = (hit.time / totalTime) * 100;
          const iFrameActive = hit.time >= phases.invuln.start && hit.time < phases.invuln.end;
          return (
            <div
              key={hit.id}
              className="absolute top-0 h-full flex items-center justify-center z-10"
              style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
              title={`${hit.label}: ${hit.damage} dmg @ ${hit.time.toFixed(2)}s ${iFrameActive ? '(DODGED)' : '(HIT!)'}`}
            >
              <div
                className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                style={{
                  backgroundColor: iFrameActive ? `${ACCENT_EMERALD}30` : `${STATUS_ERROR}40`,
                  borderColor: iFrameActive ? ACCENT_EMERALD : STATUS_ERROR,
                  boxShadow: `0 0 6px ${iFrameActive ? ACCENT_EMERALD : STATUS_ERROR}60`,
                }}
              >
                <span className="text-[6px] font-bold" style={{ color: iFrameActive ? ACCENT_EMERALD : STATUS_ERROR }}>
                  {iFrameActive ? '✓' : '!'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <motion.div
          className="absolute top-0 h-full w-0.5 z-20"
          style={{
            left: `${(playhead / totalTime) * 100}%`,
            backgroundColor: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white rounded-sm" style={{ boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />
        </motion.div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs font-mono text-text-muted px-0.5">
        <span>0s</span>
        <span style={{ color: ACCENT_ORANGE }}>{phases.invuln.end.toFixed(2)}s</span>
        <span style={{ color: ACCENT_VIOLET }}>{phases.cancel.start.toFixed(2)}s</span>
        <span style={{ color: ACCENT_CYAN }}>{phases.movement.end.toFixed(2)}s</span>
        <span>{totalTime.toFixed(2)}s</span>
      </div>
    </div>
  );
}

/* ── Velocity Curve SVG ───────────────────────────────────────────────────── */

function VelocityCurve({ params, phases, playhead }: { params: DodgeParams; phases: DodgePhases; playhead: number }) {
  const maxSpeed = params.dodgeDistance / params.dodgeDuration;
  const curveD = useMemo(() => {
    return Array.from({ length: 51 }, (_, i) => {
      const frac = i / 50;
      const t = frac * phases.totalTimeline;
      const alpha = params.dodgeDuration > 0 ? Math.min(t / params.dodgeDuration, 1) : 0;
      const speed = t <= params.dodgeDuration ? speedCurve(alpha) : 0;
      const x = frac * 200;
      const y = 34 - speed * 30;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [params, phases.totalTimeline]);

  const playFrac = playhead / phases.totalTimeline;
  const playAlpha = params.dodgeDuration > 0 ? Math.min(playhead / params.dodgeDuration, 1) : 0;
  const playSpeed = playhead <= params.dodgeDuration ? speedCurve(playAlpha) * maxSpeed : 0;
  const playX = playFrac * 200;
  const playY = 34 - (playhead <= params.dodgeDuration ? speedCurve(playAlpha) * 30 : 0);

  return (
    <div>
      <svg width="100%" height={40} viewBox="0 0 200 40" preserveAspectRatio="none" className="overflow-visible">
        {/* Baseline */}
        <line x1={0} y1={34} x2={200} y2={34} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        {/* Velocity curve */}
        <path
          d={curveD}
          fill="none" stroke={ACCENT_CYAN} strokeWidth="1.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${ACCENT_CYAN}60)` }}
        />
        {/* Playhead dot */}
        <circle cx={playX} cy={Math.max(4, playY)} r={3} fill="#fff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
      </svg>
      <div className="flex justify-between text-xs font-mono text-text-muted mt-0.5">
        <span style={{ color: ACCENT_CYAN }}>Velocity</span>
        <span className="font-bold" style={{ color: playSpeed > 0 ? ACCENT_CYAN : 'var(--text-muted)' }}>
          {playSpeed.toFixed(0)} UU/s
        </span>
      </div>
    </div>
  );
}

/* ── Multi-Dodge Chain Visualization ──────────────────────────────────────── */

function DodgeChainTimeline({
  chain,
  playhead,
  onScrub,
}: {
  chain: DodgeChainEntry[];
  playhead: number;
  onScrub: (t: number) => void;
}) {
  const totalChainTime = useMemo(() => {
    if (chain.length === 0) return 0;
    const last = chain[chain.length - 1];
    const phases = computePhases(last.params);
    return last.startTime + phases.totalTimeline;
  }, [chain]);

  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleInteraction = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onScrub(pct * totalChainTime);
  }, [totalChainTime, onScrub]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) handleInteraction(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [handleInteraction]);

  if (chain.length === 0) return null;

  // Stamina tracking
  const maxStamina = 100;
  let staminaRemaining = maxStamina;
  const staminaPoints: { t: number; stamina: number }[] = [{ t: 0, stamina: maxStamina }];
  for (const entry of chain) {
    staminaRemaining = Math.max(0, staminaRemaining - entry.params.staminaCost);
    staminaPoints.push({ t: entry.startTime, stamina: staminaRemaining });
    staminaPoints.push({ t: entry.startTime + 0.01, stamina: staminaRemaining });
  }
  staminaPoints.push({ t: totalChainTime, stamina: staminaRemaining });

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
        <Zap className="w-3 h-3" style={{ color: ACCENT_EMERALD }} />
        Dodge Chain ({chain.length}× dodges)
      </div>

      {/* Chain timeline bar */}
      <div
        ref={barRef}
        className="relative h-10 rounded-md overflow-hidden cursor-pointer select-none"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
        onMouseDown={(e) => { dragging.current = true; handleInteraction(e.clientX); }}
      >
        {chain.map((entry, i) => {
          const entryPhases = computePhases(entry.params);
          const leftPct = (entry.startTime / totalChainTime) * 100;
          const widthPct = (entryPhases.totalTimeline / totalChainTime) * 100;
          const mvPct = (entryPhases.movement.end / entryPhases.totalTimeline) * widthPct;
          const invStart = ((entry.startTime + entryPhases.invuln.start) / totalChainTime) * 100;
          const invWidth = ((entryPhases.invuln.end - entryPhases.invuln.start) / totalChainTime) * 100;

          return (
            <div key={entry.id}>
              {/* Movement phase */}
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPct}%`,
                  width: `${mvPct}%`,
                  backgroundColor: `${ACCENT_CYAN}20`,
                  borderBottom: `2px solid ${ACCENT_CYAN}`,
                }}
              />
              {/* I-Frame overlay */}
              <div
                className="absolute top-0 h-full phase-iframe-pulse"
                style={{
                  left: `${invStart}%`,
                  width: `${invWidth}%`,
                  borderBottom: `2px solid ${ACCENT_ORANGE}`,
                  '--phase-color-10': `${ACCENT_ORANGE}1a`,
                  '--phase-color-18': `${ACCENT_ORANGE}2e`,
                  '--phase-color-20': `${ACCENT_ORANGE}33`,
                  '--phase-color-25': `${ACCENT_ORANGE}40`,
                  '--phase-color-30': `${ACCENT_ORANGE}4d`,
                } as React.CSSProperties}
              />
              {/* Cooldown */}
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPct + mvPct}%`,
                  width: `${widthPct - mvPct}%`,
                  backgroundColor: 'rgba(100,116,139,0.1)',
                  borderBottom: '2px solid rgba(100,116,139,0.3)',
                }}
              />
              {/* Dodge number label */}
              <div
                className="absolute top-0.5 text-[9px] font-mono font-bold"
                style={{ left: `${leftPct + 1}%`, color: ACCENT_CYAN }}
              >
                #{i + 1}
              </div>
            </div>
          );
        })}

        {/* Stamina curve (bottom half) */}
        <svg className="absolute bottom-0 left-0 w-full h-3 overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${totalChainTime} ${maxStamina}`}>
          <path
            d={staminaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.t},${maxStamina - p.stamina}`).join(' ')}
            fill="none" stroke={ACCENT_EMERALD} strokeWidth={maxStamina * 0.05} strokeLinecap="round" opacity={0.6}
          />
        </svg>

        {/* Playhead */}
        <motion.div
          className="absolute top-0 h-full w-0.5 z-20"
          style={{
            left: `${(playhead / totalChainTime) * 100}%`,
            backgroundColor: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }}
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white rounded-sm" style={{ boxShadow: '0 0 4px rgba(255,255,255,0.8)' }} />
        </motion.div>
      </div>

      {/* Time labels + stamina readout */}
      <div className="flex justify-between text-xs font-mono text-text-muted px-0.5">
        <span>0s</span>
        <span style={{ color: ACCENT_EMERALD }}>
          Stamina: {staminaRemaining}/{maxStamina}
        </span>
        <span>{totalChainTime.toFixed(2)}s</span>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

interface DodgeTimelineEditorProps {
  /** Optional initial params from a genome or external source */
  initialParams?: Partial<DodgeParams>;
}

/* ── Haptic effect type ───────────────────────────────────────────────────── */

type HapticEffect = { type: 'dodge' | 'hit'; id: string } | null;

export function DodgeTimelineEditor({ initialParams }: DodgeTimelineEditorProps) {
  const [params, setParams] = useState<DodgeParams>({ ...DEFAULT_PARAMS, ...initialParams });
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([
    { id: '1', time: 0.1, label: 'Sword Swing', damage: 40 },
    { id: '2', time: 0.35, label: 'Follow-up', damage: 25 },
  ]);
  const [showHitEditor, setShowHitEditor] = useState(false);
  const [chainMode, setChainMode] = useState(false);
  const [chain, setChain] = useState<DodgeChainEntry[]>([]);
  const [chainPlayhead, setChainPlayhead] = useState(0);
  const animRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  // ── Visual haptic state ──────────────────────────────────────────────
  const [hapticEffect, setHapticEffect] = useState<HapticEffect>(null);
  const prevPlayheadRef = useRef<number>(0);
  const triggeredHitsRef = useRef<Set<string>>(new Set());
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cliStore = useCharacterCliStore();

  // Pick up pending optimized params from the sidebar "Apply" button
  useEffect(() => {
    const pending = cliStore.pendingResult;
    if (pending) {
      // Applied via the sidebar "Apply" button — see CharacterBlueprint.tsx
    }
  }, [cliStore.pendingResult]);

  // ── Haptic detection: fire when playhead crosses a hit marker ──────
  useEffect(() => {
    const prev = prevPlayheadRef.current;
    const curr = playhead;
    prevPlayheadRef.current = curr;

    // Only detect forward crossings during playback
    if (curr <= prev) return;

    for (const hit of hitMarkers) {
      if (hit.time > prev && hit.time <= curr && !triggeredHitsRef.current.has(hit.id)) {
        triggeredHitsRef.current.add(hit.id);
        const iFrameStart = params.iFrameStart;
        const iFrameEnd = params.iFrameStart + params.iFrameDuration;
        const dodged = hit.time >= iFrameStart && hit.time < iFrameEnd;

        clearTimeout(hapticTimerRef.current);
        setHapticEffect({ type: dodged ? 'dodge' : 'hit', id: hit.id });
        hapticTimerRef.current = setTimeout(() => setHapticEffect(null), dodged ? 500 : 400);
      }
    }
  }, [playhead, hitMarkers, params.iFrameStart, params.iFrameDuration]);

  // Reset triggered hits when playhead resets to 0 or when hit markers change
  useEffect(() => {
    if (playhead === 0) {
      triggeredHitsRef.current.clear();
      setHapticEffect(null);
    }
  }, [playhead]);

  useEffect(() => {
    triggeredHitsRef.current.clear();
  }, [hitMarkers]);

  // Cleanup haptic timer
  useEffect(() => () => clearTimeout(hapticTimerRef.current), []);

  const phases = useMemo(() => computePhases(params), [params]);

  const updateParam = useCallback((key: keyof DodgeParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Computed stats at playhead position
  const stats = useMemo(() => {
    const t = playhead;
    const alpha = params.dodgeDuration > 0 ? Math.min(t / params.dodgeDuration, 1) : 0;
    const maxSpeed = params.dodgeDistance / params.dodgeDuration;
    const speed = t <= params.dodgeDuration ? speedCurve(alpha) * maxSpeed : 0;
    const dist = t <= params.dodgeDuration
      ? distanceCurve(alpha) * params.dodgeDistance
      : params.dodgeDistance;
    const inMovement = t >= phases.movement.start && t < phases.movement.end;
    const inInvuln = t >= phases.invuln.start && t < phases.invuln.end;
    const inCancel = t >= phases.cancel.start && t < phases.cancel.end;
    const inCooldown = t >= phases.recovery.start;

    // Check which hits are dodged
    const dodgedHits = hitMarkers.filter((h) => h.time >= phases.invuln.start && h.time < phases.invuln.end).length;
    const totalHits = hitMarkers.length;

    return { speed, dist, inMovement, inInvuln, inCancel, inCooldown, dodgedHits, totalHits };
  }, [playhead, params, phases, hitMarkers]);

  // Animation loop
  const play = useCallback(() => {
    setIsPlaying(true);
    lastFrameRef.current = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      if (chainMode) {
        setChainPlayhead((prev) => {
          const totalChainTime = chain.length > 0
            ? chain[chain.length - 1].startTime + computePhases(chain[chain.length - 1].params).totalTimeline
            : 0;
          const next = prev + dt;
          if (next >= totalChainTime) {
            setIsPlaying(false);
            return totalChainTime;
          }
          return next;
        });
      } else {
        setPlayhead((prev) => {
          const next = prev + dt;
          if (next >= phases.totalTimeline) {
            setIsPlaying(false);
            return phases.totalTimeline;
          }
          return next;
        });
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
  }, [phases, chainMode, chain]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(animRef.current);
  }, []);

  const reset = useCallback(() => {
    pause();
    setPlayhead(0);
    setChainPlayhead(0);
  }, [pause]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // Chain management
  const addDodgeToChain = useCallback(() => {
    setChain((prev) => {
      const lastEnd = prev.length > 0
        ? prev[prev.length - 1].startTime + computePhases(prev[prev.length - 1].params).totalTimeline
        : 0;
      return [...prev, { id: crypto.randomUUID(), startTime: lastEnd, params: { ...params } }];
    });
  }, [params]);

  const removeLastFromChain = useCallback(() => {
    setChain((prev) => prev.slice(0, -1));
  }, []);

  const buildChainFromCount = useCallback((count: number) => {
    const newChain: DodgeChainEntry[] = [];
    for (let i = 0; i < count; i++) {
      const lastEnd = newChain.length > 0
        ? newChain[newChain.length - 1].startTime + computePhases(newChain[newChain.length - 1].params).totalTimeline
        : 0;
      newChain.push({ id: crypto.randomUUID(), startTime: lastEnd, params: { ...params } });
    }
    setChain(newChain);
  }, [params]);

  // Hit marker management
  const addHitMarker = useCallback(() => {
    setHitMarkers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: params.dodgeDuration * 0.5, label: `Hit ${prev.length + 1}`, damage: 30 },
    ]);
  }, [params.dodgeDuration]);

  const removeHitMarker = useCallback((id: string) => {
    setHitMarkers((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHitMarker = useCallback((id: string, field: keyof HitMarker, value: string | number) => {
    setHitMarkers((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  }, []);

  return (
    <div className="space-y-2.5">
      {/* ── Header + Controls ─────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <SectionLabel icon={Crosshair} label="Interactive Dodge Timeline" color={ACCENT_CYAN} />
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                cliStore.startOptimization();
                cliStore.addLogEntry({
                  type: 'info',
                  message: 'Starting dodge parameter optimization...',
                  detail: `Current params: distance=${params.dodgeDistance}, duration=${params.dodgeDuration}, iFrameStart=${params.iFrameStart}`,
                });
                // Simulate async optimization
                setTimeout(() => {
                  cliStore.addLogEntry({
                    type: 'change',
                    message: 'Analyzing i-frame window coverage...',
                  });
                }, 800);
                setTimeout(() => {
                  cliStore.addLogEntry({
                    type: 'result',
                    message: 'Optimization complete — suggested adjustments ready',
                    detail: 'Increased i-frame window by 15%, reduced cooldown by 10%',
                  });
                  cliStore.finishOptimization({
                    ...params,
                    iFrameDuration: Math.min(params.iFrameDuration * 1.15, params.dodgeDuration * 0.8),
                    cooldown: params.cooldown * 0.9,
                  });
                }, 2000);
              }}
              disabled={cliStore.isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: '#10b981' + '40',
                backgroundColor: '#10b981' + '10',
                color: '#10b981',
              }}
            >
              {cliStore.isOptimizing ? 'Optimizing...' : 'Simulate & Optimize'}
            </button>
            <button
              onClick={() => setShowParams(!showParams)}
              className="p-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: showParams ? `${ACCENT_CYAN}40` : 'rgba(255,255,255,0.08)',
                backgroundColor: showParams ? `${ACCENT_CYAN}10` : 'transparent',
                color: showParams ? ACCENT_CYAN : 'var(--text-muted)',
              }}
              title="Toggle parameter editor"
            >
              <Settings2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowHitEditor(!showHitEditor)}
              className="p-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: showHitEditor ? `${STATUS_ERROR}40` : 'rgba(255,255,255,0.08)',
                backgroundColor: showHitEditor ? `${STATUS_ERROR}10` : 'transparent',
                color: showHitEditor ? STATUS_ERROR : 'var(--text-muted)',
              }}
              title="Toggle hit marker editor"
            >
              <AlertTriangle className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Phase legend */}
        <div className="flex flex-wrap gap-2 mb-2">
          {[phases.movement, phases.invuln, phases.cancel, phases.recovery].map((phase) => (
            <span key={phase.label} className="flex items-center gap-1 text-xs font-mono" style={{ color: phase.color }}>
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: phase.color }} />
              {phase.label}
            </span>
          ))}
          {hitMarkers.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono" style={{ color: STATUS_ERROR }}>
              <span className="w-2 h-2 rounded-full border" style={{ borderColor: STATUS_ERROR }} />
              Hits ({stats.dodgedHits}/{stats.totalHits} dodged)
            </span>
          )}
        </div>

        {/* Timeline bar */}
        <TimelineBar
          phases={phases}
          playhead={playhead}
          hitMarkers={hitMarkers}
          totalTime={phases.totalTimeline}
          onScrub={setPlayhead}
          hapticEffect={hapticEffect}
        />

        {/* Velocity curve */}
        <div className="mt-2">
          <VelocityCurve params={params} phases={phases} playhead={playhead} />
        </div>

        {/* Live stats grid */}
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <div className="p-1.5 rounded-lg border bg-surface-deep/50" style={{ borderColor: stats.inMovement ? `${ACCENT_CYAN}60` : 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-text-muted">Distance</div>
            <div className="text-sm font-mono font-bold" style={{ color: ACCENT_CYAN }}>
              {stats.dist.toFixed(0)} <span className="text-xs font-normal text-text-muted">cm</span>
            </div>
          </div>
          <div className="p-1.5 rounded-lg border bg-surface-deep/50" style={{ borderColor: stats.inInvuln ? `${ACCENT_ORANGE}60` : 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-text-muted">I-Frames</div>
            <div className="text-sm font-mono font-bold" style={{ color: stats.inInvuln ? ACCENT_ORANGE : 'var(--text-muted)' }}>
              {stats.inInvuln ? 'ACTIVE' : `${params.iFrameDuration}s`}
            </div>
          </div>
          <div className="p-1.5 rounded-lg border bg-surface-deep/50" style={{ borderColor: stats.inCancel ? `${ACCENT_VIOLET}60` : 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-text-muted">Cancel</div>
            <div className="text-sm font-mono font-bold" style={{ color: stats.inCancel ? ACCENT_VIOLET : 'var(--text-muted)' }}>
              {stats.inCancel ? 'OPEN' : `${params.cancelWindowStart.toFixed(2)}s`}
            </div>
          </div>
          <div className="p-1.5 rounded-lg border bg-surface-deep/50" style={{ borderColor: stats.inCooldown ? 'rgba(100,116,139,0.5)' : 'rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-text-muted">Cooldown</div>
            <div className="text-sm font-mono font-bold" style={{ color: stats.inCooldown ? STATUS_NEUTRAL : 'var(--text-muted)' }}>
              {stats.inCooldown ? `${Math.max(0, phases.recovery.end - playhead).toFixed(2)}s` : `${params.cooldown}s`}
            </div>
          </div>
        </div>

        {/* Playback controls + readout */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
          <button
            onClick={isPlaying ? pause : play}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
            style={{ borderColor: `${ACCENT_CYAN}40`, backgroundColor: `${ACCENT_CYAN}12`, color: ACCENT_CYAN }}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-border/30 text-text-muted hover:text-text transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs font-mono text-text-muted">
            <span>Playhead: <span className="font-bold text-text">{playhead.toFixed(3)}s</span></span>
            <span>Stamina: <span className="font-bold" style={{ color: ACCENT_EMERALD }}>-{params.staminaCost}</span></span>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Parameter Editor ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showParams && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <SurfaceCard level={2} className="p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <SectionLabel icon={Settings2} label="Dodge Parameters" color={ACCENT_CYAN} />
                <button
                  onClick={() => setParams({ ...DEFAULT_PARAMS })}
                  className="ml-auto text-xs font-mono text-text-muted hover:text-text transition-colors"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
                {PARAM_FIELDS.map((f) => {
                  const val = params[f.key];
                  const pct = ((val - f.min) / (f.max - f.min)) * 100;
                  return (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-text-muted w-24 truncate flex-shrink-0">{f.label}</span>
                      <div className="flex-1 relative h-4 flex items-center">
                        <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
                        <div
                          className="absolute h-1.5 rounded-full transition-all duration-150"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: f.color, boxShadow: `0 0 6px ${f.color}40` }}
                        />
                        <input
                          type="range" min={f.min} max={f.max} step={f.step} value={val}
                          onChange={(e) => updateParam(f.key, parseFloat(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none transition-all duration-150"
                          style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: f.color }}
                        />
                      </div>
                      <input
                        type="number" min={f.min} max={f.max} step={f.step} value={val}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) updateParam(f.key, Math.max(f.min, Math.min(f.max, v)));
                        }}
                        className="w-14 text-xs font-mono font-bold text-right px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
                      />
                      <span className="text-xs font-mono text-text-muted/60 w-6 flex-shrink-0">{f.unit}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quick stat readouts */}
              <div className="flex flex-wrap gap-3 mt-2.5 pt-2 border-t border-border/30 text-xs font-mono text-text-muted">
                <span>Max Speed: <span className="font-bold" style={{ color: ACCENT_CYAN }}>{(params.dodgeDistance / params.dodgeDuration).toFixed(0)} cm/s</span></span>
                <span>I-Frame Window: <span className="font-bold" style={{ color: ACCENT_ORANGE }}>{(params.iFrameDuration / params.dodgeDuration * 100).toFixed(0)}%</span></span>
                <span>Cancel Window: <span className="font-bold" style={{ color: ACCENT_VIOLET }}>{((params.cancelWindowEnd - params.cancelWindowStart) / params.dodgeDuration * 100).toFixed(0)}%</span></span>
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hit Marker Editor ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showHitEditor && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <SurfaceCard level={2} className="p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <SectionLabel icon={AlertTriangle} label="Incoming Hit Timing" color={STATUS_ERROR} />
                <button
                  onClick={addHitMarker}
                  className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors"
                  style={{ borderColor: `${STATUS_ERROR}40`, backgroundColor: `${STATUS_ERROR}10`, color: STATUS_ERROR }}
                >
                  <Plus className="w-3 h-3" />
                  Add Hit
                </button>
              </div>
              <div className="space-y-1.5">
                {hitMarkers.map((hit) => {
                  const dodged = hit.time >= phases.invuln.start && hit.time < phases.invuln.end;
                  return (
                    <div key={hit.id} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dodged ? ACCENT_EMERALD : STATUS_ERROR, boxShadow: `0 0 4px ${dodged ? ACCENT_EMERALD : STATUS_ERROR}60` }}
                      />
                      <input
                        type="text" value={hit.label}
                        onChange={(e) => updateHitMarker(hit.id, 'label', e.target.value)}
                        className="w-28 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
                      />
                      <span className="text-xs text-text-muted">@</span>
                      <input
                        type="number" value={hit.time} min={0} max={phases.totalTimeline} step={0.01}
                        onChange={(e) => updateHitMarker(hit.id, 'time', parseFloat(e.target.value) || 0)}
                        className="w-16 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none text-right"
                      />
                      <span className="text-xs text-text-muted">s</span>
                      <input
                        type="number" value={hit.damage} min={0} max={999} step={1}
                        onChange={(e) => updateHitMarker(hit.id, 'damage', parseInt(e.target.value) || 0)}
                        className="w-14 text-xs font-mono px-1.5 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none text-right"
                      />
                      <span className="text-xs text-text-muted">dmg</span>
                      <span className="text-xs font-mono font-bold ml-auto" style={{ color: dodged ? ACCENT_EMERALD : STATUS_ERROR }}>
                        {dodged ? 'DODGED' : 'HIT'}
                      </span>
                      <button onClick={() => removeHitMarker(hit.id)} className="text-text-muted hover:text-text transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {hitMarkers.length === 0 && (
                  <p className="text-xs text-text-muted/50 py-2 text-center">No hit markers — add one to simulate incoming attacks</p>
                )}
              </div>
              {hitMarkers.length > 0 && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 text-xs font-mono text-text-muted">
                  <span>Total hits: <span className="font-bold text-text">{hitMarkers.length}</span></span>
                  <span>Dodged: <span className="font-bold" style={{ color: ACCENT_EMERALD }}>{stats.dodgedHits}</span></span>
                  <span>Took damage: <span className="font-bold" style={{ color: STATUS_ERROR }}>{stats.totalHits - stats.dodgedHits}</span></span>
                  <span>Damage avoided: <span className="font-bold" style={{ color: ACCENT_EMERALD }}>
                    {hitMarkers.filter((h) => h.time >= phases.invuln.start && h.time < phases.invuln.end).reduce((sum, h) => sum + h.damage, 0)}
                  </span></span>
                </div>
              )}
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dodge Chain Mode ──────────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <SectionLabel icon={Zap} label="Dodge Chain Simulator" color={ACCENT_EMERALD} />
          <div className="ml-auto flex items-center gap-1.5">
            {/* Quick chain buttons */}
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => { setChainMode(true); buildChainFromCount(n); }}
                className="px-2 py-1 rounded text-xs font-mono font-bold border transition-colors"
                style={{
                  borderColor: chain.length === n && chainMode ? `${ACCENT_EMERALD}40` : 'rgba(255,255,255,0.08)',
                  backgroundColor: chain.length === n && chainMode ? `${ACCENT_EMERALD}10` : 'transparent',
                  color: chain.length === n && chainMode ? ACCENT_EMERALD : 'var(--text-muted)',
                }}
              >
                {n}×
              </button>
            ))}
            <button
              onClick={() => { if (chainMode) addDodgeToChain(); else { setChainMode(true); buildChainFromCount(1); } }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors"
              style={{ borderColor: `${ACCENT_EMERALD}40`, backgroundColor: `${ACCENT_EMERALD}10`, color: ACCENT_EMERALD }}
            >
              <Plus className="w-3 h-3" />
            </button>
            {chain.length > 0 && (
              <button
                onClick={removeLastFromChain}
                className="p-1 rounded-lg text-text-muted hover:text-text transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {chainMode && chain.length > 0 ? (
          <DodgeChainTimeline
            chain={chain}
            playhead={chainPlayhead}
            onScrub={setChainPlayhead}
          />
        ) : (
          <div className="flex items-center justify-center py-6 text-text-muted">
            <p className="text-xs">Select a chain count (2×, 3×, 4×) or add dodges to simulate a sequence</p>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
