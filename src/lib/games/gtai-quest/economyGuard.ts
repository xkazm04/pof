/**
 * Economy guard: a quest's reward and difficulty against the per-act table
 * (`games/gtai/balance/quest-economy.json`, PROVISIONAL, owner-tunable).
 *
 * Shaped by the registry's `game-economy-tuning/techniques/faucet-sink-balance-band`:
 *  - a number carries its basis: every verdict names the table revision it was scored against;
 *  - unmeasured is not a pass: no table means `unmeasured`, never green;
 *  - severity escalates at a stated multiple of the tolerance: cash just outside the band (within
 *    25% of the bound it crossed) is `warn`, farther out is `error`. A bound of 0 has no tolerance.
 *  - a faucet is read beside its sink: an `info` finding states the cash as a fraction of the
 *    cheapest soul-upgrade tier, the main cash sink.
 * Pure: the caller loads the table.
 */

import { ACT_SOUL } from '@/lib/games/gtai-quest/campaignBaseline';
import type { GuardFinding, GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** The tolerance band around the cash bounds, as a fraction of the bound crossed. */
export const CASH_TOLERANCE = 0.25;

export function assessEconomy(design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  const table = ctx.economy;
  if (table === null) {
    return { guard: 'economy', state: 'unmeasured', basis: 'no quest-economy table', findings: [] };
  }
  const basis = `quest-economy.json r${table.revision}${table.provisional ? ' (provisional)' : ''}`;
  const band = table.acts[design.act];
  if (!band) {
    return { guard: 'economy', state: 'unmeasured', basis: `${basis}: no row for ${design.act}`, findings: [] };
  }
  const findings: GuardFinding[] = [];
  const { reward, difficulty: d } = design;

  const { min, max } = band.cash;
  if (reward.cash < min || reward.cash > max) {
    const near = reward.cash < min ? reward.cash >= min * (1 - CASH_TOLERANCE) : reward.cash <= max * (1 + CASH_TOLERANCE);
    findings.push({
      code: 'CASH_OUT_OF_BAND',
      severity: near ? 'warn' : 'error',
      message: `cash ${reward.cash} outside ${design.act} band ${min}-${max}${near ? ` (within ${CASH_TOLERANCE * 100}%)` : ''}`,
    });
  }
  if (d.heatPeak > band.heatCeiling) {
    findings.push({ code: 'HEAT_OVER_CEILING', severity: 'error', message: `heat ${d.heatPeak} over ${design.act} ceiling ${band.heatCeiling}` });
  }
  if (d.enemyCount > band.enemyCount.max) {
    findings.push({ code: 'ENEMIES_OVER_BUDGET', severity: 'error', message: `${d.enemyCount} enemies over ${design.act} budget ${band.enemyCount.max}` });
  }
  if (d.enemyWaves > band.enemyWaves.max) {
    findings.push({ code: 'WAVES_OVER_BUDGET', severity: 'error', message: `${d.enemyWaves} waves over ${design.act} budget ${band.enemyWaves.max}` });
  }
  if (d.timeLimitS !== null && !band.timerAllowed) {
    findings.push({ code: 'TIMER_NOT_ALLOWED', severity: 'error', message: `a ${d.timeLimitS}s timer, but ${design.act} allows none` });
  }
  if (d.minutes < band.minutes.min || d.minutes > band.minutes.max) {
    findings.push({ code: 'MINUTES_OUT_OF_BAND', severity: 'warn', message: `${d.minutes} min outside ${design.act} band ${band.minutes.min}-${band.minutes.max}` });
  }
  if (d.failStates.length === 0) {
    findings.push({ code: 'NO_FAIL_STATE', severity: 'error', message: 'no fail state: the quest cannot be lost' });
  }
  const actSoul = ACT_SOUL[design.act];
  for (const u of reward.unlocks) {
    if (!u.startsWith('soul:')) continue;
    const soul = u.slice('soul:'.length);
    if (soul !== actSoul) {
      findings.push({
        code: 'SOUL_UNLOCK_WRONG_ACT', severity: 'error', ref: u,
        message: `unlocks ${soul} in ${design.act}; ${actSoul ? `only ${actSoul} unlocks here` : 'no soul unlocks here'}`,
      });
    }
  }

  const cheapest = table.soulUpgradePrices.length ? Math.min(...table.soulUpgradePrices) : null;
  findings.push({
    code: 'CASH_VS_SOUL_UPGRADE',
    severity: 'info',
    message: cheapest === null || cheapest <= 0
      ? 'no soul-upgrade price in the table: sink context unmeasured'
      : `cash ${reward.cash} = ${(reward.cash / cheapest).toFixed(2)} x the cheapest soul-upgrade tier (${cheapest})`,
  });

  return { guard: 'economy', state: findings.some((f) => f.severity === 'error') ? 'red' : 'green', basis, findings };
}
