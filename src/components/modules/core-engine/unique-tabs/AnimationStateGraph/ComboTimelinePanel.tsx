'use client';

import { useState, useMemo } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN, STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT, COMBO_DEFS, COMBO_SECTIONS, type ComboSection } from './data';

export function ComboTimelinePanel() {
  const [activeCombo, setActiveCombo] = useState(COMBO_DEFS[0].id);

  const activeSections: ComboSection[] = useMemo(() => {
    const combo = COMBO_DEFS.find((c) => c.id === activeCombo) ?? COMBO_DEFS[0];
    return combo.sectionIds.map((idx) => COMBO_SECTIONS[idx]).filter(Boolean);
  }, [activeCombo]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="Combo Montage Timeline" icon={Play} color={ACCENT} />

      {/* Combo selector (only when multiple combos) */}
      {COMBO_DEFS.length > 1 && (
        <div className="flex items-center gap-1 mb-3 border-b border-border/40 pb-2">
          {COMBO_DEFS.map((combo) => (
            <button
              key={combo.id}
              onClick={() => setActiveCombo(combo.id)}
              className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                activeCombo === combo.id ? 'text-text border-b-2' : 'text-text-muted hover:text-text'
              }`}
              style={activeCombo === combo.id ? { borderColor: ACCENT } : undefined}
            >
              {combo.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        {activeSections.map((section, i) => (
          <div key={section.label} className="flex items-center gap-2 flex-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.2 }}
              className="flex-1"
            >
              <div
                className="rounded-xl border px-3 py-2 mb-2 relative overflow-hidden"
                style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10` }}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="text-sm font-bold text-text">{section.label}</div>
                  <div className="text-xs font-mono font-semibold" style={{ color: ACCENT }}>{section.duration}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                {section.windows.map((w, wi) => (
                  <div key={w.name} className="relative h-4 rounded overflow-hidden bg-surface-deep shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${w.width * 100}%` }}
                      transition={{ delay: (i * 0.2) + (wi * 0.1) + 0.3, duration: 0.5, type: 'spring' }}
                      className="absolute top-0 h-full rounded shadow-sm"
                      style={{
                        left: `${w.start * 100}%`,
                        backgroundColor: `${w.color}50`,
                        borderLeft: `2px solid ${w.color}`,
                        boxShadow: `0 0 8px ${w.color}40`,
                      }}
                      title={w.name}
                    />
                  </div>
                ))}
              </div>
            </motion.div>

            {i < activeSections.length - 1 && (
              <div className="hidden md:flex flex-col items-center flex-shrink-0 w-8">
                <div className="w-full h-[2px] bg-border relative overflow-hidden rounded-full">
                  <motion.div
                    className="absolute inset-y-0 left-0 w-full bg-text-muted/50"
                    initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 text-xs font-medium text-text-muted flex-wrap border-t border-border/40 pt-3">
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${ACCENT_CYAN}80`, color: ACCENT_CYAN }} />
          ComboWindow
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_ERROR}80`, color: STATUS_ERROR }} />
          HitDetection
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_WARNING}80`, color: STATUS_WARNING }} />
          SpawnVFX
        </span>
      </div>
    </BlueprintPanel>
  );
}
