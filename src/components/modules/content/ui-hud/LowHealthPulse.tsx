'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, Play, Pause, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';

// ── C++ defaults from ARPGHUDWidget.h ──────────────────────────────────────

const DEFAULT_THRESHOLD = 0.25;
const DEFAULT_PULSE_SPEED = 2.0; // cycles/sec
const HEALTHY_COLOR = { r: 0.1, g: 0.8, b: 0.1 }; // FLinearColor(0.1,0.8,0.1)
const DANGER_COLOR = { r: 0.9, g: 0.1, b: 0.1 };  // FLinearColor(0.9,0.1,0.1)

function toCSS(c: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

function lerpColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

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

// ── Component ──────────────────────────────────────────────────────────────

export function LowHealthPulse() {
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

  return (
    <div className="space-y-4" data-testid="low-health-pulse-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg relative overflow-hidden"
            style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_10}` }}
          >
            <Heart className="w-4 h-4" style={{ color: STATUS_ERROR }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">Low-Health Pulse</h3>
            <p className="text-2xs text-text-muted">UARPGHUDWidget sine-wave color oscillation</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            data-testid="pulse-play-pause-btn"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <Pause className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <Play className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            data-testid="pulse-reset-btn"
            title="Reset to C++ defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ── Left column: Live preview + Health bar ── */}
        <SurfaceCard level={2} className="p-4 space-y-4">
          {/* Live health bar preview */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Live Preview</div>

            {/* Simulated health bar */}
            <div className="relative h-7 rounded-md overflow-hidden bg-black/60 border border-border/60">
              <div
                className="h-full rounded-md transition-[width] duration-200"
                style={{
                  width: `${healthPct * 100}%`,
                  backgroundColor: currentCSS,
                  boxShadow: isLow ? `0 0 12px ${currentCSS}, inset 0 0 8px ${currentCSS}` : 'none',
                }}
                data-testid="pulse-health-bar"
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {Math.round(healthPct * 100)}%
              </span>
            </div>

            {/* Threshold marker */}
            <div className="relative h-2">
              <div
                className="absolute top-0 h-2 w-px"
                style={{
                  left: `${threshold * 100}%`,
                  backgroundColor: STATUS_WARNING,
                  boxShadow: `0 0 4px ${STATUS_WARNING}`,
                }}
              />
              <span
                className="absolute text-2xs font-mono"
                style={{
                  left: `${threshold * 100}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                  color: STATUS_WARNING,
                }}
              >
                {Math.round(threshold * 100)}%
              </span>
            </div>
          </div>

          {/* Health slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Health %</span>
              <span className="text-xs font-mono font-bold" style={{ color: isLow ? dangerCSS : healthyCSS }}>
                {Math.round(healthPct * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(healthPct * 100)}
              onChange={(e) => setHealthPct(Number(e.target.value) / 100)}
              className="w-full accent-current h-1.5 rounded-full appearance-none bg-border cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                accentColor: isLow ? dangerCSS : healthyCSS,
              }}
              data-testid="health-pct-slider"
            />
          </div>

          {/* Color endpoints */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-black/30 border border-border/40">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: healthyCSS }} />
              <div>
                <div className="text-2xs font-bold text-text">Healthy</div>
                <div className="text-2xs font-mono text-text-muted">(0.1, 0.8, 0.1)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-black/30 border border-border/40">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: dangerCSS }} />
              <div>
                <div className="text-2xs font-bold text-text">Danger</div>
                <div className="text-2xs font-mono text-text-muted">(0.9, 0.1, 0.1)</div>
              </div>
            </div>
          </div>

          {/* Current interpolated color */}
          {isLow && (
            <div className="flex items-center gap-2 p-2 rounded-md border border-border/40" style={{ backgroundColor: `${currentCSS}10` }}>
              <div
                className="w-5 h-5 rounded"
                style={{ backgroundColor: currentCSS, boxShadow: `0 0 8px ${currentCSS}` }}
              />
              <div>
                <div className="text-2xs font-bold text-text">Current Color</div>
                <div className="text-2xs font-mono text-text-muted">
                  Alpha: {alpha.toFixed(2)} &middot; Lerp(Danger, Healthy, {alpha.toFixed(2)})
                </div>
              </div>
            </div>
          )}
        </SurfaceCard>

        {/* ── Right column: Timing diagram + Parameters ── */}
        <SurfaceCard level={2} className="p-4 space-y-4">
          {/* Timing diagram */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Pulse Timing Diagram</div>
            <div className="text-2xs text-text-muted">
              1 cycle = {(1 / pulseSpeed).toFixed(2)}s &middot; sin(t &times; {pulseSpeed.toFixed(1)} &times; 2&pi;)
            </div>

            <div className="relative bg-black/40 rounded-lg border border-border/40 p-3">
              <svg viewBox="-8 -8 116 116" className="w-full h-32" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="0" x2="100" y2="0" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1,3" />
                <line x1="0" y1="100" x2="100" y2="100" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1,3" />
                <line x1="25" y1="0" x2="25" y2="100" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1,3" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1,3" />
                <line x1="75" y1="0" x2="75" y2="100" stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1,3" />

                {/* Sine wave path */}
                <path
                  d={diagramPath}
                  fill="none"
                  stroke="url(#pulse-grad)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Gradient for the sine wave */}
                <defs>
                  <linearGradient id="pulse-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={healthyCSS} />
                    <stop offset="50%" stopColor={STATUS_WARNING} />
                    <stop offset="100%" stopColor={dangerCSS} />
                  </linearGradient>
                </defs>

                {/* Playhead dot */}
                {isLow && playing && (
                  <circle
                    cx={cyclePhase * 100}
                    cy={(1 - alpha) * 100}
                    r="3"
                    fill={currentCSS}
                    stroke="white"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    style={{
                      filter: `drop-shadow(0 0 4px ${currentCSS})`,
                    }}
                  />
                )}

                {/* Y-axis labels */}
                <text x="-6" y="3" fontSize="6" fill={healthyCSS} textAnchor="end" dominantBaseline="middle" fontFamily="monospace">G</text>
                <text x="-6" y="103" fontSize="6" fill={dangerCSS} textAnchor="end" dominantBaseline="middle" fontFamily="monospace">R</text>

                {/* X-axis labels */}
                <text x="0" y="110" fontSize="5" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">0</text>
                <text x="25" y="110" fontSize="5" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">&frac14;</text>
                <text x="50" y="110" fontSize="5" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">&frac12;</text>
                <text x="75" y="110" fontSize="5" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">&frac34;</text>
                <text x="100" y="110" fontSize="5" fill="var(--text-muted)" textAnchor="middle" fontFamily="monospace">1</text>
              </svg>

              {/* Time label below */}
              <div className="text-center text-2xs text-text-muted mt-1">
                cycle position (0 &rarr; 1)
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-text-muted uppercase tracking-widest">Parameters</div>

            {/* Threshold */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">LowHealthThreshold</span>
                <span className="text-xs font-mono font-bold" style={{ color: STATUS_WARNING }}>
                  {(threshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={75}
                step={1}
                value={Math.round(threshold * 100)}
                onChange={(e) => setThreshold(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ accentColor: STATUS_WARNING }}
                data-testid="threshold-slider"
              />
              <div className="text-2xs text-text-muted font-mono">UPROPERTY float LowHealthThreshold = {threshold.toFixed(2)}f;</div>
            </div>

            {/* Pulse speed */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">LowHealthPulseSpeed</span>
                <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>
                  {pulseSpeed.toFixed(1)} Hz
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.1}
                value={pulseSpeed}
                onChange={(e) => setPulseSpeed(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
                style={{ accentColor: STATUS_SUCCESS }}
                data-testid="pulse-speed-slider"
              />
              <div className="text-2xs text-text-muted font-mono">UPROPERTY float LowHealthPulseSpeed = {pulseSpeed.toFixed(1)}f;</div>
            </div>
          </div>

          {/* Formula reference */}
          <SurfaceCard level={2} className="p-2.5 space-y-1">
            <div className="text-2xs font-bold text-text-muted uppercase tracking-widest">C++ Formula</div>
            <code className="block text-2xs font-mono text-text-muted leading-relaxed whitespace-pre-wrap">
{`Alpha = (sin(PulseTime * ${pulseSpeed.toFixed(1)} * 2*PI) + 1) * 0.5
Color = Lerp(LowHealthColor, HealthBarColor, Alpha)
// Trigger: HealthPct < ${(threshold * 100).toFixed(0)}% && > 0%`}
            </code>
          </SurfaceCard>
        </SurfaceCard>
      </div>
    </div>
  );
}
