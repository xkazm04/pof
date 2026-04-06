'use client';

import { useState } from 'react';
import { Scan, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_ERROR, ACCENT_CYAN, OVERLAY_WHITE, OPACITY_4, OPACITY_5, OPACITY_20, OPACITY_25, withOpacity,
  OPACITY_8, OPACITY_22,
} from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, CornerBrackets } from '../design';
import { HITBOX_ZONES } from '../data';

const ZONE_DESCRIPTIONS: Record<string, string> = {
  Hurtbox: 'Damageable body regions — head, torso, limbs',
  Hitbox: 'Active attack collision — arms, weapons, projectiles',
  Pushbox: 'Physics blocking volume — prevents character overlap',
};

export function HitboxWireframeViewer() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    Hurtbox: true, Hitbox: true, Pushbox: true,
  });
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  return (
    <BlueprintPanel className="p-4">
      <SectionHeader icon={Scan} label="Hitbox Wireframe" color={STATUS_ERROR} />
      <div className="flex items-start gap-5">
        {/* ── Wireframe Display ──────────────────────────────────────────── */}
        <div className="relative rounded-lg border border-border/20 bg-surface/20 p-3 flex-shrink-0">
          <CornerBrackets color={STATUS_ERROR} size={8} />

          <svg width={140} height={140} viewBox="-5 -5 110 120" className="overflow-visible">
            {/* Grid lines */}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`h${i}`} x1={-5} y1={i * 10} x2={105} y2={i * 10}
                stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="0.5" />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`v${i}`} x1={i * 10} y1={-5} x2={i * 10} y2={115}
                stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="0.5" />
            ))}

            {/* Character silhouette outline */}
            <ellipse cx={50} cy={15} rx={10} ry={12} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" />
            <rect x={38} y={27} width={24} height={35} rx={3} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" />
            <rect x={16} y={30} width={22} height={8} rx={2} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="1" />
            <rect x={62} y={30} width={22} height={8} rx={2} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="1" />
            <rect x={38} y={62} width={10} height={35} rx={2} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" />
            <rect x={52} y={62} width={10} height={35} rx={2} fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_8)} strokeWidth="1" />

            {/* Center axis */}
            <line x1={50} y1={-2} x2={50} y2={102} stroke={withOpacity(OVERLAY_WHITE, OPACITY_5)} strokeWidth="0.5" strokeDasharray="3 3" />

            {/* Hitbox zone overlays with animated entrance + hover highlight */}
            {HITBOX_ZONES.filter(z => toggles[z.type]).map((zone, zi) => {
              const isHovered = hoveredZone === zone.type;
              const isDimmed = hoveredZone !== null && !isHovered;
              return zone.shapes.map((shape, si) => {
                const delay = zi * 0.15 + si * 0.05;
                const fillOpacity = isHovered ? OPACITY_20 : isDimmed ? OPACITY_4 : OPACITY_8;
                const sw = isHovered ? 2.5 : isDimmed ? 1 : 1.5;
                const sharedProps = {
                  fill: withOpacity(zone.color, fillOpacity),
                  stroke: zone.color,
                  strokeWidth: sw,
                  strokeDasharray: '4 2',
                  style: {
                    cursor: 'pointer' as const,
                    filter: isHovered ? `drop-shadow(0 0 4px ${zone.color})` : 'none',
                    transition: 'filter 0.2s, opacity 0.2s',
                    opacity: isDimmed ? 0.4 : 1,
                  },
                  onMouseEnter: () => setHoveredZone(zone.type),
                  onMouseLeave: () => setHoveredZone(null),
                };
                return shape.kind === 'ellipse' ? (
                  <motion.ellipse
                    key={`${zone.type}-${si}`}
                    cx={shape.x} cy={shape.y} rx={shape.w / 2} ry={shape.h / 2}
                    {...sharedProps}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: isDimmed ? 0.4 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay, ...MOTION_CONFIG.standard }}
                  />
                ) : (
                  <motion.rect
                    key={`${zone.type}-${si}`}
                    x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={2}
                    {...sharedProps}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: isDimmed ? 0.4 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay, ...MOTION_CONFIG.standard }}
                  />
                );
              });
            })}

            {/* Animated scan line — uses framer-motion animate to avoid per-frame state updates */}
            <motion.g
              animate={{ y: [-10, 110] }}
              transition={{ duration: 7.2, repeat: Infinity, ease: 'linear' }}
            >
              <line
                x1={-5} y1={0} x2={105} y2={0}
                stroke={STATUS_ERROR}
                strokeWidth="1"
                opacity={0.3}
              />
              <rect
                x={-5} y={-4} width={110} height={8}
                fill={withOpacity(STATUS_ERROR, OPACITY_5)}
              />
            </motion.g>
          </svg>
        </div>

        {/* ── Controls & Info ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3">
          <div className="text-xs font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Layer Toggles
          </div>

          <div className="flex flex-col gap-1.5">
            <AnimatePresence>
              {HITBOX_ZONES.map((zone, i) => {
                const active = toggles[zone.type];
                const isZoneHovered = hoveredZone === zone.type;
                return (
                  <motion.button
                    key={zone.type}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * MOTION_CONFIG.stagger }}
                    onClick={() => setToggles(prev => ({ ...prev, [zone.type]: !prev[zone.type] }))}
                    onMouseEnter={() => setHoveredZone(zone.type)}
                    onMouseLeave={() => setHoveredZone(null)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md border text-left transition-all cursor-pointer group"
                    style={{
                      borderColor: isZoneHovered ? zone.color : active ? `${withOpacity(zone.color, OPACITY_22)}` : 'var(--border)',
                      backgroundColor: isZoneHovered ? withOpacity(zone.color, OPACITY_8) : active ? withOpacity(zone.color, OPACITY_5) : 'transparent',
                      boxShadow: isZoneHovered ? `0 0 8px ${withOpacity(zone.color, OPACITY_8)}` : 'none',
                    }}
                  >
                    {/* Toggle indicator */}
                    <div className="relative w-7 h-4 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: active ? withOpacity(zone.color, OPACITY_20) : 'var(--border)' }}>
                      <motion.div
                        className="absolute top-0.5 w-3 h-3 rounded-full"
                        animate={{ left: active ? 14 : 2 }}
                        transition={MOTION_CONFIG.spring}
                        style={{ backgroundColor: active ? zone.color : 'var(--text-muted)' }}
                      />
                    </div>

                    {/* Zone label */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
                        style={{ color: active ? zone.color : 'var(--text-muted)' }}>
                        {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {zone.type}
                      </div>
                      <div className="text-xs text-text-muted truncate mt-0.5">
                        {ZONE_DESCRIPTIONS[zone.type]}
                      </div>
                    </div>

                    {/* Color swatch */}
                    <span className="w-2 h-2 rounded-full flex-shrink-0 transition-opacity"
                      style={{
                        backgroundColor: zone.color,
                        opacity: active ? 1 : 0.3,
                        boxShadow: active ? `0 0 6px ${zone.color}` : 'none',
                      }} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="pt-2 border-t border-border/20 space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
              <span className="w-4 h-px" style={{ borderTop: `1.5px dashed ${ACCENT_CYAN}` }} />
              Dashed = collision boundary
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
              <span className="w-4 h-px" style={{ background: withOpacity(STATUS_ERROR, OPACITY_25) }} />
              Scan sweep (active detection)
            </div>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
