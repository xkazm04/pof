'use client';

import { useState, useMemo } from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT_CYAN, STATUS_ERROR, STATUS_WARNING, OVERLAY_WHITE, withOpacity, OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_30, OPACITY_50, GLOW_MD } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { ACCENT, COMBO_DEFS, COMBO_SECTIONS, type ComboSection } from '../data';

export function ComboTimelinePanel() {
  const [activeCombo, setActiveCombo] = useState(COMBO_DEFS[0].id);
  const [scrubPct, setScrubPct] = useState(30);

  const { activeSections, damages } = useMemo(() => {
    const combo = COMBO_DEFS.find((c) => c.id === activeCombo) ?? COMBO_DEFS[0];
    return {
      activeSections: combo.sectionIds.map((idx) => COMBO_SECTIONS[idx]).filter(Boolean) as ComboSection[],
      damages: combo.damages ?? [],
    };
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
              className={`px-3 py-1 text-xs font-medium rounded-t transition-colors cursor-pointer ${
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
                style={{ borderColor: withOpacity(ACCENT, OPACITY_25), backgroundColor: withOpacity(ACCENT, OPACITY_8) }}
              >
                <div className="flex justify-between items-center relative z-10">
                  <div className="text-sm font-bold text-text">{section.label}</div>
                  <div className="flex items-center gap-2">
                    {damages[i] !== undefined && (
                      <span className="text-xs font-mono font-bold" style={{ color: STATUS_ERROR }}>{damages[i]} dmg</span>
                    )}
                    <span className="text-xs font-mono font-semibold" style={{ color: ACCENT }}>{section.duration}</span>
                  </div>
                </div>
              </div>

              <div className="relative">
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
                          backgroundColor: withOpacity(w.color, OPACITY_30),
                          borderLeft: `2px solid ${w.color}`,
                          boxShadow: `${GLOW_MD} ${withOpacity(w.color, OPACITY_25)}`,
                          backgroundImage: w.name === 'ComboWindow'
                            ? `repeating-linear-gradient(45deg,transparent 0px,transparent 2px,${withOpacity(OVERLAY_WHITE, OPACITY_8)} 2px,${withOpacity(OVERLAY_WHITE, OPACITY_8)} 4px)`
                            : undefined,
                        }}
                        title={w.name}
                      />
                    </div>
                  ))}
                </div>
                {/* Scrub position indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 rounded pointer-events-none z-10"
                  style={{ left: `${scrubPct}%`, backgroundColor: withOpacity(OVERLAY_WHITE, OPACITY_50) }}
                />
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

      {/* Scrub handle */}
      <div className="mt-3 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Scrub</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: ACCENT }}>{scrubPct}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={scrubPct}
          onChange={(e) => setScrubPct(Number(e.target.value))}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
          style={{ accentColor: ACCENT, background: `linear-gradient(to right, ${withOpacity(ACCENT, OPACITY_25)} ${scrubPct}%, ${withOpacity(OVERLAY_WHITE, OPACITY_5)} ${scrubPct}%)` }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 text-xs font-medium text-text-muted flex-wrap border-t border-border/40 pt-3">
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_50), color: ACCENT_CYAN, backgroundImage: `repeating-linear-gradient(45deg,transparent 0px,transparent 2px,${withOpacity(OVERLAY_WHITE, OPACITY_15)} 2px,${withOpacity(OVERLAY_WHITE, OPACITY_15)} 4px)` }} />
          ComboWindow (hatched)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: withOpacity(STATUS_ERROR, OPACITY_50), color: STATUS_ERROR }} />
          HitDetection
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_50), color: STATUS_WARNING }} />
          SpawnVFX
        </span>
      </div>
    </BlueprintPanel>
  );
}
