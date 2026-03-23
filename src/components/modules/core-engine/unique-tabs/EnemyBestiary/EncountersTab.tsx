'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Map as MapIcon } from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_RED, ACCENT_PURPLE_BOLD, STATUS_ERROR,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import {
  DIFFICULTY_GRUNT, DIFFICULTY_CASTER, DIFFICULTY_BRUTE,
  SPAWN_POINTS, WAVE_TIMELINE,
  TACTICS_ENEMIES, TACTICS_ROLE_COLORS,
} from './data';
import { DifficultyChart } from './DifficultyChart';
import { TacticsMap } from './TacticsMap';
import { SpawnFormationViz } from './SpawnFormationViz';
import { ArchetypeBuilder } from './ArchetypeBuilder';
import { AggroTable } from './AggroTable';

interface EncountersTabProps {
  accent: string;
}

export function EncountersTab({ accent }: EncountersTabProps) {
  const [spawnFormation, setSpawnFormation] = useState<'Circle' | 'Line' | 'Ambush'>('Circle');

  return (
    <motion.div key="encounters"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }} className="space-y-4">

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
      </div>

      {/* Group Tactics */}
      <BlueprintPanel color={accent} className="p-3">
        <SectionHeader icon={MapIcon} label="Enemy Group Tactics Planner" color={accent} />
        <div className="mt-3 flex flex-col md:flex-row gap-4">
          <TacticsMap enemies={TACTICS_ENEMIES} roleColors={TACTICS_ROLE_COLORS} accent={accent} />
          <TacticsLegend />
        </div>
      </BlueprintPanel>

      {/* Spawn Wave Choreographer */}
      <BlueprintPanel color={MODULE_COLORS.content} className="p-3">
        <SectionHeader icon={Users} label="Spawn Wave Choreographer" color={MODULE_COLORS.content} />
        <div className="mt-3 flex flex-col md:flex-row gap-4">
          <SpawnFormationViz spawnPoints={SPAWN_POINTS} accent={MODULE_COLORS.content} />
          <SpawnControls
            formation={spawnFormation}
            setFormation={setSpawnFormation}
          />
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
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Tactics Config</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'MaxSimultaneous', value: '2' },
            { label: 'FlankingEnabled', value: 'true' },
          ].map(c => (
            <div key={c.label} className="bg-surface-deep rounded border border-border/30 px-2 py-1.5 text-center">
              <div className="text-xs font-mono font-bold text-text">{c.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Role Status</div>
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
    <div className="flex-1 space-y-3 min-w-0">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Formation</div>
        <div className="flex gap-1.5">
          {(['Circle', 'Line', 'Ambush'] as const).map(f => (
            <button key={f} onClick={() => setFormation(f)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                formation === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-text-muted hover:text-text bg-surface border border-border/40'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {[{ label: 'WaveDelay', value: '60s' }, { label: 'MaxActive', value: '12' }].map(c => (
          <div key={c.label} className="flex-1 py-1.5 px-2 rounded-lg bg-surface-deep border border-border/40 text-center">
            <div className="text-xs font-mono font-bold text-text">{c.value}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">{c.label}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1.5">Wave Timeline</div>
        <div className="space-y-1.5">
          {WAVE_TIMELINE.map(wave => (
            <motion.div key={wave.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: wave.id * 0.1 }}
              className="flex items-center gap-2 text-xs bg-surface-deep px-2 py-1.5 rounded border border-border/30">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[11px] font-mono font-bold text-amber-400 flex-shrink-0">
                {wave.id}
              </span>
              <span className="font-mono text-text-muted text-xs w-8">{wave.delay}</span>
              <span className="text-text font-medium">{wave.archetype}</span>
              <span className="ml-auto text-text-muted font-mono text-xs">x{wave.count}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
