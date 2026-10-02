'use client';

import { useState, useCallback } from 'react';
import { Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_30, OPACITY_37, OPACITY_50, OPACITY_90,
  GLOW_SM, GLOW_MD, GLOW_LG,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { arpgPreviewLayout } from '@/components/modules/core-engine/sub_ui/_shared/hudRegistry';

const ACCENT = ACCENT_PINK;

type HudRender = 'globe-red' | 'globe-blue' | 'skill-bar' | 'xp-bar' | 'minimap' | 'rect' | 'badge';

/** How the preview draws a registry widget; geometry comes from the registry, never from here. */
const RENDER_BY_ID: Record<string, HudRender> = {
  'health-globe': 'globe-red',
  'force-globe': 'globe-blue',
  'skill-bar': 'skill-bar',
  ExperienceBar: 'xp-bar',
  MiniMap: 'minimap',
  'combo-counter': 'badge',
};

/** The ARPG Layout context's placements (one rect per widget, shared with the compositor). */
const HUD_ELEMENTS = arpgPreviewLayout().map(p => ({ ...p, render: RENDER_BY_ID[p.id] ?? 'rect' }));

const SKILL_KEYS = ['1', '2', '3', '4', '5', '6', 'Q', 'R'];

function GlobeElement({ color, symbol }: { color: string; symbol: string }) {
  return (
    <div className="w-full h-full rounded-full flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 40% 35%, ${withOpacity(color, OPACITY_90)}, ${withOpacity(color, OPACITY_37)} 55%, ${withOpacity(color, OPACITY_20)} 100%)`,
        boxShadow: `0 0 18px ${withOpacity(color, OPACITY_30)}, inset 0 -4px 12px ${withOpacity(color, OPACITY_30)}`,
        border: `2px solid ${withOpacity(color, OPACITY_50)}`,
      }}>
      <span className="text-lg font-bold drop-shadow-lg" style={{ color: '#fff', textShadow: `${GLOW_MD} ${color}` }}>{symbol}</span>
    </div>
  );
}

function SkillBarElement() {
  return (
    <div className="w-full h-full flex items-center justify-center gap-[3%] px-[4%]">
      {SKILL_KEYS.map(k => (
        <div key={k} className="flex-1 aspect-square rounded border flex items-center justify-center max-h-full"
          style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_30), backgroundColor: withOpacity(STATUS_WARNING, OPACITY_20), boxShadow: `${GLOW_SM} ${withOpacity(STATUS_WARNING, OPACITY_20)}` }}>
          <span className="text-[9px] font-mono font-bold" style={{ color: withOpacity(STATUS_WARNING, OPACITY_90) }}>{k}</span>
        </div>
      ))}
    </div>
  );
}

function XpBarElement() {
  return (
    <div className="w-full h-full rounded-full overflow-hidden" style={{ background: '#1a1a2e' }}>
      <div className="h-full rounded-full" style={{
        width: '62%',
        background: `linear-gradient(90deg, ${withOpacity(ACCENT_EMERALD, OPACITY_90)}, ${withOpacity(ACCENT_CYAN, OPACITY_90)})`,
        boxShadow: `${GLOW_MD} ${withOpacity(ACCENT_EMERALD, OPACITY_30)}`,
      }} />
    </div>
  );
}

function MinimapElement() {
  return (
    <div className="w-full h-full rounded-full flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle, #1a2a1a 0%, #0d1a0d 70%, #050a05 100%)',
        border: `2px solid ${withOpacity(STATUS_SUCCESS, OPACITY_30)}`,
        boxShadow: `0 0 12px ${withOpacity(STATUS_SUCCESS, OPACITY_8)}`,
      }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUCCESS, boxShadow: `${GLOW_SM} ${STATUS_SUCCESS}` }} />
    </div>
  );
}

function BadgeElement({ label }: { label: string }) {
  return (
    <div className="w-full h-full rounded-lg border flex items-center justify-center"
      style={{ borderColor: withOpacity(STATUS_ERROR, OPACITY_30), backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8) }}>
      <span className="text-[10px] font-mono font-bold" style={{ color: STATUS_ERROR }}>x12</span>
    </div>
  );
}

function RectElement({ label }: { label: string }) {
  return (
    <div className="w-full h-full rounded border border-white/10 bg-white/[0.04] flex items-center justify-center p-1">
      <span className="text-[8px] font-mono text-white/40 text-center leading-tight truncate">{label}</span>
    </div>
  );
}

export function ArpgHudPreview() {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = useCallback((id: string) => {
    setSelected(prev => prev === id ? null : id);
  }, []);

  const selectedEl = HUD_ELEMENTS.find(e => e.id === selected);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="ARPG HUD Layout" color={ACCENT} icon={Gamepad2} />

      <div className="relative w-full rounded-lg overflow-hidden"
        style={{
          aspectRatio: '16 / 9',
          background: 'radial-gradient(ellipse at center, #12121e 0%, #0a0a14 60%, #050508 100%)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8)',
        }}>

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />

        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '10% 10%',
          }} />

        {HUD_ELEMENTS.map(el => {
          const isSelected = selected === el.id;
          return (
            <motion.button key={el.id}
              onClick={() => handleClick(el.id)}
              className="absolute cursor-pointer z-10 focus:outline-none"
              style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.w}%`, height: `${el.h}%` }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {isSelected && (
                <div className="absolute -inset-1 rounded-lg pointer-events-none"
                  style={{ boxShadow: `0 0 12px ${withOpacity(ACCENT, OPACITY_37)}`, border: `1px solid ${withOpacity(ACCENT, OPACITY_30)}` }} />
              )}
              {el.render === 'globe-red' && <GlobeElement color="#dc2626" symbol="+" />}
              {el.render === 'globe-blue' && <GlobeElement color="#2563eb" symbol="*" />}
              {el.render === 'skill-bar' && <SkillBarElement />}
              {el.render === 'xp-bar' && <XpBarElement />}
              {el.render === 'minimap' && <MinimapElement />}
              {el.render === 'badge' && <BadgeElement label={el.label} />}
              {el.render === 'rect' && <RectElement label={el.label} />}
            </motion.button>
          );
        })}

        <AnimatePresence>
          {selectedEl && (
            <motion.div
              key={selectedEl.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-md border"
              style={{
                backgroundColor: 'rgba(10,10,20,0.92)',
                borderColor: withOpacity(ACCENT, OPACITY_30),
                boxShadow: `${GLOW_LG} ${withOpacity(ACCENT, OPACITY_20)}`,
              }}>
              <span className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                {selectedEl.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-border/30">
        {[
          { label: 'Health Globe', color: '#dc2626' },
          { label: 'Force Globe', color: '#2563eb' },
          { label: 'Skill Bar', color: '#f59e0b' },
          { label: 'XP Bar', color: ACCENT_EMERALD },
          { label: 'UI Elements', color: withOpacity('#ffffff', OPACITY_20) },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
