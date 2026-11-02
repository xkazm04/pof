import type { GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** STUB (WP0) — WP1 implements: reward and difficulty against `ctx.economy.acts[design.act]`. */
export function assessEconomy(design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  void design; void ctx;
  return { guard: 'economy', state: 'unmeasured', basis: 'not implemented', findings: [] };
}
