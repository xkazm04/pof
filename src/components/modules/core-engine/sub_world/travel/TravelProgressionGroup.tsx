'use client';

import { useState, useMemo } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_CYAN, ACCENT_ORANGE,
  OPACITY_8, OPACITY_20, OPACITY_25,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { COMPARE_ZONE_NAMES, buildZoneComparisons } from '../_shared/helpers';
import { FastTravelNetwork } from './FastTravelNetwork';
import { ProgressionTimeline } from './ProgressionTimeline';

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
