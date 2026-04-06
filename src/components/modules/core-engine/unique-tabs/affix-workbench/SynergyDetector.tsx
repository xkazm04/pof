'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import {
  ACCENT_ORANGE,
  OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_25,
  GLOW_LG, GLOW_MD,
  withOpacity,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ANIMATION_PRESETS, motionSafe } from '@/lib/motion';
import type { SynergyRule } from './data';
import { SYNERGY_COLORS } from './data';

interface SynergyDetectorProps {
  activeSynergies: SynergyRule[];
  expandedSynergies: boolean;
  onToggleExpanded: () => void;
  synergyGlow: boolean;
  newSynergyLabels: Set<string>;
  craftedAffixCount: number;
}

export function SynergyDetector({
  activeSynergies, expandedSynergies, onToggleExpanded,
  synergyGlow, newSynergyLabels, craftedAffixCount,
}: SynergyDetectorProps) {
  const prefersReduced = useReducedMotion();
  return (
    <SurfaceCard
      level={2}
      className="p-3 relative overflow-hidden"
      style={{
        transition: 'box-shadow 0.3s ease',
        boxShadow: synergyGlow && activeSynergies.length > 0
          ? `${GLOW_LG} ${withOpacity(SYNERGY_COLORS[activeSynergies[0].severity], OPACITY_25)}, inset ${GLOW_MD} ${withOpacity(SYNERGY_COLORS[activeSynergies[0].severity], OPACITY_8)}`
          : 'none',
      }}
    >
      <button
        onClick={onToggleExpanded}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={synergyGlow && !prefersReduced ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : {}}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.4 }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
          </motion.div>
          <span className="text-xs font-bold text-text">Synergy Detector</span>
          {activeSynergies.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: withOpacity(SYNERGY_COLORS[activeSynergies[0].severity], OPACITY_12), color: SYNERGY_COLORS[activeSynergies[0].severity] }}>
              {activeSynergies.length} active
            </span>
          )}
        </div>
        {expandedSynergies ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>

      {expandedSynergies && (
        <div className="mt-3 space-y-3">
          {activeSynergies.length > 0 ? (
            activeSynergies.map((syn, idx) => {
              const isNew = newSynergyLabels.has(syn.label);
              const synColor = SYNERGY_COLORS[syn.severity];
              return (
                <motion.div
                  key={syn.label}
                  initial={prefersReduced ? { opacity: 1 } : isNew ? { opacity: 0, x: 30, scale: 0.9 } : { opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={prefersReduced ? { duration: 0 } : isNew ? { ...ANIMATION_PRESETS.spring, delay: 0.2 + idx * ANIMATION_PRESETS.stagger.slow, duration: 0.35 } : undefined}
                  className="rounded-lg px-2.5 py-2 relative overflow-hidden"
                  style={{ backgroundColor: withOpacity(synColor, OPACITY_5), border: `1px solid ${withOpacity(synColor, OPACITY_20)}` }}
                >
                  {/* Sparkle particles on new synergy — hidden for reduced motion */}
                  {isNew && !prefersReduced && (
                    <>
                      {[
                        { x: 12, y: -8, delay: 0.25 },
                        { x: -10, y: -12, delay: 0.35 },
                        { x: 20, y: 6, delay: 0.3 },
                        { x: -6, y: 10, delay: 0.4 },
                      ].map((p, i) => (
                        <motion.div
                          key={i}
                          className="absolute rounded-full pointer-events-none"
                          style={{ width: 4, height: 4, backgroundColor: synColor, top: '50%', left: '50%' }}
                          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                          animate={{ opacity: 0, x: p.x * 3, y: p.y * 3, scale: 0 }}
                          transition={{ delay: p.delay + idx * ANIMATION_PRESETS.stagger.slow, duration: 0.45, ease: 'easeOut' }}
                        />
                      ))}
                    </>
                  )}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap className="w-3 h-3" style={{ color: synColor }} />
                    <span className="text-xs font-bold" style={{ color: synColor }}>{syn.label}</span>
                    <span className="text-xs font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(synColor, OPACITY_8), color: synColor }}>
                      {syn.severity}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{syn.description}</p>
                </motion.div>
              );
            })
          ) : (
            <div className="text-2xs text-text-muted italic py-2">
              {craftedAffixCount < 2
                ? 'Add 2+ affixes to detect synergies'
                : 'No known synergies detected'}
            </div>
          )}

          {/* All possible synergies hint */}
          {craftedAffixCount >= 1 && activeSynergies.length === 0 && (
            <div className="text-2xs text-text-muted mt-1">
              <span className="font-medium">Hint:</span> Try combining Life Steal + Crit, or All Damage + Crit Damage
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
