'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { motionSafe } from '@/lib/motion';
import type { DetectedEntity } from '../_shared/data';
import { ACCENT_CYAN, OVERLAY_WHITE, withOpacity, OPACITY_25, OPACITY_12, OPACITY_50, OPACITY_4, OPACITY_30 } from '@/lib/chart-colors';

interface PerceptionConeVizProps {
  entities: DetectedEntity[];
  accent?: string;
}

/**
 * Tracks whether `ref` is currently on screen via IntersectionObserver so the
 * infinite radar/pulse loops can be parked while scrolled out of view (the
 * AI-Logic tab is a long scroll). Defaults to `true` — on SSR, first paint, or
 * any environment without IntersectionObserver (e.g. jsdom) the element is
 * treated as visible, so rendered markup + animation are unchanged from before.
 */
function useIsOnScreen(ref: React.RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

// Geometry shared by the static diagram and the live sweep (AI eye at centre).
const CX = 65;
const CY = 65;
const CONE_R = 56.9;   // sight radius (1500cm, scaled)
// The beam oscillates ±26° — just inside the 60° cone's ±30° edges.
const SWEEP_DEG = 26;

export function PerceptionConeViz({ entities, accent = ACCENT_CYAN }: PerceptionConeVizProps) {
  // null (SSR / first paint) is treated as "animate" so the rendered markup is
  // identical on server and client — only the `transition` flips under reduced
  // motion, keeping hydration stable (see motionSafe).
  const prefersReduced = useReducedMotion();
  // Unique gradient id so multiple cones on a page never collide.
  const sweepGrad = `${useId()}-sweep`;

  // Park the perpetual sweep/pulse loops while the SVG is scrolled off-screen.
  // When visible, animation is exactly as before; off-screen it rests on a
  // static frame (rotate 0 / scale 1) with no `repeat`, freeing the rAF loop.
  const svgRef = useRef<SVGSVGElement>(null);
  const onScreen = useIsOnScreen(svgRef);

  return (
    <svg ref={svgRef} width={200} height={200} viewBox="0 0 130 130" className="flex-shrink-0">
      <defs>
        {/* Beam fades from bright at the AI eye to nothing at its reach. */}
        <linearGradient id={sweepGrad} gradientUnits="userSpaceOnUse" x1={CX} y1={CY} x2={CX} y2={CY - CONE_R}>
          <stop offset="0" stopColor={accent} stopOpacity={0.55} />
          <stop offset="1" stopColor={accent} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Background grid */}
      {[32.5, 65, 97.5].map(r => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_4)} strokeWidth="1" />
      ))}
      {/* Hearing circle (800cm radius - scaled) */}
      <circle cx={CX} cy={CY} r={44.7} fill="none" stroke={withOpacity(accent, OPACITY_25)} strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Sight cone: 60 degrees, pointing up */}
      <path
        d={`M ${CX} ${CY} L ${CX + CONE_R * Math.cos(-Math.PI / 2 - Math.PI / 6)} ${CY + CONE_R * Math.sin(-Math.PI / 2 - Math.PI / 6)} A ${CONE_R} ${CONE_R} 0 0 1 ${CX + CONE_R * Math.cos(-Math.PI / 2 + Math.PI / 6)} ${CY + CONE_R * Math.sin(-Math.PI / 2 + Math.PI / 6)} Z`}
        fill={withOpacity(accent, OPACITY_12)} stroke={withOpacity(accent, OPACITY_50)} strokeWidth="1.5"
      />

      {/* Radar sweep: a beam that scans across the cone on a ~4s loop, pivoting
          on the AI eye. Under reduced motion it rests as a static sight-line. */}
      <motion.g
        data-testid="perception-sweep"
        style={{ transformBox: 'view-box', transformOrigin: `${CX}px ${CY}px` }}
        animate={onScreen ? { rotate: [-SWEEP_DEG, SWEEP_DEG] } : { rotate: 0 }}
        transition={onScreen ? motionSafe(
          { duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' } as const,
          prefersReduced,
        ) : { duration: 0 }}
      >
        <line x1={CX} y1={CY} x2={CX} y2={CY - CONE_R} stroke={`url(#${sweepGrad})`} strokeWidth="2.5" strokeLinecap="round" />
      </motion.g>

      {/* AI center glow */}
      <circle cx={CX} cy={CY} r={5} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
      <text x={CX} y={77.2} textAnchor="middle" className="text-xs font-mono font-bold" fill={accent}>AI</text>

      {/* Detected entities — anything in the cone or hearing radius emits a soft
          detection pulse (faster when actually seen). */}
      {entities.map(e => {
        const detected = e.inCone || e.inHearing;
        return (
          <g key={e.label}>
            {detected && (
              <motion.circle
                data-testid="perception-pulse"
                cx={e.x} cy={e.y} r={5.5} fill="none" stroke={e.color} strokeWidth="1.5"
                style={{ transformOrigin: 'center' }}
                animate={onScreen ? { scale: [1, 1.9, 1], opacity: [0.55, 0, 0.55] } : { scale: 1, opacity: 0.55 }}
                transition={onScreen ? motionSafe(
                  { duration: e.inCone ? 1.8 : 2.6, repeat: Infinity, ease: 'easeInOut' } as const,
                  prefersReduced,
                ) : { duration: 0 }}
              />
            )}
            <circle cx={e.x} cy={e.y} r={4} fill={e.color} style={{ filter: `drop-shadow(0 0 4px ${e.color})` }} />
            <text x={e.x} y={e.y - 8} textAnchor="middle" className="text-xs font-mono font-bold" fill={e.color}>{e.label}</text>
          </g>
        );
      })}

      {/* Range labels */}
      <text x={CX} y={17.9} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>1500cm</text>
      <text x={111.3} y={CY} textAnchor="middle" className="text-xs font-mono" fill={withOpacity(OVERLAY_WHITE, OPACITY_30)}>800cm</text>
    </svg>
  );
}
