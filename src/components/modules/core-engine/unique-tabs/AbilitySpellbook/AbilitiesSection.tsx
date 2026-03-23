'use client';

import { useState } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_PURPLE_BOLD, ACCENT_GREEN,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  FeatureCard as SharedFeatureCard, PipelineFlow, SectionLabel, RadarChart,
} from '../_shared';
import { ABILITY_RADAR_AXES } from './data';
import { useSpellbookData } from './context';
import type { SectionProps } from './types';

export function AbilitiesSection({ featureMap, defs, expanded, onToggle }: SectionProps) {
  const { ABILITY_RADAR_DATA, COOLDOWN_ABILITIES } = useSpellbookData();
  const [selectedRadarAbility, setSelectedRadarAbility] = useState(0);
  const [selectedCooldownAbility, setSelectedCooldownAbility] = useState(0);

  const crossModuleAbilities = [
    { name: 'Melee attack ability', module: 'arpg-combat' },
    { name: 'Dodge ability (GAS)', module: 'arpg-combat' },
  ];

  return (
    <div className="space-y-4">
      <SharedFeatureCard name="Base GameplayAbility" featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT_PURPLE_BOLD} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SurfaceCard level={2} className="p-3 relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
          <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" /> Derived Cross-Module
          </div>
          <div className="space-y-4">
            {crossModuleAbilities.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm bg-surface p-2.5 rounded-lg border border-border/50"
              >
                <div className="bg-purple-500/10 p-1.5 rounded">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                </div>
                <span className="text-text font-medium">{a.name}</span>
                <span className="text-2xs text-text-muted font-mono ml-auto bg-surface-deep px-1.5 py-0.5 rounded border border-border/40">
                  {a.module}
                </span>
              </motion.div>
            ))}
          </div>
        </SurfaceCard>

        {/* Ability lifecycle */}
        <SurfaceCard level={2} className="p-4 flex flex-col justify-center">
          <SectionLabel label="Ability Lifecycle" />
          <div className="mt-4">
            <PipelineFlow steps={['CanActivate', 'CommitAbility', 'ActivateAbility', 'ApplyCost', 'EndAbility']} accent={ACCENT_PURPLE_BOLD} />
          </div>
        </SurfaceCard>
      </div>

      {/* 3.2 Ability Cost/Benefit Radar */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Sparkles} label="Ability Cost/Benefit Radar" color={ACCENT_PURPLE_BOLD} />
        <div className="flex flex-wrap gap-1.5 mb-3 mt-3">
          {ABILITY_RADAR_DATA.map((ability, i) => (
            <button key={ability.name} onClick={() => setSelectedRadarAbility(i)}
              className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all cursor-pointer ${
                selectedRadarAbility === i ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
              }`}
              style={selectedRadarAbility === i ? {
                backgroundColor: `${ability.color}15`,
                borderColor: `${ability.color}40`,
                color: ability.color,
              } : {
                backgroundColor: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}>
              {ability.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 justify-center flex-wrap bg-surface-deep/30 rounded-lg p-3">
          <RadarChart
            data={ABILITY_RADAR_AXES.map((axis, i) => ({
              axis,
              value: ABILITY_RADAR_DATA[selectedRadarAbility].values[i],
            }))}
            size={150}
            accent={ABILITY_RADAR_DATA[selectedRadarAbility].color}
            overlays={ABILITY_RADAR_DATA.filter((_, i) => i !== selectedRadarAbility).map(ab => ({
              data: ABILITY_RADAR_AXES.map((axis, i) => ({ axis, value: ab.values[i] })),
              color: ab.color,
              label: ab.name,
            }))}
          />
          {/* Legend */}
          <div className="flex flex-col gap-2">
            {ABILITY_RADAR_DATA.map((ab, i) => (
              <div key={ab.name} className={`flex items-center gap-2 text-sm font-mono ${i === selectedRadarAbility ? '' : 'opacity-50'}`}>
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ab.color }} />
                <span style={{ color: ab.color }}>{ab.name}</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* 3.7 Cooldown Flow Visualization */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Clock} label="Cooldown Flow" color={ACCENT_PURPLE_BOLD} />
        <div className="flex flex-wrap gap-1.5 mb-3 mt-3">
          {COOLDOWN_ABILITIES.map((ability, i) => (
            <button key={ability.name} onClick={() => setSelectedCooldownAbility(i)}
              className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all cursor-pointer ${
                selectedCooldownAbility === i ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
              }`}
              style={selectedCooldownAbility === i ? {
                backgroundColor: `${ability.color}15`,
                borderColor: `${ability.color}40`,
                color: ability.color,
              } : {
                backgroundColor: 'transparent',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}>
              {ability.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 justify-center flex-wrap">
          <CooldownWheel ability={COOLDOWN_ABILITIES[selectedCooldownAbility]} index={0} />
          <div className="text-sm text-text-muted space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold" style={{ color: COOLDOWN_ABILITIES[selectedCooldownAbility].color }}>
                {COOLDOWN_ABILITIES[selectedCooldownAbility].name}
              </span>
            </div>
            <div className="text-sm font-mono">Cooldown: {COOLDOWN_ABILITIES[selectedCooldownAbility].cd}s</div>
            <div className="text-sm font-mono">Remaining: {COOLDOWN_ABILITIES[selectedCooldownAbility].remaining}s</div>
            <div className="text-sm font-mono">
              Status: {COOLDOWN_ABILITIES[selectedCooldownAbility].remaining === 0 ? (
                <span className="text-green-400 font-bold">Ready</span>
              ) : (
                <span className="text-amber-400 font-bold">On Cooldown</span>
              )}
            </div>
          </div>
        </div>
        {/* All cooldowns overview */}
        <div className="flex items-center gap-4 justify-center flex-wrap mt-4 pt-3 border-t border-border/30">
          {COOLDOWN_ABILITIES.map((ab, i) => (
            <CooldownWheel key={ab.name} ability={ab} index={i} />
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Cooldown Wheel component ─────────────────────────────────────────── */

function CooldownWheel({ ability, index }: { ability: { name: string; cd: number; remaining: number; color: string }; index: number }) {
  const size = 56;
  const strokeW = 5;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = ability.remaining / ability.cd;
  const ready = ability.remaining === 0;

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
          {/* Cooldown arc */}
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={ready ? ACCENT_GREEN : ability.color}
            strokeWidth={strokeW}
            strokeDasharray={circ}
            strokeDashoffset={circ * pct}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ filter: `drop-shadow(0 0 4px ${ready ? ACCENT_GREEN : ability.color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-xs font-mono font-bold" style={{ color: ready ? ACCENT_GREEN : ability.color }}>
            {ready ? 'READY' : `${ability.remaining.toFixed(1)}s`}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[11px] font-mono font-bold text-text truncate max-w-[70px]">{ability.name}</div>
        <div className="text-[11px] font-mono text-text-muted">{ability.cd}s CD</div>
      </div>
    </motion.div>
  );
}
