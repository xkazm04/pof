import type { GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** STUB (WP0) — WP1 implements: structural line checks + the cross-family judge report when present. */
export function assessLines(design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  void design; void ctx;
  return { guard: 'lines', state: 'unmeasured', basis: 'not implemented', findings: [] };
}
