'use client';

import { useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { OVERLAY_WHITE, OPACITY_4, OPACITY_30, withOpacity } from '@/lib/chart-colors';
import { channelT, type CurveValues } from '@/lib/character/feel-curve-codec';
import { drawGroundLine, drawStickFigure, drawSpeedHUD } from './canvas-draw';

/* ── Stick Figure Preview ─────────────────────────────────────────────────── */

interface StickFigureProps {
  /** Decoded curve values keyed by FeelProfile path (see `decodeCurves`). */
  values: CurveValues;
  isPlaying: boolean;
}

/** Walk-cycle state carried across a suspend so the resumed run continues it. */
interface RunSnapshot {
  key: string;
  currentSpeed: number;
  posX: number;
  isDodging: boolean;
  dodgeTimer: number;
  dodgeStartX: number;
  nextDodgeAt: number;
  phase: number;
}

/** Mutable-by-copy walk-cycle state integrated each frame. */
export type PreviewState = Omit<RunSnapshot, 'key'>;

export interface PreviewParams {
  targetSpeed: number;
  accelRate: number;
  dodgeDist: number;
  dodgeDur: number;
  /** Canvas width, for the wrap-around. */
  width: number;
}

/** A fresh run's schedule is rebased on the preview clock `t` — `t` accumulates
 *  across runs, so an absolute 2-4 s would already be in the past after a pause. */
export function freshRun(t: number, rand: () => number = Math.random): PreviewState {
  return {
    currentSpeed: 0, posX: 60, isDodging: false, dodgeTimer: 0, dodgeStartX: 0,
    nextDodgeAt: t + 2 + rand() * 2, phase: 0,
  };
}

/** One frame of the preview integrator: dodge scheduling, ramp, wrap, gait phase. */
export function stepPreview(
  prev: PreviewState, t: number, dt: number, p: PreviewParams, rand: () => number = Math.random,
): PreviewState {
  const s = { ...prev };
  if (!s.isDodging && t > s.nextDodgeAt) {
    s.isDodging = true;
    s.dodgeTimer = 0;
    s.dodgeStartX = s.posX;
    s.nextDodgeAt = t + 3 + rand() * 2;
  }
  if (s.isDodging) {
    s.dodgeTimer += dt;
    const dodgeProgress = Math.min(s.dodgeTimer / p.dodgeDur, 1);
    const eased = 1 - Math.pow(1 - dodgeProgress, 3);
    s.posX = s.dodgeStartX + p.dodgeDist * eased;
    if (dodgeProgress >= 1) {
      s.isDodging = false;
      s.currentSpeed = p.targetSpeed * 0.5;
    }
  } else {
    if (s.currentSpeed < p.targetSpeed) {
      s.currentSpeed = Math.min(s.currentSpeed + p.accelRate * dt, p.targetSpeed);
    }
    s.posX += s.currentSpeed * dt;
  }
  if (s.posX > p.width + 20) {
    s.posX = -20;
    s.currentSpeed = 0;
  }
  s.phase += s.currentSpeed * dt * 0.15;
  return s;
}

export function StickFigurePreview({ values, isPlaying }: StickFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const snapshotRef = useRef<RunSnapshot | null>(null);

  // Normalized feel parameters — through the codec's FEEL_FIELD_META ranges.
  const speedFactor = channelT('movement.maxWalkSpeed', values['movement.maxWalkSpeed']);
  const accelFactor = channelT('movement.acceleration', values['movement.acceleration']);
  const dodgeDistFactor = channelT('dodge.distance', values['dodge.distance']);
  const dodgeDurFactor = channelT('dodge.duration', values['dodge.duration']);

  // Identifies the tuning this run belongs to. A snapshot is only restored when
  // the tuning is unchanged — i.e. the effect re-ran because the pane resumed,
  // not because the curves were edited (which has always reset the walk cycle).
  const runKey = `${speedFactor}|${accelFactor}|${dodgeDistFactor}|${dodgeDurFactor}|${isPlaying}`;

  /* Suspend-gated (see `useSuspend.ts`). This is an unbounded 60fps canvas loop:
     it clears, integrates and redraws the whole preview every frame while
     `isPlaying`. The module LRU keeps this pane MOUNTED behind `display:none`
     and the browser only throttles rAF for a hidden TAB, so an unwatched
     playground kept a full canvas repaint running for nobody.

     Pausing is lossless because the walk cycle is fully described by the eight
     scalars in `RunSnapshot`: the cleanup banks them, and a resume for the SAME
     tuning restores them, so the figure carries on from its exact position,
     speed, gait phase and dodge schedule. `lastFrameRef` is rebased on the
     first live frame, so the hidden span is never integrated as one huge dt
     (which would fling the figure off-canvas). A tuning edit still starts a
     fresh run, exactly as before the gate. */
  useSuspendableEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const groundY = H - 20;

    const resumed = snapshotRef.current?.key === runKey ? snapshotRef.current : null;
    let state: PreviewState = resumed ?? freshRun(timeRef.current);
    const params: PreviewParams = {
      targetSpeed: 40 + speedFactor * 60,
      accelRate: 30 + accelFactor * 120,
      dodgeDist: 40 + dodgeDistFactor * 80,
      dodgeDur: 0.2 + dodgeDurFactor * 0.6,
      width: W,
    };
    const { targetSpeed } = params;

    function frame(ts: number) {
      if (!ctx || !isPlaying) return;
      const dt = Math.min((ts - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = ts;
      timeRef.current += dt;
      const t = timeRef.current;

      ctx.clearRect(0, 0, W, H);
      drawGroundLine(ctx, W, groundY);

      // Speed ramp markers
      [0.25, 0.5, 0.75, 1.0].forEach(m => {
        const mx = 30 + m * (W - 60);
        ctx.strokeStyle = withOpacity(OVERLAY_WHITE, OPACITY_4);
        ctx.beginPath();
        ctx.moveTo(mx, 10);
        ctx.lineTo(mx, groundY);
        ctx.stroke();
      });

      state = stepPreview(state, t, dt, params);
      const { currentSpeed, posX, isDodging, phase } = state;

      // Draw afterimages during dodge
      if (isDodging) {
        ctx.globalAlpha = 0.15;
        drawStickFigure(ctx, posX - 15, groundY, phase - 0.5, true);
        ctx.globalAlpha = 0.3;
        drawStickFigure(ctx, posX - 8, groundY, phase - 0.25, true);
        ctx.globalAlpha = 1;
      }

      drawStickFigure(ctx, posX, groundY, phase, isDodging);
      drawSpeedHUD(ctx, currentSpeed, targetSpeed, isDodging, posX, groundY);

      animRef.current = requestAnimationFrame(frame);
    }

    if (isPlaying) {
      lastFrameRef.current = performance.now();
      animRef.current = requestAnimationFrame(frame);
    } else {
      // Draw static idle pose
      ctx.clearRect(0, 0, W, H);
      drawGroundLine(ctx, W, groundY);
      drawStickFigure(ctx, W / 2, groundY, 0, false);
      ctx.fillStyle = withOpacity(OVERLAY_WHITE, OPACITY_30);
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press play to preview movement feel', W / 2, H - 4);
      ctx.textAlign = 'start';
    }

    return () => {
      snapshotRef.current = {
        key: runKey, ...state,
      };
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speedFactor, accelFactor, dodgeDistFactor, dodgeDurFactor, values, runKey]);

  // The canvas pixels are invisible to AT; the name carries the tuning it animates.
  const label = `Movement preview (${isPlaying ? 'playing' : 'paused, press play'}): walk speed ${
    Math.round(values['movement.maxWalkSpeed'])} cm/s, acceleration ${
    Math.round(values['movement.acceleration'])} cm/s², dodge ${
    Math.round(values['dodge.distance'])} cm over ${Number(values['dodge.duration'].toFixed(2))} s`;

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      width={400}
      height={120}
      className="w-full rounded-lg border border-border/30 bg-surface-deep/50"
      style={{ imageRendering: 'auto' }}
    />
  );
}
