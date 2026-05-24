'use client';

import { MapPin } from 'lucide-react';
import {
  STATUS_WARNING, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_EMERALD,
  OPACITY_8, OPACITY_15, OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { POI_ICONS, ZONE_POIS } from '../_shared/data';
import { ConnectionTable } from './ConnectionTable';
import { BossArenaCards } from './BossArenaCards';
import { HazardMap } from './HazardMap';

export function PoiEncountersGroup() {
  return (
    <>
      {/* Points of Interest */}
      <BlueprintPanel color={ACCENT_EMERALD} className="p-3">
        <SectionHeader icon={MapPin} label="Points of Interest Layer" color={ACCENT_EMERALD} />
        <PoiLegend />
        <div className="space-y-3">
          {ZONE_POIS.map((zp) => {
            const totalPois = zp.pois.reduce((acc, p) => acc + p.count, 0);
            return (
              <div key={zp.zone} className="bg-surface-deep rounded-lg p-3 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-text">{zp.zone}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{totalPois} POIs</span>
                    <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: zp.discoveryPct === 100 ? STATUS_SUCCESS : zp.discoveryPct > 0 ? STATUS_WARNING : STATUS_LOCKED,
                        backgroundColor: zp.discoveryPct === 100 ? withOpacity(STATUS_SUCCESS, OPACITY_8) : zp.discoveryPct > 0 ? withOpacity(STATUS_WARNING, OPACITY_8) : 'transparent',
                        border: `1px solid ${withOpacity(zp.discoveryPct === 100 ? STATUS_SUCCESS : zp.discoveryPct > 0 ? STATUS_WARNING : STATUS_LOCKED, OPACITY_20)}`,
                      }}>
                      {zp.discoveryPct}% discovered
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {zp.pois.map((poi) => {
                    const cfg = POI_ICONS[poi.type];
                    const IconComp = cfg.icon;
                    return (
                      <span key={poi.type} className="flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: withOpacity(cfg.color, OPACITY_8), color: cfg.color, border: `1px solid ${withOpacity(cfg.color, OPACITY_15)}` }}>
                        <IconComp className="w-3 h-3" /> x{poi.count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>

      {/* Zone Connection Visualizer */}
      <ConnectionTable />

      {/* Boss Arena Details */}
      <BossArenaCards />

      {/* Environmental Hazard Map */}
      <HazardMap />
    </>
  );
}

/* ── POI Legend ────────────────────────────────────────────────────────── */

function PoiLegend() {
  return (
    <div className="flex flex-wrap gap-3 mb-2.5 pb-3 border-b border-border/40">
      {Object.entries(POI_ICONS).map(([type, cfg]) => {
        const IconComp = cfg.icon;
        return (
          <span key={type} className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: cfg.color }}>
            <IconComp className="w-3 h-3" /> {cfg.label}
          </span>
        );
      })}
    </div>
  );
}
