'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Film, Play, Pause, SkipBack, SkipForward, Crosshair, ArrowRight, Code2, Cpu } from 'lucide-react';
import {
  SEVERITY_TOKENS,
  ACCENT_EMERALD,
  STATUS_LOCKED,
  statusBg,
  statusBorder,
  type SeverityToken,
} from '@/lib/chart-colors';
import { DURATION, EASE_OUT, motionSafe } from '@/lib/motion';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CrashReport } from '@/types/crash-analyzer';
import {
  orderCallstackForReplay,
  findCulpritPos,
  type ReplayFrame,
} from '@/lib/crash-analyzer/crash-replay';

// ── Frame coloring ───────────────────────────────────────────────────────────
//
// Three legible tiers: dim slate engine frames, emerald "your game code"
// frames, and the red crash-origin culprit. A frame is a `SeverityToken`-shaped
// triple so segments style identically to the rest of the crash UI.

const GAME_TOKEN: SeverityToken = {
  color: ACCENT_EMERALD,
  bg: statusBg(ACCENT_EMERALD),
  border: statusBorder(ACCENT_EMERALD),
};
const ENGINE_TOKEN: SeverityToken = {
  color: STATUS_LOCKED,
  bg: statusBg(STATUS_LOCKED),
  border: statusBorder(STATUS_LOCKED),
};

function frameToken(frame: ReplayFrame): SeverityToken {
  if (frame.isCrashOrigin) return SEVERITY_TOKENS.critical;
  return frame.isGameCode ? GAME_TOKEN : ENGINE_TOKEN;
}

