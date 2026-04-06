'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Map as MapIcon } from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_RED, ACCENT_PURPLE_BOLD, STATUS_ERROR,
  STATUS_WARNING, STATUS_INFO, ACCENT_PURPLE, STATUS_NEUTRAL,
  withOpacity, OPACITY_8, OPACITY_20, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import {
  DIFFICULTY_GRUNT, DIFFICULTY_CASTER, DIFFICULTY_BRUTE,
  SPAWN_POINTS,
  TACTICS_ENEMIES, TACTICS_ROLE_COLORS,
  EXPANDED_WAVES,
} from '../data';
import { DifficultyChart } from './DifficultyChart';
import { TacticsMap } from './TacticsMap';
import { SpawnFormationViz } from './SpawnFormationViz';
import { ArchetypeBuilder } from '../archetypes/ArchetypeBuilder';
import { AggroTable } from '../ai-logic/AggroTable';

interface EncountersTabProps {
  accent: string;
}

const WAVE_ROW_H = 36;
const WAVE_OVERSCAN = 4;

export function EncountersTab({ accent }: EncountersTabProps) {
  const [spawnFormation, setSpawnFormation] = useState<'Circle' | 'Line' | 'Ambush'>('Circle');
  const [waveFilter, setWaveFilter] = useState<'all' | string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const filteredWaves = useMemo(() => {
    if (waveFilter === 'all') return EXPANDED_WAVES;
    return EXPANDED_WAVES.filter(w => w.tier === waveFilter);
  }, [waveFilter]);

  const containerH = Math.min(filteredWaves.length * WAVE_ROW_H, 400);
  const totalH = filteredWaves.length * WAVE_ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / WAVE_ROW_H) - WAVE_OVERSCAN);
  const endIdx = Math.min(filteredWaves.length, Math.ceil((scrollTop + containerH) / WAVE_ROW_H) + WAVE_OVERSCAN);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const tierColorValue = (tier: string) => {
    switch (tier) {
      case 'minion': return STATUS_NEUTRAL;
      case 'standard': return STATUS_INFO;
      case 'elite': return ACCENT_PURPLE;
      case 'boss': return STATUS_WARNING;
      case 'raid-boss': return ACCENT_RED;
      default: return 'var(--text-muted)';
    }
  };

  return (
    <motion.div key="encounters"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }} className="space-y-4">

      {/* Difficulty Curve */}
      <BlueprintPanel color={STATUS_ERROR} className="p-3">
        <SectionHeader icon={TrendingUp} label="Enemy Difficulty Curve" color={STATUS_ERROR} />
        <div className="mt-3">
          <DifficultyChart series={[
            { label: 'Grunt', data: DIFFICULTY_GRUNT, color: ACCENT_RED },
            { label: 'Caster', data: DIFFICULTY_CASTER, color: ACCENT_PURPLE_BOLD },
            { label: 'Brute', data: DIFFICULTY_BRUTE, color: MODULE_COLORS.content },
          ]} accent={STATUS_ERROR} />
        </div>
      </BlueprintPanel>

      {/* Group Tactics */}
      <BlueprintPanel color={accent} className="p-3">
        <SectionHeader icon={MapIcon} label="Enemy Group Tactics Planner" color={accent} />
        <div className="mt-3 flex flex-col md:flex-row gap-4">
          <TacticsMap enemies={TACTICS_ENEMIES} roleColors={TACTICS_ROLE_COLORS} accent={accent} />
          <TacticsLegend />
        </div>
      </BlueprintPanel>

      {/* Expanded Wave Choreographer with Virtual Scroll */}
      <BlueprintPanel color={MODULE_COLORS.content} className="p-3">
        <SectionHeader icon={Users} label={`Wave Choreographer (${EXPANDED_WAVES.length} waves)`} color={MODULE_COLORS.content} />
        <div className="mt-3 flex flex-col md:flex-row gap-4">
          <div className="flex-shrink-0 space-y-2">
            <SpawnFormationViz spawnPoints={SPAWN_POINTS} formation={spawnFormation} accent={MODULE_COLORS.content} />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-1">
              {SPAWN_POINTS.filter(sp => sp.role).reduce<{ role: string; color: string }[]>((acc, sp) => {
                if (!acc.find(r => r.role === sp.role)) acc.push({ role: sp.role!, color: sp.color! });
                return acc;
              }, []).map(r => (
                <span key={r.role} className="flex items-center gap-1 text-[10px] font-mono text-text-muted uppercase">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  {r.role}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <SpawnControls formation={spawnFormation} setFormation={setSpawnFormation} />
              <select value={waveFilter} onChange={(e) => setWaveFilter(e.target.value)}
                className="px-2 py-1 rounded border border-border/30 bg-surface-deep/60 text-xs font-mono text-text outline-none cursor-pointer">
                <option value="all">All tiers ({EXPANDED_WAVES.length})</option>
                {['minion', 'standard', 'elite', 'boss', 'raid-boss'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} ({EXPANDED_WAVES.filter(w => w.tier === t).length})</option>
                ))}
              </select>
            </div>

            {/* Virtual scrolled wave list */}
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              Wave Timeline ({filteredWaves.length} waves)
            </div>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="overflow-y-auto custom-scrollbar"
              style={{ height: containerH }}
            >
              <div style={{ height: totalH, position: 'relative' }}>
                {filteredWaves.slice(startIdx, endIdx).map((wave, i) => (
                  <div
                    key={wave.id}
                    className="absolute left-0 right-0 flex items-center gap-2 text-xs px-2 rounded border border-border/20 bg-surface-deep/50"
                    style={{
                      top: (startIdx + i) * WAVE_ROW_H,
                      height: WAVE_ROW_H - 2,
                    }}
                  >
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 border"
                      style={{ backgroundColor: withOpacity(MODULE_COLORS.content, OPACITY_8), borderColor: withOpacity(MODULE_COLORS.content, OPACITY_25), color: MODULE_COLORS.content }}>
                      {wave.id}
                    </span>
                    <span className="text-text-muted font-mono w-10 flex-shrink-0">{wave.delay}</span>
                    <span className="text-text font-medium truncate flex-1">{wave.archetype}</span>
                    <span className="font-mono font-bold uppercase text-[10px]" style={{ color: tierColorValue(wave.tier) }}>{wave.tier}</span>
                    <span className="text-text-muted font-mono text-xs flex-shrink-0">x{wave.count}</span>
                    <span className="text-text-muted/60 font-mono text-[10px] truncate max-w-[60px]">{wave.area}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ArchetypeBuilder />
        <AggroTable />
      </div>
    </motion.div>
  );
}

/* ── Tactics Legend ───────────────────────────────────────────────────── */

function TacticsLegend() {
  return (
    <div className="flex-1 space-y-3 min-w-0">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Tactics Config</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'MaxSimultaneous', value: '2' },
            { label: 'FlankingEnabled', value: 'true' },
          ].map(c => (
            <div key={c.label} className="bg-surface-deep rounded border border-border/30 px-2 py-1.5 text-center">
              <div className="text-xs font-mono font-bold text-text">{c.value}</div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Role Status</div>
        <div className="space-y-1">
          {TACTICS_ENEMIES.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TACTICS_ROLE_COLORS[e.role] }} />
              <span className="font-mono font-bold text-text w-12">{e.label}</span>
              <span className="font-medium capitalize" style={{ color: TACTICS_ROLE_COLORS[e.role] }}>{e.role}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-text-muted leading-relaxed">
        Attack slot rotation ensures only MaxSimultaneous enemies engage at once. Flankers circle around to rear. Waiting enemies hold positions until a slot opens.
      </p>
    </div>
  );
}

/* ── Spawn Controls ──────────────────────────────────────────────────── */

function SpawnControls({ formation, setFormation }: {
  formation: 'Circle' | 'Line' | 'Ambush';
  setFormation: (f: 'Circle' | 'Line' | 'Ambush') => void;
}) {
  return (
    <div className="flex gap-1.5">
      {(['Circle', 'Line', 'Ambush'] as const).map(f => (
        <button key={f} onClick={() => setFormation(f)}
          className="px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer border"
          style={formation === f
            ? { backgroundColor: withOpacity(STATUS_WARNING, OPACITY_20), color: STATUS_WARNING, borderColor: withOpacity(STATUS_WARNING, OPACITY_25) }
            : { color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }
          }>
          {f}
        </button>
      ))}
    </div>
  );
}
