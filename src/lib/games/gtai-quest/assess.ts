import { assessEconomy } from '@/lib/games/gtai-quest/economyGuard';
import { assessLines } from '@/lib/games/gtai-quest/lineGuard';
import { assessStory } from '@/lib/games/gtai-quest/storyGuard';
import { assessUniqueness } from '@/lib/games/gtai-quest/uniqueness';
import type {
  GuardId,
  GuardOverride,
  GuardVerdict,
  QuestDesign,
  QuestGuardContext,
  QuestVerdict,
} from '@/lib/games/gtai-quest/types';

/**
 * Run every guard on one quest design (a council path or a package). Pure: the caller loads the context.
 * A red guard blocks unless an override for it exists. `unmeasured` never blocks and never passes —
 * the pipeline's acceptance treats it as "not yet".
 */
export function assessQuest(
  subject: string,
  design: QuestDesign,
  ctx: QuestGuardContext,
  overrides: readonly GuardOverride[] = [],
  selfId?: string,
): QuestVerdict {
  const guards: GuardVerdict[] = [
    assessStory(subject, design, ctx),
    assessEconomy(design, ctx),
    assessLines(design, ctx),
    assessUniqueness(design, ctx, selfId),
  ];
  const overridden = new Set<GuardId>(overrides.filter((o) => o.reason.trim().length > 0).map((o) => o.guard));
  const blockedBy = guards.filter((g) => g.state === 'red' && !overridden.has(g.guard)).map((g) => g.guard);
  return { subject, guards, blockedBy, blocked: blockedBy.length > 0 };
}

/** A verdict's state from its findings: red iff any error. */
export function stateOf(findings: readonly { severity: string }[]): 'green' | 'red' {
  return findings.some((f) => f.severity === 'error') ? 'red' : 'green';
}