/** Short, human label for a frame (drops the namespace before `::`). */
function shortName(fn: string): string {
  const parts = fn.split('::');
  return parts[parts.length - 1] || fn;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Cinematic Crash Time Machine — replays the callstack as a horizontal film
 * strip. Execution flows left (engine entry) → right (crash point), every frame
 * up to the playhead is "lit", the mapped-module ribbon lights up as execution
 * crosses from engine into game code, and the replay stops on the glowing
 * culprit. Click any frame to focus it; scrub or play to step through the story.
 */
export function CrashTimeMachine({ report }: { report: CrashReport }) {
  const frames = useMemo(() => orderCallstackForReplay(report.callstack), [report.callstack]);
  const culpritPos = useMemo(() => findCulpritPos(frames), [frames]);
  const prefersReducedMotion = useReducedMotion();

  // Open "stopped on the culprit" — the climax of the story. State is re-anchored
  // per crash by a `key={report.id}` remount at the call site, so no reset effect
  // is needed here.
  const [playhead, setPlayhead] = useState(culpritPos);
  const [focusedPos, setFocusedPos] = useState(culpritPos);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-advance while playing; stop on the culprit (the replay's resting beat).
  // A latest-value ref lets the interval read the current playhead without
  // re-subscribing every tick (ref written in an effect, never during render).
  const playheadRef = useRef(playhead);
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const next = playheadRef.current + 1;
      if (next >= culpritPos) {
        setPlayhead(culpritPos);
        setFocusedPos(culpritPos);
        setIsPlaying(false);
      } else {
        setPlayhead(next);
        setFocusedPos(next);
      }
    }, UI_TIMEOUTS.crashReplayStep);
    return () => clearInterval(id);
  }, [isPlaying, culpritPos]);

  if (frames.length === 0) return null;

  const lastPos = frames.length - 1;
  const activeFrame = frames[playhead] ?? frames[lastPos];
  const focusedFrame = frames[focusedPos] ?? activeFrame;

  const jumpTo = (pos: number) => {
    setIsPlaying(false);
    setPlayhead(pos);
    setFocusedPos(pos);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Replay from the entry frame; reduced-motion users jump straight to the end.
    if (prefersReducedMotion) {
      jumpTo(culpritPos);
      return;
    }
    setFocusedPos(0);
    setPlayhead(0);
    setIsPlaying(true);
  };

  const moduleLabel = report.mappedModule ?? 'Game code';
  const inGameCode = activeFrame.isGameCode;

  return (
    <div className="space-y-2.5" data-testid="crash-time-machine">
      {/* Header + transport controls */}
      <div className="flex items-center justify-between">
        <p className="text-2xs font-medium text-text-muted flex items-center gap-1.5">
          <Film className="w-3 h-3 text-rose-400" />
          Crash Replay
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Replay controls">
          <TransportButton label="Step back" onClick={() => jumpTo(Math.max(0, playhead - 1))} disabled={playhead === 0}>
            <SkipBack className="w-3 h-3" />
          </TransportButton>
          <TransportButton label={isPlaying ? 'Pause replay' : 'Play replay'} onClick={togglePlay}>
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </TransportButton>
          <TransportButton label="Step forward" onClick={() => jumpTo(Math.min(lastPos, playhead + 1))} disabled={playhead === lastPos}>
            <SkipForward className="w-3 h-3" />
          </TransportButton>
        </div>
      </div>

      {/* Module ribbon — lights up the side execution is currently in */}
      <div className="flex items-center gap-2 text-2xs">
        <ZonePill icon={Cpu} label="Engine" active={!inGameCode} color={STATUS_LOCKED} />
        <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />
        <ZonePill icon={Code2} label={moduleLabel} active={inGameCode} color={ACCENT_EMERALD} />
      </div>

      {/* Film-strip timeline */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1" role="group" aria-label="Callstack frames, entry to crash">
        {frames.map((frame) => {
          const token = frameToken(frame);
          const lit = frame.pos <= playhead;
          const isActive = frame.pos === playhead;
          const isFocused = frame.pos === focusedPos;
          const isCulprit = frame.pos === culpritPos;
          const glow = isCulprit && (isActive || isFocused) && !prefersReducedMotion;
          return (
            <motion.button
              key={frame.index}
              type="button"
              data-testid="frame-segment"
              onClick={() => jumpTo(frame.pos)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Frame ${frame.pos + 1} of ${frames.length}: ${shortName(frame.functionName)}${isCulprit ? ' (crash origin)' : ''}`}
              title={frame.functionName}
              className="focus-ring relative flex-1 min-w-[44px] rounded-md border px-1.5 py-1.5 text-left transition-colors"
              style={{
                backgroundColor: lit ? token.bg : 'transparent',
                borderColor: isFocused ? token.color : lit ? token.border : 'var(--border)',
                opacity: lit ? 1 : 0.45,
                boxShadow: glow ? `0 0 0 1.5px ${token.color}, 0 0 10px ${token.bg}` : isFocused ? `0 0 0 1.5px ${token.color}` : undefined,
              }}
              animate={isActive && !prefersReducedMotion ? { scale: 1.04 } : { scale: 1 }}
              transition={motionSafe({ duration: DURATION.fast, ease: EASE_OUT }, prefersReducedMotion)}
            >
              <span className="flex items-center gap-1">
                {isCulprit && <Crosshair className="w-2.5 h-2.5 shrink-0" style={{ color: SEVERITY_TOKENS.critical.color }} />}
                <span className="text-2xs font-mono truncate" style={{ color: lit ? token.color : 'var(--text-muted)' }}>
                  {shortName(frame.functionName)}
                </span>
              </span>
              <span className="block text-2xs text-text-muted mt-0.5">#{frame.index}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Scrubber */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={lastPos}
          value={playhead}
          onChange={(e) => jumpTo(Number(e.target.value))}
          aria-label="Scrub crash replay"
          aria-valuetext={`Frame ${playhead + 1} of ${frames.length}: ${shortName(activeFrame.functionName)}`}
          className="flex-1 accent-rose-400 cursor-pointer"
        />
        <span className="text-2xs text-text-muted font-mono shrink-0 w-16 text-right">
          {playhead + 1} / {frames.length}
        </span>
      </div>

      {/* Focused frame detail */}
      <FrameDetail frame={focusedFrame} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TransportButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring flex items-center justify-center w-6 h-6 rounded border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function ZonePill({
  icon: Icon,
  label,
  active,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <span
      data-active={active}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono transition-colors"
      style={{
        color: active ? color : 'var(--text-muted)',
        backgroundColor: active ? statusBg(color) : 'transparent',
        borderColor: active ? statusBorder(color) : 'var(--border)',
        opacity: active ? 1 : 0.55,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function FrameDetail({ frame }: { frame: ReplayFrame }) {
  const token = frameToken(frame);
  return (
    <div
      data-testid="time-machine-frame-detail"
      className="rounded-md border p-2"
      style={{ backgroundColor: token.bg, borderColor: token.border }}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        <span className="text-2xs font-mono font-medium" style={{ color: token.color }}>
          {frame.functionName}
        </span>
        {frame.isCrashOrigin ? (
          <span className="text-2xs px-1 rounded font-medium" style={{ color: SEVERITY_TOKENS.critical.color, backgroundColor: SEVERITY_TOKENS.critical.bg }}>
            crash origin
          </span>
        ) : (
          <span className="text-2xs px-1 rounded text-text-muted bg-surface-2">
            {frame.isGameCode ? 'game code' : 'engine'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-text-muted font-mono">
        {frame.sourceFile && (
          <span>
            {frame.sourceFile}
            {frame.lineNumber != null && `:${frame.lineNumber}`}
          </span>
        )}
        <span className="truncate">{frame.moduleName}</span>
        <span className="text-text-muted/70">{frame.address}</span>
      </div>
    </div>
  );
}
