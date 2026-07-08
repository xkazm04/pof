'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_THRESHOLD, DEFAULT_PULSE_SPEED, HEALTHY_COLOR, DANGER_COLOR } from './constants';
import { toCSS, lerpColor } from './helpers';

// ── Custom hook for RAF-driven animation counter ───────────────────────────

function useAnimationTime(active: boolean): [number, () => void] {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    let lastTs = 0;
    let accumulated = 0;

    const frame = (now: number) => {
      if (lastTs === 0) lastTs = now;
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      accumulated += dt;
      setTime(accumulated);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const reset = useCallback(() => {
    setTime(0);
  }, []);

  return [time, reset];
}

// ── Stateful logic for LowHealthPulse ──────────────────────────────────────

export function useLowHealthPulse() {
  // Tuning parameters (matching C++ UPROPERTY defaults)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [pulseSpeed, setPulseSpeed] = useState(DEFAULT_PULSE_SPEED);
  const [healthPct, setHealthPct] = useState(0.15); // Start below threshold
  const [playing, setPlaying] = useState(true);

  const isLow = healthPct < threshold && healthPct > 0;

  // Animation driven by RAF
  const [pulseTime, resetTime] = useAnimationTime(playing && isLow);

  // Compute the current alpha exactly as UE5 does:
  // Alpha = (sin(PulseTime * PulseSpeed * 2 * PI) + 1) * 0.5
  // Color  = Lerp(LowHealthColor, HealthBarColor, Alpha)
  const alpha = isLow
    ? (Math.sin(pulseTime * pulseSpeed * 2 * Math.PI) + 1) * 0.5
    : 1;

  const currentColor = isLow
    ? lerpColor(DANGER_COLOR, HEALTHY_COLOR, alpha)
    : HEALTHY_COLOR;

  const currentCSS = toCSS(currentColor);
  const healthyCSS = toCSS(HEALTHY_COLOR);
  const dangerCSS = toCSS(DANGER_COLOR);

  const handleReset = useCallback(() => {
    setThreshold(DEFAULT_THRESHOLD);
    setPulseSpeed(DEFAULT_PULSE_SPEED);
    setHealthPct(0.15);
    resetTime();
  }, [resetTime]);

  // ── Timing diagram: plot one full cycle of the sine wave ──

  const DIAGRAM_POINTS = 120;
  const diagramPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= DIAGRAM_POINTS; i++) {
      const t = i / DIAGRAM_POINTS; // 0..1 over one cycle
      const sineVal = (Math.sin(t * 2 * Math.PI) + 1) * 0.5; // 0..1
      const x = t * 100;
      const y = (1 - sineVal) * 100; // invert for SVG coords
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  })();

  // Current position on diagram (phase within current cycle)
  const cyclePhase = isLow ? (pulseTime * pulseSpeed) % 1 : 0;

  return {
    threshold,
    setThreshold,
    pulseSpeed,
    setPulseSpeed,
    healthPct,
    setHealthPct,
    playing,
    setPlaying,
    isLow,
    alpha,
    currentCSS,
    healthyCSS,
    dangerCSS,
    handleReset,
    diagramPath,
    cyclePhase,
  };
}
