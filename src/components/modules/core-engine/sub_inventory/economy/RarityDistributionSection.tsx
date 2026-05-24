'use client';

import { BarChart3 } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_MUTED, OVERLAY_WHITE,
  withOpacity, OPACITY_8, OPACITY_12, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import {
  ACCENT,
  RARITY_DIST, LUCK_SCORE,
} from '../_shared/data';

/* ── Rarity Distribution Section ───────────────────────────────────────── */

export function RarityDistributionSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={BarChart3} label="Rarity Distribution Analyzer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Compare expected vs actual inventory rarity at Level 14.</p>
      <div className="space-y-3">
        {RARITY_DIST.map(r => {
          const maxPct = Math.max(r.expected, r.actual);
          const barScale = maxPct > 0 ? 100 / maxPct : 100;
          return (
            <div key={r.rarity} className="space-y-1">
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="font-bold" style={{ color: r.color, textShadow: `0 0 12px ${withOpacity(r.color, OPACITY_25)}` }}>{r.rarity}</span>
                <span className="text-text-muted">Expected {(r.expected * 100).toFixed(0)}% | Actual {(r.actual * 100).toFixed(0)}%</span>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 space-y-0.5">
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${withOpacity(r.color, OPACITY_8)}` }}>
                    <div className="h-full rounded-full opacity-50" style={{ width: `${r.expected * barScale}%`, backgroundColor: r.color }} />
                  </div>
                  <NeonBar pct={r.actual * barScale} color={r.color} height={8} />
                </div>
                <div className="w-8 flex flex-col items-center justify-center text-xs font-mono">
                  {r.actual > r.expected
                    ? <span style={{ color: STATUS_ERROR }}>{'▲'}</span>
                    : r.actual < r.expected
                      ? <span style={{ color: STATUS_SUCCESS }}>{'▼'}</span>
                      : <span className="text-text-muted">=</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 text-sm font-mono text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm opacity-50" style={{ backgroundColor: STATUS_MUTED }} /> Expected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_MUTED }} /> Actual</span>
        </div>
        {/* Luck Score */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-deep border" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_12)}` }}>
          <div className="relative w-10 h-10">
            <svg width={40} height={40} viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none"
                stroke={LUCK_SCORE >= 80 ? STATUS_SUCCESS : LUCK_SCORE >= 50 ? STATUS_WARNING : STATUS_ERROR}
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - LUCK_SCORE / 100)}`}
                transform="rotate(-90 24 24)" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-mono font-bold text-text">{LUCK_SCORE}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-text">Luck Score</p>
            <p className="text-xs font-mono text-text-muted">Based on deviation from expected rarity distribution at Level 14</p>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
