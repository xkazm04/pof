'use client';

import { useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { OVERLAY_WHITE, OPACITY_4, OPACITY_30, withOpacity } from '@/lib/chart-colors';
import type { DerivedGenomeValues } from './types';
import { invLerp } from './types';
import { drawGroundLine, drawStickFigure, drawSpeedHUD } from './canvas-draw';

/* ── Stick Figure Preview ─────────────────────────────────────────────────── */

interface StickFigureProps {
  values: DerivedGenomeValues;
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

export function StickFigurePreview({ values, isPlaying }: StickFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const snapshotRef = useRef<RunSnapshot | null>(null);

  // Normalized feel parameters
  const speedFactor = invLerp(200, 600, values.maxWalkSpeed);
  const accelFactor = invLerp(800, 4500, values.acceleration);
  const dodgeDistFactor = invLerp(150, 600, values.dodgeDistance);
  const dodgeDurFactor = invLerp(0.15, 0.9, values.dodgeDuration);

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
    let currentSpeed = resumed?.currentSpeed ?? 0;
    let posX = resumed?.posX ?? 60;
    let isDodging = resumed?.isDodging ?? false;
    let dodgeTimer = resumed?.dodgeTimer ?? 0;
    let dodgeStartX = resumed?.dodgeStartX ?? 0;
    const targetSpeed = 40 + speedFactor * 60;
    const accelRate = 30 + accelFactor * 120;
    const dodgeDist = 40 + dodgeDistFactor * 80;
    const dodgeDur = 0.2 + dodgeDurFactor * 0.6;
    let nextDodgeAt = resumed?.nextDodgeAt ?? 2 + Math.random() * 2;
    let phase = resumed?.phase ?? 0;

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

      // Dodge logic
      if (!isDodging && t > nextDodgeAt) {
        isDodging = true;
        dodgeTimer = 0;
        dodgeStartX = posX;
        nextDodgeAt = t + 3 + Math.random() * 2;
      }

      if (isDodging) {
        dodgeTimer += dt;
        const dodgeProgress = Math.min(dodgeTimer / dodgeDur, 1);
        const eased = 1 - Math.pow(1 - dodgeProgress, 3);
        posX = dodgeStartX + dodgeDist * eased;
        if (dodgeProgress >= 1) {
          isDodging = false;
          currentSpeed = targetSpeed * 0.5;
        }
      } else {
        if (currentSpeed < targetSpeed) {
          currentSpeed = Math.min(currentSpeed + accelRate * dt, targetSpeed);
        }
        posX += currentSpeed * dt;
      }

      // Wrap position
      if (posX > W + 20) {
        posX = -20;
        currentSpeed = 0;
      }

      phase += currentSpeed * dt * 0.15;

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
        key: runKey, currentSpeed, posX, isDodging, dodgeTimer, dodgeStartX, nextDodgeAt, phase,
      };
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speedFactor, accelFactor, dodgeDistFactor, dodgeDurFactor, values, runKey]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={120}
      className="w-full rounded-lg border border-border/30 bg-surface-deep/50"
      style={{ imageRendering: 'auto' }}
    />
  );
}
