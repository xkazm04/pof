'use client';

import { AlertTriangle } from 'lucide-react';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS,
  ACCENT_ORANGE,
  OPACITY_8, OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  ENV_HAZARDS, HAZARD_TYPE_COLORS, HAZARD_WARNING_COLORS,
  ZONE_DANGER_SCORES,
} from '../_shared/data';

export function HazardMap() {
  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <SectionHeader icon={AlertTriangle} label="Environmental Hazard Map" color={ACCENT_ORANGE} />

      {/* Danger Score Summary */}
      <div className="flex flex-wrap gap-2 mb-2.5 pb-3 border-b border-border/40">
        {ZONE_DANGER_SCORES.map((zds) => {
          const dangerColor = zds.score >= 80 ? STATUS_ERROR : zds.score >= 50 ? ACCENT_ORANGE : zds.score >= 20 ? STATUS_WARNING : STATUS_SUCCESS;
          return (
            <div key={zds.zone} className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em]">
              <span className="text-text-muted">{zds.zone}:</span>
              <span className="font-bold px-1 py-0.5 rounded" style={{ color: dangerColor, backgroundColor: withOpacity(dangerColor, OPACITY_8) }}>
                {zds.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hazard Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Zone</th>
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Type</th>
              <th className="text-right py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">DPS</th>
              <th className="text-right py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Area</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Warning</th>
            </tr>
          </thead>
          <tbody>
            {ENV_HAZARDS.map((hazard, i) => {
              const typeColor = HAZARD_TYPE_COLORS[hazard.type];
              const warnColor = HAZARD_WARNING_COLORS[hazard.warningLevel];
              return (
                <tr key={i} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                  <td className="py-2 px-2 text-text">{hazard.zone}</td>
                  <td className="py-2 px-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: withOpacity(typeColor, OPACITY_8), color: typeColor, border: `1px solid ${withOpacity(typeColor, OPACITY_20)}` }}>
                      {hazard.type}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: hazard.damagePerSec >= 35 ? STATUS_ERROR : STATUS_WARNING }}>
                    {hazard.damagePerSec}
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">{hazard.affectedArea}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: withOpacity(warnColor, OPACITY_8), color: warnColor, border: `1px solid ${withOpacity(warnColor, OPACITY_20)}` }}>
                      {hazard.warningLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BlueprintPanel>
  );
}
