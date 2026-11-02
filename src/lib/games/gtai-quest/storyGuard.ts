import type { StoryGraph } from '@/lib/story/types';
import type { GuardVerdict, QuestDesign, QuestGuardContext } from '@/lib/games/gtai-quest/types';

/** STUB (WP0) — WP1 implements. The GTAI campaign baseline (pitch.md §2) as `pof.storygraph/1`,
 *  project `gtai`, with every accepted ledger quest merged in as a `container` of class `contract`. */
export function buildCampaignGraph(ledger: QuestGuardContext['ledger']): StoryGraph {
  void ledger;
  throw new Error('buildCampaignGraph: not implemented (WP1)');
}

/** Variables only the owner may set; no quest may write them (protected unknowns). */
export const PROTECTED_VARS: readonly string[] = [];

/** STUB (WP0) — WP1 implements: findings diff before/after merging `design`, protected-var writes,
 *  cast continuity (`existing` characters must be in `ctx.cast`). */
export function assessStory(subject: string, design: QuestDesign, ctx: QuestGuardContext): GuardVerdict {
  void subject; void design; void ctx;
  return { guard: 'story', state: 'unmeasured', basis: 'not implemented', findings: [] };
}

