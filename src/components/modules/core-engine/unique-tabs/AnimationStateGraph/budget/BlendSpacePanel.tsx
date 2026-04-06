'use client';

import { ACCENT_CYAN, OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_25 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, BLEND_CLIPS, BLEND_CURRENT } from '../data';

/** The 3 clips closest to the current blend position — forms the blend triangle. */
const BLEND_TRIANGLE = (() => {
  const scored = BLEND_CLIPS.map(c => ({
    c,
    d: Math.sqrt(((c.x - BLEND_CURRENT.x) / 180) ** 2 + (c.y - BLEND_CURRENT.y) ** 2),
  })).filter(s => s.d > 0);
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, 3).map(s => s.c);
})();

export function BlendSpacePanel() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Blend Space Visualizer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        2D blend space mapping Direction vs Speed. Each dot is an animation clip; the pulsing dot shows the current sampled position.
      </p>
      <div className="flex justify-center min-h-[200px]">
        <svg width={280} height={190} viewBox="0 0 280 190" className="overflow-visible">
          {/* Grid */}
          <rect x={35} y={8} width={228} height={158} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" />
          {[0.25, 0.5, 0.75].map((t) => {
            const yy = 166 - t * 158;
            return <line key={t} x1={35} y1={yy} x2={263} y2={yy} stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="1" />;
          })}
          {[-90, 0, 90].map((deg) => {
            const xx = 35 + ((deg + 180) / 360) * 228;
            return <line key={deg} x1={xx} y1={8} x2={xx} y2={166} stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="1" />;
          })}
          {/* Axis labels */}
          <text x={140} y={184} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">Direction (deg)</text>
          <text x={10} y={87} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]" transform="rotate(-90 10 87)">Speed</text>
          {/* Tick labels - X axis */}
          {[-180, -90, 0, 90, 180].map((deg) => {
            const xx = 35 + ((deg + 180) / 360) * 228;
            return <text key={deg} x={xx} y={177} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]">{deg}</text>;
          })}
          {/* Tick labels - Y axis */}
          {[0, 0.5, 1].map((v) => {
            const yy = 166 - v * 158;
            return <text key={v} x={31} y={yy + 3} textAnchor="end" className="text-xs font-mono fill-[var(--text-muted)]">{v}</text>;
          })}
          {/* Blend triangle connecting 3 nearest clips */}
          {BLEND_TRIANGLE.length === 3 && (
            <polygon
              points={BLEND_TRIANGLE.map(clip => {
                const cx = 35 + ((clip.x + 180) / 360) * 228;
                const cy = 166 - clip.y * 158;
                return `${cx},${cy}`;
              }).join(' ')}
              fill={withOpacity(ACCENT_CYAN, OPACITY_5)}
              stroke={withOpacity(ACCENT_CYAN, OPACITY_25)}
              strokeWidth="1"
              strokeDasharray="4 2"
            />
          )}
          {/* Animation clip dots */}
          {BLEND_CLIPS.map((clip) => {
            const cx = 35 + ((clip.x + 180) / 360) * 228;
            const cy = 166 - clip.y * 158;
            return (
              <g key={clip.name}>
                <circle cx={cx} cy={cy} r={6} fill={withOpacity(ACCENT, OPACITY_25)} stroke={ACCENT} strokeWidth="1.5" />
                <text x={cx} y={cy - 10} textAnchor="middle" className="text-xs font-mono font-bold fill-[var(--text-muted)]">{clip.name}</text>
              </g>
            );
          })}
          {/* Contributing weight lines */}
          {BLEND_CLIPS.filter((c) => {
            const dx = Math.abs(c.x - BLEND_CURRENT.x);
            const dy = Math.abs(c.y - BLEND_CURRENT.y);
            return dx < 100 && dy < 0.4 && (dx + dy * 180) > 0;
          }).map((clip) => {
            const cx = 35 + ((clip.x + 180) / 360) * 228;
            const cy = 166 - clip.y * 158;
            const curX = 35 + ((BLEND_CURRENT.x + 180) / 360) * 228;
            const curY = 166 - BLEND_CURRENT.y * 158;
            return (
              <line key={clip.name} x1={curX} y1={curY} x2={cx} y2={cy}
                stroke={withOpacity(ACCENT, OPACITY_25)} strokeWidth="1" strokeDasharray="3 2" />
            );
          })}
          {/* Current position (pulsing) */}
          {(() => {
            const curX = 35 + ((BLEND_CURRENT.x + 180) / 360) * 228;
            const curY = 166 - BLEND_CURRENT.y * 158;
            return (
              <>
                <circle cx={curX} cy={curY} r={10} fill={withOpacity(ACCENT_CYAN, OPACITY_12)} stroke={ACCENT_CYAN} strokeWidth="1.5">
                  <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={curX} cy={curY} r={3} fill={ACCENT_CYAN} />
                <text x={curX + 14} y={curY + 3} className="text-xs font-mono font-bold" fill={ACCENT_CYAN}>Current</text>
              </>
            );
          })()}
        </svg>
      </div>
    </BlueprintPanel>
  );
}
