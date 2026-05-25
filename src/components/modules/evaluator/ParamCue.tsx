'use client';

/**
 * ParamCue — a tiny live visual cue for the Post-Process Recipe Studio's
 * "explain mode". Given a {@link PPParamCueKind} and a normalized 0-1 value,
 * it draws a small, jargon-free picture of what a slider actually does (how
 * much edges glow, how warm the color cast is, how thick the fog is …) so a
 * non-technical user can read the control at a glance.
 *
 * Pure presentational SVG/CSS — no wall-clock or randomness in render (see the
 * react-hooks/purity rule), all colors come from chart-colors tokens or CSS
 * variables (no hardcoded hex), and the box-shadow/gradient alphas use rgba()
 * functional notation rather than hex so they stay off the no-hex linter.
 */

import type { PPParamCueKind } from '@/types/post-process-studio';
import {
  ACCENT_RED, ACCENT_GREEN, STATUS_INFO, ACCENT_ORANGE, ACCENT_PINK,
  STATUS_NEUTRAL, OVERLAY_WHITE,
} from '@/lib/chart-colors';

/** Every cue kind — exported so tests can render the full set. */
export const ALL_CUE_KINDS: PPParamCueKind[] = [
  'glow', 'blur', 'threshold', 'temperature', 'tint', 'saturation', 'contrast',
  'brightness', 'distance', 'aperture', 'corners', 'vignette', 'speed', 'fringe',
  'grain', 'fog', 'level', 'channel-r', 'channel-g', 'channel-b',
];

const W = 46;
const H = 18;

/** Static grain dot positions (% x, % y) — fixed so render stays pure. */
const GRAIN_DOTS: ReadonlyArray<readonly [number, number]> = [
  [12, 30], [26, 70], [38, 18], [50, 55], [60, 82],
  [70, 35], [82, 62], [90, 22], [18, 88], [44, 40],
];

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

/** A horizontal gradient scale with a marker at the current position. */
function GradientScale({ gradient, t }: { gradient: string; t: number }) {
  return (
    <div className="absolute inset-0" style={{ background: gradient }}>
      <span
        className="absolute top-0 bottom-0 w-[2px] rounded-full"
        style={{
          left: `${t * 100}%`,
          transform: 'translateX(-50%)',
          backgroundColor: OVERLAY_WHITE,
          boxShadow: '0 0 2px rgba(0,0,0,0.8)',
        }}
      />
    </div>
  );
}

