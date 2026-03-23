'use client';

import { useRef, useEffect } from 'react';
import type { DerivedGenomeValues } from './types';
import { invLerp } from './types';
import { drawGroundLine, drawStickFigure, drawSpeedHUD } from './canvas-draw';

/* ── Stick Figure Preview ─────────────────────────────────────────────────── */

interface StickFigureProps {
  values: DerivedGenomeValues;
  isPlaying: boolean;
}

export function StickFigurePreview({ values, isPlaying }: StickFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Normalized feel parameters
  const speedFactor = invLerp(200, 600, values.maxWalkSpeed);
  const accelFactor = invLerp(800, 4500, values.acceleration);
  const dodgeDistFactor = invLerp(150, 600, values.dodgeDistance);
  const dodgeDurFactor = invLerp(0.15, 0.9, values.dodgeDuration);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const groundY = H - 20;

    let currentSpeed = 0;
    let posX = 60;
    let isDodging = false;
    let dodgeTimer = 0;
    let dodgeStartX = 0;
    const targetSpeed = 40 + speedFactor * 60;
    const accelRate = 30 + accelFactor * 120;
    const dodgeDist = 40 + dodgeDistFactor * 80;
    const dodgeDur = 0.2 + dodgeDurFactor * 0.6;
    let nextDodgeAt = 2 + Math.random() * 2;
    let phase = 0;

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
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press play to preview movement feel', W / 2, H - 4);
      ctx.textAlign = 'start';
    }

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, speedFactor, accelFactor, dodgeDistFactor, dodgeDurFactor, values]);

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
