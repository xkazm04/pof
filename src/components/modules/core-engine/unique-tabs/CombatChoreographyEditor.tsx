'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Plus, Trash2, Play, Pause, RotateCcw, Download, Copy, Check,
  AlertTriangle, Clock, Zap, Volume2, Camera, Sparkles, ChevronDown, X,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_VIOLET,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import {
  ENEMY_ARCHETYPES,
  PLAYER_ABILITIES,
  DEFAULT_TUNING,
} from '@/lib/combat/definitions';
import type { TuningOverrides, EnemyArchetype, CombatAbility, BalanceAlertSeverity } from '@/types/combat-simulator';

// ── Types ──────────────────────────────────────────────────────────────────

interface PlacedEnemy {
  id: string;
  archetypeId: string;
  gridX: number; // 0-based column
  gridY: number; // 0-based row
  waveIndex: number;
  level: number;
}

interface WaveDef {
  spawnTimeSec: number;
  label: string;
}

interface DamageEvent {
  timeSec: number;
  source: string;
  target: string;
  abilityName: string;
  damage: number;
  isCrit: boolean;
  element: 'Physical' | 'Fire' | 'Ice' | 'Lightning';
}

interface FeedbackEvent {
  timeSec: number;
  type: 'hitstop' | 'shake' | 'vfx' | 'sfx';
  durationSec: number;
  label: string;
  color: string;
}

interface BalanceAlert {
  severity: BalanceAlertSeverity;
  message: string;
  timeSec?: number; // position on timeline (undefined = aggregate/global alert)
}

// ── Constants ──────────────────────────────────────────────────────────────

const GRID_COLS = 6;
const GRID_ROWS = 4;
const CELL_SIZE = 48;

const ARCHETYPE_COLORS: Record<string, string> = {
  'melee-grunt': ACCENT_EMERALD,
  'ranged-caster': ACCENT_VIOLET,
  'brute': ACCENT_ORANGE,
  'elite-knight': STATUS_ERROR,
};

const ARCHETYPE_ICONS: Record<string, string> = {
  'melee-grunt': 'FG',
  'ranged-caster': 'DM',
  'brute': 'SB',
  'elite-knight': 'HK',
};

const FEEDBACK_CHANNEL_COLORS: Record<string, string> = {
  hitstop: STATUS_WARNING,
  shake: ACCENT_ORANGE,
  vfx: ACCENT_CYAN,
  sfx: ACCENT_VIOLET,
};

// ── Utility ────────────────────────────────────────────────────────────────

let _nextId = 1;
function nextId(): string {
  return `e${_nextId++}`;
}

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Simulation (simplified single-pass for timeline preview) ───────────────

