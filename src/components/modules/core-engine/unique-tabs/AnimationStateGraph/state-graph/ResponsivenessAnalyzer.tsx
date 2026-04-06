'use client';

import { AlertTriangle } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_25, GLOW_SM,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../_design';
import {
  ACCENT, RESPONSIVENESS_RESULTS, getGrade,
  type AnimStateName,
} from '../data';

export function ResponsivenessAnalyzer() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4 col-span-full">
      <SectionHeader label="Predictive Responsiveness Analyzer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1 mb-3">
        Input-to-visual response latency computed from transition rules, montage durations, cancel windows, and blend weights.
        Based on <span className="font-mono text-text">UARPGAnimInstance</span> transition booleans.
      </p>
      <div className="space-y-3">
        {/* Summary gauges */}
        <div className="grid grid-cols-4 gap-2">
          {(['Locomotion', 'Attacking', 'Dodging', 'HitReact'] as AnimStateName[]).map((state, idx) => {
            const stateResults = RESPONSIVENESS_RESULTS.filter(r => r.from === state);
            if (stateResults.length === 0) return null;
            const avgAll = stateResults.reduce((s, r) => s + r.avgCase, 0) / stateResults.length;
            const grade = getGrade(avgAll);
            return (
              <GlowStat
                key={state}
                label={state}
                value={`${(avgAll * 1000).toFixed(0)}ms`}
                unit={grade.label}
                color={grade.color}
                delay={idx * 0.05}
              />
            );
          })}
        </div>

        <ResponsivenessTable />
        <LatencyBarChart />
      </div>
    </BlueprintPanel>
  );
}

/* ── Detail Table ──────────────────────────────────────────────────────────── */

function ResponsivenessTable() {
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-1.5 pr-3 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Action</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Best</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Avg</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Worst</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted text-center">Grade</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Frames</th>
            <th className="py-1.5 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Gate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {RESPONSIVENESS_RESULTS.map((r, i) => {
            const grade = getGrade(r.avgCase);
            return (
              <tr key={i} className="hover:bg-surface/30 transition-colors">
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    {r.exceedsNorm && <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_WARNING }} />}
                    <span className="font-mono text-text">{r.action}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-center font-mono" style={{ color: getGrade(r.bestCase).color }}>
                  {(r.bestCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center font-mono font-bold" style={{ color: grade.color }}>
                  {(r.avgCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center font-mono" style={{ color: getGrade(r.worstCase).color }}>
                  {(r.worstCase * 1000).toFixed(0)}ms
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span
                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: withOpacity(grade.color, OPACITY_8), color: grade.color, border: `1px solid ${withOpacity(grade.color, OPACITY_20)}` }}
                  >
                    {grade.label}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-xs font-mono text-text-muted">{r.frameRange}</td>
                <td className="py-1.5 px-2">
                  <span className="text-xs font-mono px-1 py-0.5 rounded bg-surface-deep border border-border/30 text-text-muted">
                    {r.gateBool}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Latency Bar Chart ─────────────────────────────────────────────────────── */

function LatencyBarChart() {
  return (
    <div className="space-y-1">
      <div className="text-xs font-mono font-bold text-text-muted uppercase tracking-[0.15em]">
        Response Latency Comparison
      </div>
      {RESPONSIVENESS_RESULTS.map((r, i) => {
        const maxMs = 600;
        const barPct = Math.min((r.avgCase * 1000 / maxMs) * 100, 100);
        const bestPct = Math.min((r.bestCase * 1000 / maxMs) * 100, 100);
        const worstPct = Math.min((r.worstCase * 1000 / maxMs) * 100, 100);
        const normPct = Math.min((r.normThreshold * 1000 / maxMs) * 100, 100);
        const grade = getGrade(r.avgCase);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-muted w-36 truncate" title={r.action}>{r.action}</span>
            <div className="flex-1 relative h-4 rounded bg-surface-deep">
              <div
                className="absolute top-0 h-full rounded opacity-20"
                style={{ left: `${bestPct}%`, width: `${worstPct - bestPct}%`, backgroundColor: grade.color }}
              />
              <div
                className="absolute top-0.5 h-3 rounded-sm"
                style={{ width: `${barPct}%`, backgroundColor: grade.color, boxShadow: `${GLOW_SM} ${withOpacity(grade.color, OPACITY_25)}` }}
              />
              <div
                className="absolute top-0 w-[2px] h-full"
                style={{ left: `${normPct}%`, backgroundColor: STATUS_WARNING }}
                title={`Genre norm: ${r.normThreshold * 1000}ms`}
              />
            </div>
            <span className="text-xs font-mono w-12 text-right" style={{ color: grade.color }}>
              {(r.avgCase * 1000).toFixed(0)}ms
            </span>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_SUCCESS }} /> &lt;100ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_WARNING }} /> 100-250ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> &gt;500ms
        </span>
        <span className="flex items-center gap-1">
          <span className="w-[2px] h-3" style={{ backgroundColor: STATUS_WARNING }} /> Genre norm
        </span>
      </div>
    </div>
  );
}
