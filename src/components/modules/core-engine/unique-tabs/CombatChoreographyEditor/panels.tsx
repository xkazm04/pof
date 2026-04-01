'use client';

import { useMemo } from 'react';
import {
  Plus, Trash2, Play, Pause, RotateCcw, Download, Copy, Check, Clock,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
} from '@/lib/chart-colors';
import type { WaveDef } from '@/lib/combat/choreography-sim';
import type { TuningOverrides } from '@/types/combat-simulator';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { FEEDBACK_CHANNEL_COLORS } from './types';
import { UnifiedTimeline } from './UnifiedTimeline';
import { TuningSlider, StatBox } from './TuningSlider';
export { ArchetypePalette, GhostLegend } from './GridPanels';

interface SimResult {
  totalDurationSec: number;
  damageEvents: import('@/lib/combat/choreography-sim').DamageEvent[];
  feedbackEvents: import('@/lib/combat/choreography-sim').FeedbackEvent[];
  alerts: { severity: 'critical' | 'warning' | 'info'; message: string; timeSec?: number }[];
}

/* ── Wave Manager ───────────────────────────────────────────────────────── */

export function WaveManager({ waves, selectedWave, waveEnemyCounts, totalEnemies, totalDuration, onSelect, onAdd, onRemove, onUpdateTime }: {
  waves: WaveDef[]; selectedWave: number; waveEnemyCounts: number[];
  totalEnemies: number; totalDuration: number;
  onSelect: (i: number) => void; onAdd: () => void;
  onRemove: (i: number) => void; onUpdateTime: (i: number, t: number) => void;
}) {
  return (
    <BlueprintPanel className="p-3 space-y-3 w-full xl:w-56">
      <div className="flex items-center justify-between">
        <SectionHeader label="Waves" />
        <button onClick={onAdd} className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
          <Plus className="w-3 h-3 text-text-muted" />
        </button>
      </div>
      <div className="space-y-1">
        {waves.map((wave, i) => (
          <div key={i}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-colors"
            style={{ borderColor: selectedWave === i ? `${ACCENT_CYAN}60` : 'var(--border)', backgroundColor: selectedWave === i ? `${ACCENT_CYAN}10` : 'transparent' }}
            onClick={() => onSelect(i)}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono font-bold truncate" style={{ color: selectedWave === i ? ACCENT_CYAN : 'var(--text)' }}>
                {wave.label}
              </div>
              <div className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
                <Clock className="w-2.5 h-2.5" />
                <input type="number" min={0} max={120} step={1} value={wave.spawnTimeSec}
                  onChange={(e) => onUpdateTime(i, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 bg-transparent border-b border-border/40 text-xs font-mono text-text-muted focus:outline-none focus:border-cyan-400/50" />
                s &middot; {waveEnemyCounts[i]} enemies
              </div>
            </div>
            {waves.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="p-0.5 rounded hover:bg-surface-deep transition-colors shrink-0">
                <Trash2 className="w-2.5 h-2.5 text-text-muted hover:text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border/30 space-y-1 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        <div className="flex justify-between"><span>Total enemies</span><span className="font-bold text-text">{totalEnemies}</span></div>
        <div className="flex justify-between"><span>Waves</span><span className="font-bold text-text">{waves.length}</span></div>
        <div className="flex justify-between"><span>Est. duration</span><span className="font-bold" style={{ color: ACCENT_CYAN }}>{totalDuration.toFixed(1)}s</span></div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Timeline Section ───────────────────────────────────────────────────── */

export function TimelineSection({ simResult, waves, scrubTime, isPlaying, onScrub, onTogglePlay, onReset }: {
  simResult: SimResult; waves: WaveDef[];
  scrubTime: number; isPlaying: boolean;
  onScrub: (t: number) => void; onTogglePlay: () => void; onReset: () => void;
}) {
  return (
    <BlueprintPanel className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader label={`Combat Timeline \u2014 ${simResult.damageEvents.length} events, ${simResult.totalDurationSec.toFixed(1)}s`} />
        <div className="flex items-center gap-1">
          <button onClick={onTogglePlay} className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
            {isPlaying ? <Pause className="w-3 h-3 text-text-muted" /> : <Play className="w-3 h-3 text-text-muted" />}
          </button>
          <button onClick={onReset} className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
            <RotateCcw className="w-3 h-3 text-text-muted" />
          </button>
          <span className="text-xs font-mono text-text-muted ml-1">{scrubTime.toFixed(1)}s</span>
        </div>
      </div>
      <UnifiedTimeline
        damageEvents={simResult.damageEvents} feedbackEvents={simResult.feedbackEvents}
        alerts={simResult.alerts} waves={waves} totalDuration={simResult.totalDurationSec}
        scrubTime={scrubTime} onScrub={onScrub}
      />
      <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-[0.15em] text-text-muted pt-1 border-t border-border/20">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ACCENT_EMERALD }} /> Player dmg</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> Enemy dmg</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border" style={{ backgroundColor: `${ACCENT_CYAN}40`, borderColor: ACCENT_CYAN }} /> Wave marker</span>
        {Object.entries(FEEDBACK_CHANNEL_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} /> {type}</span>
        ))}
      </div>
    </BlueprintPanel>
  );
}

/* ── Tuning Panel ───────────────────────────────────────────────────────── */

export function TuningPanel({ tuning, onUpdate, onReset }: {
  tuning: TuningOverrides;
  onUpdate: <K extends keyof TuningOverrides>(key: K, value: number) => void;
  onReset: () => void;
}) {
  return (
    <BlueprintPanel className="p-3 space-y-3">
      <SectionHeader label="Tuning Overrides" />
      <TuningSlider label="playerDmgMul" value={tuning.playerDamageMul} onChange={(v) => onUpdate('playerDamageMul', v)} color={ACCENT_EMERALD} />
      <TuningSlider label="enemyHPMul" value={tuning.enemyHealthMul} onChange={(v) => onUpdate('enemyHealthMul', v)} color={STATUS_ERROR} />
      <TuningSlider label="enemyDmgMul" value={tuning.enemyDamageMul} onChange={(v) => onUpdate('enemyDamageMul', v)} color={ACCENT_ORANGE} />
      <TuningSlider label="armorWeight" value={tuning.armorEffectivenessWeight} onChange={(v) => onUpdate('armorEffectivenessWeight', v)} color={ACCENT_VIOLET} />
      <TuningSlider label="critMulMul" value={tuning.critMultiplierMul} onChange={(v) => onUpdate('critMultiplierMul', v)} color={STATUS_WARNING} />
      <TuningSlider label="playerHPMul" value={tuning.playerHealthMul} onChange={(v) => onUpdate('playerHealthMul', v)} color={STATUS_SUCCESS} />
      <TuningSlider label="playerArmorMul" value={tuning.playerArmorMul} onChange={(v) => onUpdate('playerArmorMul', v)} color={ACCENT_CYAN} />
      <button onClick={onReset}
        className="w-full text-xs font-mono uppercase tracking-[0.15em] py-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors text-text-muted">
        Reset to Default
      </button>
    </BlueprintPanel>
  );
}

/* ── Stats Panel ────────────────────────────────────────────────────────── */

export function StatsPanel({ simResult }: { simResult: SimResult }) {
  const playerHits = useMemo(() => simResult.damageEvents.filter((e) => e.source === 'Player').length, [simResult.damageEvents]);
  const enemyHits = useMemo(() => simResult.damageEvents.filter((e) => e.target === 'Player').length, [simResult.damageEvents]);
  const crits = useMemo(() => simResult.damageEvents.filter((e) => e.isCrit).length, [simResult.damageEvents]);

  return (
    <BlueprintPanel className="p-3 space-y-3">
      <SectionHeader label="Simulation Stats" />
      <div className="grid grid-cols-2 gap-2">
        <GlowStat label="Duration" value={`${simResult.totalDurationSec.toFixed(1)}`} unit="sec" color={ACCENT_CYAN} delay={0} />
        <GlowStat label="Player Hits" value={`${playerHits}`} color={ACCENT_EMERALD} delay={0.05} />
        <GlowStat label="Enemy Hits" value={`${enemyHits}`} color={STATUS_ERROR} delay={0.1} />
        <GlowStat label="Crits" value={`${crits}`} color={STATUS_WARNING} delay={0.15} />
      </div>
    </BlueprintPanel>
  );
}

/* ── Export Panel ───────────────────────────────────────────────────────── */

export function ExportPanel({ exportConfig, onCopy, copied }: {
  exportConfig: string; onCopy: () => void; copied: boolean;
}) {
  return (
    <BlueprintPanel className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader label="UE5 Export" />
        <div className="flex items-center gap-1">
          <button onClick={onCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono uppercase tracking-[0.15em] font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
            {copied ? <Check className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} /> : <Copy className="w-2.5 h-2.5 text-text-muted" />}
            <span className="text-text-muted">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button onClick={() => {
            const blob = new Blob([exportConfig], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'EncounterConfig.h'; a.click();
            URL.revokeObjectURL(url);
          }}
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono uppercase tracking-[0.15em] font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
            <Download className="w-2.5 h-2.5 text-text-muted" />
            <span className="text-text-muted">.h</span>
          </button>
        </div>
      </div>
      <div className="rounded-md bg-black/50 border border-border/40 overflow-hidden">
        <pre className="p-2 text-xs font-mono text-text-muted leading-relaxed overflow-auto max-h-[220px] whitespace-pre">
          {exportConfig}
        </pre>
      </div>
    </BlueprintPanel>
  );
}