function simulateEncounter(
  enemies: PlacedEnemy[],
  waves: WaveDef[],
  tuning: TuningOverrides,
  playerLevel: number,
): { damageEvents: DamageEvent[]; feedbackEvents: FeedbackEvent[]; alerts: BalanceAlert[]; totalDurationSec: number } {
  const damageEvents: DamageEvent[] = [];
  const feedbackEvents: FeedbackEvent[] = [];
  const rng = seededRandom(42);

  // Player stats (level-scaled)
  const playerAP = 15 + 3 * (playerLevel - 1);
  const playerArmor = 5 + 1.5 * (playerLevel - 1);
  const playerMaxHP = 100 + 12 * (playerLevel - 1);
  let playerHP = Math.round(playerMaxHP * tuning.playerHealthMul);

  // Build enemy instances per wave
  const enemyInstances = enemies.map((e) => {
    const arch = ENEMY_ARCHETYPES.find((a) => a.id === e.archetypeId)!;
    const hp = Math.round((arch.baseAttributes.maxHealth + (arch.levelScaling.maxHealth ?? 0) * (e.level - 1)) * tuning.enemyHealthMul);
    return {
      ...e,
      arch,
      hp,
      maxHP: hp,
      nextAttack: waves[e.waveIndex]?.spawnTimeSec ?? 0 + 0.5 + rng() * 1.5,
      alive: true,
    };
  });

  const abilities = PLAYER_ABILITIES.filter((a) => a.type !== 'buff' && a.type !== 'dodge');
  const elements: Array<'Physical' | 'Fire' | 'Ice' | 'Lightning'> = ['Physical', 'Fire', 'Ice', 'Lightning'];
  let totalDuration = 0;

  // Tick simulation at 0.2s resolution
  const maxTime = 60;
  let playerNextAction = 0;
  const abilityCooldowns: Record<string, number> = {};

  for (let t = 0; t < maxTime; t += 0.2) {
    const activeEnemies = enemyInstances.filter(
      (e) => e.alive && (waves[e.waveIndex]?.spawnTimeSec ?? 0) <= t,
    );

    if (activeEnemies.length === 0 && t > 1) {
      // Check if more waves coming
      const futureEnemies = enemyInstances.filter(
        (e) => e.alive && (waves[e.waveIndex]?.spawnTimeSec ?? 0) > t,
      );
      if (futureEnemies.length === 0) {
        totalDuration = t;
        break;
      }
      continue;
    }

    // Player attacks
    if (t >= playerNextAction && activeEnemies.length > 0) {
      const available = abilities.filter((a) => (abilityCooldowns[a.id] ?? 0) <= t);
      const ability = available.sort((a, b) => b.baseDamage - a.baseDamage)[0] ?? abilities[0];
      const target = activeEnemies[0];

      const baseDmg = ability.baseDamage + playerAP * ability.attackPowerScaling;
      const isCrit = rng() < 0.05 + 0.005 * (playerLevel - 1);
      const critMul = isCrit ? 1.5 * tuning.critMultiplierMul : 1.0;
      const targetArmor = target.arch.baseAttributes.armor + (target.arch.levelScaling.armor ?? 0) * (target.arch.baseAttributes.armor > 5 ? (target.hp / target.maxHP) : 1);
      const armorRed = (targetArmor * tuning.armorEffectivenessWeight) / (targetArmor * tuning.armorEffectivenessWeight + 100);
      const dmg = Math.max(1, Math.round(baseDmg * tuning.playerDamageMul * critMul * (1 - armorRed)));

      target.hp -= dmg;
      if (target.hp <= 0) target.alive = false;

      const element = ability.id === 'ga-fireball' ? 'Fire' : elements[Math.floor(rng() * 2)]; // mostly Physical

      damageEvents.push({
        timeSec: Math.round(t * 10) / 10,
        source: 'Player',
        target: target.arch.name,
        abilityName: ability.name,
        damage: dmg,
        isCrit,
        element,
      });

      // Feedback events per hit
      feedbackEvents.push({
        timeSec: Math.round(t * 10) / 10,
        type: 'hitstop',
        durationSec: isCrit ? 0.08 : 0.05,
        label: `Hitstop ${isCrit ? '(crit)' : ''}`,
        color: FEEDBACK_CHANNEL_COLORS.hitstop,
      });
      feedbackEvents.push({
        timeSec: Math.round(t * 10) / 10,
        type: 'shake',
        durationSec: isCrit ? 0.15 : 0.08,
        label: `Shake ${isCrit ? 'heavy' : 'light'}`,
        color: FEEDBACK_CHANNEL_COLORS.shake,
      });
      feedbackEvents.push({
        timeSec: Math.round(t * 10) / 10,
        type: 'vfx',
        durationSec: 0.3,
        label: `HitVFX (${element})`,
        color: FEEDBACK_CHANNEL_COLORS.vfx,
      });
      feedbackEvents.push({
        timeSec: Math.round(t * 10) / 10,
        type: 'sfx',
        durationSec: 0.2,
        label: `SFX (${element})`,
        color: FEEDBACK_CHANNEL_COLORS.sfx,
      });

      if (ability.cooldownSec > 0) abilityCooldowns[ability.id] = t + ability.cooldownSec;
      playerNextAction = t + ability.castTimeSec + 0.1;
    }

    // Enemy attacks
    for (const enemy of activeEnemies) {
      if (t < enemy.nextAttack || !enemy.alive) continue;

      const ability = enemy.arch.abilities[0];
      const enemyAP = enemy.arch.baseAttributes.attackPower + (enemy.arch.levelScaling.attackPower ?? 0) * (enemy.arch.baseAttributes.attackPower > 10 ? 0.5 : 1);
      const baseDmg = ability.baseDamage + enemyAP * ability.attackPowerScaling;
      const armorRed = (playerArmor * tuning.playerArmorMul * tuning.armorEffectivenessWeight) / (playerArmor * tuning.playerArmorMul * tuning.armorEffectivenessWeight + 100);
      const dmg = Math.max(1, Math.round(baseDmg * tuning.enemyDamageMul * (1 - armorRed)));

      playerHP -= dmg;

      damageEvents.push({
        timeSec: Math.round(t * 10) / 10,
        source: enemy.arch.name,
        target: 'Player',
        abilityName: ability.name,
        damage: dmg,
        isCrit: false,
        element: 'Physical',
      });

      enemy.nextAttack = t + enemy.arch.attackIntervalSec * (0.8 + rng() * 0.4);
    }

    if (playerHP <= 0) {
      totalDuration = t;
      break;
    }

    totalDuration = t;
  }

  // Generate alerts
  const alerts: BalanceAlert[] = [];
  const playerDied = playerHP <= 0;
  const totalPlayerDmgTaken = damageEvents.filter((e) => e.target === 'Player').reduce((s, e) => s + e.damage, 0);
  const totalPlayerDmgDealt = damageEvents.filter((e) => e.source === 'Player').reduce((s, e) => s + e.damage, 0);

  if (playerDied && totalDuration < 5) {
    alerts.push({ severity: 'critical', message: `Player dies in ${totalDuration.toFixed(1)}s — encounter is too punishing`, timeSec: totalDuration });
  } else if (playerDied) {
    alerts.push({ severity: 'warning', message: `Player dies at ${totalDuration.toFixed(1)}s — survival not guaranteed`, timeSec: totalDuration });
  }

  if (totalDuration > 45) {
    alerts.push({ severity: 'warning', message: 'Encounter lasts 45s+ — combat feels spongy', timeSec: 45 });
  }

  if (!playerDied && totalDuration < 3 && enemies.length > 0) {
    alerts.push({ severity: 'info', message: 'Encounter ends in <3s — trivially easy', timeSec: totalDuration });
  }

  const totalEnemyHP = enemyInstances.reduce((s, e) => s + e.maxHP, 0);
  if (totalEnemyHP > playerMaxHP * tuning.playerHealthMul * 5) {
    alerts.push({ severity: 'warning', message: `Combined enemy HP (${totalEnemyHP}) is 5x+ player HP — may feel tedious`, timeSec: 0 });
  }

  // Temporal alerts: detect DPS spikes and damage droughts
  const bucketSize = 2; // 2s buckets
  const buckets = new Map<number, { playerDmg: number; enemyDmg: number }>();
  for (const evt of damageEvents) {
    const bucket = Math.floor(evt.timeSec / bucketSize) * bucketSize;
    const b = buckets.get(bucket) ?? { playerDmg: 0, enemyDmg: 0 };
    if (evt.source === 'Player') b.playerDmg += evt.damage;
    else b.enemyDmg += evt.damage;
    buckets.set(bucket, b);
  }
  for (const [t, b] of buckets) {
    if (b.enemyDmg > playerMaxHP * tuning.playerHealthMul * 0.4) {
      alerts.push({ severity: 'critical', message: `Burst damage spike at ${t}s: ${b.enemyDmg} dmg in ${bucketSize}s (${(b.enemyDmg / (playerMaxHP * tuning.playerHealthMul) * 100).toFixed(0)}% of HP)`, timeSec: t });
    }
    if (t > 0 && b.playerDmg === 0 && b.enemyDmg === 0) {
      alerts.push({ severity: 'info', message: `Dead zone at ${t}–${t + bucketSize}s: no combat activity`, timeSec: t });
    }
  }

  return { damageEvents, feedbackEvents, alerts, totalDurationSec: totalDuration };
}

// ── UE5 Export ─────────────────────────────────────────────────────────────

