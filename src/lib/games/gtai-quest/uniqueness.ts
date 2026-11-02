import type { GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** STUB (WP0) — WP1 implements: fingerprint comparison against every OTHER ledger quest (`selfId` skipped). */
export function assessUniqueness(design: QuestDesign, ctx: QuestGuardContext, selfId?: string): GuardVerdict {
  void design; void ctx; void selfId;
  return { guard: 'uniqueness', state: 'unmeasured', basis: 'not implemented', findings: [] };
}
