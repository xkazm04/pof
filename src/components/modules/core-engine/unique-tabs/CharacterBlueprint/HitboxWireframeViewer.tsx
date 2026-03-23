'use client';

import { useState, useEffect } from 'react';
import { Scan, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_ERROR, ACCENT_CYAN, OVERLAY_WHITE } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, CornerBrackets } from './design';
import { HITBOX_ZONES } from './data';

const ZONE_DESCRIPTIONS: Record<string, string> = {
  Hurtbox: 'Damageable body regions — head, torso, limbs',
  Hitbox: 'Active attack collision — arms, weapons, projectiles',
  Pushbox: 'Physics blocking volume — prevents character overlap',
};

export function HitboxWireframeViewer() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    Hurtbox: true, Hitbox: true, Pushbox: true,
  });
  const [scanY, setScanY] = useState(0);

  // Animated scan line sweep
  useEffect(() => {
    const interval = setInterval(() => {
      setScanY(prev => (prev >= 110 ? -10 : prev + 0.5));
    }, 30);
    return () => clearInterval(interval);
  }, []);

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
                stroke={`${OVERLAY_WHITE}06`} strokeWidth="0.5" />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`v${i}`} x1={i * 10} y1={-5} x2={i * 10} y2={115}
                stroke={`${OVERLAY_WHITE}06`} strokeWidth="0.5" />
            ))}

            {/* Character silhouette outline */}
            <ellipse cx={50} cy={15} rx={10} ry={12} fill="none" stroke={`${OVERLAY_WHITE}12`} strokeWidth="1" />
            <rect x={38} y={27} width={24} height={35} rx={3} fill="none" stroke={`${OVERLAY_WHITE}12`} strokeWidth="1" />
            <rect x={16} y={30} width={22} height={8} rx={2} fill="none" stroke={`${OVERLAY_WHITE}08`} strokeWidth="1" />
            <rect x={62} y={30} width={22} height={8} rx={2} fill="none" stroke={`${OVERLAY_WHITE}08`} strokeWidth="1" />
            <rect x={38} y={62} width={10} height={35} rx={2} fill="none" stroke={`${OVERLAY_WHITE}12`} strokeWidth="1" />
            <rect x={52} y={62} width={10} height={35} rx={2} fill="none" stroke={`${OVERLAY_WHITE}12`} strokeWidth="1" />

            {/* Center axis */}
            <line x1={50} y1={-2} x2={50} y2={102} stroke={`${OVERLAY_WHITE}08`} strokeWidth="0.5" strokeDasharray="3 3" />

            {/* Hitbox zone overlays with animated entrance */}
            {HITBOX_ZONES.filter(z => toggles[z.type]).map((zone, zi) =>
              zone.shapes.map((shape, si) => {
                const delay = zi * 0.15 + si * 0.05;
                return shape.kind === 'ellipse' ? (
                  <motion.ellipse
                    key={`${zone.type}-${si}`}
                    cx={shape.x} cy={shape.y} rx={shape.w / 2} ry={shape.h / 2}
                    fill={`${zone.color}12`}
                    stroke={zone.color}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay, duration: 0.3 }}
                  />
                ) : (
                  <motion.rect
                    key={`${zone.type}-${si}`}
                    x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={2}
                    fill={`${zone.color}12`}
                    stroke={zone.color}
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay, duration: 0.3 }}
                  />
                );
              }),
            )}

            {/* Animated scan line */}
            <motion.line
              x1={-5} y1={scanY} x2={105} y2={scanY}
              stroke={STATUS_ERROR}
              strokeWidth="1"
              opacity={0.3}
            />
            <motion.rect
              x={-5} y={scanY - 4} width={110} height={8}
              fill={`${STATUS_ERROR}08`}
            />
          </svg>
        </div>

        {/* ── Controls & Info ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
            Layer Toggles
          </div>

          <div className="flex flex-col gap-1.5">
            <AnimatePresence>
              {HITBOX_ZONES.map((zone, i) => {
                const active = toggles[zone.type];
                return (
                  <motion.button
                    key={zone.type}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => setToggles(prev => ({ ...prev, [zone.type]: !prev[zone.type] }))}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md border text-left transition-all cursor-pointer group"
                    style={{
                      borderColor: active ? `${zone.color}35` : 'var(--border)',
                      backgroundColor: active ? `${zone.color}08` : 'transparent',
                    }}
                  >
                    {/* Toggle indicator */}
                    <div className="relative w-7 h-4 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: active ? `${zone.color}30` : 'var(--border)' }}>
                      <motion.div
                        className="absolute top-0.5 w-3 h-3 rounded-full"
                        animate={{ left: active ? 14 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
                      <div className="text-[10px] text-text-muted truncate mt-0.5">
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
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
              <span className="w-4 h-px" style={{ borderTop: `1.5px dashed ${ACCENT_CYAN}` }} />
              Dashed = collision boundary
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
              <span className="w-4 h-px" style={{ background: `${STATUS_ERROR}40` }} />
              Scan sweep (active detection)
            </div>
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
