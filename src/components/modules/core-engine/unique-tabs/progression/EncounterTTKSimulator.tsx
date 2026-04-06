'use client';

import { useMemo, useState } from 'react';
import { Crosshair, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
  withOpacity, OPACITY_5, OPACITY_12, GLOW_MD,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../_shared';
import { BUILD_PRESETS, PLAYER_POWER, ENEMY_DIFFICULTY } from './progression-data';

/* ── Encounter TTK Simulator Data ────────────────────────────────────────── */

interface EnemyType {
  name: string;
  hpMultiplier: number;
  dpsMultiplier: number;
  armorMultiplier: number;
  icon: string;
  color: string;
}

const ENEMY_TYPES: EnemyType[] = [
  { name: 'Trash Mob', hpMultiplier: 0.6, dpsMultiplier: 0.5, armorMultiplier: 0.3, icon: '\u{1F400}', color: STATUS_SUCCESS },
  { name: 'Normal', hpMultiplier: 1.0, dpsMultiplier: 1.0, armorMultiplier: 1.0, icon: '\u2694\uFE0F', color: STATUS_WARNING },
  { name: 'Elite', hpMultiplier: 2.5, dpsMultiplier: 1.8, armorMultiplier: 1.5, icon: '\u{1F6E1}\uFE0F', color: ACCENT_ORANGE },
  { name: 'Champion', hpMultiplier: 5.0, dpsMultiplier: 2.5, armorMultiplier: 2.0, icon: '\u{1F451}', color: ACCENT_VIOLET },
  { name: 'Boss', hpMultiplier: 12.0, dpsMultiplier: 3.5, armorMultiplier: 3.0, icon: '\u{1F480}', color: STATUS_ERROR },
];

const DEFAULT_HEALTHY_RANGE = { min: 2.0, max: 5.0 };

interface EncounterResult {
  playerDPS: number;
  playerEffectiveHP: number;
  enemyHP: number;
  enemyDPS: number;
  playerTTK: number;
  enemyTTK: number;
  ttkRatio: number;
  hitsToKillEnemy: number;
  hitsToKillPlayer: number;
  balanceVerdict: 'trivial' | 'easy' | 'balanced' | 'hard' | 'lethal';
}

function computeEncounter(
  playerLevel: number,
  build: typeof BUILD_PRESETS[number],
  enemy: EnemyType,
  healthyRange: { min: number; max: number },
): EncounterResult {
  const levelIdx = Math.min(Math.floor(playerLevel / 5), PLAYER_POWER.length - 1);
  const levelFrac = (playerLevel % 5) / 5;
  const nextIdx = Math.min(levelIdx + 1, PLAYER_POWER.length - 1);

  const playerPower = PLAYER_POWER[levelIdx] + (PLAYER_POWER[nextIdx] - PLAYER_POWER[levelIdx]) * levelFrac;
  const enemyBase = ENEMY_DIFFICULTY[levelIdx] + (ENEMY_DIFFICULTY[nextIdx] - ENEMY_DIFFICULTY[levelIdx]) * levelFrac;

  const strScale = build.stats.Strength / 50;
  const vitScale = build.stats.Vitality / 50;
  const dexScale = 1 + (build.stats.Dexterity - 50) / 200;

  const basePlayerHP = 100 + playerLevel * 20;
  const playerEffectiveHP = basePlayerHP * vitScale;
  const basePlayerDamage = 10 + playerPower * 0.3;
  const playerDamagePerHit = basePlayerDamage * strScale;
  const attacksPerSecond = 1.2 * dexScale;
  const playerDPS = playerDamagePerHit * attacksPerSecond;

  const enemyHP = enemyBase * enemy.hpMultiplier * 3;
  const enemyDamagePerHit = (enemyBase * 0.15) * enemy.dpsMultiplier;
  const enemyAttacksPerSecond = 0.8;
  const enemyDPS = enemyDamagePerHit * enemyAttacksPerSecond;

  const playerArmor = build.stats.Endurance * 0.5 + playerLevel * 0.3;
  const enemyArmor = enemyBase * 0.1 * enemy.armorMultiplier;
  const playerDR = playerArmor / (playerArmor + 100);
  const enemyDR = enemyArmor / (enemyArmor + 100);

  const effectivePlayerDPS = playerDPS * (1 - enemyDR);
  const effectiveEnemyDPS = enemyDPS * (1 - playerDR);

  const playerTTK = effectivePlayerDPS > 0 ? enemyHP / effectivePlayerDPS : Infinity;
  const enemyTTK = effectiveEnemyDPS > 0 ? playerEffectiveHP / effectiveEnemyDPS : Infinity;
  const ttkRatio = playerTTK > 0 ? enemyTTK / playerTTK : Infinity;

  const hitsToKillEnemy = Math.ceil(enemyHP / Math.max(playerDamagePerHit * (1 - enemyDR), 1));
  const hitsToKillPlayer = Math.ceil(playerEffectiveHP / Math.max(enemyDamagePerHit * (1 - playerDR), 1));

  let balanceVerdict: EncounterResult['balanceVerdict'];
  if (ttkRatio > healthyRange.max * 1.5) balanceVerdict = 'trivial';
  else if (ttkRatio > healthyRange.max) balanceVerdict = 'easy';
  else if (ttkRatio >= healthyRange.min) balanceVerdict = 'balanced';
  else if (ttkRatio >= 1.0) balanceVerdict = 'hard';
  else balanceVerdict = 'lethal';

  return {
    playerDPS: effectivePlayerDPS,
    playerEffectiveHP,
    enemyHP,
    enemyDPS: effectiveEnemyDPS,
    playerTTK,
    enemyTTK,
    ttkRatio,
    hitsToKillEnemy,
    hitsToKillPlayer,
    balanceVerdict,
  };
}

const VERDICT_STYLES: Record<EncounterResult['balanceVerdict'], { color: string; label: string; desc: string }> = {
  trivial: { color: ACCENT_CYAN, label: 'TRIVIAL', desc: 'No challenge \u2014 player massively overleveled' },
  easy: { color: STATUS_SUCCESS, label: 'EASY', desc: 'Low threat \u2014 consider reducing player power or buffing enemy' },
  balanced: { color: STATUS_WARNING, label: 'BALANCED', desc: 'Healthy encounter \u2014 engaging combat' },
  hard: { color: ACCENT_ORANGE, label: 'HARD', desc: 'High tension \u2014 player may die if not careful' },
  lethal: { color: STATUS_ERROR, label: 'LETHAL', desc: 'Near-certain death \u2014 player severely undergeared/underleveled' },
};

export function EncounterTTKSimulator() {
  const [encLevel, setEncLevel] = useState(25);
  const [encBuildIdx, setEncBuildIdx] = useState(0);
  const [encEnemyIdx, setEncEnemyIdx] = useState(1);
  const [encHealthyMin, setEncHealthyMin] = useState(DEFAULT_HEALTHY_RANGE.min);
  const [encHealthyMax, setEncHealthyMax] = useState(DEFAULT_HEALTHY_RANGE.max);

  const encounterResult = useMemo(
    () => computeEncounter(encLevel, BUILD_PRESETS[encBuildIdx], ENEMY_TYPES[encEnemyIdx], { min: encHealthyMin, max: encHealthyMax }),
    [encLevel, encBuildIdx, encEnemyIdx, encHealthyMin, encHealthyMax],
  );

  const verdict = VERDICT_STYLES[encounterResult.balanceVerdict];

  return (
    <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-56 h-56 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${withOpacity(verdict.color, OPACITY_5)}` }} />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <SectionLabel icon={Crosshair} label="Encounter TTK Simulator" color={ACCENT_ORANGE} />
        <div className="flex items-center gap-1.5 text-2xs font-mono px-2 py-1 rounded border" style={{
          color: verdict.color,
          borderColor: `${verdict.color}${OPACITY_30}`,
          backgroundColor: `${verdict.color}${OPACITY_10}`,
        }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: verdict.color, boxShadow: `0 0 6px ${verdict.color}` }} />
          {verdict.label}
        </div>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 relative z-10">
        {/* Player Level */}
        <div className="bg-surface-deep/40 rounded-lg p-3 border border-border/40">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-2xs font-bold uppercase tracking-widest text-text-muted">Player Level</span>
            <span className="text-xs font-mono font-bold" style={{ color: ACCENT_ORANGE }}>{encLevel}</span>
          </div>
          <input
            title="Player Level"
            type="range" min={1} max={50} step={1} value={encLevel}
            onChange={(e) => setEncLevel(Number(e.target.value))}
            className="w-full accent-orange-500 h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1"><span>1</span><span>25</span><span>50</span></div>
        </div>

        {/* Build Preset */}
        <div className="bg-surface-deep/40 rounded-lg p-3 border border-border/40">
          <span className="text-2xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Build Preset</span>
          <div className="flex gap-1.5">
            {BUILD_PRESETS.map((b, idx) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.name}
                  onClick={() => setEncBuildIdx(idx)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold transition-all border"
                  style={{
                    backgroundColor: encBuildIdx === idx ? `${b.color}${OPACITY_15}` : 'transparent',
                    borderColor: encBuildIdx === idx ? `${b.color}${OPACITY_30}` : 'var(--border)',
                    color: encBuildIdx === idx ? b.color : 'var(--text-muted)',
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Enemy Type */}
        <div className="bg-surface-deep/40 rounded-lg p-3 border border-border/40">
          <span className="text-2xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Enemy Type</span>
          <div className="flex gap-1 flex-wrap">
            {ENEMY_TYPES.map((et, idx) => (
              <button
                key={et.name}
                onClick={() => setEncEnemyIdx(idx)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all border"
                style={{
                  backgroundColor: encEnemyIdx === idx ? `${et.color}${OPACITY_15}` : 'transparent',
                  borderColor: encEnemyIdx === idx ? `${et.color}${OPACITY_30}` : 'var(--border)',
                  color: encEnemyIdx === idx ? et.color : 'var(--text-muted)',
                }}
              >
                <span>{et.icon}</span>
                {et.name}
              </button>
            ))}
          </div>
        </div>

        {/* Healthy Range Config */}
        <div className="bg-surface-deep/40 rounded-lg p-3 border border-border/40">
          <span className="text-2xs font-bold uppercase tracking-widest text-text-muted block mb-1.5">Healthy TTK Ratio</span>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-text-muted">Min</label>
              <input
                title="Min healthy ratio"
                type="number" min={1} max={10} step={0.5}
                value={encHealthyMin}
                onChange={(e) => setEncHealthyMin(Number(e.target.value))}
                className="w-full bg-surface-deep border border-border/40 rounded px-2 py-1 text-xs font-mono text-text focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <span className="text-text-muted text-xs mt-3">:</span>
            <div className="flex-1">
              <label className="text-xs text-text-muted">Max</label>
              <input
                title="Max healthy ratio"
                type="number" min={1} max={20} step={0.5}
                value={encHealthyMax}
                onChange={(e) => setEncHealthyMax(Number(e.target.value))}
                className="w-full bg-surface-deep border border-border/40 rounded px-2 py-1 text-xs font-mono text-text focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
          <div className="text-xs text-text-muted mt-1">e.g. 2:1 to 5:1 (enemy dies faster)</div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {/* Stats Grid */}
        <div className="bg-surface-deep/30 rounded-xl p-4 border border-border/40">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Player DPS</div>
              <div className="text-xl font-mono font-bold" style={{ color: STATUS_SUCCESS }}>{encounterResult.playerDPS.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Enemy DPS</div>
              <div className="text-xl font-mono font-bold" style={{ color: STATUS_ERROR }}>{encounterResult.enemyDPS.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Player Eff. HP</div>
              <div className="text-xl font-mono font-bold" style={{ color: ACCENT_EMERALD }}>{Math.round(encounterResult.playerEffectiveHP).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Enemy HP</div>
              <div className="text-xl font-mono font-bold" style={{ color: ACCENT_VIOLET }}>{Math.round(encounterResult.enemyHP).toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-0.5">Player TTK</div>
              <div className="text-sm font-mono font-bold" style={{ color: STATUS_SUCCESS }}>
                {encounterResult.playerTTK < 999 ? `${encounterResult.playerTTK.toFixed(1)}s` : '\u221E'}
              </div>
              <div className="text-xs text-text-muted">{encounterResult.hitsToKillEnemy} hits</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-0.5">Enemy TTK</div>
              <div className="text-sm font-mono font-bold" style={{ color: STATUS_ERROR }}>
                {encounterResult.enemyTTK < 999 ? `${encounterResult.enemyTTK.toFixed(1)}s` : '\u221E'}
              </div>
              <div className="text-xs text-text-muted">{encounterResult.hitsToKillPlayer} hits</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-0.5">TTK Ratio</div>
              <div className="text-sm font-mono font-bold" style={{ color: verdict.color }}>
                {encounterResult.ttkRatio < 99 ? `${encounterResult.ttkRatio.toFixed(2)}:1` : '\u221E:1'}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Gauge + Warnings */}
        <div className="bg-surface-deep/30 rounded-xl p-4 border border-border/40 flex flex-col">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Balance Gauge</div>
          <div className="relative h-6 bg-surface-deep rounded-full border border-border/40 overflow-hidden mb-2">
            <div className="absolute inset-0 flex">
              <div className="h-full" style={{ width: '15%', backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_12)}` }} />
              <div className="h-full" style={{ width: '15%', backgroundColor: `${withOpacity(ACCENT_ORANGE, OPACITY_10)}` }} />
              <div className="h-full" style={{ width: '40%', backgroundColor: `${withOpacity(STATUS_WARNING, OPACITY_10)}` }} />
              <div className="h-full" style={{ width: '15%', backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_10)}` }} />
              <div className="h-full" style={{ width: '15%', backgroundColor: `${withOpacity(ACCENT_CYAN, OPACITY_10)}` }} />
            </div>
            <div className="absolute inset-0 flex items-center text-[9px] font-mono text-text-muted">
              <span className="w-[15%] text-center">Lethal</span>
              <span className="w-[15%] text-center">Hard</span>
              <span className="w-[40%] text-center">Balanced</span>
              <span className="w-[15%] text-center">Easy</span>
              <span className="w-[15%] text-center">Trivial</span>
            </div>
            {(() => {
              const r = encounterResult.ttkRatio;
              const pct = r <= 1 ? Math.max(0, r / 1 * 15)
                : r <= encHealthyMin ? 15 + ((r - 1) / (encHealthyMin - 1)) * 15
                : r <= encHealthyMax ? 30 + ((r - encHealthyMin) / (encHealthyMax - encHealthyMin)) * 40
                : r <= encHealthyMax * 1.5 ? 70 + ((r - encHealthyMax) / (encHealthyMax * 0.5)) * 15
                : Math.min(100, 85 + ((r - encHealthyMax * 1.5) / (encHealthyMax * 0.5)) * 15);
              return (
                <motion.div
                  className="absolute top-0 bottom-0 w-1 rounded-full"
                  style={{ backgroundColor: verdict.color, boxShadow: `${GLOW_MD} ${verdict.color}` }}
                  animate={{ left: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                />
              );
            })()}
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: verdict.color }} />
              <span className="text-sm font-bold" style={{ color: verdict.color }}>
                {verdict.label}
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {verdict.desc}
            </p>

            {encounterResult.balanceVerdict !== 'balanced' && (
              <div className="mt-2 space-y-1">
                {encounterResult.ttkRatio < encHealthyMin && (
                  <div className="text-xs font-mono px-2 py-1 rounded border" style={{
                    color: STATUS_ERROR,
                    borderColor: `${STATUS_ERROR}${OPACITY_20}`,
                    backgroundColor: `${STATUS_ERROR}${OPACITY_10}`,
                  }}>
                    TTK ratio {encounterResult.ttkRatio.toFixed(2)}:1 below minimum {encHealthyMin}:1 — player dies too quickly
                  </div>
                )}
                {encounterResult.ttkRatio > encHealthyMax && (
                  <div className="text-xs font-mono px-2 py-1 rounded border" style={{
                    color: ACCENT_CYAN,
                    borderColor: `${ACCENT_CYAN}${OPACITY_20}`,
                    backgroundColor: `${ACCENT_CYAN}${OPACITY_10}`,
                  }}>
                    TTK ratio {encounterResult.ttkRatio.toFixed(2)}:1 above maximum {encHealthyMax}:1 — encounter too easy
                  </div>
                )}
                {encounterResult.hitsToKillEnemy <= 2 && (
                  <div className="text-xs font-mono px-2 py-1 rounded border" style={{
                    color: STATUS_WARNING,
                    borderColor: `${STATUS_WARNING}${OPACITY_20}`,
                    backgroundColor: `${STATUS_WARNING}${OPACITY_10}`,
                  }}>
                    Enemy dies in {encounterResult.hitsToKillEnemy} hit{encounterResult.hitsToKillEnemy > 1 ? 's' : ''} — no combat engagement
                  </div>
                )}
                {encounterResult.hitsToKillPlayer <= 3 && (
                  <div className="text-xs font-mono px-2 py-1 rounded border" style={{
                    color: STATUS_ERROR,
                    borderColor: `${STATUS_ERROR}${OPACITY_20}`,
                    backgroundColor: `${STATUS_ERROR}${OPACITY_10}`,
                  }}>
                    Player dies in {encounterResult.hitsToKillPlayer} hit{encounterResult.hitsToKillPlayer > 1 ? 's' : ''} — feels unfair
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-border/40 text-xs text-text-muted font-mono">
            Healthy range: {encHealthyMin}:1 – {encHealthyMax}:1 | {BUILD_PRESETS[encBuildIdx].name} Lv{encLevel} vs {ENEMY_TYPES[encEnemyIdx].name}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
