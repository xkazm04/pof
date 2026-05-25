'use client';

import type { ReverbPreset } from '@/types/audio-scene';

// ── Glyph geometry — a compact 28×14 inline SVG decay curve ──
const GLYPH_W = 28;
const GLYPH_H = 14;
const PAD = 1.5;
const SAMPLES = 26;

/** Acoustic signature of a reverb preset, used to draw its decay glyph. */
export interface ReverbAcoustic {
  /** Normalised tail length 0..1 — how far audible energy extends across the glyph. */
  decay: number;
  /** Initial amplitude 0..1 at the attack transient. */
  initial: number;
  /** Ripple oscillations across the tail (low-pass undulation / metallic flutter). */
  rippleFreq?: number;
  /** Ripple depth 0..1. */
  rippleAmp?: number;
  /** Diffuse scatter 0..1 — irregular reflections (forest). */
  jitter?: number;
}

/**
 * Per-preset acoustic signatures. Decay = how long the tail rings; ripple =
 * undulating/metallic resonance; jitter = scattered diffuse reflections.
 */
const ACOUSTICS: Record<ReverbPreset, ReverbAcoustic> = {
  'none': { decay: 0.05, initial: 1 },
  'small-room': { decay: 0.2, initial: 1 },
  'large-hall': { decay: 0.9, initial: 1 },
  'cave': { decay: 1, initial: 1, rippleFreq: 1.5, rippleAmp: 0.12 },
  'outdoor': { decay: 0.24, initial: 0.55 },
  'underwater': { decay: 0.6, initial: 0.7, rippleFreq: 2.4, rippleAmp: 0.3 },
  'metal-corridor': { decay: 0.72, initial: 0.95, rippleFreq: 6.5, rippleAmp: 0.42 },
  'stone-chamber': { decay: 0.55, initial: 0.9, rippleFreq: 2, rippleAmp: 0.1 },
  'forest': { decay: 0.42, initial: 0.6, jitter: 0.2 },
  'custom': { decay: 0.5, initial: 0.85 },
};

/** Deterministic pseudo-noise in [0,1) for stable diffuse scatter. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Resolve a preset's acoustic signature. For 'custom', the zone's actual
 * decay time (seconds) maps onto the normalised tail length.
 */
export function reverbDecaySignature(preset: ReverbPreset, decayTimeSeconds?: number): ReverbAcoustic {
  const base = ACOUSTICS[preset] ?? ACOUSTICS.custom;
  if (preset === 'custom' && typeof decayTimeSeconds === 'number') {
    return { ...base, decay: Math.min(1, Math.max(0.05, decayTimeSeconds / 8)) };
  }
  return base;
}

/** Amplitude envelope a(t) for t in [0,1], clamped to [0,1]. */
function amplitudeAt(t: number, sig: ReverbAcoustic, sampleIndex: number): number {
  const k = 4 / Math.max(sig.decay, 0.001);
  let amp = sig.initial * Math.exp(-t * k);
  if (sig.rippleFreq && sig.rippleAmp) {
    amp *= 1 + sig.rippleAmp * Math.sin(t * sig.rippleFreq * Math.PI * 2);
  }
  if (sig.jitter) {
    amp += sig.jitter * (noise(sampleIndex) - 0.5);
  }
  return Math.min(1, Math.max(0, amp));
}

/**
 * Build SVG geometry for a decay glyph. Returns the stroked envelope `line`
 * and a closed `area` (filled under the curve). Coordinates fit 28×14.
 */
export function reverbDecayGeometry(sig: ReverbAcoustic): { line: string; area: string } {
  const baseline = GLYPH_H - PAD;
  const usableW = GLYPH_W - PAD * 2;
  const usableH = GLYPH_H - PAD * 2;

  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const amp = amplitudeAt(t, sig, i);
    const x = PAD + t * usableW;
    const y = PAD + (1 - amp) * usableH;
    pts.push([x, y]);
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  // Sharp attack: rise from baseline to the first peak, then the decaying tail.
  const line =
    `M ${r(pts[0][0])} ${r(baseline)} ` +
    `L ${r(pts[0][0])} ${r(pts[0][1])} ` +
    pts.slice(1).map(([x, y]) => `L ${r(x)} ${r(y)}`).join(' ');
  const area = `${line} L ${r(pts[pts.length - 1][0])} ${r(baseline)} Z`;
  return { line, area };
}

interface ReverbDecayGlyphProps {
  preset: ReverbPreset;
  color: string;
  /** Zone decay time (seconds) — only consulted for the 'custom' preset. */
  decayTimeSeconds?: number;
  className?: string;
}

/**
 * Inline 28×14 SVG that renders a reverb preset's acoustic decay signature.
 * On hover (via the parent `.group`), the stroked envelope redraws from
 * t=0 → t=decay so the eye can feel the tail length before clicking.
 */
export function ReverbDecayGlyph({ preset, color, decayTimeSeconds, className }: ReverbDecayGlyphProps) {
  const sig = reverbDecaySignature(preset, decayTimeSeconds);
  const { line, area } = reverbDecayGeometry(sig);
  // Longer tails take longer to redraw on hover, so the eye feels the length.
  const drawDuration = 0.28 + sig.decay * 0.9;

  return (
    <svg
      width={GLYPH_W}
      height={GLYPH_H}
      viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`}
      className={className}
      aria-hidden="true"
      data-preset={preset}
      style={{ overflow: 'visible', '--reverb-dur': `${drawDuration.toFixed(2)}s` } as React.CSSProperties}
    >
      {/* baseline */}
      <line
        x1={PAD}
        y1={GLYPH_H - PAD}
        x2={GLYPH_W - PAD}
        y2={GLYPH_H - PAD}
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={0.5}
      />
      {/* energy under the curve */}
      <path d={area} fill={color} fillOpacity={0.16} stroke="none" />
      {/* decay envelope — animated on hover via .reverb-glyph-path */}
      <path
        className="reverb-glyph-path"
        d={line}
        fill="none"
        stroke={color}
        strokeOpacity={0.95}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={100}
      />
    </svg>
  );
}
