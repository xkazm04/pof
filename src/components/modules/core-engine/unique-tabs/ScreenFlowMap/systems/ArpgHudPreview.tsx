'use client';

import { useState, useCallback } from 'react';
import { Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACCENT_PINK, ACCENT_CYAN, ACCENT_EMERALD, STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_30, OPACITY_37, OPACITY_50, OPACITY_90,
  GLOW_SM, GLOW_MD, GLOW_LG,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';

const ACCENT = ACCENT_PINK;

interface HudElement {
  id: string; label: string; top: string; left: string;
  width: string; height: string;
  render: 'globe-red' | 'globe-blue' | 'skill-bar' | 'xp-bar' | 'minimap' | 'rect' | 'badge';
}

const HUD_ELEMENTS: HudElement[] = [
  { id: 'portrait',      label: 'Portrait Frame',   top: '4%',  left: '2%',  width: '8%',  height: '12%', render: 'rect' },
  { id: 'buffs',         label: 'Buffs / Debuffs',  top: '4%',  left: '12%', width: '18%', height: '6%',  render: 'rect' },
  { id: 'minimap',       label: 'Minimap',          top: '3%',  left: '83%', width: '14%', height: '22%', render: 'minimap' },
  { id: 'loot-feed',     label: 'Loot Feed',        top: '18%', left: '2%',  width: '14%', height: '28%', render: 'rect' },
  { id: 'quest-tracker', label: 'Quest Tracker',    top: '14%', left: '80%', width: '18%', height: '22%', render: 'rect' },
  { id: 'target-frame',  label: 'Target Frame',     top: '30%', left: '35%', width: '20%', height: '8%',  render: 'rect' },
  { id: 'combo-counter', label: 'Combo Counter',    top: '42%', left: '82%', width: '10%', height: '8%',  render: 'badge' },
  { id: 'xp-bar',        label: 'XP Bar',           top: '76%', left: '2%',  width: '96%', height: '3%',  render: 'xp-bar' },
  { id: 'skill-bar',     label: 'Skill Bar',        top: '84%', left: '22%', width: '56%', height: '10%', render: 'skill-bar' },
  { id: 'health-globe',  label: 'Health Globe',     top: '72%', left: '3%',  width: '16%', height: '24%', render: 'globe-red' },
  { id: 'force-globe',   label: 'Force Globe',      top: '72%', left: '81%', width: '16%', height: '24%', render: 'globe-blue' },
];

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
              style={{ top: el.top, left: el.left, width: el.width, height: el.height }}
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
