'use client';

import {
  MapPin, ArrowRightLeft, ArrowRight, CheckCircle2, Circle,
  Skull, Music, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import {
  POI_ICONS, ZONE_POIS, ZONE_CONNECTIONS, TRANSITION_COLORS,
  BOSS_ARENAS, ENV_HAZARDS, HAZARD_TYPE_COLORS, HAZARD_WARNING_COLORS,
  ZONE_DANGER_SCORES,
} from './data';

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
                        backgroundColor: zp.discoveryPct === 100 ? `${STATUS_SUCCESS}15` : zp.discoveryPct > 0 ? `${STATUS_WARNING}15` : 'transparent',
                        border: `1px solid ${zp.discoveryPct === 100 ? STATUS_SUCCESS : zp.discoveryPct > 0 ? STATUS_WARNING : STATUS_LOCKED}30`,
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
                        style={{ backgroundColor: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
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

/* ── Connection Table ─────────────────────────────────────────────────── */

function ConnectionTable() {
  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <SectionHeader icon={ArrowRightLeft} label="Zone Connection Visualizer" color={ACCENT_VIOLET} />
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">From</th>
              <th className="text-center py-2 px-2" />
              <th className="text-left py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">To</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Type</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Est. Time</th>
              <th className="text-center py-2 px-2 text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">NavMesh</th>
            </tr>
          </thead>
          <tbody>
            {ZONE_CONNECTIONS.map((conn, i) => {
              const typeColor = TRANSITION_COLORS[conn.transitionType];
              return (
                <tr key={i} className="border-b border-border/20 hover:bg-surface-hover/20 transition-colors">
                  <td className="py-2 px-2 text-text">{conn.from}</td>
                  <td className="py-2 px-2 text-center">
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted inline-block" />
                  </td>
                  <td className="py-2 px-2 text-text">{conn.to}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                      {conn.transitionType}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-text-muted">{conn.estTime}</td>
                  <td className="py-2 px-2 text-center">
                    {conn.navMeshContinuity ? (
                      <CheckCircle2 className="w-3.5 h-3.5 inline-block" style={{ color: STATUS_SUCCESS }} />
                    ) : (
                      <Circle className="w-3.5 h-3.5 inline-block text-text-muted opacity-40" />
                    )}
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

/* ── Boss Arena Cards ─────────────────────────────────────────────────── */

function BossArenaCards() {
  return (
    <BlueprintPanel color={STATUS_ERROR} className="p-3">
      <SectionHeader icon={Skull} label="Boss Arena Details" color={STATUS_ERROR} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BOSS_ARENAS.map((boss) => (
          <motion.div
            key={boss.bossName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-surface-deep rounded-xl p-4 border border-border/40 overflow-hidden group"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${STATUS_ERROR}10 0%, transparent 70%)` }} />
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, transparent, ${STATUS_ERROR}60, transparent)` }} />

            <div className="flex items-start justify-between mb-3 relative z-10">
              <div>
                <div className="text-sm font-bold text-text flex items-center gap-1.5">
                  <Skull className="w-4 h-4" style={{ color: STATUS_ERROR, filter: `drop-shadow(0 0 4px ${STATUS_ERROR}60)` }} />
                  {boss.bossName}
                </div>
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-0.5">{boss.zone}</div>
              </div>
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${STATUS_ERROR}15`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}30` }}>
                Rec. Lv{boss.recommendedLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono relative z-10">
              <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Phases</span>
                <div className="font-bold text-text">{boss.phases}</div>
              </div>
              <div className="bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Arena</span>
                <div className="font-bold text-text">{boss.arenaSize}</div>
              </div>
              <div className="col-span-2 bg-surface/50 rounded px-2 py-1.5 border border-border/30">
                <span className="text-text-muted">Hazards</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {boss.hazards.map((h) => (
                    <span key={h} className="px-1 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${STATUS_WARNING}15`, color: STATUS_WARNING, border: `1px solid ${STATUS_WARNING}25` }}>
                      {h}
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-text-muted">
                <Music className="w-3 h-3" style={{ color: ACCENT_VIOLET }} />
                <span className="italic">{boss.musicTheme}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </BlueprintPanel>
  );
}

/* ── Hazard Map ───────────────────────────────────────────────────────── */

function HazardMap() {
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
              <span className="font-bold px-1 py-0.5 rounded" style={{ color: dangerColor, backgroundColor: `${dangerColor}15` }}>
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
                      style={{ backgroundColor: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                      {hazard.type}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: hazard.damagePerSec >= 35 ? STATUS_ERROR : STATUS_WARNING }}>
                    {hazard.damagePerSec}
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">{hazard.affectedArea}</td>
                  <td className="py-2 px-2 text-center">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: `${warnColor}15`, color: warnColor, border: `1px solid ${warnColor}30` }}>
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