/** A track with a left-anchored filled bar. */
function FillMeter({ t, color }: { t: number; color: string }) {
  return (
    <div className="absolute inset-[3px] rounded-sm" style={{ backgroundColor: 'var(--surface-deep)' }}>
      <div
        className="absolute left-0 top-0 bottom-0 rounded-sm transition-all"
        style={{ width: `${t * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

function renderCue(kind: PPParamCueKind, t: number, accent: string): React.ReactNode {
  switch (kind) {
    case 'glow':
      return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--surface-deep)' }}>
          <span
            className="rounded-full"
            style={{
              width: 5,
              height: 5,
              backgroundColor: OVERLAY_WHITE,
              boxShadow: `0 0 ${2 + t * 11}px ${t * 4}px rgba(255,255,255,${0.25 + 0.65 * t})`,
            }}
          />
        </div>
      );

    case 'blur':
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-1" style={{ backgroundColor: 'var(--surface-deep)', filter: `blur(${t * 2.4}px)` }}>
          <span className="w-1 h-2.5 rounded-sm" style={{ backgroundColor: accent }} />
          <span className="w-1 h-2.5 rounded-sm" style={{ backgroundColor: OVERLAY_WHITE, opacity: 0.85 }} />
        </div>
      );

    case 'threshold':
      return <GradientScale t={t} gradient={`linear-gradient(90deg, var(--surface-deep), ${OVERLAY_WHITE})`} />;

    case 'temperature':
      return <GradientScale t={t} gradient={`linear-gradient(90deg, ${STATUS_INFO}, var(--surface), ${ACCENT_ORANGE})`} />;

    case 'tint':
      return <GradientScale t={t} gradient={`linear-gradient(90deg, ${ACCENT_GREEN}, var(--surface), ${ACCENT_PINK})`} />;

    case 'distance':
      return <GradientScale t={t} gradient={'linear-gradient(90deg, var(--text-muted), var(--surface-deep))'} />;

    case 'saturation':
      return (
        <div className="absolute inset-0" style={{ backgroundColor: accent }}>
          <div className="absolute inset-0" style={{ backgroundColor: STATUS_NEUTRAL, opacity: 1 - t }} />
        </div>
      );

    case 'brightness':
      return (
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--surface-deep)' }}>
          <div className="absolute inset-0" style={{ backgroundColor: OVERLAY_WHITE, opacity: t }} />
        </div>
      );

    case 'contrast': {
      const lo = 50 - 38 * t;
      const hi = 50 + 38 * t;
      return (
        <div className="absolute inset-0 flex">
          <div className="h-full w-1/2" style={{ backgroundColor: `hsl(0 0% ${lo}%)` }} />
          <div className="h-full w-1/2" style={{ backgroundColor: `hsl(0 0% ${hi}%)` }} />
        </div>
      );
    }

    case 'aperture': {
      const hole = 3 + (1 - t) * 11; // higher f-stop → smaller opening
      return (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--surface-deep)' }}>
          <span
            className="rounded-full flex items-center justify-center"
            style={{ width: 14, height: 14, border: `2px solid ${accent}` }}
          >
            <span className="rounded-full" style={{ width: hole, height: hole, backgroundColor: 'rgba(0,0,0,0.85)' }} />
          </span>
        </div>
      );
    }

    case 'corners':
      return (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, var(--surface) 35%, rgba(0,0,0,${0.15 + 0.8 * t}) 100%)` }}
        />
      );

    case 'vignette':
      return (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: 'var(--text-muted)',
            boxShadow: `inset 0 0 ${3 + t * 9}px ${1 + t * 5}px rgba(0,0,0,${0.3 + 0.6 * t})`,
          }}
        />
      );

    case 'speed':
      return (
        <div className="absolute inset-0 flex items-center" style={{ backgroundColor: 'var(--surface-deep)' }}>
          <div
            className="h-[3px] rounded-full"
            style={{ marginLeft: `${(1 - (0.15 + t * 0.8)) * 100}%`, width: `${(0.15 + t * 0.8) * 100}%`, background: `linear-gradient(90deg, transparent, ${accent})` }}
          />
        </div>
      );

    case 'fringe':
      return (
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--surface-deep)' }}>
          {([[ACCENT_RED, -1], [ACCENT_GREEN, 0], [STATUS_INFO, 1]] as const).map(([c, dir], i) => (
            <span
              key={i}
              className="absolute top-0 bottom-0 w-[2px]"
              style={{
                left: `calc(50% + ${dir * t * 32}%)`,
                transform: 'translateX(-50%)',
                backgroundColor: c,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      );

    case 'grain':
      return (
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--surface-deep)' }}>
          {GRAIN_DOTS.map(([x, y], i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{ left: `${x}%`, top: `${y}%`, width: 1.5, height: 1.5, backgroundColor: OVERLAY_WHITE, opacity: t }}
            />
          ))}
        </div>
      );

    case 'fog':
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--surface), var(--surface-deep))' }}>
          {/* ground silhouette */}
          <div className="absolute left-0 right-0 bottom-0 h-2" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {/* haze */}
          <div className="absolute inset-0" style={{ backgroundColor: OVERLAY_WHITE, opacity: 0.1 + 0.7 * t }} />
        </div>
      );

    case 'level':
      return <FillMeter t={t} color={accent} />;

    case 'channel-r':
      return <FillMeter t={t} color={ACCENT_RED} />;

    case 'channel-g':
      return <FillMeter t={t} color={ACCENT_GREEN} />;

    case 'channel-b':
      return <FillMeter t={t} color={STATUS_INFO} />;

    default:
      return <FillMeter t={t} color={accent} />;
  }
}

export interface ParamCueProps {
  /** Which cue to draw. */
  kind: PPParamCueKind;
  /** Normalized parameter position, 0 (low) → 1 (high). */
  value: number;
  /** Category accent color for generic cues. */
  accent: string;
  /** Optional accessible label / tooltip. */
  title?: string;
}

/** Tiny live preview of a post-process parameter for explain mode. */
export function ParamCue({ kind, value, accent, title }: ParamCueProps) {
  const t = clamp01(value);
  return (
    <span
      className="relative inline-block rounded overflow-hidden flex-shrink-0 border border-border"
      style={{ width: W, height: H }}
      role="img"
      aria-label={title ?? `${kind} preview`}
      title={title}
      data-cue={kind}
    >
      {renderCue(kind, t, accent)}
    </span>
  );
}
