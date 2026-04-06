'use client';

import { useState, useMemo } from 'react';
import {
  Zap, ArrowRight, ArrowRightLeft, Timer, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_PINK,
  OPACITY_8, OPACITY_15, OPACITY_20, OPACITY_25, OPACITY_37,
  withOpacity,
  OPACITY_22,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import {
  FAST_TRAVEL_NODES, FAST_TRAVEL_COVERAGE,
  ZONE_PROGRESSION, TOTAL_ESTIMATED_DAYS, CURRENT_DAY,
} from '../data';
import { COMPARE_ZONE_NAMES, buildZoneComparisons } from '../helpers';

const ACCENT = ACCENT_CYAN;

export function TravelProgressionGroup() {
  const [compareA, setCompareA] = useState(0);
  const [compareB, setCompareB] = useState(2);
  const comparisons = useMemo(
    () => buildZoneComparisons(COMPARE_ZONE_NAMES[compareA], COMPARE_ZONE_NAMES[compareB]),
    [compareA, compareB],
  );

  return (
    <>
      <FastTravelNetwork />
      <ProgressionTimeline />

      {/* Zone Comparison */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader icon={ArrowRightLeft} label="Zone Comparison" color={ACCENT} />

        {/* Zone Selectors */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold mb-1">Zone A</div>
            <select
              value={compareA}
              onChange={e => setCompareA(Number(e.target.value))}
              className="w-full bg-surface-deep border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none"
              style={{ borderColor: withOpacity(ACCENT, OPACITY_25) }}
            >
              {COMPARE_ZONE_NAMES.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold mb-1">Zone B</div>
            <select
              value={compareB}
              onChange={e => setCompareB(Number(e.target.value))}
              className="w-full bg-surface-deep border rounded-lg px-3 py-2 text-xs font-mono text-text focus:outline-none"
              style={{ borderColor: withOpacity(ACCENT_ORANGE, OPACITY_25) }}
            >
              {COMPARE_ZONE_NAMES.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {compareA === compareB ? (
          <div className="text-xs text-text-muted text-center py-4 italic opacity-70">Select two different zones to compare</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Stat</th>
                  <th className="text-right py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: ACCENT }}>
                    {COMPARE_ZONE_NAMES[compareA]}
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Delta</th>
                  <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: ACCENT_ORANGE }}>
                    {COMPARE_ZONE_NAMES[compareB]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map(row => {
                  const delta = row.valueB - row.valueA;
                  let deltaColor = STATUS_LOCKED;
                  if (delta !== 0 && row.higherIsBetter !== undefined) {
                    deltaColor = (row.higherIsBetter ? delta > 0 : delta < 0) ? STATUS_SUCCESS : STATUS_ERROR;
                  }
                  return (
                    <tr key={row.stat} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                      <td className="py-2 px-2 text-text-muted font-bold">{row.stat}</td>
                      <td className="py-2 px-2 text-right font-bold text-text">
                        {row.valueA}{row.unit ? ` ${row.unit}` : ''}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-xs font-bold min-w-[3rem]"
                          style={{
                            backgroundColor: delta !== 0 ? withOpacity(deltaColor, OPACITY_8) : 'transparent',
                            color: deltaColor,
                            border: `1px solid ${withOpacity(deltaColor, OPACITY_20)}`,
                          }}
                        >
                          {delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${delta}`}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-left font-bold text-text">
                        {row.valueB}{row.unit ? ` ${row.unit}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BlueprintPanel>
    </>
  );
}

/* ── Fast Travel Network ──────────────────────────────────────────────── */

function FastTravelNetwork() {
  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={Zap} label="Fast Travel Network" color={ACCENT} />

      {/* Coverage Summary */}
      <div className="flex flex-wrap gap-2 mb-2.5 pb-3 border-b border-border/40">
        {FAST_TRAVEL_COVERAGE.map((ftc) => (
          <div key={ftc.zone} className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em]">
            <span className="text-text-muted">{ftc.zone}:</span>
            <span className="font-bold" style={{ color: ftc.pct === 100 ? STATUS_SUCCESS : ftc.pct > 0 ? STATUS_WARNING : STATUS_LOCKED }}>
              {ftc.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Travel Nodes */}
      <div className="space-y-3">
        {FAST_TRAVEL_NODES.map((node) => (
          <div key={node.name} className="bg-surface-deep rounded-lg p-3 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" style={{ color: node.discovered ? ACCENT : STATUS_LOCKED }} />
                <span className="text-xs font-bold text-text">{node.name}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">({node.zone})</span>
              </div>
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: node.discovered ? STATUS_SUCCESS : STATUS_LOCKED,
                  backgroundColor: node.discovered ? withOpacity(STATUS_SUCCESS, OPACITY_8) : 'transparent',
                  border: `1px solid ${withOpacity(node.discovered ? STATUS_SUCCESS : STATUS_LOCKED, OPACITY_20)}`,
                }}>
                {node.discovered ? 'Discovered' : 'Undiscovered'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {node.travelTimes.map((tt) => (
                <span key={tt.to} className="flex items-center gap-1 text-xs font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface/50 border border-border/30">
                  <ArrowRight className="w-2.5 h-2.5" />
                  {tt.to}
                  <Timer className="w-2.5 h-2.5 ml-1 opacity-50" />
                  <span className="font-bold" style={{ color: ACCENT }}>{tt.seconds}s</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlueprintPanel>
  );
}

/* ── Zone Progression Timeline ────────────────────────────────────────── */

function ProgressionTimeline() {
  return (
    <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
      <SectionHeader icon={Clock} label="Zone Progression Timeline" color={ACCENT_EMERALD} />

      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
        Day <span className="font-bold" style={{ color: ACCENT_PINK }}>{CURRENT_DAY}</span> / {TOTAL_ESTIMATED_DAYS} estimated
      </div>

      <div className="relative">
        <div
          className="absolute top-0 bottom-0 w-[2px] z-10"
          style={{
            left: `${(CURRENT_DAY / TOTAL_ESTIMATED_DAYS) * 100}%`,
            backgroundColor: ACCENT_PINK,
            boxShadow: `0 0 6px ${withOpacity(ACCENT_PINK, OPACITY_37)}`,
          }}
        />

        <div className="space-y-3">
          {ZONE_PROGRESSION.map((zp) => {
            const started = zp.firstVisitDay >= 0;
            const startPct = started ? (zp.firstVisitDay / TOTAL_ESTIMATED_DAYS) * 100 : 0;
            const endDay = zp.completionDay ?? CURRENT_DAY;
            const widthPct = started ? ((endDay - zp.firstVisitDay) / TOTAL_ESTIMATED_DAYS) * 100 : 0;
            const gradientColor = zp.completionPct === 100 ? STATUS_SUCCESS
              : zp.completionPct >= 50 ? STATUS_WARNING
                : zp.completionPct > 0 ? ACCENT_ORANGE : STATUS_LOCKED;

            return (
              <div key={zp.zone} className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate text-right flex-shrink-0">{zp.zone}</span>
                <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                  {started ? (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6 }}
                      className="absolute top-0 bottom-0 rounded-md flex items-center justify-center"
                      style={{
                        left: `${startPct}%`,
                        backgroundColor: `${withOpacity(gradientColor, OPACITY_22)}`,
                        border: `1px solid ${withOpacity(gradientColor, OPACITY_37)}`,
                      }}
                    >
                      <span className="text-xs font-mono font-bold" style={{ color: gradientColor }}>
                        {zp.completionPct}%
                      </span>
                    </motion.div>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-text-muted opacity-40">
                      Not visited
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day axis */}
        <div className="flex items-center gap-3 mt-2">
          <span className="w-28 flex-shrink-0" />
          <div className="flex-1 flex justify-between text-xs font-mono text-text-muted px-1">
            {Array.from({ length: Math.ceil(TOTAL_ESTIMATED_DAYS / 2) + 1 }, (_, i) => (
              <span key={i}>{i * 2}d</span>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