function generateUE5Export(
  enemies: PlacedEnemy[],
  waves: WaveDef[],
  tuning: TuningOverrides,
): string {
  const lines: string[] = [];
  lines.push('// ══════════════════════════════════════════════════════════════════════');
  lines.push('// Combat Encounter Configuration — generated by PoF Choreography Editor');
  lines.push('// ══════════════════════════════════════════════════════════════════════');
  lines.push('');

  // Spawn data table
  lines.push('// ── FEncounterSpawnEntry (UDataTable rows) ─────────────────────────');
  lines.push('USTRUCT(BlueprintType)');
  lines.push('struct FEncounterSpawnEntry : public FTableRowBase');
  lines.push('{');
  lines.push('    GENERATED_BODY()');
  lines.push('');
  lines.push('    UPROPERTY(EditAnywhere) FName ArchetypeId;');
  lines.push('    UPROPERTY(EditAnywhere) int32 WaveIndex;');
  lines.push('    UPROPERTY(EditAnywhere) float SpawnTimeSec;');
  lines.push('    UPROPERTY(EditAnywhere) FVector2D GridPosition;');
  lines.push('    UPROPERTY(EditAnywhere) int32 Level;');
  lines.push('};');
  lines.push('');

  lines.push('// ── Spawn Data ─────────────────────────────────────────────────────');
  for (const [i, e] of enemies.entries()) {
    const arch = ENEMY_ARCHETYPES.find((a) => a.id === e.archetypeId);
    const wave = waves[e.waveIndex];
    lines.push(`// Row ${i + 1}: ${arch?.name ?? e.archetypeId}`);
    lines.push(`// ArchetypeId: "${e.archetypeId}", Wave: ${e.waveIndex}, SpawnTime: ${wave?.spawnTimeSec ?? 0}s, Grid: (${e.gridX}, ${e.gridY}), Level: ${e.level}`);
  }
  lines.push('');

  // Wave config
  lines.push('// ── Wave Configuration ────────────────────────────────────────────');
  for (const [i, w] of waves.entries()) {
    lines.push(`// Wave ${i}: "${w.label}" at ${w.spawnTimeSec}s`);
  }
  lines.push('');

  // Tuning overrides
  lines.push('// ── CombatFeedbackComponent Parameter Overrides ───────────────────');
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float PlayerDamageMul = ${tuning.playerDamageMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float EnemyHealthMul = ${tuning.enemyHealthMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float EnemyDamageMul = ${tuning.enemyDamageMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float ArmorEffectivenessWeight = ${tuning.armorEffectivenessWeight.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float CritMultiplierMul = ${tuning.critMultiplierMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float PlayerHealthMul = ${tuning.playerHealthMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float PlayerArmorMul = ${tuning.playerArmorMul.toFixed(2)}f;`);
  lines.push(`UPROPERTY(EditAnywhere, Category = "Tuning") float HealingMul = ${tuning.healingMul.toFixed(2)}f;`);

  return lines.join('\n');
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Spatial grid for placing enemies */
function SpatialGrid({ enemies, selectedWave, totalWaves, onPlace, onRemove }: {
  enemies: PlacedEnemy[];
  selectedWave: number;
  totalWaves: number;
  onPlace: (x: number, y: number) => void;
  onRemove: (id: string) => void;
}) {
  const waveEnemies = enemies.filter((e) => e.waveIndex === selectedWave);
  const prevWaveEnemies = selectedWave > 0
    ? enemies.filter((e) => e.waveIndex === selectedWave - 1)
    : [];
  const nextWaveEnemies = selectedWave < totalWaves - 1
    ? enemies.filter((e) => e.waveIndex === selectedWave + 1)
    : [];

  return (
    <div className="inline-block">
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
        }}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
          const x = i % GRID_COLS;
          const y = Math.floor(i / GRID_COLS);
          const enemy = waveEnemies.find((e) => e.gridX === x && e.gridY === y);

          // Ghost from previous wave
          const prevGhost = !enemy ? prevWaveEnemies.find((e) => e.gridX === x && e.gridY === y) : null;
          // Pulse from next wave
          const nextGhost = !enemy && !prevGhost ? nextWaveEnemies.find((e) => e.gridX === x && e.gridY === y) : null;

          if (enemy) {
            const color = ARCHETYPE_COLORS[enemy.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[enemy.archetypeId] ?? '??';
            return (
              <div
                key={i}
                className="relative flex items-center justify-center rounded-md border-2 cursor-pointer group"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderColor: color,
                  backgroundColor: `${color}20`,
                }}
                onClick={() => onRemove(enemy.id)}
                title={`${ENEMY_ARCHETYPES.find((a) => a.id === enemy.archetypeId)?.name} Lv${enemy.level} — click to remove`}
              >
                <span className="text-xs font-mono font-bold" style={{ color }}>{icon}</span>
                <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold px-0.5 rounded"
                  style={{ backgroundColor: color, color: 'black' }}>
                  {enemy.level}
                </span>
                <Trash2 className="absolute inset-0 m-auto w-3.5 h-3.5 opacity-0 group-hover:opacity-80 transition-opacity" style={{ color: STATUS_ERROR }} />
              </div>
            );
          }

          // Previous wave ghost — low opacity, dashed border
          if (prevGhost) {
            const color = ARCHETYPE_COLORS[prevGhost.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[prevGhost.archetypeId] ?? '??';
            return (
              <div
                key={i}
                className="relative flex items-center justify-center rounded-md cursor-pointer hover:border-border/50 transition-colors"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  border: `1px dashed ${color}40`,
                  backgroundColor: `${color}08`,
                  opacity: 0.45,
                }}
                onClick={() => onPlace(x, y)}
                title={`Previous wave: ${ENEMY_ARCHETYPES.find((a) => a.id === prevGhost.archetypeId)?.name ?? prevGhost.archetypeId} Lv${prevGhost.level}`}
              >
                <span className="text-[10px] font-mono font-bold" style={{ color }}>{icon}</span>
                <span className="absolute bottom-0.5 right-0.5 text-[6px] font-mono text-text-muted/50">prev</span>
              </div>
            );
          }

          // Next wave ghost — pulsing outline
          if (nextGhost) {
            const color = ARCHETYPE_COLORS[nextGhost.archetypeId] ?? ACCENT_CYAN;
            const icon = ARCHETYPE_ICONS[nextGhost.archetypeId] ?? '??';
            return (
              <motion.div
                key={i}
                className="relative flex items-center justify-center rounded-md cursor-pointer"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  border: `1px dashed ${color}35`,
                  backgroundColor: `${color}05`,
                }}
                animate={{
                  borderColor: [`${color}20`, `${color}50`, `${color}20`],
                  boxShadow: [`0 0 0px ${color}00`, `0 0 6px ${color}30`, `0 0 0px ${color}00`],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                onClick={() => onPlace(x, y)}
                title={`Next wave: ${ENEMY_ARCHETYPES.find((a) => a.id === nextGhost.archetypeId)?.name ?? nextGhost.archetypeId} Lv${nextGhost.level}`}
              >
                <span className="text-[10px] font-mono font-bold" style={{ color, opacity: 0.35 }}>{icon}</span>
                <span className="absolute bottom-0.5 right-0.5 text-[6px] font-mono text-text-muted/40">next</span>
              </motion.div>
            );
          }

          return (
            <div
              key={i}
              className="flex items-center justify-center rounded-md border border-border/20 bg-surface-deep/30 cursor-pointer hover:border-border/50 hover:bg-surface-deep/60 transition-colors"
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              onClick={() => onPlace(x, y)}
            >
              <Plus className="w-3 h-3 text-text-muted/30" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** DPS-over-time sparkline — aggregates damage events into 1s buckets, stacked area for player vs enemy */
function EncounterPacingCurve({ damageEvents, waves, totalDuration, scrubTime, onScrub }: {
  damageEvents: DamageEvent[];
  waves: WaveDef[];
  totalDuration: number;
  scrubTime: number;
  onScrub: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(totalDuration, 5);
  const pxPerSec = 40;
  const totalWidth = duration * pxPerSec;
  const HEIGHT = 48;

  // Aggregate into 1-second buckets
  const buckets = useMemo(() => {
    const count = Math.ceil(duration);
    const b: { playerDmg: number; enemyDmg: number }[] = Array.from({ length: count }, () => ({ playerDmg: 0, enemyDmg: 0 }));
    for (const evt of damageEvents) {
      const idx = Math.min(Math.floor(evt.timeSec), count - 1);
      if (idx < 0) continue;
      if (evt.source === 'Player') b[idx].playerDmg += evt.damage;
      else b[idx].enemyDmg += evt.damage;
    }
    return b;
  }, [damageEvents, duration]);

  const maxDmg = useMemo(() => Math.max(1, ...buckets.map((b) => b.playerDmg + b.enemyDmg)), [buckets]);

  // Build SVG area paths
  const { playerPath, enemyPath } = useMemo(() => {
    const count = buckets.length;
    if (count === 0) return { playerPath: '', enemyPath: '' };

    // For each bucket, compute y positions. Enemy stacks on top of player.
    const points = buckets.map((b, i) => {
      const x = (i + 0.5) * pxPerSec; // center of bucket
      const playerH = (b.playerDmg / maxDmg) * (HEIGHT - 4);
      const enemyH = (b.enemyDmg / maxDmg) * (HEIGHT - 4);
      return { x, playerH, enemyH };
    });

    // Player area: bottom to playerH
    const baseY = HEIGHT;
    let pTop = '';
    let pBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH } = points[i];
      const y = baseY - playerH;
      pTop += (i === 0 ? 'M' : 'L') + `${x},${y}`;
      pBot = `L${x},${baseY}` + pBot;
    }
    const playerP = pTop + `L${points[points.length - 1].x},${baseY}` + `L${points[0].x},${baseY}Z`;

    // Enemy area: from playerH to playerH+enemyH (stacked)
    let eTop = '';
    let eBot = '';
    for (let i = 0; i < points.length; i++) {
      const { x, playerH, enemyH } = points[i];
      const yBot = baseY - playerH;
      const yTop = baseY - playerH - enemyH;
      eTop += (i === 0 ? 'M' : 'L') + `${x},${yTop}`;
      eBot = `L${x},${yBot}` + eBot;
    }
    const enemyP = eTop + eBot.replace(/^L/, 'L') + `L${points[0].x},${baseY - points[0].playerH}Z`;

    return { playerPath: playerP, enemyPath: enemyP };
  }, [buckets, maxDmg, pxPerSec]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    const t = Math.max(0, Math.min(duration, x / pxPerSec));
    onScrub(t);
  }, [duration, pxPerSec, onScrub]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono font-bold text-text-muted w-14 shrink-0 uppercase">Pacing</span>
      <div
        ref={containerRef}
        className="relative overflow-x-auto custom-scrollbar"
        style={{ height: HEIGHT }}
        onClick={handleClick}
      >
        <div
          className="relative bg-black/30 rounded border border-border/20 cursor-crosshair"
          style={{ width: totalWidth, height: HEIGHT }}
        >
          {/* Time grid */}
          {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
            <div key={i} className="absolute top-0 h-full border-l border-border/10" style={{ left: i * pxPerSec }} />
          ))}

          {/* SVG area chart */}
          <svg
            className="absolute inset-0"
            width={totalWidth}
            height={HEIGHT}
            viewBox={`0 0 ${totalWidth} ${HEIGHT}`}
            preserveAspectRatio="none"
          >
            {/* Player damage area (bottom) */}
            {playerPath && (
              <path d={playerPath} fill={`${ACCENT_EMERALD}40`} stroke={ACCENT_EMERALD} strokeWidth="1.5" />
            )}
            {/* Enemy damage area (stacked on top) */}
            {enemyPath && (
              <path d={enemyPath} fill={`${STATUS_ERROR}35`} stroke={STATUS_ERROR} strokeWidth="1.5" />
            )}
          </svg>

          {/* Wave-start vertical markers */}
          {waves.map((w, i) => (
            <div
              key={i}
              className="absolute top-0 h-full flex flex-col items-center pointer-events-none"
              style={{ left: w.spawnTimeSec * pxPerSec }}
            >
              <div
                className="h-full w-px"
                style={{ backgroundColor: ACCENT_CYAN, opacity: 0.6 }}
              />
              <span
                className="absolute top-0 left-1 text-[7px] font-mono font-bold whitespace-nowrap"
                style={{ color: ACCENT_CYAN, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
              >
                W{i + 1}
              </span>
            </div>
          ))}

          {/* Scrub line */}
          <div
            className="absolute top-0 h-full w-px pointer-events-none z-10"
            style={{ left: scrubTime * pxPerSec, backgroundColor: 'white' }}
          />
        </div>
      </div>
    </div>
  );
}

/** Timeline scrubber showing damage events, feedback channels, and balance alerts */
function TimelineScrubber({ damageEvents, feedbackEvents, alerts, totalDuration, scrubTime, onScrub }: {
  damageEvents: DamageEvent[];
  feedbackEvents: FeedbackEvent[];
  alerts: BalanceAlert[];
  totalDuration: number;
  scrubTime: number;
  onScrub: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(totalDuration, 5);
  const pxPerSec = 40;
  const totalWidth = duration * pxPerSec;

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    const t = Math.max(0, Math.min(duration, x / pxPerSec));
    onScrub(t);
  }, [duration, pxPerSec, onScrub]);

  const channels: Array<{ type: string; label: string; icon: typeof Camera; color: string }> = [
    { type: 'hitstop', label: 'Hitstop', icon: Clock, color: FEEDBACK_CHANNEL_COLORS.hitstop },
    { type: 'shake', label: 'Shake', icon: Camera, color: FEEDBACK_CHANNEL_COLORS.shake },
    { type: 'vfx', label: 'VFX', icon: Sparkles, color: FEEDBACK_CHANNEL_COLORS.vfx },
    { type: 'sfx', label: 'SFX', icon: Volume2, color: FEEDBACK_CHANNEL_COLORS.sfx },
  ];

  return (
    <div className="space-y-1">
      {/* Damage events lane */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-text-muted w-14 shrink-0 uppercase">Damage</span>
        <div
          ref={containerRef}
          className="relative overflow-x-auto custom-scrollbar"
          style={{ height: 28 }}
          onClick={handleClick}
        >
          <div className="relative bg-black/30 rounded border border-border/20 cursor-crosshair"
            style={{ width: totalWidth, height: 28 }}>
            {/* Time markers */}
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className="absolute top-0 h-full border-l border-border/10"
                style={{ left: i * pxPerSec }}>
                <span className="absolute -bottom-3 left-0.5 text-[7px] font-mono text-text-muted/40">{i}s</span>
              </div>
            ))}
            {/* Damage event marks */}
            {damageEvents.map((evt, i) => {
              const x = evt.timeSec * pxPerSec;
              const isPlayerDmg = evt.source === 'Player';
              const color = isPlayerDmg ? ACCENT_EMERALD : STATUS_ERROR;
              const h = Math.min(24, 6 + (evt.damage / 20));
              return (
                <div
                  key={i}
                  className="absolute bottom-0.5 rounded-t"
                  style={{
                    left: x - 1,
                    width: 3,
                    height: h,
                    backgroundColor: color,
                    opacity: evt.isCrit ? 1 : 0.7,
                    boxShadow: evt.isCrit ? `0 0 4px ${color}` : 'none',
                  }}
                  title={`${evt.timeSec}s: ${evt.source} → ${evt.target} (${evt.abilityName}) ${evt.damage}${evt.isCrit ? ' CRIT' : ''}`}
                />
              );
            })}
            {/* Scrub line */}
            <div
              className="absolute top-0 h-full w-px pointer-events-none z-10"
              style={{ left: scrubTime * pxPerSec, backgroundColor: 'white' }}
            />
          </div>
        </div>
      </div>

      {/* Balance alert markers lane */}
      {alerts.filter((a) => a.timeSec !== undefined).length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold w-14 shrink-0 uppercase" style={{ color: STATUS_WARNING }}>
            Alerts
          </span>
          <div className="relative overflow-x-auto custom-scrollbar" style={{ height: 20 }}>
            <div className="relative bg-black/20 rounded border border-border/10 cursor-crosshair"
              style={{ width: totalWidth, height: 20 }}
              onClick={handleClick}>
              {alerts.filter((a) => a.timeSec !== undefined).map((alert, i) => {
                const color = alert.severity === 'critical' ? STATUS_ERROR
                  : alert.severity === 'warning' ? STATUS_WARNING : STATUS_INFO;
                const x = (alert.timeSec ?? 0) * pxPerSec;
                return (
                  <div
                    key={i}
                    className="absolute top-0 flex items-center justify-center group"
                    style={{ left: x - 8, width: 16, height: 20 }}
                  >
                    {/* Vertical tick */}
                    <div className="absolute top-0 h-full w-px opacity-30" style={{ backgroundColor: color }} />
                    {/* Icon */}
                    <div
                      className="relative z-10 flex items-center justify-center rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: `${color}20`,
                        border: `1.5px solid ${color}`,
                        boxShadow: `0 0 6px ${color}40`,
                      }}
                    >
                      <AlertTriangle className="w-2 h-2" style={{ color }} />
                    </div>
                    {/* Tooltip */}
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap max-w-[240px]"
                      style={{
                        backgroundColor: 'var(--surface-deep, #0a0a0a)',
                        borderColor: `${color}60`,
                        boxShadow: `0 2px 12px ${color}30`,
                      }}
                    >
                      <div className="text-[8px] font-mono font-bold uppercase tracking-widest mb-0.5" style={{ color }}>
                        {alert.severity} @ {(alert.timeSec ?? 0).toFixed(1)}s
                      </div>
                      <div className="text-[9px] font-mono text-text-muted whitespace-normal leading-tight">
                        {alert.message}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Scrub line */}
              <div
                className="absolute top-0 h-full w-px pointer-events-none z-10"
                style={{ left: scrubTime * pxPerSec, backgroundColor: 'white' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Feedback channel lanes */}
      {channels.map((ch) => {
        const channelEvents = feedbackEvents.filter((e) => e.type === ch.type);
        return (
          <div key={ch.type} className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold w-14 shrink-0 uppercase" style={{ color: ch.color }}>
              {ch.label}
            </span>
            <div className="relative overflow-x-auto custom-scrollbar" style={{ height: 14 }}>
              <div className="relative bg-black/20 rounded border border-border/10 cursor-crosshair"
                style={{ width: totalWidth, height: 14 }}
                onClick={handleClick}>
                {channelEvents.map((evt, i) => (
                  <div
                    key={i}
                    className="absolute top-0.5 rounded-sm"
                    style={{
                      left: evt.timeSec * pxPerSec,
                      width: Math.max(3, evt.durationSec * pxPerSec),
                      height: 10,
                      backgroundColor: `${ch.color}50`,
                      border: `1px solid ${ch.color}80`,
                    }}
                    title={evt.label}
                  />
                ))}
                <div
                  className="absolute top-0 h-full w-px pointer-events-none z-10"
                  style={{ left: scrubTime * pxPerSec, backgroundColor: 'white' }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tuning slider with default tick, delta badge, and per-slider reset */
function TuningSlider({ label, value, defaultValue = 1.0, onChange, color }: {
  label: string;
  value: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const c = color || ACCENT_CYAN;
  const delta = value - defaultValue;
  const hasDelta = Math.abs(delta) >= 0.01;
  // Position of the default tick as % of track (min=0.5, max=2.0, range=1.5)
  const defaultPct = ((defaultValue - 0.5) / 1.5) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-text-muted w-20 truncate shrink-0">{label}</span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none bg-border cursor-pointer relative z-10
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer"
          style={{ accentColor: c }}
        />
        {/* Default tick mark */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-2.5 rounded-full pointer-events-none z-0"
          style={{ left: `${defaultPct}%`, backgroundColor: c, opacity: 0.3 }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color: c }}>
        {value.toFixed(2)}
      </span>
      {/* Delta badge */}
      {hasDelta && (
        <span
          className="text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
          style={{ color: c, backgroundColor: `${c}15` }}
        >
          {delta > 0 ? '+' : ''}{delta.toFixed(2)}
        </span>
      )}
      {/* Per-slider reset */}
      {hasDelta && (
        <button
          onClick={() => onChange(defaultValue)}
          className="shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors"
          title={`Reset to ${defaultValue.toFixed(2)}`}
        >
          <X className="w-2.5 h-2.5 text-text-muted hover:text-text" />
        </button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function CombatChoreographyEditor() {
  // State
  const [enemies, setEnemies] = useState<PlacedEnemy[]>([
    { id: nextId(), archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'melee-grunt', gridX: 4, gridY: 1, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'ranged-caster', gridX: 3, gridY: 3, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'brute', gridX: 2, gridY: 0, waveIndex: 1, level: 6 },
    { id: nextId(), archetypeId: 'elite-knight', gridX: 3, gridY: 1, waveIndex: 2, level: 7 },
  ]);

  const [waves, setWaves] = useState<WaveDef[]>([
    { spawnTimeSec: 0, label: 'Initial' },
    { spawnTimeSec: 8, label: 'Reinforcement' },
    { spawnTimeSec: 18, label: 'Boss Wave' },
  ]);

  const [selectedWave, setSelectedWave] = useState(0);
  const [selectedArchetype, setSelectedArchetype] = useState('melee-grunt');
  const [placeLevel, setPlaceLevel] = useState(5);
  const [tuning, setTuning] = useState<TuningOverrides>({ ...DEFAULT_TUNING });
  const [scrubTime, setScrubTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playerLevel, setPlayerLevel] = useState(5);

  // Animation playback
  const playRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      return;
    }
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setScrubTime((prev) => {
        const next = prev + dt;
        if (next >= simResult.totalDurationSec) {
          setIsPlaying(false);
          return simResult.totalDurationSec;
        }
        return next;
      });
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => { if (playRef.current) cancelAnimationFrame(playRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Simulate encounter
  const simResult = useMemo(
    () => simulateEncounter(enemies, waves, tuning, playerLevel),
    [enemies, waves, tuning, playerLevel],
  );

  // Handlers
  const handlePlace = useCallback((x: number, y: number) => {
    setEnemies((prev) => [
      ...prev,
      { id: nextId(), archetypeId: selectedArchetype, gridX: x, gridY: y, waveIndex: selectedWave, level: placeLevel },
    ]);
  }, [selectedArchetype, selectedWave, placeLevel]);

  const handleRemove = useCallback((id: string) => {
    setEnemies((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateTuning = useCallback(<K extends keyof TuningOverrides>(key: K, value: number) => {
    setTuning((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAddWave = useCallback(() => {
    const lastTime = waves[waves.length - 1]?.spawnTimeSec ?? 0;
    setWaves((prev) => [...prev, { spawnTimeSec: lastTime + 10, label: `Wave ${prev.length}` }]);
  }, [waves]);

  const handleRemoveWave = useCallback((idx: number) => {
    if (waves.length <= 1) return;
    setWaves((prev) => prev.filter((_, i) => i !== idx));
    setEnemies((prev) => prev.filter((e) => e.waveIndex !== idx).map((e) => ({
      ...e,
      waveIndex: e.waveIndex > idx ? e.waveIndex - 1 : e.waveIndex,
    })));
    if (selectedWave >= idx && selectedWave > 0) setSelectedWave(selectedWave - 1);
  }, [waves.length, selectedWave]);

  const handleUpdateWaveTime = useCallback((idx: number, time: number) => {
    setWaves((prev) => prev.map((w, i) => i === idx ? { ...w, spawnTimeSec: time } : w));
  }, []);

  const exportConfig = useMemo(() => generateUE5Export(enemies, waves, tuning), [enemies, waves, tuning]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportConfig]);

  const handleReset = useCallback(() => {
    setScrubTime(0);
    setIsPlaying(false);
  }, []);

  // Stats
  const totalEnemies = enemies.length;
  const waveEnemyCounts = waves.map((_, i) => enemies.filter((e) => e.waveIndex === i).length);

  return (
    <div className="space-y-2.5" data-testid="combat-choreography-editor">
      {/* ── Row 1: Grid + Archetype Palette + Waves ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-2.5">
        {/* Left: Spatial Grid */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              Spatial Grid — Wave {selectedWave}: {waves[selectedWave]?.label}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
              <Users className="w-3 h-3" />
              {enemies.filter((e) => e.waveIndex === selectedWave).length} placed
            </div>
          </div>

          <div className="flex items-start gap-3">
            <SpatialGrid
              enemies={enemies}
              selectedWave={selectedWave}
              totalWaves={waves.length}
              onPlace={handlePlace}
              onRemove={handleRemove}
            />

            {/* Archetype palette */}
            <div className="space-y-1.5 shrink-0">
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Archetype</div>
              {ENEMY_ARCHETYPES.map((arch) => {
                const color = ARCHETYPE_COLORS[arch.id] ?? ACCENT_CYAN;
                const isActive = selectedArchetype === arch.id;
                return (
                  <button
                    key={arch.id}
                    onClick={() => setSelectedArchetype(arch.id)}
                    className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-mono font-bold rounded-md border transition-colors text-left"
                    style={{
                      borderColor: isActive ? color : 'var(--border)',
                      backgroundColor: isActive ? `${color}15` : 'transparent',
                      color: isActive ? color : 'var(--text-muted)',
                    }}
                  >
                    <span className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px]"
                      style={{ backgroundColor: `${color}30`, color }}>
                      {ARCHETYPE_ICONS[arch.id]}
                    </span>
                    {arch.name}
                  </button>
                );
              })}
              <div className="h-px bg-border/30" />
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Level</div>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={1} max={20} value={placeLevel}
                  onChange={(e) => setPlaceLevel(Number(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none bg-border cursor-pointer"
                  style={{ accentColor: ACCENT_CYAN }}
                />
                <span className="text-[10px] font-mono font-bold w-5 text-center" style={{ color: ACCENT_CYAN }}>{placeLevel}</span>
              </div>
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Player Lv</div>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={1} max={20} value={playerLevel}
                  onChange={(e) => setPlayerLevel(Number(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none bg-border cursor-pointer"
                  style={{ accentColor: ACCENT_EMERALD }}
                />
                <span className="text-[10px] font-mono font-bold w-5 text-center" style={{ color: ACCENT_EMERALD }}>{playerLevel}</span>
              </div>
            </div>
          </div>

          {/* Ghost legend */}
          {(selectedWave > 0 || selectedWave < waves.length - 1) && (
            <div className="flex items-center gap-3 text-[8px] font-mono text-text-muted/60 pt-1 border-t border-border/20">
              {selectedWave > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-dashed border-text-muted/30" style={{ opacity: 0.45 }} />
                  prev wave ghost
                </span>
              )}
              {selectedWave < waves.length - 1 && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-dashed border-text-muted/30 animate-pulse" />
                  next wave pulse
                </span>
              )}
            </div>
          )}
        </SurfaceCard>

        {/* Right: Wave manager */}
        <SurfaceCard level={2} className="p-3 space-y-2 w-full xl:w-56">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Waves</div>
            <button onClick={handleAddWave}
              className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
              <Plus className="w-3 h-3 text-text-muted" />
            </button>
          </div>
          <div className="space-y-1">
            {waves.map((wave, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border cursor-pointer transition-colors"
                style={{
                  borderColor: selectedWave === i ? `${ACCENT_CYAN}60` : 'var(--border)',
                  backgroundColor: selectedWave === i ? `${ACCENT_CYAN}10` : 'transparent',
                }}
                onClick={() => setSelectedWave(i)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono font-bold truncate"
                    style={{ color: selectedWave === i ? ACCENT_CYAN : 'var(--text)' }}>
                    {wave.label}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-text-muted font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    <input
                      type="number"
                      min={0} max={120} step={1}
                      value={wave.spawnTimeSec}
                      onChange={(e) => handleUpdateWaveTime(i, Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 bg-transparent border-b border-border/40 text-[9px] font-mono text-text-muted focus:outline-none focus:border-cyan-400/50"
                    />
                    s &middot; {waveEnemyCounts[i]} enemies
                  </div>
                </div>
                {waves.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveWave(i); }}
                    className="p-0.5 rounded hover:bg-surface-deep transition-colors shrink-0"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-text-muted hover:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* Summary */}
          <div className="pt-2 border-t border-border/30 space-y-1 text-[9px] font-mono text-text-muted">
            <div className="flex justify-between">
              <span>Total enemies</span>
              <span className="font-bold text-text">{totalEnemies}</span>
            </div>
            <div className="flex justify-between">
              <span>Waves</span>
              <span className="font-bold text-text">{waves.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Est. duration</span>
              <span className="font-bold" style={{ color: ACCENT_CYAN }}>{simResult.totalDurationSec.toFixed(1)}s</span>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ── Row 2: Timeline + Playback Controls ── */}
      <SurfaceCard level={2} className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Combat Timeline — {simResult.damageEvents.length} events, {simResult.totalDurationSec.toFixed(1)}s
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 text-text-muted" />
              ) : (
                <Play className="w-3 h-3 text-text-muted" />
              )}
            </button>
            <button onClick={handleReset}
              className="p-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors">
              <RotateCcw className="w-3 h-3 text-text-muted" />
            </button>
            <span className="text-[10px] font-mono text-text-muted ml-1">
              {scrubTime.toFixed(1)}s
            </span>
          </div>
        </div>

        <EncounterPacingCurve
          damageEvents={simResult.damageEvents}
          waves={waves}
          totalDuration={simResult.totalDurationSec}
          scrubTime={scrubTime}
          onScrub={setScrubTime}
        />

        <TimelineScrubber
          damageEvents={simResult.damageEvents}
          feedbackEvents={simResult.feedbackEvents}
          alerts={simResult.alerts}
          totalDuration={simResult.totalDurationSec}
          scrubTime={scrubTime}
          onScrub={setScrubTime}
        />

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-text-muted pt-1 border-t border-border/20">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ACCENT_EMERALD }} /> Player dmg
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> Enemy dmg
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm border" style={{ backgroundColor: `${ACCENT_CYAN}40`, borderColor: ACCENT_CYAN }} /> Wave marker
          </span>
          {Object.entries(FEEDBACK_CHANNEL_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} /> {type}
            </span>
          ))}
        </div>
      </SurfaceCard>

      {/* ── Row 3: Tuning Sliders + Alerts + Export ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5">
        {/* Tuning sliders */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Tuning Overrides
          </div>
          <TuningSlider label="playerDmgMul" value={tuning.playerDamageMul} onChange={(v) => updateTuning('playerDamageMul', v)} color={ACCENT_EMERALD} />
          <TuningSlider label="enemyHPMul" value={tuning.enemyHealthMul} onChange={(v) => updateTuning('enemyHealthMul', v)} color={STATUS_ERROR} />
          <TuningSlider label="enemyDmgMul" value={tuning.enemyDamageMul} onChange={(v) => updateTuning('enemyDamageMul', v)} color={ACCENT_ORANGE} />
          <TuningSlider label="armorWeight" value={tuning.armorEffectivenessWeight} onChange={(v) => updateTuning('armorEffectivenessWeight', v)} color={ACCENT_VIOLET} />
          <TuningSlider label="critMulMul" value={tuning.critMultiplierMul} onChange={(v) => updateTuning('critMultiplierMul', v)} color={STATUS_WARNING} />
          <TuningSlider label="playerHPMul" value={tuning.playerHealthMul} onChange={(v) => updateTuning('playerHealthMul', v)} color={STATUS_SUCCESS} />
          <TuningSlider label="playerArmorMul" value={tuning.playerArmorMul} onChange={(v) => updateTuning('playerArmorMul', v)} color={ACCENT_CYAN} />
          <button
            onClick={() => setTuning({ ...DEFAULT_TUNING })}
            className="w-full text-[9px] font-mono py-1 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors text-text-muted"
          >
            Reset to Default
          </button>
        </SurfaceCard>

        {/* Balance alerts */}
        <BalanceAlertsPanel alerts={simResult.alerts} />

        {/* Quick stats */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
            Simulation Stats
          </div>
          <div className="grid grid-cols-2 gap-1">
            <StatBox label="Duration" value={`${simResult.totalDurationSec.toFixed(1)}s`} color={ACCENT_CYAN} />
            <StatBox label="Player Hits" value={`${simResult.damageEvents.filter((e) => e.source === 'Player').length}`} color={ACCENT_EMERALD} />
            <StatBox label="Enemy Hits" value={`${simResult.damageEvents.filter((e) => e.target === 'Player').length}`} color={STATUS_ERROR} />
            <StatBox label="Crits" value={`${simResult.damageEvents.filter((e) => e.isCrit).length}`} color={STATUS_WARNING} />
          </div>
        </SurfaceCard>

        {/* UE5 Export */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              UE5 Export
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
              >
                {copied ? (
                  <Check className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} />
                ) : (
                  <Copy className="w-2.5 h-2.5 text-text-muted" />
                )}
                <span className="text-text-muted">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([exportConfig], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'EncounterConfig.h';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
              >
                <Download className="w-2.5 h-2.5 text-text-muted" />
                <span className="text-text-muted">.h</span>
              </button>
            </div>
          </div>
          <div className="rounded-md bg-black/50 border border-border/40 overflow-hidden">
            <pre className="p-2 text-[9px] font-mono text-text-muted leading-relaxed overflow-auto max-h-[220px] whitespace-pre">
              {exportConfig}
            </pre>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

// Small stat box helper
/** Balance alerts panel with severity summary bar, auto-scroll, and aria-live */
function BalanceAlertsPanel({ alerts }: { alerts: BalanceAlert[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const firstCritRef = useRef<HTMLDivElement>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const prevAlertsLen = useRef(alerts.length);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const a of alerts) c[a.severity]++;
    return c;
  }, [alerts]);

  // Auto-scroll to first critical alert when alerts change
  useEffect(() => {
    if (alerts.length === 0) { prevAlertsLen.current = 0; return; }
    if (alerts.length !== prevAlertsLen.current) {
      prevAlertsLen.current = alerts.length;
      const critIdx = alerts.findIndex(a => a.severity === 'critical');
      if (critIdx !== -1) {
        setFlashIdx(critIdx);
        requestAnimationFrame(() => {
          firstCritRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        const timer = setTimeout(() => setFlashIdx(null), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [alerts]);

  const SEVERITY_PILLS: { key: BalanceAlertSeverity; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: STATUS_ERROR },
    { key: 'warning', label: 'Warning', color: STATUS_WARNING },
    { key: 'info', label: 'Info', color: STATUS_INFO },
  ];

  return (
    <SurfaceCard level={2} className="p-3 space-y-2">
      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" /> Balance Alerts
      </div>

      {/* Severity summary bar */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {SEVERITY_PILLS.map(s => (
            <span
              key={s.key}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${s.color}20`, color: s.color, opacity: counts[s.key] > 0 ? 1 : 0.35 }}
            >
              {counts[s.key]} {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Alert list */}
      <div ref={listRef} className="max-h-48 overflow-y-auto space-y-1" aria-live="polite" aria-relevant="additions">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 p-2 rounded-md border"
            style={{ borderColor: `${STATUS_SUCCESS}40`, backgroundColor: `${STATUS_SUCCESS}10` }}>
            <span className="text-[10px] font-mono font-bold" style={{ color: STATUS_SUCCESS }}>
              No balance issues detected
            </span>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const color = alert.severity === 'critical' ? STATUS_ERROR
              : alert.severity === 'warning' ? STATUS_WARNING : STATUS_INFO;
            const isFirstCrit = i === alerts.findIndex(a => a.severity === 'critical');
            return (
              <div
                key={i}
                ref={isFirstCrit ? firstCritRef : undefined}
                className="flex items-start gap-1.5 p-1.5 rounded-md border transition-colors"
                style={{
                  borderColor: `${color}30`,
                  backgroundColor: flashIdx === i ? `${color}25` : `${color}08`,
                  transition: 'background-color 0.6s ease-out',
                }}
              >
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color }} />
                <span className="text-[9px] font-mono" style={{ color }}>{alert.message}</span>
              </div>
            );
          })
        )}
      </div>
    </SurfaceCard>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-1.5 rounded-md bg-black/30 border border-border/30 text-center">
      <div className="text-[10px] font-mono font-bold" style={{ color }}>{value}</div>
      <div className="text-[8px] text-text-muted">{label}</div>
    </div>
  );
}
