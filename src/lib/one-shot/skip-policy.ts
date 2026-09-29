import type { ArchetypeId, ViewDescriptor, AcceptanceTier, SkipDecision, CustomAutoHint } from './types';
import { isCliEligible } from '@/lib/catalog/cliEligibility';

/**
 * Who authors a one-shot step. Art (gallery) and runtime gates (L3/L4) are immune to any hint.
 * An operator's per-step choice (`hint.autoMode` 'cli' | 'deterministic') is honoured only for a
 * model-authorable archetype (`isCliEligible` — the lab's own rule); with no hint every step
 * keeps its default: brief/graph → the model, everything else → its built-in produce.
 */
export function decide(
  archetype: ArchetypeId,
  tier: AcceptanceTier,
  view: ViewDescriptor,
  hint?: CustomAutoHint,
): SkipDecision {
  void view; // the author no longer depends on the view shape (`rules` ratchets to table/manifest)
  if (archetype === 'gallery') return { mode: 'skip-needs-art' };
  if (tier === 'L3')           return { mode: 'defer-runtime', tier: 'L3' };
  if (tier === 'L4')           return { mode: 'defer-runtime', tier: 'L4' };
  if (isCliEligible(archetype) && hint?.autoMode === 'cli')           return { mode: 'run-cli' };
  if (isCliEligible(archetype) && hint?.autoMode === 'deterministic') return { mode: 'run-deterministic' };
  if (archetype === 'brief')   return { mode: 'run-cli' };
  if (archetype === 'graph')   return { mode: 'run-cli' };
  if (archetype === 'custom' && hint?.autoMode === 'cli')  return { mode: 'run-cli' };
  if (archetype === 'custom' && hint?.autoMode === 'skip') return { mode: 'skip-needs-art' };
  return { mode: 'run-deterministic' };
}
